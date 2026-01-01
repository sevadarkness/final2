/**
 * 📊 Analytics Module - Sistema de Métricas FUNCIONAL
 * Baseado no Quantum CRM MetricsCollector
 * Coleta, armazena e exibe métricas reais de campanhas
 */

(function() {
  'use strict';

  // Estado do módulo
  const state = {
    initialized: false,
    sessionStart: Date.now(),
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    
    // Métricas em memória (buffer)
    buffer: [],
    bufferMaxSize: 50,
    
    // Contadores de sessão
    session: {
      messagesSent: 0,
      messagesReceived: 0,
      messagesFailed: 0,
      campaignsStarted: 0,
      campaignsCompleted: 0
    },

    // Dados persistidos
    data: {
      totalMessages: { sent: 0, failed: 0 },
      daily: {},      // { '2025-01-15': { sent: 0, failed: 0 } }
      hourly: {},     // { 0: { sent: 0 }, 1: { sent: 0 }, ... }
      contacts: [],   // phones únicos
      campaigns: [],  // histórico de campanhas
      responseTimes: [] // tempos de resposta
    }
  };

  const STORAGE_KEY = 'whl_analytics_v2';

  /**
   * Inicializa o módulo
   */
  async function init() {
    if (state.initialized) return;

    await loadData();
    setupEventListeners();
    startAutoFlush();
    startDailyCleanup();

    state.initialized = true;
    console.log('[Analytics] ✅ Módulo inicializado');
    
    // Emitir evento
    if (window.EventBus) {
      window.EventBus.emit(window.WHL_EVENTS?.MODULE_LOADED, { module: 'analytics' });
    }
  }

  /**
   * Carrega dados do storage
   */
  async function loadData() {
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY], result => {
        if (result[STORAGE_KEY]) {
          state.data = { ...state.data, ...result[STORAGE_KEY] };
        }
        resolve();
      });
    });
  }

  /**
   * Salva dados no storage
   */
  async function saveData() {
    return new Promise(resolve => {
      chrome.storage.local.set({ [STORAGE_KEY]: state.data }, resolve);
    });
  }

  /**
   * Configura listeners de eventos
   */
  function setupEventListeners() {
    if (!window.EventBus) return;

    // Escutar eventos de mensagens
    window.EventBus.on(window.WHL_EVENTS.MESSAGE_SENT, data => {
      trackMessage(data.phone, true);
    });

    window.EventBus.on(window.WHL_EVENTS.MESSAGE_FAILED, data => {
      trackMessage(data.phone, false);
    });

    window.EventBus.on(window.WHL_EVENTS.CAMPAIGN_STARTED, data => {
      startCampaign(data.name, data.totalContacts);
    });

    window.EventBus.on(window.WHL_EVENTS.CAMPAIGN_COMPLETED, data => {
      endCampaign(data.campaignId, 'completed');
    });
  }

  /**
   * Registra envio de mensagem
   */
  function trackMessage(phone, success = true, campaignId = null) {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const hourKey = now.getHours();

    // Atualizar totais
    if (success) {
      state.data.totalMessages.sent++;
      state.session.messagesSent++;
    } else {
      state.data.totalMessages.failed++;
      state.session.messagesFailed++;
    }

    // Atualizar diário
    if (!state.data.daily[dateKey]) {
      state.data.daily[dateKey] = { sent: 0, failed: 0 };
    }
    state.data.daily[dateKey][success ? 'sent' : 'failed']++;

    // Atualizar por hora
    if (!state.data.hourly[hourKey]) {
      state.data.hourly[hourKey] = { sent: 0, failed: 0 };
    }
    state.data.hourly[hourKey][success ? 'sent' : 'failed']++;

    // Registrar contato único
    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      if (!state.data.contacts.includes(normalizedPhone)) {
        state.data.contacts.push(normalizedPhone);
        // Limitar a 10000 contatos
        if (state.data.contacts.length > 10000) {
          state.data.contacts = state.data.contacts.slice(-10000);
        }
      }
    }

    // Atualizar campanha se fornecida
    if (campaignId) {
      const campaign = state.data.campaigns.find(c => c.id === campaignId);
      if (campaign) {
        if (success) campaign.sent++;
        else campaign.failed++;
        campaign.lastActivity = now.toISOString();
      }
    }

    // Adicionar ao buffer
    addToBuffer({
      type: success ? 'message_sent' : 'message_failed',
      phone: normalizePhone(phone),
      timestamp: now.toISOString(),
      campaignId
    });

    // Emitir evento
    if (window.EventBus) {
      window.EventBus.emit(window.WHL_EVENTS.METRIC_TRACKED, {
        type: 'message',
        success,
        phone
      });
    }
  }

  /**
   * Inicia campanha
   */
  function startCampaign(name, totalContacts) {
    const campaign = {
      id: `camp_${Date.now()}`,
      name: name || `Campanha ${state.data.campaigns.length + 1}`,
      totalContacts: totalContacts || 0,
      sent: 0,
      failed: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: 'running'
    };

    state.data.campaigns.unshift(campaign);
    state.session.campaignsStarted++;

    // Limitar histórico a 100 campanhas
    if (state.data.campaigns.length > 100) {
      state.data.campaigns = state.data.campaigns.slice(0, 100);
    }

    flushBuffer();

    console.log('[Analytics] Campanha iniciada:', campaign.name);
    return campaign;
  }

  /**
   * Finaliza campanha
   */
  function endCampaign(campaignId, status = 'completed') {
    const campaign = state.data.campaigns.find(c => c.id === campaignId);
    if (campaign) {
      campaign.completedAt = new Date().toISOString();
      campaign.status = status;
      state.session.campaignsCompleted++;
      flushBuffer();
    }
    return campaign;
  }

  /**
   * Obtém estatísticas gerais
   */
  function getOverview() {
    const totalSent = state.data.totalMessages.sent;
    const totalFailed = state.data.totalMessages.failed;
    const total = totalSent + totalFailed;
    const successRate = total > 0 ? ((totalSent / total) * 100) : 0;

    return {
      totalMessages: total,
      sent: totalSent,
      failed: totalFailed,
      successRate: parseFloat(successRate.toFixed(1)),
      uniqueContacts: state.data.contacts.length,
      totalCampaigns: state.data.campaigns.length,
      activeCampaigns: state.data.campaigns.filter(c => c.status === 'running').length,
      session: { ...state.session }
    };
  }

  /**
   * Obtém dados para gráfico diário
   */
  function getDailyData(days = 7) {
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' });

      data.push({
        date: key,
        label: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        sent: state.data.daily[key]?.sent || 0,
        failed: state.data.daily[key]?.failed || 0
      });
    }

    return data;
  }

  /**
   * Obtém dados por hora
   */
  function getHourlyData() {
    const data = [];
    for (let h = 0; h < 24; h++) {
      data.push({
        hour: h,
        label: `${h.toString().padStart(2, '0')}h`,
        sent: state.data.hourly[h]?.sent || 0,
        failed: state.data.hourly[h]?.failed || 0
      });
    }
    return data;
  }

  /**
   * Obtém melhores horários
   */
  function getBestHours(limit = 3) {
    const hourlyData = getHourlyData();
    return hourlyData
      .sort((a, b) => b.sent - a.sent)
      .slice(0, limit)
      .map(h => h.label);
  }

  /**
   * Obtém campanhas recentes
   */
  function getCampaigns(limit = 10) {
    return state.data.campaigns.slice(0, limit);
  }

  /**
   * Buffer management
   */
  function addToBuffer(metric) {
    state.buffer.push(metric);
    if (state.buffer.length >= state.bufferMaxSize) {
      flushBuffer();
    }
  }

  function flushBuffer() {
    if (state.buffer.length === 0) return;
    state.buffer = [];
    saveData();
  }

  function startAutoFlush() {
    setInterval(() => flushBuffer(), 10000); // Flush a cada 10s
  }

  /**
   * Limpa dados antigos (mantém 30 dias)
   */
  function startDailyCleanup() {
    const cleanup = () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffKey = cutoff.toISOString().split('T')[0];

      Object.keys(state.data.daily).forEach(key => {
        if (key < cutoffKey) {
          delete state.data.daily[key];
        }
      });

      saveData();
    };

    // Executar uma vez por dia
    setTimeout(() => {
      cleanup();
      setInterval(cleanup, 86400000);
    }, 60000);
  }

  /**
   * Reseta todas as métricas
   */
  async function resetAll() {
    state.data = {
      totalMessages: { sent: 0, failed: 0 },
      daily: {},
      hourly: {},
      contacts: [],
      campaigns: [],
      responseTimes: []
    };
    state.session = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesFailed: 0,
      campaignsStarted: 0,
      campaignsCompleted: 0
    };
    await saveData();
    console.log('[Analytics] Métricas resetadas');
  }

  /**
   * Normaliza telefone
   */
  function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  /**
   * Renderiza Dashboard completo
   */
  function renderDashboard(container) {
    if (!container) return;
    
    const overview = getOverview();
    const dailyData = getDailyData(7);
    const campaigns = getCampaigns(5);
    const bestHours = getBestHours(3);

    container.innerHTML = `
      <div class="whl-analytics-dashboard">
        <!-- KPIs -->
        <div class="whl-analytics-kpis" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px;">
          <div id="kpi-messages"></div>
          <div id="kpi-success"></div>
          <div id="kpi-contacts"></div>
          <div id="kpi-campaigns"></div>
        </div>

        <!-- Gráfico Diário -->
        <div class="sp-card" style="margin-bottom:16px;">
          <div class="sp-title" style="font-size:13px;margin-bottom:12px;">📈 Últimos 7 dias</div>
          <div id="chart-daily" style="min-height:150px;"></div>
        </div>

        <!-- Gráfico por Hora -->
        <div class="sp-card" style="margin-bottom:16px;">
          <div class="sp-title" style="font-size:13px;margin-bottom:12px;">⏰ Distribuição por Hora</div>
          <div id="chart-hourly" style="min-height:120px;"></div>
        </div>

        <!-- Insights -->
        <div class="sp-card" style="margin-bottom:16px;">
          <div class="sp-title" style="font-size:13px;margin-bottom:12px;">💡 Insights</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(139,92,246,0.1);border-radius:8px;">
              <span style="font-size:20px;">🎯</span>
              <div>
                <div style="font-size:12px;color:rgba(255,255,255,0.6);">Melhores horários</div>
                <div style="font-size:14px;font-weight:600;">${bestHours.length > 0 ? bestHours.join(', ') : 'Dados insuficientes'}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(59,130,246,0.1);border-radius:8px;">
              <span style="font-size:20px;">📊</span>
              <div>
                <div style="font-size:12px;color:rgba(255,255,255,0.6);">Taxa de sucesso</div>
                <div style="font-size:14px;font-weight:600;">${overview.successRate}%</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Campanhas Recentes -->
        <div class="sp-card">
          <div class="sp-title" style="font-size:13px;margin-bottom:12px;">📋 Campanhas Recentes</div>
          <div id="campaigns-list"></div>
        </div>
      </div>
    `;

    // Renderizar KPIs
    if (window.ChartEngine) {
      window.ChartEngine.renderKPICard(container.querySelector('#kpi-messages'), {
        icon: '📨',
        value: overview.totalMessages,
        label: 'Mensagens Enviadas'
      });

      window.ChartEngine.renderKPICard(container.querySelector('#kpi-success'), {
        icon: '✅',
        value: overview.successRate + '%',
        label: 'Taxa de Sucesso',
        color: overview.successRate >= 80 ? '#10b981' : overview.successRate >= 50 ? '#f59e0b' : '#ef4444'
      });

      window.ChartEngine.renderKPICard(container.querySelector('#kpi-contacts'), {
        icon: '👥',
        value: overview.uniqueContacts,
        label: 'Contatos Únicos'
      });

      window.ChartEngine.renderKPICard(container.querySelector('#kpi-campaigns'), {
        icon: '🚀',
        value: overview.totalCampaigns,
        label: 'Campanhas'
      });

      // Gráfico Diário
      window.ChartEngine.renderBarChart(container.querySelector('#chart-daily'), {
        labels: dailyData.map(d => d.label),
        datasets: [
          { label: 'Enviadas', data: dailyData.map(d => d.sent), color: '#8b5cf6' },
          { label: 'Falhas', data: dailyData.map(d => d.failed), color: '#ef4444' }
        ]
      });

      // Gráfico por Hora
      const hourlyData = getHourlyData();
      window.ChartEngine.renderLineChart(container.querySelector('#chart-hourly'), {
        labels: hourlyData.filter((_, i) => i % 3 === 0).map(d => d.label),
        datasets: [
          { label: 'Mensagens', data: hourlyData.filter((_, i) => i % 3 === 0).map(d => d.sent), color: '#3b82f6' }
        ]
      });
    }

    // Renderizar lista de campanhas
    const campaignsList = container.querySelector('#campaigns-list');
    if (campaigns.length === 0) {
      campaignsList.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(255,255,255,0.5);">Nenhuma campanha registrada</div>';
    } else {
      campaignsList.innerHTML = campaigns.map(c => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-bottom:1px solid rgba(255,255,255,0.1);">
          <div>
            <div style="font-size:13px;font-weight:600;">${escapeHtml(c.name)}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.5);">${new Date(c.startedAt).toLocaleDateString('pt-BR')}</div>
          </div>
          <div style="display:flex;gap:12px;align-items:center;">
            <span style="color:#10b981;font-size:12px;">✅ ${c.sent}</span>
            <span style="color:#ef4444;font-size:12px;">❌ ${c.failed}</span>
            <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${c.status === 'completed' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)'};color:${c.status === 'completed' ? '#10b981' : '#3b82f6'};">
              ${c.status === 'completed' ? 'Concluída' : c.status === 'running' ? 'Em andamento' : c.status}
            </span>
          </div>
        </div>
      `).join('');
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Exporta dados
   */
  function exportData() {
    return JSON.parse(JSON.stringify(state.data));
  }

  // API Pública
  window.AnalyticsModule = {
    init,
    trackMessage,
    startCampaign,
    endCampaign,
    getOverview,
    getDailyData,
    getHourlyData,
    getBestHours,
    getCampaigns,
    renderDashboard,
    resetAll,
    exportData
  };

})();
