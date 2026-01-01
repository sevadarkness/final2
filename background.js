// ===== STRICT MODE AND ERROR HANDLING =====
'use strict';
// ===== FUSION: Load Group Extractor v6 background module =====
try {
  importScripts('background/extractor-v6.js');
  console.log('[Fusion] Loaded extractor-v6 background module');
} catch (e) {
  console.warn('[Fusion] Failed to load extractor-v6 background module', e);
}


// Verify Chrome APIs are available
if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('[WHL Background] Chrome APIs not available');
}

// Global error handler
self.addEventListener('error', (event) => {
    console.error('[WHL Background] Global error:', event.error);
});

// Unhandled promise rejection handler
self.addEventListener('unhandledrejection', (event) => {
    console.error('[WHL Background] Unhandled promise rejection:', event.reason);
});

// ===== BUG FIX 2: Side Panel Behavior =====
// Set panel behavior to open on action click (clicking extension icon)
// This must be done BEFORE any tabs are opened to ensure it works consistently
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .then(() => console.log('[WHL Background] ✅ Side panel set to open on action click'))
  .catch(e => console.warn('[WHL Background] setPanelBehavior failed:', e));

// ===== CONFIGURATION CONSTANTS =====
const SEND_MESSAGE_TIMEOUT_MS = 45000; // 45 seconds timeout for message sending
const NETSNIFFER_CLEANUP_INTERVAL_MS = 300000; // 5 minutes - periodic cleanup to prevent memory leaks
const NETSNIFFER_MAX_PHONES = 5000; // Reduced from 10000 to prevent excessive memory usage

// Função para substituir variáveis dinâmicas na mensagem
function substituirVariaveis(mensagem, contato) {
  if (!mensagem) return '';
  
  let nome = '';
  let firstName = '';
  let lastName = '';
  let phone = '';
  
  if (typeof contato === 'object' && contato !== null) {
    nome = contato.name || contato.pushname || contato.nome || '';
    phone = contato.phone || contato.number || contato.telefone || '';
  } else {
    phone = String(contato || '');
  }
  
  if (nome) {
    const partes = nome.split(' ').filter(p => p.length > 0);
    firstName = partes[0] || '';
    lastName = partes.slice(1).join(' ') || '';
  }
  
  const hour = new Date().getHours();
  let saudacao = 'Olá';
  if (hour >= 5 && hour < 12) saudacao = 'Bom dia';
  else if (hour >= 12 && hour < 18) saudacao = 'Boa tarde';
  else saudacao = 'Boa noite';
  
  const now = new Date();
  const data = now.toLocaleDateString('pt-BR');
  const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  const replaceVar = (str, varName, value) => {
    const regex1 = new RegExp(`\\{\\{${varName}\\}\\}`, 'gi');
    const regex2 = new RegExp(`\\{${varName}\\}`, 'gi');
    return str.replace(regex1, value).replace(regex2, value);
  };
  
  let result = mensagem;
  result = replaceVar(result, 'nome', nome);
  result = replaceVar(result, 'name', nome);
  result = replaceVar(result, 'first_name', firstName);
  result = replaceVar(result, 'primeiro_nome', firstName);
  result = replaceVar(result, 'last_name', lastName);
  result = replaceVar(result, 'sobrenome', lastName);
  result = replaceVar(result, 'phone', phone);
  result = replaceVar(result, 'telefone', phone);
  result = replaceVar(result, 'numero', phone);
  result = replaceVar(result, 'saudacao', saudacao);
  result = replaceVar(result, 'greeting', saudacao);
  result = replaceVar(result, 'data', data);
  result = replaceVar(result, 'date', data);
  result = replaceVar(result, 'hora', hora);
  result = replaceVar(result, 'time', hora);
  
  return result;
}

const NetSniffer = {
  phones: new Set(),
  lastCleanup: Date.now(),
  
  init() {
    chrome.webRequest.onBeforeRequest.addListener(
      det => this.req(det),
      {urls:["*://web.whatsapp.com/*","*://*.whatsapp.net/*"]},
      ["requestBody"]
    );
    chrome.webRequest.onCompleted.addListener(
      det => this.resp(det),
      {urls:["*://web.whatsapp.com/*","*://*.whatsapp.net/*"]}
    );
    
    // Start periodic cleanup to prevent memory leaks
    this.startPeriodicCleanup();
  },
  
  /**
   * Periodic cleanup to prevent unbounded memory growth
   */
  startPeriodicCleanup() {
    setInterval(() => {
      const now = Date.now();
      const timeSinceLastCleanup = now - this.lastCleanup;
      
      // Only clean if interval has passed
      if (timeSinceLastCleanup >= NETSNIFFER_CLEANUP_INTERVAL_MS) {
        this.cleanup();
      }
    }, NETSNIFFER_CLEANUP_INTERVAL_MS);
  },
  
  /**
   * Clean up phones set to prevent memory leaks
   */
  cleanup() {
    console.log(`[NetSniffer] Cleanup: ${this.phones.size} phones in memory`);
    
    // If we have too many phones, clear the set
    if (this.phones.size > NETSNIFFER_MAX_PHONES) {
      console.log(`[NetSniffer] Clearing phones set (exceeded ${NETSNIFFER_MAX_PHONES})`);
      this.phones.clear();
    }
    
    this.lastCleanup = Date.now();
  },
  req(det) {
    try {
      if (det.requestBody) {
        if (det.requestBody.formData) Object.values(det.requestBody.formData).forEach(vals => vals.forEach(v => this.detect(v)));
        if (det.requestBody.raw) det.requestBody.raw.forEach(d=>{
          if(d.bytes){
            let t = new TextDecoder().decode(new Uint8Array(d.bytes));
            this.detect(t);
          }
        });
      }
      this.detect(det.url);
    } catch(err) {
      console.warn('[NetSniffer] Error processing request:', err.message);
    }
  },
  resp(det) {
    if (this.phones.size) {
      chrome.tabs.query({active:true,currentWindow:true},tabs=>{
        if(tabs[0]){
          chrome.tabs.sendMessage(tabs[0].id,{type:'netPhones',phones:Array.from(this.phones)})
            .catch(err => {
              console.log('[NetSniffer] Não foi possível enviar phones para content script:', err.message);
            });
        }
      });
    }
  },
  detect(t) {
    if (!t) return;
    // Security fix: Only use WhatsApp-specific pattern to avoid false positives
    for (let m of t.matchAll(/(\d{10,15})@c\.us/g)) this.phones.add(m[1]);
  }
};
NetSniffer.init();

// ===== CONSOLIDATED MESSAGE LISTENER =====
// Single message listener to handle all actions and avoid race conditions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handler map for better organization and maintainability
  const handlers = {
    // Data export/clear actions
    exportData: handleExportData,
    clearData: handleClearData,
    
    // Worker management actions
    CHECK_IF_WORKER: handleCheckIfWorker,
    WORKER_READY: handleWorkerReady,
    WORKER_STATUS: handleWorkerStatus,
    WORKER_ERROR: handleWorkerError,
    
    // Campaign management actions
    START_CAMPAIGN_WORKER: handleStartCampaign,
    START_SCHEDULED_CAMPAIGN: handleStartScheduledCampaign,
    PAUSE_CAMPAIGN: handlePauseCampaign,
    RESUME_CAMPAIGN: handleResumeCampaign,
    STOP_CAMPAIGN: handleStopCampaign,
    GET_CAMPAIGN_STATUS: handleGetCampaignStatus,

    // UI routing (Top Panel -> Side Panel)
    WHL_OPEN_SIDE_PANEL_VIEW: handleOpenSidePanelView,
    WHL_SET_SIDE_PANEL_ENABLED: handleSetSidePanelEnabled,
    
    // Open side panel (from popup)
    openSidePanel: handleOpenSidePanel,

    // ChatBackup: download blobs/ZIPs generated in the content script
    download: handleDownload,

    // CRM: Abrir chat na mesma aba
    WHL_OPEN_CHAT: handleOpenChat,
    
    // Onboarding: Highlight de botões no Top Panel
    WHL_ONBOARDING_HIGHLIGHT: handleOnboardingHighlight
  };
  
  // Verificar também por message.type (além de message.action)
  const handler = handlers[message.action] || handlers[message.type];
  
  if (handler) {
    // All handlers return true for async operations
    handler(message, sender, sendResponse);
    return true;
  }
  
  // Unknown action - don't block
  return false;
});

// ===== MESSAGE HANDLERS =====

async function handleExportData(message, sender, sendResponse) {
  chrome.tabs.query({active:true,currentWindow:true},async tabs=>{
    if(!tabs[0]){
      sendResponse({success:false, error:'No active tab found'});
      return;
    }
    try{
      const res = await chrome.scripting.executeScript({
        target:{tabId:tabs[0].id},
        function:()=>({
          numbers: Array.from(window.HarvesterStore?._phones?.keys()||[]),
          valid: Array.from(window.HarvesterStore?._valid||[]),
          meta: window.HarvesterStore?._meta||{}
        })
      });
      sendResponse({success:true, data: res[0].result});
    }catch(e){
      sendResponse({success:false, error:e.message});
    }
  });
}

async function handleClearData(message, sender, sendResponse) {
  chrome.tabs.query({active:true,currentWindow:true},async tabs=>{
    if(!tabs[0]){
      sendResponse({success:false, error:'No active tab found'});
      return;
    }
    try{
      await chrome.scripting.executeScript({
        target:{tabId:tabs[0].id},
        function:()=>{
          if(window.HarvesterStore){
            window.HarvesterStore._phones.clear();
            window.HarvesterStore._valid.clear();
            window.HarvesterStore._meta = {};
            localStorage.removeItem('wa_extracted_numbers');
          }
        }
      });
      sendResponse({success:true});
    }catch(e){
      sendResponse({success:false, error:e.message});
    }
  });
}

// ===== ABRIR CHAT NA MESMA ABA =====
async function handleOpenChat(message, sender, sendResponse) {
  const phone = String(message.phone || '').replace(/\D/g, '');
  if (!phone) {
    sendResponse({ success: false, error: 'Telefone não informado' });
    return;
  }

  try {
    // Encontrar aba do WhatsApp Web
    const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
    
    if (tabs.length === 0) {
      // Não há aba do WhatsApp aberta, abrir nova
      await chrome.tabs.create({ url: `https://web.whatsapp.com/send?phone=${phone}` });
      sendResponse({ success: true, method: 'new_tab' });
      return;
    }

    const waTab = tabs[0];

    // Focar na aba do WhatsApp
    await chrome.tabs.update(waTab.id, { active: true });
    await chrome.windows.update(waTab.windowId, { focused: true });

    // Enviar mensagem para o content script abrir o chat
    chrome.tabs.sendMessage(waTab.id, {
      type: 'WHL_OPEN_CHAT',
      phone: phone
    }, response => {
      if (chrome.runtime.lastError) {
        console.warn('[WHL Background] Erro ao enviar msg para content:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, method: 'content_script', response });
      }
    });

  } catch (err) {
    console.error('[WHL Background] Erro ao abrir chat:', err);
    sendResponse({ success: false, error: err.message });
  }
}

// ===== UI ROUTING: OPEN SIDE PANEL + SET ACTIVE VIEW =====
async function handleOpenSidePanelView(message, sender, sendResponse) {
  try {
    const view = String(message.view || 'principal');

    // Try to open the side panel for the current WhatsApp tab/window
    const tabId = sender?.tab?.id ?? message.tabId;
    const windowId = sender?.tab?.windowId;

    // Persist view + tab association so the Side Panel can talk to the right tab
    await chrome.storage.local.set({
      whl_active_view: view,
      whl_active_tabId: (typeof tabId === 'number') ? tabId : null,
      whl_active_windowId: (typeof windowId === 'number') ? windowId : null
    });

    // BUG FIX 2: Always try to open the side panel with proper error handling
    if (chrome.sidePanel && chrome.sidePanel.open) {
      let openSuccess = false;
      
      // Try 1: Open with specific tabId if available
      if (typeof tabId === 'number') {
        try {
          await chrome.sidePanel.open({ tabId });
          openSuccess = true;
          console.log('[WHL Background] Side panel opened for tab:', tabId);
        } catch (e1) {
          console.warn('[WHL Background] Failed to open side panel with tabId:', e1.message);
        }
      }
      
      // Try 2: Open with windowId if tabId failed
      if (!openSuccess && typeof windowId === 'number') {
        try {
          await chrome.sidePanel.open({ windowId });
          openSuccess = true;
          console.log('[WHL Background] Side panel opened for window:', windowId);
        } catch (e2) {
          console.warn('[WHL Background] Failed to open side panel with windowId:', e2.message);
        }
      }
      
      // Try 3: Query active tab and try again
      if (!openSuccess) {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs?.[0]?.id != null) {
            await chrome.sidePanel.open({ tabId: tabs[0].id });
            openSuccess = true;
            console.log('[WHL Background] Side panel opened for queried tab:', tabs[0].id);
          }
        } catch (e3) {
          console.warn('[WHL Background] Failed to open side panel with queried tab:', e3.message);
        }
      }
      
      if (!openSuccess) {
        console.error('[WHL Background] All attempts to open side panel failed');
        sendResponse({ success: false, error: 'Failed to open side panel after multiple attempts' });
        return;
      }
    } else {
      console.warn('[WHL Background] chrome.sidePanel.open is not available');
    }

    sendResponse({ success: true, view });
  } catch (e) {
    console.error('[WHL Background] Error in handleOpenSidePanelView:', e);
    sendResponse({ success: false, error: e?.message || String(e) });
  }
}

// Enable/disable Side Panel for the current tab (used to keep Top Panel + Side Panel in sync)
async function handleSetSidePanelEnabled(message, sender, sendResponse) {
  try {
    const enabled = !!message.enabled;
    const tabId = sender?.tab?.id ?? message.tabId;

    if (chrome.sidePanel && chrome.sidePanel.setOptions && typeof tabId === 'number') {
      const opts = { tabId, enabled };
      if (enabled) opts.path = 'sidepanel.html';
      await chrome.sidePanel.setOptions(opts);
    }

    sendResponse({ success: true, enabled });
  } catch (e) {
    sendResponse({ success: false, error: e?.message || String(e) });
  }
}

// ===== ONBOARDING HIGHLIGHT HANDLER =====
// Retransmite mensagem do sidepanel para o content script no WhatsApp Web
async function handleOnboardingHighlight(message, sender, sendResponse) {
  try {
    // Encontrar a aba do WhatsApp Web
    const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
    
    if (tabs.length === 0) {
      console.log('[WHL Background] Nenhuma aba do WhatsApp encontrada para highlight');
      sendResponse({ success: false, error: 'No WhatsApp tab found' });
      return;
    }
    
    // Enviar para a primeira aba do WhatsApp encontrada
    const whatsappTab = tabs[0];
    
    await chrome.tabs.sendMessage(whatsappTab.id, {
      action: 'WHL_ONBOARDING_HIGHLIGHT',
      buttonIndex: message.buttonIndex,
      show: message.show
    });
    
    console.log('[WHL Background] Onboarding highlight enviado para tab:', whatsappTab.id);
    sendResponse({ success: true });
  } catch (e) {
    console.log('[WHL Background] Erro ao enviar highlight:', e);
    sendResponse({ success: false, error: e?.message || String(e) });
  }
}


// ===== OPEN SIDE PANEL HANDLER (from popup) =====
async function handleOpenSidePanel(message, sender, sendResponse) {
  try {
    const tabId = message.tabId || sender?.tab?.id;
    if (chrome.sidePanel && chrome.sidePanel.open && tabId) {
      await chrome.sidePanel.open({ tabId });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'sidePanel.open indisponível' });
    }
  } catch (e) {
    sendResponse({ success: false, error: e?.message || String(e) });
  }
}


// ===== ChatBackup: Downloads =====
// The ChatBackup content script generates Blob URLs (including ZIPs) and asks the
// service worker to download them via chrome.downloads.
function sanitizeDownloadFilename(name) {
  const safe = String(name || 'download')
    // Windows forbidden characters + control chars
    .replace(/[\u0000-\u001F\u007F<>:"/\\|?*]+/g, '_')
    // Avoid trailing dots/spaces (Windows)
    .replace(/[\.\s]+$/g, '')
    // Keep it reasonable
    .slice(0, 180);
  return safe || 'download';
}

async function handleDownload(message, _sender, sendResponse) {
  try {
    const url = message?.url;
    const fileName = sanitizeDownloadFilename(message?.fileName);

    if (!url || typeof url !== 'string') {
      sendResponse({ success: false, error: 'URL inválida para download' });
      return;
    }

    chrome.downloads.download(
      {
        url,
        filename: fileName,
        saveAs: false
      },
      (downloadId) => {
        const err = chrome.runtime.lastError;
        if (err || !downloadId) {
          sendResponse({ success: false, error: err?.message || 'Falha ao iniciar download' });
        } else {
          sendResponse({ success: true, downloadId });
        }
      }
    );
  } catch (e) {
    sendResponse({ success: false, error: e?.message || String(e) });
  }
}


// ===== WORKER TAB MANAGEMENT =====

let workerTabId = null;
let campaignQueue = [];
let campaignState = {
  isRunning: false,
  isPaused: false,
  currentIndex: 0
};

// Initialize worker state on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['workerTabId', 'campaignQueue', 'campaignState'], (data) => {
    if (data.workerTabId) {
      // Check if the tab still exists
      chrome.tabs.get(data.workerTabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          workerTabId = null;
          chrome.storage.local.remove('workerTabId');
        } else {
          workerTabId = data.workerTabId;
        }
      });
    }
    if (data.campaignQueue) campaignQueue = data.campaignQueue;
    if (data.campaignState) campaignState = data.campaignState;
  });
});

function handleCheckIfWorker(message, sender, sendResponse) {
  sendResponse({ isWorker: sender.tab?.id === workerTabId });
}

function handleWorkerReady(message, sender, sendResponse) {
  console.log('[WHL Background] Worker tab ready');
  if (campaignState.isRunning && !campaignState.isPaused) {
    processNextInQueue();
  }
  sendResponse({ success: true });
}

function handleWorkerStatus(message, sender, sendResponse) {
  console.log('[WHL Background] Worker status:', message.status);
  notifyPopup({ action: 'WORKER_STATUS_UPDATE', status: message.status });
  sendResponse({ success: true });
}

function handleWorkerError(message, sender, sendResponse) {
  console.error('[WHL Background] Worker error:', message.error);
  notifyPopup({ action: 'WORKER_ERROR', error: message.error });
  sendResponse({ success: true });
}

async function handleStartCampaign(message, sender, sendResponse) {
  const { queue, config } = message;
  const result = await startCampaign(queue, config);
  sendResponse(result);
}

async function handleStartScheduledCampaign(message, sender, sendResponse) {
  try {
    const { scheduleId, queue, config } = message;
    
    // Validate required parameters
    if (!scheduleId) {
      throw new Error('scheduleId is required');
    }
    if (!queue || !Array.isArray(queue) || queue.length === 0) {
      throw new Error('queue must be a non-empty array');
    }
    if (!config || typeof config !== 'object') {
      throw new Error('config must be an object');
    }
    
    console.log('[WHL Background] Starting scheduled campaign:', scheduleId);
    
    const result = await startCampaign(queue, config, scheduleId);
    sendResponse(result);
  } catch (error) {
    console.error('[WHL Background] Error starting scheduled campaign:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function handlePauseCampaign(message, sender, sendResponse) {
  campaignState.isPaused = true;
  saveCampaignState();
  sendResponse({ success: true });
}

function handleResumeCampaign(message, sender, sendResponse) {
  campaignState.isPaused = false;
  saveCampaignState();
  processNextInQueue();
  sendResponse({ success: true });
}

function handleStopCampaign(message, sender, sendResponse) {
  campaignState.isRunning = false;
  campaignState.isPaused = false;
  saveCampaignState();
  sendResponse({ success: true });
}

function handleGetCampaignStatus(message, sender, sendResponse) {
  sendResponse({
    ...campaignState,
    queue: campaignQueue,
    workerActive: workerTabId !== null
  });
}

async function startCampaign(queue, config, scheduleId = null) {
  console.log('[WHL Background] Starting campaign with', queue.length, 'contacts');
  
  campaignQueue = queue;
  campaignState = {
    isRunning: true,
    isPaused: false,
    currentIndex: 0,
    config: config,
    scheduleId: scheduleId // Store scheduleId to update status later
  };
  
  saveCampaignState();
  
  // Start processing directly
  processNextInQueue();
  
  return { success: true };
}

// Helper function to update schedule status
async function updateScheduleStatus(scheduleId, status, completedAt = null) {
  if (!scheduleId) return;
  
  try {
    const data = await chrome.storage.local.get('whl_schedules');
    const schedules = data.whl_schedules || [];
    const schedule = schedules.find(s => s.id === scheduleId);
    
    if (schedule) {
      schedule.status = status;
      if (completedAt) {
        schedule.completedAt = completedAt;
      }
      await chrome.storage.local.set({ whl_schedules: schedules });
      console.log('[WHL Background] ✅ Schedule status updated:', scheduleId, '->', status);
      
      // Notificar sidepanel sobre mudança de status
      chrome.runtime.sendMessage({
        action: 'SCHEDULE_STATUS_CHANGED',
        scheduleId: scheduleId,
        status: status,
        schedule: schedule
      }).catch(() => {
        // Sidepanel pode estar fechado
      });
    } else {
      console.warn('[WHL Background] Schedule not found for status update:', scheduleId);
    }
  } catch (e) {
    console.error('[WHL Background] Error updating schedule status:', e);
  }
}

// ===== ENVIO SIMPLIFICADO =====
// Usar a aba principal do WhatsApp Web ao invés de worker incógnito

async function sendMessageToWhatsApp(phone, text, imageData = null) {
    // Encontrar aba do WhatsApp Web
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    
    if (tabs.length === 0) {
        return { success: false, error: 'WhatsApp Web não está aberto' };
    }
    
    // Prefer the "normal" WhatsApp Web tab (not the hidden worker tab)
    // Worker tabs usually include ?whl_worker=true and don't load the full sender bridge.
    const nonWorkerTabs = tabs.filter(t => {
      if (!t || typeof t.id !== 'number') return false;
      if (workerTabId && t.id === workerTabId) return false;
      const url = String(t.url || '');
      return !url.includes('whl_worker');
    });

    const whatsappTab = nonWorkerTabs[0] || tabs[0];
    
    try {
        // Enviar mensagem para o content script
        const result = await chrome.tabs.sendMessage(whatsappTab.id, {
            action: 'SEND_MESSAGE_URL',
            phone: phone,
            text: text,
            imageData: imageData
        });
        
        return result;
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Helper: timeout para evitar travas
function withTimeout(promise, ms = 45000) {
  let t;
  const timeout = new Promise((_, rej) => 
    t = setTimeout(() => rej(new Error('TIMEOUT')), ms)
  );
  return Promise.race([promise.finally(() => clearTimeout(t)), timeout]);
}

async function processNextInQueue() {
  if (!campaignState.isRunning || campaignState.isPaused) {
    return;
  }
  
  if (campaignState.currentIndex >= campaignQueue.length) {
    console.log('[WHL Background] 🎉 Campanha finalizada!');
    campaignState.isRunning = false;
    saveCampaignState();
    notifyPopup({ action: 'CAMPAIGN_COMPLETED' });
    
    // Update schedule status if this was a scheduled campaign
    if (campaignState.scheduleId) {
      await updateScheduleStatus(campaignState.scheduleId, 'completed', new Date().toISOString());
    }
    
    return;
  }
  
  // VERIFICAÇÃO ANTI-BAN: Checar limite antes de enviar
  try {
    const antiBanData = await chrome.storage.local.get('whl_anti_ban_data');
    const antiBan = antiBanData.whl_anti_ban_data || { sentToday: 0, dailyLimit: 200, businessHoursOnly: false };
    
    // Verificar reset diário
    const today = new Date().toISOString().split('T')[0];
    if (antiBan.lastResetDate !== today) {
      antiBan.sentToday = 0;
      antiBan.lastResetDate = today;
      await chrome.storage.local.set({ whl_anti_ban_data: antiBan });
    }
    
    // Verificar limite diário
    if (antiBan.sentToday >= (antiBan.dailyLimit || 200)) {
      console.warn(`[WHL Background] ⛔ ANTI-BAN: Limite diário atingido (${antiBan.sentToday}/${antiBan.dailyLimit})`);
      campaignState.isRunning = false;
      campaignState.isPaused = true;
      saveCampaignState();
      notifyPopup({ 
        action: 'ANTIBAN_LIMIT_REACHED', 
        message: `Limite diário atingido (${antiBan.sentToday}/${antiBan.dailyLimit || 200}). Campanha pausada.`
      });
      
      // Update schedule status
      if (campaignState.scheduleId) {
        await updateScheduleStatus(campaignState.scheduleId, 'paused_limit');
      }
      return;
    }
    
    // Verificar horário comercial (se ativado)
    if (antiBan.businessHoursOnly) {
      const hour = new Date().getHours();
      if (hour < 8 || hour > 20) {
        console.warn(`[WHL Background] ⛔ ANTI-BAN: Fora do horário comercial (${hour}h)`);
        campaignState.isRunning = false;
        campaignState.isPaused = true;
        saveCampaignState();
        notifyPopup({ 
          action: 'ANTIBAN_BUSINESS_HOURS', 
          message: `Fora do horário comercial (8h-20h). Atual: ${hour}h. Campanha pausada.`
        });
        return;
      }
    }
  } catch (e) {
    console.warn('[WHL Background] Erro ao verificar anti-ban:', e);
  }
  
  const current = campaignQueue[campaignState.currentIndex];
  
  if (!current || current.status === 'sent') {
    campaignState.currentIndex++;
    saveCampaignState();
    processNextInQueue();
    return;
  }

  // Skip invalid/empty numbers (keeps scheduled campaigns consistent with the in-page engine)
  if (!current.phone || current.valid === false) {
    current.status = 'failed';
    current.error = current.error || (current.valid === false ? 'Número inválido' : 'Número vazio');
    campaignState.currentIndex++;
    saveCampaignState();
    notifyPopup({ 
      action: 'SEND_RESULT',
      phone: current.phone || '',
      status: current.status,
      error: current.error
    });
    processNextInQueue();
    return;
  }
  
  console.log(`[WHL Background] Processando ${current.phone} (${campaignState.currentIndex + 1}/${campaignQueue.length})`);
  
  // Update status to "sending"
  current.status = 'sending';
  saveCampaignState();
  notifyPopup({ action: 'CAMPAIGN_PROGRESS', current: campaignState.currentIndex, total: campaignQueue.length });

  // Aplicar substituição de variáveis na mensagem
  const messageToSend = substituirVariaveis(campaignState.config?.message || '', current);

  let result;
  try {
    // Use withTimeout helper to prevent blocking
    result = await withTimeout(
      sendMessageToWhatsApp(
        current.phone, 
        messageToSend,
        campaignState.config?.imageData || null
      ),
      SEND_MESSAGE_TIMEOUT_MS
    );
  } catch (err) {
    result = { success: false, error: err.message };
  }
  
  // Atualizar status SEMPRE
  if (result && result.success) {
    current.status = 'sent';
    console.log(`[WHL Background] ✅ Enviado para ${current.phone}`);
    
    // IMPORTANTE: Incrementar contador do anti-ban e notificar UI
    try {
      const antiBanData = await chrome.storage.local.get('whl_anti_ban_data');
      const antiBan = antiBanData.whl_anti_ban_data || { sentToday: 0, dailyLimit: 200 };
      antiBan.sentToday = (antiBan.sentToday || 0) + 1;
      await chrome.storage.local.set({ 
        whl_anti_ban_data: antiBan,
        // Notificar UI via storage change
        whl_antiban_ui_update: {
          sentToday: antiBan.sentToday,
          dailyLimit: antiBan.dailyLimit || 200,
          percentage: Math.round((antiBan.sentToday / (antiBan.dailyLimit || 200)) * 100),
          timestamp: Date.now()
        }
      });
      console.log(`[WHL Background] 📊 Anti-Ban: ${antiBan.sentToday}/${antiBan.dailyLimit || 200}`);
    } catch (e) {
      console.error('[WHL Background] Erro ao atualizar anti-ban:', e);
    }
  } else {
    current.status = 'failed';
    current.error = result?.error || 'Unknown error';
    console.log(`[WHL Background] ❌ Falha: ${current.phone} - ${current.error}`);
  }
  
  // Move to next
  campaignState.currentIndex++;
  saveCampaignState();
  
  // Notify popup
  notifyPopup({ 
    action: 'SEND_RESULT', 
    phone: current.phone, 
    status: current.status,
    error: current.error 
  });
  
  // Delay humanizado
  // IMPORTANT:
  // - The Side Panel/UI stores delayMin/delayMax in **seconds** (ex: 2-6).
  // - Some older/legacy paths may have stored these values in **milliseconds**.
  // To keep backwards compatibility, we normalize here.
  const normalizeDelayToMs = (value, fallbackSeconds) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return Math.round(fallbackSeconds * 1000);
    // Heuristic: if it's bigger than 1000, assume it's already milliseconds.
    if (n > 1000) return Math.round(n);
    return Math.round(n * 1000);
  };

  const minDelay = normalizeDelayToMs(campaignState.config?.delayMin, 2);
  const maxDelay = Math.max(
    minDelay,
    normalizeDelayToMs(campaignState.config?.delayMax, 6)
  );
  const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  
  console.log(`[WHL Background] Waiting ${delay}ms before next...`);
  
  setTimeout(() => {
    processNextInQueue();
  }, delay);
}

function saveCampaignState() {
  // Salvar com TODAS as chaves para compatibilidade completa
  chrome.storage.local.get('whl_campaign_state_v1', (data) => {
    const existingState = data.whl_campaign_state_v1 || {};
    
    // Atualizar o state com a fila atual
    const updatedState = {
      ...existingState,
      queue: campaignQueue,
      isRunning: campaignState.isRunning,
      isPaused: campaignState.isPaused,
      index: campaignState.currentIndex
    };
    
    chrome.storage.local.set({
      campaignQueue,
      campaignState,
      // Para o sidepanel escutar via storage.onChanged
      whl_queue: campaignQueue,
      // Para o content.js (que usa GET_STATE)
      whl_campaign_state_v1: updatedState
    });
    
    console.log('[WHL Background] Estado salvo - Fila:', campaignQueue.length, 'items');
  });
}

function notifyPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup may be closed, ignore error
  });
}

// Cleanup when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === workerTabId) {
    console.log('[WHL Background] Worker tab was closed');
    workerTabId = null;
    chrome.storage.local.remove('workerTabId');
    
    // If campaign was running, pause it
    if (campaignState.isRunning) {
      campaignState.isPaused = true;
      saveCampaignState();
      notifyPopup({ action: 'WORKER_CLOSED' });
    }
  }
});


// ===== BUG FIX 3: Side Panel Tab Management =====
// Disable side panel when user navigates away from WhatsApp Web
// Enable it when user returns to WhatsApp Web

// Helper function to check if URL is WhatsApp Web
// Note: WhatsApp Web only uses web.whatsapp.com (no regional subdomains)
// If WhatsApp introduces regional domains in the future, update this function
function isWhatsAppWebURL(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    // Check for exact match - WhatsApp Web doesn't use subdomains
    return urlObj.hostname === 'web.whatsapp.com' && urlObj.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Listen for tab activation (user switches to different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    
    // BUG FIX 2: Set popup dynamically based on tab URL
    if (isWhatsAppWebURL(tab.url)) {
      // On WhatsApp: no popup, clicking icon opens side panel
      await chrome.action.setPopup({ popup: '' });
    } else {
      // On other tabs: show popup
      await chrome.action.setPopup({ popup: 'popup/popup.html' });
    }
    
    if (chrome.sidePanel && chrome.sidePanel.setOptions) {
      if (isWhatsAppWebURL(tab.url)) {
        // Enable side panel for WhatsApp Web tabs
        await chrome.sidePanel.setOptions({
          tabId: activeInfo.tabId,
          enabled: true,
          path: 'sidepanel.html'
        });
        console.log('[WHL Background] Side panel enabled for WhatsApp tab:', activeInfo.tabId);
      } else {
        // Disable side panel for non-WhatsApp tabs
        await chrome.sidePanel.setOptions({
          tabId: activeInfo.tabId,
          enabled: false
        });
        console.log('[WHL Background] Side panel disabled for non-WhatsApp tab:', activeInfo.tabId);
      }
    }
  } catch (e) {
    console.warn('[WHL Background] Error in onActivated listener:', e);
  }
});

// Listen for tab URL updates (user navigates within the same tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only act when URL changes
  if (changeInfo.url) {
    try {
      // BUG FIX 2: Set popup dynamically based on URL change
      if (isWhatsAppWebURL(changeInfo.url)) {
        // On WhatsApp: no popup, clicking icon opens side panel
        await chrome.action.setPopup({ popup: '' });
      } else {
        // On other tabs: show popup
        await chrome.action.setPopup({ popup: 'popup/popup.html' });
      }
      
      if (chrome.sidePanel && chrome.sidePanel.setOptions) {
        if (isWhatsAppWebURL(changeInfo.url)) {
          // Enable side panel for WhatsApp Web
          await chrome.sidePanel.setOptions({
            tabId: tabId,
            enabled: true,
            path: 'sidepanel.html'
          });
          console.log('[WHL Background] Side panel enabled after navigation to WhatsApp:', tabId);
        } else {
          // Disable side panel when leaving WhatsApp Web
          await chrome.sidePanel.setOptions({
            tabId: tabId,
            enabled: false
          });
          console.log('[WHL Background] Side panel disabled after navigation away from WhatsApp:', tabId);
        }
      }
    } catch (e) {
      console.warn('[WHL Background] Error in onUpdated listener:', e);
    }
  }
});

// ===== SCHEDULER: Handle Alarms =====
chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    // Check if it's a scheduler alarm
    if (alarm.name.startsWith('whl_schedule_')) {
      const scheduleId = alarm.name.replace('whl_schedule_', '');
      console.log('[WHL Background] ⏰ Alarm fired for schedule:', scheduleId);
      
      // Fetch schedule data from storage
      const data = await chrome.storage.local.get('whl_schedules');
      const schedules = data.whl_schedules || [];
      const schedule = schedules.find(s => s.id === scheduleId);
      
      if (!schedule) {
        console.error('[WHL Background] Schedule not found with ID:', scheduleId);
        return;
      }
      
      if (schedule.status !== 'pending') {
        console.log('[WHL Background] Schedule already executed with status:', schedule.status);
        return;
      }
      
      // Validate schedule data
      if (!schedule.queue || !Array.isArray(schedule.queue) || schedule.queue.length === 0) {
        console.error('[WHL Background] Schedule has invalid or empty queue:', scheduleId);
        await updateScheduleStatus(scheduleId, 'failed');
        return;
      }
      
      if (!schedule.config || typeof schedule.config !== 'object') {
        console.error('[WHL Background] Schedule has invalid config:', scheduleId);
        await updateScheduleStatus(scheduleId, 'failed');
        return;
      }
      
      console.log('[WHL Background] 🚀 Starting scheduled campaign:', schedule.name);
      
      // Update status to 'running'
      await updateScheduleStatus(scheduleId, 'running');
      
      // Start campaign directly in background
      try {
        const result = await startCampaign(schedule.queue, schedule.config, scheduleId);
        
        if (result.success) {
          console.log('[WHL Background] ✅ Scheduled campaign started:', schedule.name);
          
          // Send notification (optional - if active listeners are available)
          chrome.runtime.sendMessage({
            action: 'SCHEDULE_STARTED',
            scheduleName: schedule.name
          }).catch(() => {
            // No active listeners available, that's okay
          });
        } else {
          console.error('[WHL Background] ❌ Failed to start scheduled campaign:', result.error);
          await updateScheduleStatus(scheduleId, 'failed');
        }
      } catch (error) {
        console.error('[WHL Background] ❌ Exception starting scheduled campaign:', error);
        await updateScheduleStatus(scheduleId, 'failed');
      }
    }
  } catch (error) {
    console.error('[WHL Background] Error handling alarm:', error);
  }
});
