/**
 * 👥 CRM Module - Sistema CRM FUNCIONAL
 * WhatsHybrid v52 - TOTALMENTE EM PORTUGUÊS
 * Correções:
 * - Deal → Negócio (tradução completa)
 * - Etiquetas funcionando no modal do contato
 * - Abrir chat na MESMA aba via API interna
 * - Formatação R$ correta
 * - Negócios sem contato aparecem no Kanban
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'whl_crm_v2';

  const state = {
    initialized: false,
    contacts: [],
    deals: [],
    activities: [],
    pipeline: null
  };

  const DEFAULT_PIPELINE = {
    id: 'default',
    name: 'Pipeline Principal',
    stages: [
      { id: 'new', name: 'Novo', color: '#6B7280', icon: '🆕', order: 0 },
      { id: 'lead', name: 'Lead', color: '#8B5CF6', icon: '🎯', order: 1 },
      { id: 'contact', name: 'Contato Feito', color: '#3B82F6', icon: '📞', order: 2 },
      { id: 'proposal', name: 'Proposta', color: '#F59E0B', icon: '📋', order: 3 },
      { id: 'negotiation', name: 'Negociação', color: '#EC4899', icon: '💼', order: 4 },
      { id: 'won', name: 'Ganho', color: '#10B981', icon: '✅', order: 5 },
      { id: 'lost', name: 'Perdido', color: '#EF4444', icon: '❌', order: 6 }
    ]
  };

  // ==================== INIT & STORAGE ====================

  async function init() {
    if (state.initialized) return;
    await loadData();
    state.initialized = true;
    console.log('[CRM] ✅ Módulo inicializado com', state.contacts.length, 'contatos e', state.deals.length, 'negócios');
  }

  async function loadData() {
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY], result => {
        if (result[STORAGE_KEY]) {
          state.contacts = result[STORAGE_KEY].contacts || [];
          state.deals = result[STORAGE_KEY].deals || [];
          state.activities = result[STORAGE_KEY].activities || [];
          state.pipeline = result[STORAGE_KEY].pipeline || DEFAULT_PIPELINE;
        } else {
          state.pipeline = DEFAULT_PIPELINE;
        }
        resolve();
      });
    });
  }

  async function saveData() {
    return new Promise(resolve => {
      chrome.storage.local.set({
        [STORAGE_KEY]: {
          contacts: state.contacts,
          deals: state.deals,
          activities: state.activities,
          pipeline: state.pipeline
        }
      }, resolve);
    });
  }

  // ==================== CONTATOS ====================

  async function upsertContact(data) {
    const phone = normalizePhone(data.phone);
    if (!phone) return null;

    let contact = state.contacts.find(c => normalizePhone(c.phone) === phone);

    if (contact) {
      Object.assign(contact, {
        name: data.name || contact.name,
        email: data.email || contact.email,
        company: data.company || contact.company,
        notes: data.notes !== undefined ? data.notes : contact.notes,
        tags: data.tags || contact.tags,
        stage: data.stage || contact.stage,
        updatedAt: new Date().toISOString()
      });
    } else {
      contact = {
        id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        phone,
        name: data.name || '',
        email: data.email || '',
        company: data.company || '',
        notes: data.notes || '',
        tags: data.tags || [],
        stage: data.stage || 'new',
        source: data.source || 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.contacts.unshift(contact);
    }

    await saveData();
    return contact;
  }

  function getContact(phone) {
    const normalized = normalizePhone(phone);
    return state.contacts.find(c => normalizePhone(c.phone) === normalized);
  }

  function getContacts(filters = {}) {
    let contacts = [...state.contacts];
    if (filters.search) {
      const search = filters.search.toLowerCase();
      contacts = contacts.filter(c =>
        c.name?.toLowerCase().includes(search) ||
        c.phone?.includes(search) ||
        c.email?.toLowerCase().includes(search)
      );
    }
    if (filters.stage) {
      contacts = contacts.filter(c => c.stage === filters.stage);
    }
    return contacts;
  }

  async function deleteContact(id) {
    state.contacts = state.contacts.filter(c => c.id !== id);
    state.deals = state.deals.filter(d => d.contactId !== id);
    await saveData();
  }

  // ==================== NEGÓCIOS (DEALS) ====================

  async function createDeal(data) {
    const deal = {
      id: `deal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      contactId: data.contactId || null,
      title: data.title || 'Novo Negócio',
      value: data.value || 0,
      stageId: data.stageId || 'lead',
      notes: data.notes || '',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.deals.unshift(deal);
    await saveData();
    await addActivity({ type: 'deal_created', dealId: deal.id, contactId: deal.contactId, content: `Negócio criado: ${deal.title}` });
    return deal;
  }

  async function updateDeal(id, updates) {
    const deal = state.deals.find(d => d.id === id);
    if (!deal) return null;

    const previousStage = deal.stageId;
    Object.assign(deal, updates, { updatedAt: new Date().toISOString() });

    if (updates.stageId && updates.stageId !== previousStage) {
      const stage = getStage(updates.stageId);
      await addActivity({ type: 'deal_moved', dealId: deal.id, contactId: deal.contactId, content: `Movido para: ${stage?.name || updates.stageId}` });
      
      if (updates.stageId === 'won') {
        deal.status = 'won';
        deal.closedAt = new Date().toISOString();
      } else if (updates.stageId === 'lost') {
        deal.status = 'lost';
        deal.closedAt = new Date().toISOString();
      }
    }

    await saveData();
    return deal;
  }

  async function moveDeal(dealId, stageId) {
    return updateDeal(dealId, { stageId });
  }

  function getDeal(id) {
    return state.deals.find(d => d.id === id);
  }

  function getDeals(filters = {}) {
    let deals = [...state.deals];
    if (filters.stageId) deals = deals.filter(d => d.stageId === filters.stageId);
    if (filters.contactId) deals = deals.filter(d => d.contactId === filters.contactId);
    if (filters.status) deals = deals.filter(d => d.status === filters.status);
    return deals;
  }

  async function deleteDeal(id) {
    state.deals = state.deals.filter(d => d.id !== id);
    await saveData();
  }

  // ==================== PIPELINE ====================

  function getPipeline() {
    return state.pipeline || DEFAULT_PIPELINE;
  }

  function getStage(stageId) {
    const pipeline = getPipeline();
    return pipeline.stages.find(s => s.id === stageId);
  }

  function getKanbanData() {
    const pipeline = getPipeline();
    const stages = pipeline.stages.sort((a, b) => a.order - b.order);
    const itemsByStage = {};

    stages.forEach(stage => {
      // Incluir CONTACTS do estágio (compatibilidade com CRM standalone)
      const contactsInStage = state.contacts
        .filter(c => c.stage === stage.id)
        .map(contact => ({
          id: contact.id,
          title: contact.name || contact.phone || 'Sem nome',
          value: contact.value || 0,
          stageId: stage.id,
          status: 'open',
          contactId: contact.id,
          contact: contact,
          isContact: true
        }));
      
      // Incluir DEALS do estágio
      const dealsInStage = state.deals
        .filter(d => d.stageId === stage.id && d.status === 'open')
        .map(deal => {
          const contact = deal.contactId ? state.contacts.find(c => c.id === deal.contactId) : null;
          return { ...deal, contact, isContact: false };
        });
      
      // Combinar (evitar duplicatas - deals já vinculados a contacts)
      const dealContactIds = dealsInStage.map(d => d.contactId).filter(Boolean);
      const uniqueContacts = contactsInStage.filter(c => !dealContactIds.includes(c.contactId));
      
      itemsByStage[stage.id] = [...dealsInStage, ...uniqueContacts];
    });

    return { stages, deals: itemsByStage };
  }

  function getPipelineMetrics() {
    // Contar deals
    const deals = state.deals;
    const openDeals = deals.filter(d => d.status === 'open');
    const wonDeals = deals.filter(d => d.status === 'won');
    const lostDeals = deals.filter(d => d.status === 'lost');

    // Contar contacts por stage
    const wonContacts = state.contacts.filter(c => c.stage === 'won');
    const lostContacts = state.contacts.filter(c => c.stage === 'lost');
    const totalContacts = state.contacts.length;
    
    // Valores
    const dealValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const contactValue = state.contacts.reduce((sum, c) => sum + (c.value || 0), 0);
    const totalValue = dealValue + contactValue;
    
    const wonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0) +
                     wonContacts.reduce((sum, c) => sum + (c.value || 0), 0);
    
    const totalWon = wonDeals.length + wonContacts.length;
    const totalLost = lostDeals.length + lostContacts.length;
    const closedTotal = totalWon + totalLost;
    const conversionRate = closedTotal > 0 ? (totalWon / closedTotal * 100) : 0;
    
    const totalOpen = openDeals.length + state.contacts.filter(c => !['won', 'lost'].includes(c.stage)).length;

    return {
      totalDeals: deals.length + totalContacts,
      openDeals: totalOpen,
      wonDeals: totalWon,
      lostDeals: totalLost,
      totalValue,
      wonValue,
      conversionRate: parseFloat(conversionRate.toFixed(1)),
      avgDealValue: totalOpen > 0 ? Math.round(totalValue / totalOpen) : 0
    };
  }

  // ==================== ATIVIDADES ====================

  async function addActivity(data) {
    const activity = {
      id: `activity_${Date.now()}`,
      type: data.type || 'note',
      dealId: data.dealId || null,
      contactId: data.contactId || null,
      content: data.content || '',
      createdAt: new Date().toISOString()
    };

    state.activities.unshift(activity);
    if (state.activities.length > 500) {
      state.activities = state.activities.slice(0, 500);
    }

    await saveData();
    return activity;
  }

  function getActivities(filters = {}) {
    let activities = [...state.activities];
    if (filters.dealId) activities = activities.filter(a => a.dealId === filters.dealId);
    if (filters.contactId) activities = activities.filter(a => a.contactId === filters.contactId);
    return activities.slice(0, filters.limit || 50);
  }

  // ==================== RENDERIZAÇÃO KANBAN ====================

  function renderKanban(container) {
    if (!container) return;

    const { stages, deals } = getKanbanData();
    const metrics = getPipelineMetrics();

    container.innerHTML = `
      <div class="whl-crm-kanban">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">
          <div style="background:rgba(139,92,246,0.1);padding:12px;border-radius:10px;text-align:center;">
            <div style="font-size:20px;font-weight:700;color:#8b5cf6;">${metrics.openDeals}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.6);">Em Aberto</div>
          </div>
          <div style="background:rgba(59,130,246,0.1);padding:12px;border-radius:10px;text-align:center;">
            <div style="font-size:16px;font-weight:700;color:#3b82f6;white-space:nowrap;">${formatCurrency(metrics.totalValue)}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.6);">Valor Total</div>
          </div>
          <div style="background:rgba(245,158,11,0.1);padding:12px;border-radius:10px;text-align:center;">
            <div style="font-size:20px;font-weight:700;color:#f59e0b;">${metrics.conversionRate}%</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.6);">Conversão</div>
          </div>
          <div style="background:rgba(16,185,129,0.1);padding:12px;border-radius:10px;text-align:center;">
            <div style="font-size:20px;font-weight:700;color:#10b981;">${metrics.wonDeals}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.6);">Ganhos</div>
          </div>
        </div>

        <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;" id="kanban-board">
          ${stages.filter(s => !['won', 'lost'].includes(s.id)).map(stage => `
            <div class="kanban-column" data-stage-id="${stage.id}" style="min-width:200px;flex:1;background:rgba(0,0,0,0.2);border-radius:12px;padding:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;margin-bottom:10px;border-bottom:2px solid ${stage.color};">
                <span style="font-size:13px;font-weight:600;color:white;">${stage.icon} ${stage.name}</span>
                <span style="font-size:11px;background:${stage.color}30;color:${stage.color};padding:2px 8px;border-radius:10px;">${(deals[stage.id] || []).length}</span>
              </div>
              <div class="kanban-cards" data-stage-id="${stage.id}" style="min-height:100px;">
                ${(deals[stage.id] || []).map(deal => renderDealCard(deal, stage)).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    setupKanbanEventListeners(container);
    setupDragAndDrop(container);
  }

  function renderDealCard(deal, stage) {
    // Se é um contact (não um deal), usar layout diferente
    if (deal.isContact) {
      const contact = deal.contact;
      return `
        <div class="deal-card contact-card-mini" data-contact-id="${contact.id}" data-phone="${contact.phone || ''}" draggable="true" style="
          background:rgba(26,26,46,0.9);border:1px solid rgba(255,255,255,0.1);
          border-left:3px solid ${stage.color};border-radius:8px;padding:10px;margin-bottom:8px;cursor:grab;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
            <div style="font-size:13px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:white;">
              👤 ${escapeHtml(contact.name || 'Sem nome')}
            </div>
            ${deal.value > 0 ? `<div style="font-size:12px;font-weight:700;color:#10b981;margin-left:8px;white-space:nowrap;">${formatCurrency(deal.value)}</div>` : ''}
          </div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:4px;">
            📱 ${contact.phone || 'Sem telefone'}
          </div>
          <div style="display:flex;gap:4px;margin-top:8px;">
            <button class="contact-btn-view" data-contact-id="${contact.id}" style="
              flex:1;background:rgba(139,92,246,0.2);border:none;border-radius:4px;
              padding:4px;font-size:10px;cursor:pointer;color:#a78bfa;">📋 Ver</button>
            ${contact.phone ? `
              <button class="contact-btn-message" data-phone="${contact.phone}" style="
                flex:1;background:rgba(59,130,246,0.2);border:none;border-radius:4px;
                padding:4px;font-size:10px;cursor:pointer;color:#60a5fa;">💬 Msg</button>
            ` : ''}
          </div>
        </div>
      `;
    }
    
    // Deal normal
    return `
      <div class="deal-card" data-deal-id="${deal.id}" draggable="true" style="
        background:rgba(26,26,46,0.9);border:1px solid rgba(255,255,255,0.1);
        border-left:3px solid ${stage.color};border-radius:8px;padding:10px;margin-bottom:8px;cursor:grab;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
          <div style="font-size:13px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:white;">
            ${escapeHtml(deal.title)}
          </div>
          <div style="font-size:12px;font-weight:700;color:#10b981;margin-left:8px;white-space:nowrap;">${formatCurrency(deal.value)}</div>
        </div>
        ${deal.contact ? `
          <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:4px;">
            👤 ${escapeHtml(deal.contact.name || deal.contact.phone)}
          </div>
        ` : `
          <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px;font-style:italic;">
            ⚠️ Sem contato vinculado
          </div>
        `}
        <div style="display:flex;gap:4px;margin-top:8px;">
          <button class="deal-btn-details" data-deal-id="${deal.id}" style="
            flex:1;background:rgba(139,92,246,0.2);border:none;border-radius:4px;
            padding:4px;font-size:10px;cursor:pointer;color:#a78bfa;">📋 Info</button>
          ${deal.contact ? `
            <button class="deal-btn-contact" data-deal-id="${deal.id}" style="
              flex:1;background:rgba(16,185,129,0.2);border:none;border-radius:4px;
              padding:4px;font-size:10px;cursor:pointer;color:#34d399;">👤 Ver</button>
            <button class="deal-btn-message" data-deal-id="${deal.id}" style="
              flex:1;background:rgba(59,130,246,0.2);border:none;border-radius:4px;
              padding:4px;font-size:10px;cursor:pointer;color:#60a5fa;">💬 Msg</button>
          ` : `
            <button class="deal-btn-delete" data-deal-id="${deal.id}" style="
              flex:1;background:rgba(239,68,68,0.2);border:none;border-radius:4px;
              padding:4px;font-size:10px;cursor:pointer;color:#f87171;">🗑️ Excluir</button>
          `}
        </div>
      </div>
    `;
  }

  function setupKanbanEventListeners(container) {
    // Botão Info (detalhes do negócio)
    container.querySelectorAll('.deal-btn-details').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDealModal(btn.dataset.dealId);
      });
    });

    // Botão Ver (contato)
    container.querySelectorAll('.deal-btn-contact').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showContactFromDeal(btn.dataset.dealId);
      });
    });

    // Botão Msg (WhatsApp) - deals
    container.querySelectorAll('.deal-btn-message').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sendMessageToDeal(btn.dataset.dealId);
      });
    });

    // Botão Excluir (para negócios sem contato)
    container.querySelectorAll('.deal-btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Excluir este negócio?')) {
          await deleteDeal(btn.dataset.dealId);
          notify('Negócio excluído', 'success');
          const kanbanContainer = document.getElementById('crm_kanban_container');
          if (kanbanContainer) renderKanban(kanbanContainer);
        }
      });
    });
    
    // === CONTACT BUTTONS ===
    
    // Botão Ver contato
    container.querySelectorAll('.contact-btn-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const contactId = btn.dataset.contactId;
        const contact = state.contacts.find(c => c.id === contactId);
        if (contact) {
          showContactModal(contact);
        }
      });
    });
    
    // Botão Msg contato (WhatsApp)
    container.querySelectorAll('.contact-btn-message').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const phone = btn.dataset.phone;
        if (phone) {
          openChatInSameTab(phone);
        }
      });
    });
  }

  function setupDragAndDrop(container) {
    const cards = container.querySelectorAll('.deal-card');
    const columns = container.querySelectorAll('.kanban-cards');

    cards.forEach(card => {
      card.addEventListener('dragstart', e => {
        // Suportar tanto deal quanto contact
        if (card.dataset.dealId) {
          e.dataTransfer.setData('dealId', card.dataset.dealId);
          e.dataTransfer.setData('type', 'deal');
        } else if (card.dataset.contactId) {
          e.dataTransfer.setData('contactId', card.dataset.contactId);
          e.dataTransfer.setData('type', 'contact');
        }
        card.style.opacity = '0.5';
      });
      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
      });
    });

    columns.forEach(column => {
      column.addEventListener('dragover', e => {
        e.preventDefault();
        column.style.background = 'rgba(139,92,246,0.1)';
      });
      column.addEventListener('dragleave', () => {
        column.style.background = 'transparent';
      });
      column.addEventListener('drop', async e => {
        e.preventDefault();
        column.style.background = 'transparent';
        
        const type = e.dataTransfer.getData('type');
        const newStageId = column.dataset.stageId;
        
        if (type === 'deal') {
          const dealId = e.dataTransfer.getData('dealId');
          if (dealId && newStageId) {
            await moveDeal(dealId, newStageId);
          }
        } else if (type === 'contact') {
          const contactId = e.dataTransfer.getData('contactId');
          if (contactId && newStageId) {
            // Mover contact
            const contact = state.contacts.find(c => c.id === contactId);
            if (contact) {
              contact.stage = newStageId;
              contact.updatedAt = new Date().toISOString();
              await saveData();
              notify(`Contato movido para ${getStage(newStageId)?.name || newStageId}`, 'success');
            }
          }
        }
        
        const kanbanContainer = document.getElementById('crm_kanban_container');
        if (kanbanContainer) renderKanban(kanbanContainer);
      });
    });
  }

  // ==================== MODAIS ====================

  function createModal(id, content) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'crm-modal-overlay';
    modal.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;
      background:rgba(0,0,0,0.85);
      display:flex;align-items:center;justify-content:center;
      z-index:10001;
    `;
    modal.innerHTML = content;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => modal.remove());
    }

    const cancelBtn = modal.querySelector('.modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => modal.remove());
    }

    return modal;
  }

  /**
   * Modal de detalhes do Negócio
   */
  function showDealModal(dealId) {
    const deal = getDeal(dealId);
    if (!deal) {
      notify('Negócio não encontrado', 'error');
      return;
    }

    const contact = deal.contactId ? state.contacts.find(c => c.id === deal.contactId) : null;
    const stages = getPipeline().stages;

    const modal = createModal('crm-deal-modal', `
      <div style="background:#1a1a2e;border-radius:16px;padding:24px;width:90%;max-width:400px;max-height:80vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;font-size:18px;color:white;">📋 ${escapeHtml(deal.title)}</h3>
          <button class="modal-close-btn" style="background:none;border:none;font-size:24px;cursor:pointer;color:rgba(255,255,255,0.6);line-height:1;">×</button>
        </div>

        <div style="font-size:24px;font-weight:700;color:#10b981;margin-bottom:16px;">${formatCurrency(deal.value)}</div>

        ${contact ? `
          <div style="background:rgba(139,92,246,0.1);padding:12px;border-radius:8px;margin-bottom:16px;">
            <div style="font-size:14px;font-weight:600;color:white;">👤 ${escapeHtml(contact.name || contact.phone)}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">${contact.phone}</div>
          </div>
        ` : '<div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;margin-bottom:16px;color:rgba(255,255,255,0.5);">⚠️ Nenhum contato vinculado</div>'}

        <div style="margin-bottom:16px;">
          <label style="font-size:12px;color:rgba(255,255,255,0.6);">Estágio</label>
          <select id="deal-stage-select" style="width:100%;padding:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;margin-top:4px;">
            ${stages.map(s => `<option value="${s.id}" ${deal.stageId === s.id ? 'selected' : ''}>${s.icon} ${s.name}</option>`).join('')}
          </select>
        </div>

        <div style="display:flex;gap:8px;">
          <button class="modal-save-btn" style="flex:1;background:linear-gradient(135deg,#8b5cf6,#3b82f6);border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;color:white;">💾 Salvar</button>
          <button class="modal-delete-btn" style="background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.3);padding:12px 16px;border-radius:8px;cursor:pointer;color:#ef4444;">🗑️</button>
        </div>
      </div>
    `);

    modal.querySelector('.modal-save-btn').addEventListener('click', async () => {
      const newStage = modal.querySelector('#deal-stage-select').value;
      await updateDeal(dealId, { stageId: newStage });
      modal.remove();
      notify('Negócio atualizado!', 'success');
      const kanbanContainer = document.getElementById('crm_kanban_container');
      if (kanbanContainer) renderKanban(kanbanContainer);
    });

    modal.querySelector('.modal-delete-btn').addEventListener('click', async () => {
      if (confirm('Excluir este negócio?')) {
        await deleteDeal(dealId);
        modal.remove();
        notify('Negócio excluído', 'success');
        const kanbanContainer = document.getElementById('crm_kanban_container');
        if (kanbanContainer) renderKanban(kanbanContainer);
      }
    });
  }

  function showContactFromDeal(dealId) {
    const deal = getDeal(dealId);
    if (!deal?.contactId) {
      notify('Negócio não tem contato vinculado', 'warning');
      return;
    }

    const contact = state.contacts.find(c => c.id === deal.contactId);
    if (!contact) {
      notify('Contato não encontrado', 'error');
      return;
    }

    showContactModal(contact);
  }

  /**
   * Modal de detalhes do Contato - COM ETIQUETAS
   */
  function showContactModal(contact) {
    const stage = getStage(contact.stage);
    const contactDeals = state.deals.filter(d => d.contactId === contact.id);
    
    // Obter etiquetas do contato
    const contactLabels = window.LabelsModule?.getContactLabels(contact.phone) || [];
    const allLabels = window.LabelsModule?.getLabels() || [];

    const modal = createModal('crm-contact-modal', `
      <div style="background:#1a1a2e;border-radius:16px;padding:0;width:90%;max-width:450px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#8b5cf6,#3b82f6);padding:24px;text-align:center;position:relative;">
          <button class="modal-close-btn" style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,0.2);border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;color:white;line-height:1;">×</button>
          <div style="width:70px;height:70px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:28px;color:white;">
            ${(contact.name || '?')[0].toUpperCase()}
          </div>
          <div style="font-size:18px;font-weight:700;color:white;">${escapeHtml(contact.name || 'Sem nome')}</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.9);margin-top:4px;">${contact.phone}</div>
          ${contact.email ? `<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">${contact.email}</div>` : ''}
        </div>

        <!-- Conteúdo -->
        <div style="padding:20px;overflow-y:auto;flex:1;">
          
          <!-- Etiquetas -->
          <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div style="font-size:12px;color:rgba(255,255,255,0.5);">🏷️ Etiquetas</div>
              <button class="btn-manage-labels" style="font-size:11px;padding:4px 8px;background:rgba(139,92,246,0.2);border:1px solid rgba(139,92,246,0.3);border-radius:6px;color:#a78bfa;cursor:pointer;">+ Gerenciar</button>
            </div>
            <div class="contact-labels-container" style="display:flex;flex-wrap:wrap;gap:6px;min-height:30px;">
              ${contactLabels.length > 0 ? contactLabels.map(label => `
                <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${label.color}30;color:${label.color};">
                  ${label.icon || '🏷️'} ${label.name}
                </span>
              `).join('') : '<span style="color:rgba(255,255,255,0.4);font-size:12px;font-style:italic;">Nenhuma etiqueta</span>'}
            </div>
          </div>

          <!-- Info Grid -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="padding:12px;background:rgba(139,92,246,0.1);border-radius:10px;">
              <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:4px;">Estágio</div>
              <div style="font-size:14px;font-weight:600;color:${stage?.color || '#8b5cf6'};">${stage?.icon || '📋'} ${stage?.name || 'Novo'}</div>
            </div>
            <div style="padding:12px;background:rgba(59,130,246,0.1);border-radius:10px;">
              <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:4px;">Empresa</div>
              <div style="font-size:14px;font-weight:600;color:white;">${escapeHtml(contact.company) || '-'}</div>
            </div>
          </div>

          <!-- Negócios -->
          ${contactDeals.length > 0 ? `
            <div style="margin-bottom:16px;">
              <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px;">💼 Negócios (${contactDeals.length})</div>
              ${contactDeals.map(d => {
                const dStage = getStage(d.stageId);
                return `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:rgba(0,0,0,0.2);border-radius:8px;margin-bottom:6px;">
                    <div>
                      <div style="font-size:13px;font-weight:600;color:white;">${escapeHtml(d.title)}</div>
                      <div style="font-size:11px;color:${dStage?.color || '#888'};">${dStage?.icon || ''} ${dStage?.name || d.stageId}</div>
                    </div>
                    <div style="font-size:14px;font-weight:700;color:#10b981;">${formatCurrency(d.value)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- Notas -->
          ${contact.notes ? `
            <div style="margin-bottom:16px;">
              <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px;">📝 Notas</div>
              <div style="padding:12px;background:rgba(0,0,0,0.2);border-radius:8px;font-size:13px;color:rgba(255,255,255,0.8);line-height:1.5;">${escapeHtml(contact.notes)}</div>
            </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="padding:16px;border-top:1px solid rgba(255,255,255,0.1);display:flex;gap:8px;">
          <button class="modal-edit-btn" style="flex:1;padding:12px;background:rgba(255,255,255,0.1);border:none;border-radius:8px;cursor:pointer;color:white;font-weight:600;">✏️ Editar</button>
          <button class="modal-whatsapp-btn" style="flex:1;padding:12px;background:linear-gradient(135deg,#25D366,#128C7E);border:none;border-radius:8px;cursor:pointer;color:white;font-weight:600;">💬 WhatsApp</button>
        </div>
      </div>
    `);

    // Gerenciar Etiquetas
    modal.querySelector('.btn-manage-labels').addEventListener('click', () => {
      showLabelPickerForContact(contact.phone, modal);
    });

    // Editar
    modal.querySelector('.modal-edit-btn').addEventListener('click', () => {
      modal.remove();
      editContact(contact.id);
    });

    // WhatsApp - ABRE NA MESMA ABA
    modal.querySelector('.modal-whatsapp-btn').addEventListener('click', () => {
      openChatInSameTab(contact.phone);
      modal.remove();
    });
  }

  /**
   * Picker de etiquetas para contato
   */
  function showLabelPickerForContact(phone, parentModal) {
    const allLabels = window.LabelsModule?.getLabels() || [];
    const contactLabelIds = (window.LabelsModule?.getContactLabels(phone) || []).map(l => l.id);

    const picker = document.createElement('div');
    picker.id = 'label-picker-modal';
    picker.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;
      background:rgba(0,0,0,0.9);
      display:flex;align-items:center;justify-content:center;
      z-index:10002;
    `;

    picker.innerHTML = `
      <div style="background:#1a1a2e;border-radius:16px;padding:20px;width:90%;max-width:350px;max-height:70vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;font-size:16px;color:white;">🏷️ Selecionar Etiquetas</h3>
          <button class="picker-close-btn" style="background:none;border:none;font-size:20px;cursor:pointer;color:rgba(255,255,255,0.6);">×</button>
        </div>
        
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${allLabels.map(label => `
            <div class="label-option" data-label-id="${label.id}" style="
              display:flex;align-items:center;gap:12px;padding:12px;
              background:${contactLabelIds.includes(label.id) ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)'};
              border:1px solid ${contactLabelIds.includes(label.id) ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)'};
              border-radius:10px;cursor:pointer;transition:all 0.2s;
            ">
              <div style="width:24px;height:24px;border-radius:50%;background:${label.color};display:flex;align-items:center;justify-content:center;font-size:12px;">${label.icon || '🏷️'}</div>
              <span style="flex:1;color:white;font-weight:500;">${label.name}</span>
              ${contactLabelIds.includes(label.id) ? '<span style="color:#10b981;font-size:16px;">✓</span>' : ''}
            </div>
          `).join('')}
        </div>
        
        <button class="picker-done-btn" style="width:100%;margin-top:16px;padding:12px;background:linear-gradient(135deg,#8b5cf6,#3b82f6);border:none;border-radius:8px;color:white;font-weight:600;cursor:pointer;">✓ Concluído</button>
      </div>
    `;

    document.body.appendChild(picker);

    // Toggle etiqueta
    picker.querySelectorAll('.label-option').forEach(opt => {
      opt.addEventListener('click', async () => {
        const labelId = opt.dataset.labelId;
        const isSelected = contactLabelIds.includes(labelId);
        
        if (isSelected) {
          await window.LabelsModule?.removeLabelFromContact(phone, labelId);
          contactLabelIds.splice(contactLabelIds.indexOf(labelId), 1);
          opt.style.background = 'rgba(255,255,255,0.05)';
          opt.style.borderColor = 'rgba(255,255,255,0.1)';
          opt.querySelector('span:last-child')?.remove();
        } else {
          await window.LabelsModule?.addLabelToContact(phone, labelId);
          contactLabelIds.push(labelId);
          opt.style.background = 'rgba(139,92,246,0.2)';
          opt.style.borderColor = 'rgba(139,92,246,0.4)';
          opt.insertAdjacentHTML('beforeend', '<span style="color:#10b981;font-size:16px;">✓</span>');
        }
      });
    });

    // Fechar
    picker.querySelector('.picker-close-btn').addEventListener('click', () => picker.remove());
    picker.querySelector('.picker-done-btn').addEventListener('click', () => {
      picker.remove();
      // Atualizar modal do contato
      const contactModal = document.getElementById('crm-contact-modal');
      if (contactModal) {
        const contact = state.contacts.find(c => normalizePhone(c.phone) === normalizePhone(phone));
        if (contact) {
          contactModal.remove();
          showContactModal(contact);
        }
      }
    });

    picker.addEventListener('click', e => {
      if (e.target === picker) picker.remove();
    });
  }

  /**
   * Modal de edição do Contato
   */
  function editContact(contactId) {
    const contact = state.contacts.find(c => c.id === contactId);
    if (!contact) return;

    const stages = getPipeline().stages;

    const modal = createModal('crm-edit-contact-modal', `
      <div style="background:#1a1a2e;border-radius:16px;padding:24px;width:90%;max-width:400px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="margin:0;font-size:18px;color:white;">✏️ Editar Contato</h3>
          <button class="modal-close-btn" style="background:none;border:none;font-size:24px;cursor:pointer;color:rgba(255,255,255,0.6);line-height:1;">×</button>
        </div>

        <form id="edit-contact-form" style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.6);">Telefone</label>
            <input type="text" value="${contact.phone}" disabled style="width:100%;padding:10px;background:rgba(0,0,0,0.3);opacity:0.6;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.6);">Nome</label>
            <input type="text" id="edit-name" value="${escapeHtml(contact.name || '')}" style="width:100%;padding:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.6);">Email</label>
            <input type="email" id="edit-email" value="${escapeHtml(contact.email || '')}" style="width:100%;padding:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.6);">Empresa</label>
            <input type="text" id="edit-company" value="${escapeHtml(contact.company || '')}" style="width:100%;padding:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.6);">Estágio</label>
            <select id="edit-stage" style="width:100%;padding:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;margin-top:4px;">
              ${stages.map(s => `<option value="${s.id}" ${contact.stage === s.id ? 'selected' : ''}>${s.icon} ${s.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.6);">Notas</label>
            <textarea id="edit-notes" rows="3" style="width:100%;padding:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;margin-top:4px;resize:vertical;">${escapeHtml(contact.notes || '')}</textarea>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button type="button" class="modal-cancel-btn" style="flex:1;padding:12px;background:rgba(255,255,255,0.1);border:none;border-radius:8px;color:white;cursor:pointer;">Cancelar</button>
            <button type="submit" style="flex:1;padding:12px;background:linear-gradient(135deg,#8b5cf6,#3b82f6);border:none;border-radius:8px;color:white;font-weight:600;cursor:pointer;">💾 Salvar</button>
          </div>
        </form>
      </div>
    `);

    modal.querySelector('#edit-contact-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await upsertContact({
        phone: contact.phone,
        name: modal.querySelector('#edit-name').value,
        email: modal.querySelector('#edit-email').value,
        company: modal.querySelector('#edit-company').value,
        stage: modal.querySelector('#edit-stage').value,
        notes: modal.querySelector('#edit-notes').value
      });
      modal.remove();
      notify('Contato atualizado!', 'success');
      if (window.renderModuleViews) window.renderModuleViews();
    });
  }

  /**
   * Abrir chat na MESMA ABA via API interna
   */
  function openChatInSameTab(phone) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    
    // Enviar mensagem para o content script abrir o chat
    chrome.runtime.sendMessage({
      type: 'WHL_OPEN_CHAT',
      phone: cleanPhone
    }, response => {
      if (!response?.success) {
        // Fallback: tentar via tabs
        chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, tabs => {
          if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'WHL_OPEN_CHAT',
              phone: cleanPhone
            });
            // Focar na aba do WhatsApp
            chrome.tabs.update(tabs[0].id, { active: true });
          } else {
            // Último recurso: abrir nova aba
            window.open(`https://web.whatsapp.com/send?phone=${cleanPhone}`, '_blank');
          }
        });
      }
    });

    notify(`Abrindo conversa...`, 'success');
    
    addActivity({
      type: 'message',
      content: `Abriu conversa com ${phone}`
    });
  }

  /**
   * Enviar mensagem para negócio
   */
  function sendMessageToDeal(dealId) {
    const deal = getDeal(dealId);
    if (!deal?.contactId) {
      notify('Negócio não tem contato vinculado', 'warning');
      return;
    }

    const contact = state.contacts.find(c => c.id === deal.contactId);
    if (!contact?.phone) {
      notify('Contato não tem telefone', 'warning');
      return;
    }

    openChatInSameTab(contact.phone);

    addActivity({
      type: 'message',
      dealId: deal.id,
      contactId: contact.id,
      content: `Iniciou conversa com ${contact.name || contact.phone}`
    });
  }

  // ==================== ATIVIDADES RENDER ====================

  function renderActivities(container, filters = {}) {
    const activities = getActivities(filters);
    const typeIcons = {
      note: '📝', call: '📞', message: '💬', email: '📧',
      meeting: '📅', deal_created: '🎯', deal_moved: '📊', stage_change: '🔄', task: '✅'
    };

    container.innerHTML = activities.length === 0
      ? '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.5);">Nenhuma atividade registrada</div>'
      : activities.map(a => `
          <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
            <div style="width:32px;height:32px;background:rgba(139,92,246,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">${typeIcons[a.type] || '📋'}</div>
            <div style="flex:1;">
              <div style="font-size:13px;color:white;">${escapeHtml(a.content)}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;">${formatRelativeTime(a.createdAt)}</div>
            </div>
          </div>
        `).join('');
  }

  // ==================== HELPERS ====================

  function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Formata moeda - SEMPRE mostra R$ à esquerda
   */
  function formatCurrency(value) {
    const num = Number(value || 0);
    return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  function formatRelativeTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return formatDate(dateStr);
  }

  function notify(message, type = 'info') {
    if (window.NotificationsModule) {
      if (type === 'success') window.NotificationsModule.success(message);
      else if (type === 'error') window.NotificationsModule.error(message);
      else if (type === 'warning') window.NotificationsModule.warning(message);
      else window.NotificationsModule.info(message);
    } else {
      console.log(`[CRM] ${type}: ${message}`);
    }
  }

  function exportData() {
    return {
      contacts: state.contacts,
      deals: state.deals,
      activities: state.activities,
      pipeline: state.pipeline
    };
  }

  // ==================== API PÚBLICA ====================

  window.CRMModule = {
    init,
    // Contatos
    upsertContact,
    getContact,
    getContacts,
    deleteContact,
    showContactModal,
    editContact,
    // Negócios
    createDeal,
    updateDeal,
    moveDeal,
    getDeal,
    getDeals,
    deleteDeal,
    // Pipeline
    getPipeline,
    getStage,
    getKanbanData,
    getPipelineMetrics,
    // Atividades
    addActivity,
    getActivities,
    // UI
    renderKanban,
    renderActivities,
    showDealModal,
    sendMessageToDeal,
    showContactFromDeal,
    openChatInSameTab,
    showLabelPickerForContact,
    // Dados
    exportData,
    // Recarregar dados
    reloadData: loadData
  };

  // ==================== SINCRONIZAÇÃO COM STORAGE ====================
  // Escuta mudanças do storage (quando CRM em aba separada salva dados)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      console.log('[CRM] 🔄 Dados alterados externamente, recarregando...');
      loadData().then(() => {
        // Re-renderizar se a função existir
        if (typeof window.renderModuleViews === 'function') {
          window.renderModuleViews();
        }
      });
    }
  });

  console.log('[CRM] Módulo v53 carregado - Sincronização ativada');

})();
