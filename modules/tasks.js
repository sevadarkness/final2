/**
 * 📋 Tasks Module - Sistema de Tarefas FUNCIONAL
 * Baseado no Quantum CRM TaskService
 * Inclui: Tarefas, Lembretes, Prioridades, Vínculos com Contatos
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'whl_tasks_v2';

  const TASK_STATUS = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  };

  const TASK_PRIORITY = {
    LOW: { id: 'low', label: 'Baixa', color: '#10B981', icon: '🟢' },
    MEDIUM: { id: 'medium', label: 'Média', color: '#F59E0B', icon: '🟡' },
    HIGH: { id: 'high', label: 'Alta', color: '#EF4444', icon: '🔴' },
    URGENT: { id: 'urgent', label: 'Urgente', color: '#DC2626', icon: '🔥' }
  };

  const TASK_TYPES = {
    FOLLOW_UP: { id: 'follow_up', label: 'Follow-up', icon: '📞' },
    MESSAGE: { id: 'message', label: 'Enviar mensagem', icon: '💬' },
    CALL: { id: 'call', label: 'Ligar', icon: '📱' },
    MEETING: { id: 'meeting', label: 'Reunião', icon: '📅' },
    EMAIL: { id: 'email', label: 'E-mail', icon: '📧' },
    OTHER: { id: 'other', label: 'Outro', icon: '📝' }
  };

  // Estado
  const state = {
    initialized: false,
    tasks: [],
    reminderIntervalId: null
  };

  /**
   * Inicializa o módulo
   */
  async function init() {
    if (state.initialized) return;

    await loadTasks();
    startReminderChecker();

    state.initialized = true;
    console.log('[Tasks] ✅ Módulo inicializado com', state.tasks.length, 'tarefas');

    if (window.EventBus) {
      window.EventBus.emit(window.WHL_EVENTS?.MODULE_LOADED, { module: 'tasks' });
    }
  }

  /**
   * Carrega tarefas
   */
  async function loadTasks() {
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY], result => {
        state.tasks = result[STORAGE_KEY] || [];
        resolve();
      });
    });
  }

  /**
   * Salva tarefas
   */
  async function saveTasks() {
    return new Promise(resolve => {
      chrome.storage.local.set({ [STORAGE_KEY]: state.tasks }, resolve);
    });
  }

  /**
   * Cria tarefa
   */
  async function createTask(data) {
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      title: data.title || 'Nova tarefa',
      description: data.description || '',
      type: data.type || 'other',
      priority: data.priority || 'medium',
      status: TASK_STATUS.PENDING,
      contactPhone: data.contactPhone || null,
      contactName: data.contactName || null,
      dueDate: data.dueDate || null,
      reminderDate: data.reminderDate || null,
      reminderShown: false,
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null
    };

    state.tasks.unshift(task);
    await saveTasks();

    if (window.EventBus) {
      window.EventBus.emit(window.WHL_EVENTS?.TASK_CREATED, task);
    }

    console.log('[Tasks] Tarefa criada:', task.title);
    return task;
  }

  /**
   * Atualiza tarefa
   */
  async function updateTask(id, updates) {
    const index = state.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    state.tasks[index] = {
      ...state.tasks[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (updates.status === TASK_STATUS.COMPLETED) {
      state.tasks[index].completedAt = new Date().toISOString();
      
      if (window.EventBus) {
        window.EventBus.emit(window.WHL_EVENTS?.TASK_COMPLETED, state.tasks[index]);
      }
    }

    await saveTasks();
    return state.tasks[index];
  }

  /**
   * Completa tarefa
   */
  async function completeTask(id) {
    return updateTask(id, { status: TASK_STATUS.COMPLETED });
  }

  /**
   * Remove tarefa
   */
  async function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    await saveTasks();
  }

  /**
   * Obtém tarefa por ID
   */
  function getTask(id) {
    return state.tasks.find(t => t.id === id);
  }

  /**
   * Obtém tarefas com filtros
   */
  function getTasks(filters = {}) {
    let tasks = [...state.tasks];

    if (filters.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }

    if (filters.priority) {
      tasks = tasks.filter(t => t.priority === filters.priority);
    }

    if (filters.type) {
      tasks = tasks.filter(t => t.type === filters.type);
    }

    if (filters.contactPhone) {
      const phone = normalizePhone(filters.contactPhone);
      tasks = tasks.filter(t => normalizePhone(t.contactPhone) === phone);
    }

    // Ordenação
    if (filters.sortBy === 'dueDate') {
      tasks.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    } else if (filters.sortBy === 'priority') {
      const order = ['urgent', 'high', 'medium', 'low'];
      tasks.sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
    } else {
      tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return tasks;
  }

  /**
   * Obtém tarefas para hoje
   */
  function getTodayTasks() {
    const today = new Date().toISOString().split('T')[0];
    return state.tasks.filter(t => {
      if (t.status === TASK_STATUS.COMPLETED || t.status === TASK_STATUS.CANCELLED) return false;
      if (!t.dueDate) return false;
      return t.dueDate.split('T')[0] === today;
    });
  }

  /**
   * Obtém tarefas atrasadas
   */
  function getOverdueTasks() {
    const now = new Date();
    return state.tasks.filter(t => {
      if (t.status === TASK_STATUS.COMPLETED || t.status === TASK_STATUS.CANCELLED) return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < now;
    });
  }

  /**
   * Contagem por status
   */
  function getStatusCounts() {
    const counts = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      overdue: 0,
      today: 0,
      total: state.tasks.length
    };

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    state.tasks.forEach(t => {
      counts[t.status]++;

      if (t.status !== TASK_STATUS.COMPLETED && t.status !== TASK_STATUS.CANCELLED) {
        if (t.dueDate) {
          const dueDate = new Date(t.dueDate);
          if (dueDate < now) counts.overdue++;
          else if (t.dueDate.split('T')[0] === today) counts.today++;
        }
      }
    });

    return counts;
  }

  /**
   * Verificador de lembretes
   */
  function startReminderChecker() {
    if (state.reminderIntervalId) return;

    state.reminderIntervalId = setInterval(() => {
      checkReminders();
    }, 60000); // A cada minuto

    // Verificar imediatamente
    checkReminders();
  }

  /**
   * Verifica e dispara lembretes
   */
  function checkReminders() {
    const now = Date.now();

    state.tasks.forEach(task => {
      if (task.status !== TASK_STATUS.PENDING && task.status !== TASK_STATUS.IN_PROGRESS) return;
      if (!task.reminderDate || task.reminderShown) return;

      const reminderTime = new Date(task.reminderDate).getTime();
      if (reminderTime <= now && reminderTime > now - 120000) { // 2 min de tolerância
        showReminder(task);
        task.reminderShown = true;
        saveTasks();
      }
    });
  }

  /**
   * Exibe lembrete
   */
  function showReminder(task) {
    const type = TASK_TYPES[task.type.toUpperCase()] || TASK_TYPES.OTHER;
    const priority = TASK_PRIORITY[task.priority.toUpperCase()] || TASK_PRIORITY.MEDIUM;

    if (window.NotificationsModule) {
      window.NotificationsModule.show({
        title: `⏰ Lembrete: ${task.title}`,
        message: task.description || `${type.icon} ${type.label}`,
        type: priority.id === 'urgent' || priority.id === 'high' ? 'warning' : 'info',
        duration: 15000,
        actions: [
          { label: 'Concluir', action: () => completeTask(task.id) },
          { label: 'Ver', action: () => openTaskModal(task.id) }
        ]
      });
    } else {
      // Fallback para notification API ou alert
      if (Notification.permission === 'granted') {
        new Notification(`⏰ ${task.title}`, {
          body: task.description || 'Lembrete de tarefa',
          icon: '/icons/48.png'
        });
      }
    }

    if (window.EventBus) {
      window.EventBus.emit(window.WHL_EVENTS?.TASK_REMINDER, task);
    }
  }

  /**
   * Renderiza lista de tarefas
   */
  function renderTaskList(container, filters = {}) {
    if (!container) return;

    const tasks = getTasks(filters);
    const counts = getStatusCounts();

    container.innerHTML = `
      <div class="whl-tasks-container">
        <!-- Filtros -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <button class="task-filter-btn ${!filters.status ? 'active' : ''}" data-filter="all" style="
            padding:6px 12px;
            background:${!filters.status ? 'linear-gradient(135deg,#8b5cf6,#3b82f6)' : 'rgba(255,255,255,0.1)'};
            border:none;
            border-radius:20px;
            color:white;
            font-size:11px;
            cursor:pointer;
          ">Todas (${counts.total})</button>
          <button class="task-filter-btn ${filters.status === 'pending' ? 'active' : ''}" data-filter="pending" style="
            padding:6px 12px;
            background:${filters.status === 'pending' ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.1)'};
            border:1px solid ${filters.status === 'pending' ? '#8b5cf6' : 'transparent'};
            border-radius:20px;
            color:white;
            font-size:11px;
            cursor:pointer;
          ">Pendentes (${counts.pending})</button>
          <button class="task-filter-btn ${filters.overdue ? 'active' : ''}" data-filter="overdue" style="
            padding:6px 12px;
            background:rgba(239,68,68,0.2);
            border:1px solid rgba(239,68,68,0.5);
            border-radius:20px;
            color:#ef4444;
            font-size:11px;
            cursor:pointer;
          ">Atrasadas (${counts.overdue})</button>
        </div>

        <!-- Botão Nova Tarefa -->
        <button onclick="TasksModule.openTaskModal()" style="
          width:100%;
          padding:12px;
          background:linear-gradient(135deg,#8b5cf6,#3b82f6);
          border:none;
          border-radius:10px;
          color:white;
          font-weight:600;
          cursor:pointer;
          margin-bottom:12px;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
        ">➕ Nova Tarefa</button>

        <!-- Lista -->
        <div class="tasks-list" style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto;">
          ${tasks.length === 0 
            ? '<div style="text-align:center;padding:32px;color:rgba(255,255,255,0.5);">Nenhuma tarefa encontrada</div>'
            : tasks.map(task => renderTaskItem(task)).join('')
          }
        </div>
      </div>
    `;

    // Setup events
    setupTaskListEvents(container, filters);
  }

  /**
   * Renderiza item de tarefa
   */
  function renderTaskItem(task) {
    const priority = TASK_PRIORITY[task.priority.toUpperCase()] || TASK_PRIORITY.MEDIUM;
    const type = TASK_TYPES[task.type.toUpperCase()] || TASK_TYPES.OTHER;
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && 
                      task.status !== TASK_STATUS.COMPLETED;
    const isCompleted = task.status === TASK_STATUS.COMPLETED;

    return `
      <div class="task-item" data-task-id="${task.id}" style="
        display:flex;
        align-items:flex-start;
        gap:12px;
        background:rgba(26,26,46,0.9);
        border:1px solid ${isOverdue ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'};
        border-radius:10px;
        padding:12px;
        opacity:${isCompleted ? '0.6' : '1'};
        transition:all 0.2s ease;
      ">
        <input type="checkbox" 
               ${isCompleted ? 'checked' : ''} 
               onchange="TasksModule.toggleComplete('${task.id}', this.checked)"
               style="
                 width:20px;
                 height:20px;
                 cursor:pointer;
                 accent-color:#8b5cf6;
                 margin-top:2px;
               ">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:14px;">${type.icon}</span>
            <span style="
              font-size:14px;
              font-weight:600;
              ${isCompleted ? 'text-decoration:line-through;' : ''}
              overflow:hidden;
              text-overflow:ellipsis;
              white-space:nowrap;
            ">${escapeHtml(task.title)}</span>
            <span style="color:${priority.color};font-size:12px;" title="${priority.label}">${priority.icon}</span>
          </div>
          ${task.description ? `
            <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${escapeHtml(task.description)}
            </div>
          ` : ''}
          <div style="display:flex;gap:12px;margin-top:6px;font-size:11px;color:rgba(255,255,255,0.5);">
            ${task.contactName ? `<span>👤 ${escapeHtml(task.contactName)}</span>` : ''}
            ${task.dueDate ? `
              <span style="color:${isOverdue ? '#ef4444' : 'inherit'};">
                📅 ${formatDate(task.dueDate)}
              </span>
            ` : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <button onclick="TasksModule.openTaskModal('${task.id}')" style="
            background:rgba(139,92,246,0.2);
            border:none;
            border-radius:6px;
            padding:6px;
            cursor:pointer;
            font-size:12px;
          " title="Editar">✏️</button>
          <button onclick="TasksModule.deleteTaskWithConfirm('${task.id}')" style="
            background:rgba(239,68,68,0.2);
            border:none;
            border-radius:6px;
            padding:6px;
            cursor:pointer;
            font-size:12px;
          " title="Excluir">🗑️</button>
        </div>
      </div>
    `;
  }

  /**
   * Setup eventos da lista
   */
  function setupTaskListEvents(container, currentFilters) {
    container.querySelectorAll('.task-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        let newFilters = {};
        
        if (filter === 'pending') {
          newFilters = { status: 'pending' };
        } else if (filter === 'overdue') {
          newFilters = { overdue: true };
        }
        
        renderTaskList(container, newFilters);
      });
    });
  }

  /**
   * Toggle completar tarefa
   */
  async function toggleComplete(id, completed) {
    const status = completed ? TASK_STATUS.COMPLETED : TASK_STATUS.PENDING;
    await updateTask(id, { status });

    // Re-renderizar se necessário
    const container = document.querySelector('.whl-tasks-container')?.parentElement;
    if (container) {
      renderTaskList(container);
    }
  }

  /**
   * Excluir com confirmação
   */
  async function deleteTaskWithConfirm(id) {
    if (confirm('Excluir esta tarefa?')) {
      await deleteTask(id);

      const container = document.querySelector('.whl-tasks-container')?.parentElement;
      if (container) {
        renderTaskList(container);
      }
    }
  }

  /**
   * Modal de Tarefa
   */
  function openTaskModal(taskId = null) {
    const task = taskId ? getTask(taskId) : null;
    const isEdit = !!task;

    // Remover modal existente
    const existing = document.getElementById('task-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'task-modal';
    modal.style.cssText = `
      position:fixed;
      top:0;
      left:0;
      right:0;
      bottom:0;
      background:rgba(0,0,0,0.8);
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:10000;
    `;

    modal.innerHTML = `
      <div style="
        background:#1a1a2e;
        border-radius:16px;
        padding:24px;
        width:90%;
        max-width:400px;
        max-height:80vh;
        overflow-y:auto;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;font-size:18px;">${isEdit ? '✏️ Editar Tarefa' : '➕ Nova Tarefa'}</h3>
          <button onclick="document.getElementById('task-modal').remove()" style="
            background:none;
            border:none;
            font-size:20px;
            cursor:pointer;
            color:rgba(255,255,255,0.6);
          ">×</button>
        </div>

        <form id="task-form" style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.6);">Título *</label>
            <input type="text" id="task-title" value="${escapeHtml(task?.title || '')}" 
                   placeholder="Ex: Ligar para cliente" required style="
              width:100%;
              padding:10px;
              background:rgba(0,0,0,0.3);
              border:1px solid rgba(255,255,255,0.1);
              border-radius:8px;
              color:white;
              margin-top:4px;
            ">
          </div>

          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.6);">Descrição</label>
            <textarea id="task-description" placeholder="Detalhes..." style="
              width:100%;
              padding:10px;
              background:rgba(0,0,0,0.3);
              border:1px solid rgba(255,255,255,0.1);
              border-radius:8px;
              color:white;
              margin-top:4px;
              min-height:60px;
              resize:vertical;
            ">${escapeHtml(task?.description || '')}</textarea>
          </div>

          <div style="display:flex;gap:12px;">
            <div style="flex:1;">
              <label style="font-size:12px;color:rgba(255,255,255,0.6);">Tipo</label>
              <select id="task-type" style="
                width:100%;
                padding:10px;
                background:rgba(0,0,0,0.3);
                border:1px solid rgba(255,255,255,0.1);
                border-radius:8px;
                color:white;
                margin-top:4px;
              ">
                ${Object.values(TASK_TYPES).map(t => `
                  <option value="${t.id}" ${task?.type === t.id ? 'selected' : ''}>${t.icon} ${t.label}</option>
                `).join('')}
              </select>
            </div>
            <div style="flex:1;">
              <label style="font-size:12px;color:rgba(255,255,255,0.6);">Prioridade</label>
              <select id="task-priority" style="
                width:100%;
                padding:10px;
                background:rgba(0,0,0,0.3);
                border:1px solid rgba(255,255,255,0.1);
                border-radius:8px;
                color:white;
                margin-top:4px;
              ">
                ${Object.values(TASK_PRIORITY).map(p => `
                  <option value="${p.id}" ${task?.priority === p.id ? 'selected' : ''}>${p.icon} ${p.label}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div style="display:flex;gap:12px;">
            <div style="flex:1;">
              <label style="font-size:12px;color:rgba(255,255,255,0.6);">Vencimento</label>
              <input type="datetime-local" id="task-due" 
                     value="${task?.dueDate ? task.dueDate.slice(0, 16) : ''}" style="
                width:100%;
                padding:10px;
                background:rgba(0,0,0,0.3);
                border:1px solid rgba(255,255,255,0.1);
                border-radius:8px;
                color:white;
                margin-top:4px;
              ">
            </div>
            <div style="flex:1;">
              <label style="font-size:12px;color:rgba(255,255,255,0.6);">Lembrete</label>
              <input type="datetime-local" id="task-reminder" 
                     value="${task?.reminderDate ? task.reminderDate.slice(0, 16) : ''}" style="
                width:100%;
                padding:10px;
                background:rgba(0,0,0,0.3);
                border:1px solid rgba(255,255,255,0.1);
                border-radius:8px;
                color:white;
                margin-top:4px;
              ">
            </div>
          </div>

          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.6);">Contato (telefone)</label>
            <input type="text" id="task-contact-phone" 
                   value="${escapeHtml(task?.contactPhone || '')}" 
                   placeholder="5511999999999" style="
              width:100%;
              padding:10px;
              background:rgba(0,0,0,0.3);
              border:1px solid rgba(255,255,255,0.1);
              border-radius:8px;
              color:white;
              margin-top:4px;
            ">
          </div>

          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.6);">Nome do contato</label>
            <input type="text" id="task-contact-name" 
                   value="${escapeHtml(task?.contactName || '')}" 
                   placeholder="Nome do cliente" style="
              width:100%;
              padding:10px;
              background:rgba(0,0,0,0.3);
              border:1px solid rgba(255,255,255,0.1);
              border-radius:8px;
              color:white;
              margin-top:4px;
            ">
          </div>

          <div style="display:flex;gap:8px;margin-top:8px;">
            <button type="button" onclick="document.getElementById('task-modal').remove()" style="
              flex:1;
              padding:12px;
              background:rgba(255,255,255,0.1);
              border:none;
              border-radius:8px;
              color:white;
              cursor:pointer;
            ">Cancelar</button>
            <button type="submit" style="
              flex:1;
              padding:12px;
              background:linear-gradient(135deg,#8b5cf6,#3b82f6);
              border:none;
              border-radius:8px;
              color:white;
              font-weight:600;
              cursor:pointer;
            ">${isEdit ? '💾 Salvar' : '➕ Criar'}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Submit handler
    document.getElementById('task-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-description').value,
        type: document.getElementById('task-type').value,
        priority: document.getElementById('task-priority').value,
        dueDate: document.getElementById('task-due').value || null,
        reminderDate: document.getElementById('task-reminder').value || null,
        contactPhone: document.getElementById('task-contact-phone').value || null,
        contactName: document.getElementById('task-contact-name').value || null
      };

      if (!data.title) {
        alert('Título é obrigatório');
        return;
      }

      if (isEdit) {
        await updateTask(taskId, data);
      } else {
        await createTask(data);
      }

      modal.remove();

      // Re-renderizar lista
      const container = document.querySelector('.whl-tasks-container')?.parentElement;
      if (container) {
        renderTaskList(container);
      }

      if (window.NotificationsModule) {
        window.NotificationsModule.success(isEdit ? 'Tarefa atualizada!' : 'Tarefa criada!');
      }
    });

    // Fechar ao clicar fora
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.remove();
    });
  }

  // Helpers
  function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.setDate(now.getDate() + 1)).toISOString().split('T')[0];
    const dateOnly = dateStr.split('T')[0];

    if (dateOnly === today) return 'Hoje ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (dateOnly === tomorrow) return 'Amanhã ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  // Estatísticas de tarefas
  function getStats() {
    const allTasks = state.tasks;
    const nowTime = Date.now();

    const total = allTasks.length;
    const completed = allTasks.filter(t => t.status === TASK_STATUS.COMPLETED).length;
    const pending = allTasks.filter(t => t.status !== TASK_STATUS.COMPLETED).length;
    const overdue = allTasks.filter(t => {
      if (t.status === TASK_STATUS.COMPLETED) return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate).getTime() < nowTime;
    }).length;

    return { total, completed, pending, overdue };
  }

  // API Pública
  window.TasksModule = {
    init,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    getTask,
    getTasks,
    getTodayTasks,
    getOverdueTasks,
    getStatusCounts,
    getStats,
    renderTaskList,
    openTaskModal,
    toggleComplete,
    deleteTaskWithConfirm,
    TASK_STATUS,
    TASK_PRIORITY,
    TASK_TYPES
  };

})();
