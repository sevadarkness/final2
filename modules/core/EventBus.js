/**
 * Enhanced EventBus - Sistema pub/sub com wildcards e namespaces
 * WhatsHybrid Enterprise
 */

(function() {
    'use strict';

    class EventBus {
        constructor() {
            this.listeners = new Map();
            this.onceListeners = new Map();
            this.wildcardListeners = new Map();
            this.history = [];
            this.maxHistory = 100;
            this.debugMode = false;
        }

        /**
         * Registrar listener para evento
         */
        on(event, callback, context = null) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }

            this.listeners.get(event).push({
                callback,
                context
            });

            if (this.debugMode) {
                console.log(`[EventBus] Listener registered: ${event}`);
            }

            // Return unsubscribe function
            return () => this.off(event, callback);
        }

        /**
         * Registrar listener que executa apenas uma vez
         */
        once(event, callback, context = null) {
            if (!this.onceListeners.has(event)) {
                this.onceListeners.set(event, []);
            }

            this.onceListeners.get(event).push({
                callback,
                context
            });

            return () => this.offOnce(event, callback);
        }

        /**
         * Remover listener
         */
        off(event, callback) {
            if (!this.listeners.has(event)) return;

            const listeners = this.listeners.get(event);
            const index = listeners.findIndex(l => l.callback === callback);
            
            if (index !== -1) {
                listeners.splice(index, 1);
                
                if (listeners.length === 0) {
                    this.listeners.delete(event);
                }

                if (this.debugMode) {
                    console.log(`[EventBus] Listener removed: ${event}`);
                }
            }
        }

        /**
         * Remover listener once
         */
        offOnce(event, callback) {
            if (!this.onceListeners.has(event)) return;

            const listeners = this.onceListeners.get(event);
            const index = listeners.findIndex(l => l.callback === callback);
            
            if (index !== -1) {
                listeners.splice(index, 1);
                
                if (listeners.length === 0) {
                    this.onceListeners.delete(event);
                }
            }
        }

        /**
         * Registrar wildcard listener (ex: 'contact:*' escuta 'contact:created', 'contact:updated', etc)
         */
        onPattern(pattern, callback, context = null) {
            if (!this.wildcardListeners.has(pattern)) {
                this.wildcardListeners.set(pattern, []);
            }

            this.wildcardListeners.get(pattern).push({
                callback,
                context
            });

            return () => this.offPattern(pattern, callback);
        }

        /**
         * Remover wildcard listener
         */
        offPattern(pattern, callback) {
            if (!this.wildcardListeners.has(pattern)) return;

            const listeners = this.wildcardListeners.get(pattern);
            const index = listeners.findIndex(l => l.callback === callback);
            
            if (index !== -1) {
                listeners.splice(index, 1);
                
                if (listeners.length === 0) {
                    this.wildcardListeners.delete(pattern);
                }
            }
        }

        /**
         * Emitir evento
         */
        emit(event, data = null) {
            const timestamp = Date.now();

            // Add to history
            this.history.push({ event, data, timestamp });
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            }

            if (this.debugMode) {
                console.log(`[EventBus] Event emitted: ${event}`, data);
            }

            // Execute regular listeners
            if (this.listeners.has(event)) {
                const listeners = [...this.listeners.get(event)];
                for (const listener of listeners) {
                    try {
                        if (listener.context) {
                            listener.callback.call(listener.context, data, event);
                        } else {
                            listener.callback(data, event);
                        }
                    } catch (error) {
                        console.error(`[EventBus] Error in listener for ${event}:`, error);
                    }
                }
            }

            // Execute once listeners
            if (this.onceListeners.has(event)) {
                const listeners = [...this.onceListeners.get(event)];
                this.onceListeners.delete(event);
                
                for (const listener of listeners) {
                    try {
                        if (listener.context) {
                            listener.callback.call(listener.context, data, event);
                        } else {
                            listener.callback(data, event);
                        }
                    } catch (error) {
                        console.error(`[EventBus] Error in once listener for ${event}:`, error);
                    }
                }
            }

            // Execute wildcard listeners
            for (const [pattern, listeners] of this.wildcardListeners) {
                if (this.matchPattern(event, pattern)) {
                    for (const listener of listeners) {
                        try {
                            if (listener.context) {
                                listener.callback.call(listener.context, data, event);
                            } else {
                                listener.callback(data, event);
                            }
                        } catch (error) {
                            console.error(`[EventBus] Error in wildcard listener for ${pattern}:`, error);
                        }
                    }
                }
            }
        }

        /**
         * Emitir evento assíncrono
         */
        async emitAsync(event, data = null) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    this.emit(event, data);
                    resolve();
                }, 0);
            });
        }

        /**
         * Verificar se pattern combina com evento
         */
        matchPattern(event, pattern) {
            if (pattern === '*') return true;
            
            const patternParts = pattern.split(':');
            const eventParts = event.split(':');

            if (patternParts.length !== eventParts.length) {
                // Allow * at end to match multiple levels
                if (pattern.endsWith(':*') || pattern.endsWith('*')) {
                    const basePattern = pattern.replace(/:\*$|\*$/, '');
                    return event.startsWith(basePattern);
                }
                return false;
            }

            return patternParts.every((part, index) => {
                return part === '*' || part === eventParts[index];
            });
        }

        /**
         * Remover todos os listeners de um evento
         */
        clear(event) {
            if (event) {
                this.listeners.delete(event);
                this.onceListeners.delete(event);
            } else {
                this.listeners.clear();
                this.onceListeners.clear();
                this.wildcardListeners.clear();
            }
        }

        /**
         * Obter histórico de eventos
         */
        getHistory(event = null, limit = 10) {
            if (event) {
                return this.history
                    .filter(h => h.event === event)
                    .slice(-limit);
            }
            return this.history.slice(-limit);
        }

        /**
         * Aguardar por evento específico
         */
        waitFor(event, timeout = 5000) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    this.off(event, handler);
                    reject(new Error(`Timeout waiting for event: ${event}`));
                }, timeout);

                const handler = (data) => {
                    clearTimeout(timer);
                    resolve(data);
                };

                this.once(event, handler);
            });
        }

        /**
         * Debug mode
         */
        setDebug(enabled) {
            this.debugMode = enabled;
        }

        /**
         * Obter estatísticas
         */
        getStats() {
            return {
                listeners: this.listeners.size,
                onceListeners: this.onceListeners.size,
                wildcardListeners: this.wildcardListeners.size,
                historySize: this.history.length,
                events: Array.from(this.listeners.keys())
            };
        }
    }

    // Singleton instance
    if (!window.WHL_EventBus) {
        window.WHL_EventBus = new EventBus();
    }

    // Export for modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EventBus;
    }

})();
