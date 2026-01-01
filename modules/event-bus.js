/**
 * 🔄 EventBus - Sistema de Eventos Central
 * Baseado no Quantum CRM EventDispatcher
 * Permite comunicação desacoplada entre módulos
 */

(function() {
  'use strict';

  class EventBus {
    constructor() {
      this.listeners = new Map();
      this.onceListeners = new Map();
      this.history = [];
      this.maxHistorySize = 100;
    }

    /**
     * Registra listener para evento
     */
    on(event, callback, options = {}) {
      if (typeof callback !== 'function') {
        console.warn('[EventBus] Callback deve ser uma função');
        return () => {};
      }

      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }

      const listener = { callback, options };
      this.listeners.get(event).push(listener);

      // Retorna função para remover listener
      return () => this.off(event, callback);
    }

    /**
     * Registra listener que executa apenas uma vez
     */
    once(event, callback) {
      if (!this.onceListeners.has(event)) {
        this.onceListeners.set(event, []);
      }
      this.onceListeners.get(event).push(callback);
      
      return () => {
        const listeners = this.onceListeners.get(event);
        if (listeners) {
          const index = listeners.indexOf(callback);
          if (index > -1) listeners.splice(index, 1);
        }
      };
    }

    /**
     * Remove listener
     */
    off(event, callback) {
      const listeners = this.listeners.get(event);
      if (listeners) {
        const index = listeners.findIndex(l => l.callback === callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }

    /**
     * Emite evento
     */
    emit(event, data = {}) {
      const timestamp = Date.now();
      const eventData = { event, data, timestamp };

      // Adicionar ao histórico
      this.history.push(eventData);
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }

      // Executar listeners normais
      const listeners = this.listeners.get(event) || [];
      listeners.forEach(({ callback, options }) => {
        try {
          if (options.async) {
            setTimeout(() => callback(data, eventData), 0);
          } else {
            callback(data, eventData);
          }
        } catch (error) {
          console.error(`[EventBus] Erro no listener de "${event}":`, error);
        }
      });

      // Executar listeners once
      const onceListeners = this.onceListeners.get(event) || [];
      this.onceListeners.set(event, []);
      onceListeners.forEach(callback => {
        try {
          callback(data, eventData);
        } catch (error) {
          console.error(`[EventBus] Erro no once-listener de "${event}":`, error);
        }
      });

      // Emitir evento wildcard
      if (event !== '*') {
        const wildcardListeners = this.listeners.get('*') || [];
        wildcardListeners.forEach(({ callback }) => {
          try {
            callback(eventData);
          } catch (error) {
            console.error('[EventBus] Erro no wildcard listener:', error);
          }
        });
      }

      return this;
    }

    /**
     * Emite evento com Promise (aguarda todos os listeners async)
     */
    async emitAsync(event, data = {}) {
      const listeners = this.listeners.get(event) || [];
      const promises = listeners.map(({ callback }) => {
        return Promise.resolve().then(() => callback(data));
      });
      
      await Promise.all(promises);
      return this;
    }

    /**
     * Remove todos os listeners de um evento
     */
    clear(event) {
      if (event) {
        this.listeners.delete(event);
        this.onceListeners.delete(event);
      } else {
        this.listeners.clear();
        this.onceListeners.clear();
      }
    }

    /**
     * Obtém histórico de eventos
     */
    getHistory(event = null, limit = 50) {
      let history = [...this.history];
      if (event) {
        history = history.filter(h => h.event === event);
      }
      return history.slice(-limit);
    }

    /**
     * Debug - lista todos os eventos registrados
     */
    debug() {
      const events = {};
      for (const [event, listeners] of this.listeners) {
        events[event] = listeners.length;
      }
      return events;
    }
  }

  // Singleton
  const eventBus = new EventBus();

  // Eventos padronizados do sistema
  eventBus.EVENTS = {
    // Mensagens
    MESSAGE_SENT: 'message:sent',
    MESSAGE_RECEIVED: 'message:received',
    MESSAGE_FAILED: 'message:failed',
    
    // Campanha
    CAMPAIGN_STARTED: 'campaign:started',
    CAMPAIGN_PROGRESS: 'campaign:progress',
    CAMPAIGN_PAUSED: 'campaign:paused',
    CAMPAIGN_COMPLETED: 'campaign:completed',
    CAMPAIGN_CANCELLED: 'campaign:cancelled',
    
    // CRM
    CONTACT_CREATED: 'crm:contact:created',
    CONTACT_UPDATED: 'crm:contact:updated',
    DEAL_CREATED: 'crm:deal:created',
    DEAL_UPDATED: 'crm:deal:updated',
    DEAL_STAGE_CHANGED: 'crm:deal:stage_changed',
    
    // Tasks
    TASK_CREATED: 'task:created',
    TASK_COMPLETED: 'task:completed',
    TASK_REMINDER: 'task:reminder',
    
    // Analytics
    METRIC_TRACKED: 'analytics:metric',
    
    // UI
    VIEW_CHANGED: 'ui:view_changed',
    NOTIFICATION_SHOW: 'ui:notification:show',
    
    // Sistema
    MODULE_LOADED: 'system:module_loaded',
    ERROR: 'system:error'
  };

  // Expor globalmente
  window.EventBus = eventBus;
  window.WHL_EVENTS = eventBus.EVENTS;

  console.log('[EventBus] ✅ Sistema de eventos inicializado');
})();
