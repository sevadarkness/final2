/**
 * Sidepanel Inline Scripts - Movido para arquivo separado por CSP
 * WhatsHybrid v6.8.2
 */

// Initialize all modules after page load
window.addEventListener('load', async function() {
    console.log('[Modules] Inicializando módulos v53...');
    
    // Aguarda módulos estarem carregados via init.js
    // O init.js já faz a inicialização automática
    
    // Onboarding
    setTimeout(function() {
        if (typeof OnboardingSystem !== 'undefined') {
            const onboarding = new OnboardingSystem();
            if (onboarding.shouldShow()) {
                onboarding.start();
            }
            window.whlOnboarding = onboarding;
        }
    }, 500);

    // Garantir renderização após 1 segundo
    setTimeout(function() {
        if (typeof window.renderModuleViews === 'function') {
            console.log('[Modules] Chamando renderModuleViews após load...');
            window.renderModuleViews();
        }
    }, 1000);
});

// Atualiza estatísticas de tarefas
function updateTasksStats() {
    if (!window.TasksModule) return;
    const stats = window.TasksModule.getStats();
    
    const el1 = document.getElementById('stat_total');
    const el2 = document.getElementById('stat_pending');
    const el3 = document.getElementById('stat_overdue');
    const el4 = document.getElementById('stat_completed');
    
    if (el1) el1.textContent = stats.total || 0;
    if (el2) el2.textContent = stats.pending || 0;
    if (el3) el3.textContent = stats.overdue || 0;
    if (el4) el4.textContent = stats.completed || 0;
}

// Setup eventos dos botões
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Sidepanel] DOMContentLoaded - configurando handlers...');

    // CRM Header button - Abrir em nova aba
    const btnCrmHeader = document.getElementById('btnOpenCrmFullscreen');
    if (btnCrmHeader) {
        btnCrmHeader.addEventListener('click', () => {
            console.log('[Sidepanel] Abrindo CRM em nova aba...');
            chrome.tabs.create({ url: chrome.runtime.getURL('crm/crm.html') });
        });
        console.log('[Sidepanel] ✅ Handler btnOpenCrmFullscreen configurado');
    }

    // CRM Fullscreen button - Abrir em nova aba
    const btnCrmFullscreen = document.getElementById('crm_open_fullscreen');
    if (btnCrmFullscreen) {
        btnCrmFullscreen.addEventListener('click', () => {
            console.log('[Sidepanel] Abrindo CRM em nova aba (fullscreen)...');
            chrome.tabs.create({ url: chrome.runtime.getURL('crm/crm.html') });
        });
        console.log('[Sidepanel] ✅ Handler crm_open_fullscreen configurado');
    }

    // CRM buttons
    document.getElementById('crm_new_deal')?.addEventListener('click', () => {
        // Tentar função global primeiro, depois módulo
        if (window.showNewDealModal) {
            window.showNewDealModal();
        } else if (window.CRMModule?.showDealModal) {
            window.CRMModule.showDealModal();
        } else {
            console.warn('[Sidepanel] Nenhuma função de modal de negócio disponível');
        }
    });

    document.getElementById('crm_new_contact')?.addEventListener('click', () => {
        // Tentar função global primeiro, depois módulo
        if (window.showNewContactModal) {
            window.showNewContactModal();
        } else if (window.CRMModule?.showContactModal) {
            window.CRMModule.showContactModal();
        } else {
            console.warn('[Sidepanel] Nenhuma função de modal de contato disponível');
        }
    });

    document.getElementById('crm_refresh')?.addEventListener('click', async () => {
        if (window.CRMModule?.reloadData) {
            await window.CRMModule.reloadData();
        }
        if (window.renderModuleViews) {
            window.renderModuleViews();
        }
    });

    // Analytics buttons
    document.getElementById('analytics_refresh')?.addEventListener('click', () => {
        if (window.renderModuleViews) window.renderModuleViews();
        if (window.NotificationsModule) {
            window.NotificationsModule.success('Dashboard atualizado!');
        }
    });

    document.getElementById('analytics_reset')?.addEventListener('click', async () => {
        if (confirm('Tem certeza que deseja resetar todas as métricas? Esta ação não pode ser desfeita.')) {
            if (window.AnalyticsModule) {
                await window.AnalyticsModule.resetAll();
                if (window.renderModuleViews) window.renderModuleViews();
                if (window.NotificationsModule) {
                    window.NotificationsModule.success('Métricas resetadas!');
                }
            }
        }
    });

    // AI Test buttons
    document.getElementById('ai_test_btn')?.addEventListener('click', async () => {
        const input = document.getElementById('ai_test_input')?.value?.trim();
        if (!input) return;

        if (!window.SmartRepliesModule?.isConfigured()) {
            alert('Configure o provedor de IA primeiro');
            return;
        }

        try {
            document.getElementById('ai_test_btn').disabled = true;
            document.getElementById('ai_test_btn').textContent = '⏳ Gerando...';

            const reply = await window.SmartRepliesModule.generateReply('test', [
                { role: 'user', content: input }
            ]);

            document.getElementById('ai_test_output').style.display = 'block';
            document.getElementById('ai_test_result').textContent = reply;
        } catch (error) {
            alert('Erro ao gerar resposta: ' + error.message);
        } finally {
            document.getElementById('ai_test_btn').disabled = false;
            document.getElementById('ai_test_btn').textContent = '🚀 Gerar Resposta';
        }
    });

    document.getElementById('ai_correct_btn')?.addEventListener('click', async () => {
        const input = document.getElementById('ai_test_input')?.value?.trim();
        if (!input) return;

        if (!window.SmartRepliesModule?.isConfigured()) {
            alert('Configure o provedor de IA primeiro');
            return;
        }

        try {
            document.getElementById('ai_correct_btn').disabled = true;
            document.getElementById('ai_correct_btn').textContent = '⏳...';

            const result = await window.SmartRepliesModule.correctText(input);

            document.getElementById('ai_test_output').style.display = 'block';
            document.getElementById('ai_test_result').innerHTML = result.hasChanges 
                ? '<strong>Corrigido:</strong><br>' + result.corrected
                : '<em>Texto já está correto!</em>';
        } catch (error) {
            alert('Erro ao corrigir texto: ' + error.message);
        } finally {
            document.getElementById('ai_correct_btn').disabled = false;
            document.getElementById('ai_correct_btn').textContent = '✏️ Corrigir Texto';
        }
    });

    console.log('[Sidepanel] ✅ Todos os handlers configurados');
});
