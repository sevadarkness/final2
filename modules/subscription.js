/**
 * 💳 SubscriptionModule - Sistema de Assinaturas e Créditos
 * WhatsHybrid v49 - Baseado no SubscriptionManager do Quantum CRM
 * 
 * Funcionalidades:
 * - Planos: Free, Starter, Pro, Enterprise
 * - Créditos de IA com consumo e alertas
 * - Limites diários (mensagens, mídias, exports)
 * - Feature gates por plano
 * - Trial de 7 dias
 * - Sincronização com storage
 * - Widget de status premium
 */

(function() {
    'use strict';

    // ============================================
    // CONFIGURAÇÃO DE PLANOS
    // ============================================

    const PLANS = {
        free: {
            id: 'free',
            name: 'Gratuito',
            icon: '🆓',
            price: 0,
            color: '#6B7280',
            features: {
                maxContacts: 100,
                maxChatsPerDay: 20,
                maxCampaigns: 1,
                maxFlows: 1,
                aiCredits: 0,
                smartReplies: false,
                copilot: false,
                analytics: false,
                bulkMessages: false,
                customLabels: false,
                apiAccess: false,
                prioritySupport: false,
                exportFormats: ['csv']
            },
            limits: {
                messagesPerDay: 50,
                mediaPerDay: 10,
                exportsPerDay: 1
            }
        },
        starter: {
            id: 'starter',
            name: 'Starter',
            icon: '⭐',
            price: 29.90,
            color: '#3B82F6',
            features: {
                maxContacts: 1000,
                maxChatsPerDay: 100,
                maxCampaigns: 5,
                maxFlows: 3,
                aiCredits: 100,
                smartReplies: true,
                copilot: false,
                analytics: 'basic',
                bulkMessages: true,
                customLabels: true,
                apiAccess: false,
                prioritySupport: false,
                exportFormats: ['csv', 'xlsx']
            },
            limits: {
                messagesPerDay: 500,
                mediaPerDay: 100,
                exportsPerDay: 10
            }
        },
        pro: {
            id: 'pro',
            name: 'Pro',
            icon: '💎',
            price: 79.90,
            color: '#8B5CF6',
            features: {
                maxContacts: 10000,
                maxChatsPerDay: -1, // ilimitado
                maxCampaigns: 20,
                maxFlows: 10,
                aiCredits: 500,
                smartReplies: true,
                copilot: true,
                analytics: 'advanced',
                bulkMessages: true,
                customLabels: true,
                apiAccess: true,
                prioritySupport: true,
                exportFormats: ['csv', 'xlsx', 'json']
            },
            limits: {
                messagesPerDay: 2000,
                mediaPerDay: 500,
                exportsPerDay: -1
            }
        },
        enterprise: {
            id: 'enterprise',
            name: 'Enterprise',
            icon: '🏢',
            price: 199.90,
            color: '#F59E0B',
            features: {
                maxContacts: -1,
                maxChatsPerDay: -1,
                maxCampaigns: -1,
                maxFlows: -1,
                aiCredits: 2000,
                smartReplies: true,
                copilot: true,
                analytics: 'full',
                bulkMessages: true,
                customLabels: true,
                apiAccess: true,
                prioritySupport: true,
                exportFormats: ['csv', 'xlsx', 'json', 'pdf']
            },
            limits: {
                messagesPerDay: -1,
                mediaPerDay: -1,
                exportsPerDay: -1
            }
        }
    };

    const STORAGE_KEY = 'whl_subscription_v2';
    const CREDITS_STORAGE_KEY = 'whl_ai_credits_v2';

    const THRESHOLDS = {
        LOW_CREDITS: 10,
        CRITICAL_CREDITS: 5,
        LOW_LIMIT_PERCENT: 80
    };

    // ============================================
    // ESTADO
    // ============================================

    let subscription = {
        planId: 'free',
        status: 'active',           // active, trial, expired, cancelled
        expiresAt: null,
        trialEndsAt: null,
        activatedAt: null,
        licenseKey: null
    };

    let credits = {
        total: 0,
        used: 0,
        remaining: 0,
        lastUpdated: null
    };

    let usage = {
        messagesToday: 0,
        mediaToday: 0,
        exportsToday: 0,
        contactsTotal: 0,
        campaignsActive: 0,
        lastReset: null
    };

    let listeners = new Map();
    let initialized = false;

    // ============================================
    // STORAGE
    // ============================================

    async function loadData() {
        try {
            const result = await chrome.storage.local.get([STORAGE_KEY, CREDITS_STORAGE_KEY]);
            
            if (result[STORAGE_KEY]) {
                subscription = { ...subscription, ...result[STORAGE_KEY].subscription };
                usage = { ...usage, ...result[STORAGE_KEY].usage };
            }
            
            if (result[CREDITS_STORAGE_KEY]) {
                credits = { ...credits, ...result[CREDITS_STORAGE_KEY] };
            }
            
            // Verificar se precisa resetar contadores diários
            checkDailyReset();
            
        } catch (error) {
            console.error('[Subscription] Erro ao carregar:', error);
        }
    }

    async function saveData() {
        try {
            await chrome.storage.local.set({
                [STORAGE_KEY]: { subscription, usage },
                [CREDITS_STORAGE_KEY]: credits
            });
        } catch (error) {
            console.error('[Subscription] Erro ao salvar:', error);
        }
    }

    function checkDailyReset() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        if (usage.lastReset !== today) {
            usage.messagesToday = 0;
            usage.mediaToday = 0;
            usage.exportsToday = 0;
            usage.lastReset = today;
            saveData();
            emit('daily_reset', usage);
        }
    }

    // ============================================
    // INICIALIZAÇÃO
    // ============================================

    async function init() {
        if (initialized) return;
        
        console.log('[Subscription] Inicializando...');
        
        await loadData();
        
        // Verificar status
        checkSubscriptionStatus();
        
        // Agendar reset diário
        scheduleDailyReset();
        
        initialized = true;
        
        // Emitir evento
        if (window.EventBus) {
            window.EventBus.emit(window.EventBus.EVENTS.MODULE_LOADED, { module: 'Subscription' });
        }
        
        console.log('[Subscription] Plano atual:', subscription.planId);
    }

    function scheduleDailyReset() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const msUntilMidnight = tomorrow - now;
        
        setTimeout(() => {
            checkDailyReset();
            scheduleDailyReset();
        }, msUntilMidnight);
    }

    function checkSubscriptionStatus() {
        const now = new Date();
        
        // Verificar trial
        if (subscription.status === 'trial' && subscription.trialEndsAt) {
            const trialEnd = new Date(subscription.trialEndsAt);
            if (now > trialEnd) {
                subscription.status = 'expired';
                subscription.planId = 'free';
                saveData();
                emit('trial_expired', subscription);
            }
        }
        
        // Verificar expiração
        if (subscription.expiresAt) {
            const expires = new Date(subscription.expiresAt);
            if (now > expires) {
                subscription.status = 'expired';
                saveData();
                emit('subscription_expired', subscription);
            }
        }
    }

    // ============================================
    // GETTERS
    // ============================================

    function getSubscription() {
        return { ...subscription };
    }

    function getPlan() {
        return PLANS[subscription.planId] || PLANS.free;
    }

    function getPlanId() {
        return subscription.planId;
    }

    function getFeature(featureName) {
        const plan = getPlan();
        return plan.features[featureName];
    }

    function getLimit(limitName) {
        const plan = getPlan();
        return plan.limits[limitName];
    }

    function getUsage() {
        return { ...usage };
    }

    function getCredits() {
        return { ...credits };
    }

    function getCreditsStatus() {
        const remaining = credits.remaining;
        const total = credits.total || remaining;
        const used = credits.used || 0;
        const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
        
        let status = 'ok';
        let statusText = 'Créditos OK';
        let color = 'var(--mod-success)';
        
        if (remaining <= 0) {
            status = 'critical';
            statusText = 'Sem créditos';
            color = 'var(--mod-error)';
        } else if (remaining <= THRESHOLDS.CRITICAL_CREDITS) {
            status = 'critical';
            statusText = 'Créditos críticos';
            color = 'var(--mod-error)';
        } else if (remaining <= THRESHOLDS.LOW_CREDITS) {
            status = 'warning';
            statusText = 'Poucos créditos';
            color = 'var(--mod-warning)';
        }
        
        return { remaining, used, total, percentage, status, statusText, color };
    }

    function isActive() {
        return subscription.status === 'active' || subscription.status === 'trial';
    }

    function isTrial() {
        return subscription.status === 'trial';
    }

    function getTrialDaysRemaining() {
        if (!isTrial() || !subscription.trialEndsAt) return 0;
        
        const now = new Date();
        const end = new Date(subscription.trialEndsAt);
        const diff = end - now;
        
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    // ============================================
    // VERIFICAÇÕES
    // ============================================

    function hasFeature(featureName) {
        const feature = getFeature(featureName);
        return feature === true || feature === 'basic' || feature === 'advanced' || feature === 'full';
    }

    function canUseAI() {
        const plan = getPlan();
        return plan.features.aiCredits > 0 && credits.remaining > 0;
    }

    function checkLimit(limitName, currentValue) {
        const limit = getLimit(limitName);
        
        if (limit === -1) {
            return { allowed: true, remaining: -1, percentage: 0 };
        }
        
        const remaining = Math.max(0, limit - currentValue);
        const percentage = Math.round((currentValue / limit) * 100);
        
        return {
            allowed: currentValue < limit,
            remaining,
            percentage,
            limit,
            current: currentValue
        };
    }

    function canPerformAction(action) {
        const plan = getPlan();
        
        switch (action) {
            case 'send_message':
                return checkLimit('messagesPerDay', usage.messagesToday);
                
            case 'send_media':
                return checkLimit('mediaPerDay', usage.mediaToday);
                
            case 'export':
                return checkLimit('exportsPerDay', usage.exportsToday);
                
            case 'use_copilot':
                if (!plan.features.copilot) {
                    return { allowed: false, reason: 'feature_locked', message: 'Copilot não disponível no seu plano' };
                }
                if (!canUseAI()) {
                    return { allowed: false, reason: 'no_credits', message: 'Créditos de IA esgotados' };
                }
                return { allowed: true };
                
            case 'use_smart_replies':
                if (!plan.features.smartReplies) {
                    return { allowed: false, reason: 'feature_locked', message: 'Smart Replies não disponível no seu plano' };
                }
                if (!canUseAI()) {
                    return { allowed: false, reason: 'no_credits', message: 'Créditos de IA esgotados' };
                }
                return { allowed: true };
                
            case 'view_analytics':
                if (!plan.features.analytics) {
                    return { allowed: false, reason: 'feature_locked', message: 'Analytics não disponível no seu plano' };
                }
                return { allowed: true };
                
            case 'create_campaign':
                const campaigns = checkLimit('maxCampaigns', usage.campaignsActive);
                if (!campaigns.allowed) {
                    return { allowed: false, reason: 'limit_reached', message: 'Limite de campanhas atingido' };
                }
                return { allowed: true };
                
            default:
                return { allowed: true };
        }
    }

    // ============================================
    // CONSUMO DE RECURSOS
    // ============================================

    async function consumeCredit(amount = 1) {
        if (credits.remaining < amount) {
            throw new Error('Créditos insuficientes');
        }
        
        credits.remaining -= amount;
        credits.used += amount;
        credits.lastUpdated = new Date().toISOString();
        
        await saveData();
        emit('credits_updated', getCreditsStatus());
        
        // Verificar alertas
        const status = getCreditsStatus();
        if (status.status === 'warning') {
            emit('credits_low', status);
        } else if (status.status === 'critical') {
            emit('credits_depleted', status);
        }
        
        return status;
    }

    async function addCredits(amount) {
        credits.remaining += amount;
        credits.total += amount;
        credits.lastUpdated = new Date().toISOString();
        
        await saveData();
        emit('credits_added', { amount, ...getCreditsStatus() });
        
        return getCreditsStatus();
    }

    async function incrementUsage(type, amount = 1) {
        const keyMap = {
            message: 'messagesToday',
            media: 'mediaToday',
            export: 'exportsToday',
            contact: 'contactsTotal',
            campaign: 'campaignsActive'
        };
        
        const key = keyMap[type];
        if (!key) return;
        
        usage[key] = (usage[key] || 0) + amount;
        await saveData();
        
        // Verificar limites
        const limitMap = {
            message: 'messagesPerDay',
            media: 'mediaPerDay',
            export: 'exportsPerDay'
        };
        
        const limitKey = limitMap[type];
        if (limitKey) {
            const check = checkLimit(limitKey, usage[key]);
            if (check.percentage >= THRESHOLDS.LOW_LIMIT_PERCENT) {
                emit('limit_warning', { type, ...check });
            }
        }
        
        emit('usage_updated', usage);
    }

    async function decrementUsage(type, amount = 1) {
        const keyMap = {
            campaign: 'campaignsActive',
            contact: 'contactsTotal'
        };
        
        const key = keyMap[type];
        if (!key) return;
        
        usage[key] = Math.max(0, (usage[key] || 0) - amount);
        await saveData();
        emit('usage_updated', usage);
    }

    // ============================================
    // UPGRADE / TRIAL
    // ============================================

    async function activatePlan(planId, options = {}) {
        if (!PLANS[planId]) {
            throw new Error(`Plano inválido: ${planId}`);
        }
        
        const plan = PLANS[planId];
        
        subscription.planId = planId;
        subscription.status = 'active';
        subscription.activatedAt = new Date().toISOString();
        subscription.expiresAt = options.expiresAt || null;
        subscription.licenseKey = options.licenseKey || null;
        
        // Adicionar créditos do plano
        if (plan.features.aiCredits > 0) {
            credits.total = plan.features.aiCredits;
            credits.remaining = plan.features.aiCredits;
            credits.used = 0;
        }
        
        await saveData();
        emit('plan_activated', { planId, plan: subscription });
        
        if (window.NotificationsModule) {
            window.NotificationsModule.success(`Plano ${plan.name} ativado!`);
        }
        
        return subscription;
    }

    async function startTrial(planId = 'pro', days = 7) {
        if (!PLANS[planId]) {
            throw new Error(`Plano inválido: ${planId}`);
        }
        
        const plan = PLANS[planId];
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + days);
        
        subscription.planId = planId;
        subscription.status = 'trial';
        subscription.trialEndsAt = trialEnd.toISOString();
        subscription.activatedAt = new Date().toISOString();
        
        // Créditos de trial (metade do plano)
        if (plan.features.aiCredits > 0) {
            const trialCredits = Math.floor(plan.features.aiCredits / 2);
            credits.total = trialCredits;
            credits.remaining = trialCredits;
            credits.used = 0;
        }
        
        await saveData();
        emit('trial_started', { planId, endsAt: trialEnd, daysRemaining: days });
        
        if (window.NotificationsModule) {
            window.NotificationsModule.success(`Trial ${plan.name} iniciado! ${days} dias grátis.`);
        }
        
        return subscription;
    }

    async function cancelSubscription() {
        subscription.status = 'cancelled';
        await saveData();
        emit('subscription_cancelled', subscription);
        
        return subscription;
    }

    function getUpgradeUrl(planId) {
        return `https://whatshybrid.com/upgrade?plan=${planId}&ref=extension`;
    }

    function getManageUrl() {
        return 'https://whatshybrid.com/account/subscription';
    }

    // ============================================
    // EVENTOS
    // ============================================

    function on(event, callback) {
        if (!listeners.has(event)) {
            listeners.set(event, []);
        }
        listeners.get(event).push(callback);
        return () => off(event, callback);
    }

    function off(event, callback) {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.indexOf(callback);
            if (index > -1) eventListeners.splice(index, 1);
        }
    }

    function emit(event, data) {
        // Internal listeners
        if (listeners.has(event)) {
            listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error('[Subscription] Erro em listener:', e);
                }
            });
        }
        
        // Bridge para EventBus
        if (window.EventBus) {
            window.EventBus.emit(`subscription:${event}`, data);
        }
    }

    // ============================================
    // RENDERIZAÇÃO
    // ============================================

    function renderStatusWidget(container) {
        const plan = getPlan();
        const creditsStatus = getCreditsStatus();
        const trialDays = getTrialDaysRemaining();
        
        const html = `
            <div class="mod-card" style="background:linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.1))">
                <!-- Plano atual -->
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                    <div>
                        <div style="font-size:24px">${plan.icon}</div>
                        <div style="font-size:18px;font-weight:700;margin-top:4px">${plan.name}</div>
                        ${isTrial() ? `
                            <div class="mod-badge mod-badge-warning">
                                ⏱️ Trial - ${trialDays} dias restantes
                            </div>
                        ` : ''}
                    </div>
                    <div style="text-align:right">
                        ${plan.price > 0 ? `
                            <div style="font-size:24px;font-weight:800;color:${plan.color}">
                                R$ ${plan.price.toFixed(2)}
                            </div>
                            <div style="font-size:11px;color:var(--mod-text-muted)">/mês</div>
                        ` : `
                            <div style="font-size:20px;font-weight:700;color:var(--mod-text-muted)">Gratuito</div>
                        `}
                    </div>
                </div>
                
                <!-- Créditos de IA -->
                ${plan.features.aiCredits > 0 ? `
                    <div class="mod-card" style="background:rgba(0,0,0,0.2);padding:12px;margin-bottom:12px">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                            <span style="font-size:12px;color:var(--mod-text-muted)">🤖 Créditos de IA</span>
                            <span class="mod-badge" style="background:${creditsStatus.color};color:white">
                                ${creditsStatus.remaining} / ${creditsStatus.total}
                            </span>
                        </div>
                        <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">
                            <div style="height:100%;width:${100 - creditsStatus.percentage}%;background:${creditsStatus.color};transition:width 0.3s"></div>
                        </div>
                        <div style="font-size:11px;color:var(--mod-text-muted);margin-top:4px">
                            ${creditsStatus.statusText}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Uso diário -->
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
                    ${renderUsageItem('📨', 'Mensagens', usage.messagesToday, getLimit('messagesPerDay'))}
                    ${renderUsageItem('📎', 'Mídias', usage.mediaToday, getLimit('mediaPerDay'))}
                    ${renderUsageItem('📤', 'Exports', usage.exportsToday, getLimit('exportsPerDay'))}
                </div>
                
                <!-- Features -->
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
                    ${renderFeatureBadge('smartReplies', '🤖 Smart Replies')}
                    ${renderFeatureBadge('copilot', '✨ Copilot')}
                    ${renderFeatureBadge('analytics', '📊 Analytics')}
                    ${renderFeatureBadge('bulkMessages', '📨 Envio em Massa')}
                    ${renderFeatureBadge('apiAccess', '🔌 API')}
                </div>
                
                <!-- Ações -->
                <div class="sp-row">
                    ${subscription.planId === 'free' ? `
                        <button class="mod-btn mod-btn-primary" style="flex:1" onclick="window.SubscriptionModule.startTrial()">
                            🚀 Iniciar Trial Pro
                        </button>
                    ` : subscription.planId !== 'enterprise' ? `
                        <button class="mod-btn mod-btn-primary" style="flex:1" onclick="window.open('${getUpgradeUrl('pro')}')">
                            ⬆️ Fazer Upgrade
                        </button>
                    ` : ''}
                    <button class="mod-btn mod-btn-secondary" onclick="window.open('${getManageUrl()}')">
                        ⚙️
                    </button>
                </div>
            </div>
        `;
        
        if (container) {
            container.innerHTML = html;
        }
        
        return html;
    }

    function renderUsageItem(icon, label, current, limit) {
        const isUnlimited = limit === -1;
        const percentage = isUnlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));
        const color = percentage >= 90 ? 'var(--mod-error)' : percentage >= 70 ? 'var(--mod-warning)' : 'var(--mod-success)';
        
        return `
            <div style="text-align:center;padding:8px;background:rgba(0,0,0,0.2);border-radius:8px">
                <div style="font-size:16px">${icon}</div>
                <div style="font-size:14px;font-weight:700;color:${isUnlimited ? 'var(--mod-text)' : color}">
                    ${current}${isUnlimited ? '' : `/${limit}`}
                </div>
                <div style="font-size:10px;color:var(--mod-text-muted)">${label}</div>
            </div>
        `;
    }

    function renderFeatureBadge(feature, label) {
        const has = hasFeature(feature);
        return `
            <span class="mod-badge ${has ? 'mod-badge-success' : 'mod-badge-error'}" style="opacity:${has ? 1 : 0.5}">
                ${has ? '✓' : '✗'} ${label}
            </span>
        `;
    }

    function renderPlansComparison(container) {
        const currentPlan = subscription.planId;
        
        const html = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
                ${Object.values(PLANS).map(plan => `
                    <div class="mod-card" style="
                        ${plan.id === currentPlan ? `border:2px solid ${plan.color};` : ''}
                        text-align:center;
                    ">
                        <div style="font-size:32px;margin-bottom:8px">${plan.icon}</div>
                        <div style="font-size:18px;font-weight:700">${plan.name}</div>
                        <div style="font-size:24px;font-weight:800;color:${plan.color};margin:8px 0">
                            ${plan.price > 0 ? `R$ ${plan.price.toFixed(2)}` : 'Grátis'}
                        </div>
                        
                        <div style="text-align:left;font-size:12px;margin:12px 0">
                            <div>📨 ${plan.limits.messagesPerDay === -1 ? '∞' : plan.limits.messagesPerDay} msg/dia</div>
                            <div>🤖 ${plan.features.aiCredits} créditos IA</div>
                            <div>${plan.features.smartReplies ? '✅' : '❌'} Smart Replies</div>
                            <div>${plan.features.copilot ? '✅' : '❌'} Copilot</div>
                            <div>${plan.features.analytics ? '✅' : '❌'} Analytics</div>
                        </div>
                        
                        ${plan.id === currentPlan ? `
                            <div class="mod-badge mod-badge-primary">Plano Atual</div>
                        ` : plan.id !== 'free' ? `
                            <button class="mod-btn mod-btn-primary mod-btn-sm" style="width:100%"
                                    onclick="window.open('${getUpgradeUrl(plan.id)}')">
                                Assinar
                            </button>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        
        if (container) {
            container.innerHTML = html;
        }
        
        return html;
    }

    // ============================================
    // EXPORT GLOBAL
    // ============================================

    window.SubscriptionModule = {
        // Lifecycle
        init,
        
        // Getters
        getSubscription,
        getPlan,
        getPlanId,
        getFeature,
        getLimit,
        getUsage,
        getCredits,
        getCreditsStatus,
        isActive,
        isTrial,
        getTrialDaysRemaining,
        
        // Checks
        hasFeature,
        canUseAI,
        checkLimit,
        canPerformAction,
        
        // Actions
        consumeCredit,
        addCredits,
        incrementUsage,
        decrementUsage,
        
        // Plan management
        activatePlan,
        startTrial,
        cancelSubscription,
        getUpgradeUrl,
        getManageUrl,
        
        // Events
        on,
        off,
        
        // UI
        renderStatusWidget,
        renderPlansComparison,
        
        // Constants
        PLANS,
        THRESHOLDS
    };

    console.log('[Subscription] Módulo carregado');
})();
