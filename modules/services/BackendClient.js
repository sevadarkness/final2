/**
 * BackendClient - Cliente HTTP para API do backend
 * WhatsHybrid Enterprise
 */

(function() {
    'use strict';

    class BackendClient {
        constructor(options = {}) {
            this.baseURL = options.baseURL || 'http://localhost:3000/api';
            this.token = null;
            this.refreshToken = null;
            this.onUnauthorized = options.onUnauthorized || (() => {});
            this.retryAttempts = options.retryAttempts || 3;
            this.retryDelay = options.retryDelay || 1000;
            
            this.loadTokens();
        }

        /**
         * Carregar tokens do storage
         */
        async loadTokens() {
            try {
                const result = await chrome.storage.local.get(['whl_auth_token', 'whl_refresh_token']);
                this.token = result.whl_auth_token;
                this.refreshToken = result.whl_refresh_token;
            } catch (error) {
                console.error('[BackendClient] Failed to load tokens:', error);
            }
        }

        /**
         * Salvar tokens no storage
         */
        async saveTokens(token, refreshToken) {
            this.token = token;
            this.refreshToken = refreshToken;
            
            try {
                await chrome.storage.local.set({
                    whl_auth_token: token,
                    whl_refresh_token: refreshToken
                });
            } catch (error) {
                console.error('[BackendClient] Failed to save tokens:', error);
            }
        }

        /**
         * Limpar tokens
         */
        async clearTokens() {
            this.token = null;
            this.refreshToken = null;
            
            try {
                await chrome.storage.local.remove(['whl_auth_token', 'whl_refresh_token']);
            } catch (error) {
                console.error('[BackendClient] Failed to clear tokens:', error);
            }
        }

        /**
         * Fazer requisição HTTP
         */
        async request(method, endpoint, data = null, options = {}) {
            const url = `${this.baseURL}${endpoint}`;
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };

            if (this.token && !options.skipAuth) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const config = {
                method,
                headers,
                ...options
            };

            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                config.body = JSON.stringify(data);
            }

            try {
                const response = await fetch(url, config);
                
                // Handle 401 - Token expired
                if (response.status === 401 && !options.skipAuth && !options.isRefresh) {
                    const refreshed = await this.refreshAccessToken();
                    if (refreshed) {
                        // Retry original request
                        return await this.request(method, endpoint, data, options);
                    } else {
                        this.onUnauthorized();
                        throw new Error('Unauthorized');
                    }
                }

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || `HTTP ${response.status}`);
                }

                return result;
            } catch (error) {
                console.error(`[BackendClient] ${method} ${endpoint} failed:`, error);
                throw error;
            }
        }

        /**
         * GET request
         */
        async get(endpoint, options = {}) {
            return await this.request('GET', endpoint, null, options);
        }

        /**
         * POST request
         */
        async post(endpoint, data, options = {}) {
            return await this.request('POST', endpoint, data, options);
        }

        /**
         * PUT request
         */
        async put(endpoint, data, options = {}) {
            return await this.request('PUT', endpoint, data, options);
        }

        /**
         * PATCH request
         */
        async patch(endpoint, data, options = {}) {
            return await this.request('PATCH', endpoint, data, options);
        }

        /**
         * DELETE request
         */
        async delete(endpoint, options = {}) {
            return await this.request('DELETE', endpoint, null, options);
        }

        /**
         * Refresh access token
         */
        async refreshAccessToken() {
            if (!this.refreshToken) {
                return false;
            }

            try {
                const result = await this.post('/auth/refresh', {
                    refreshToken: this.refreshToken
                }, { skipAuth: true, isRefresh: true });

                await this.saveTokens(result.token, this.refreshToken);
                return true;
            } catch (error) {
                console.error('[BackendClient] Token refresh failed:', error);
                await this.clearTokens();
                return false;
            }
        }

        // ====================================
        // AUTH ENDPOINTS
        // ====================================

        async login(email, password) {
            const result = await this.post('/auth/login', { email, password }, { skipAuth: true });
            await this.saveTokens(result.token, result.refreshToken);
            return result;
        }

        async register(userData) {
            return await this.post('/auth/register', userData, { skipAuth: true });
        }

        async logout() {
            try {
                await this.post('/auth/logout');
            } finally {
                await this.clearTokens();
            }
        }

        async getCurrentUser() {
            return await this.get('/auth/me');
        }

        // ====================================
        // AI ENDPOINTS
        // ====================================

        async aiCopilot(context) {
            return await this.post('/ai/copilot', context);
        }

        async aiSmartReplies(message, count = 3) {
            return await this.post('/ai/smart-replies', { message, count });
        }

        async aiSentiment(text) {
            return await this.post('/ai/sentiment', { text });
        }

        async aiIntent(text) {
            return await this.post('/ai/intent', { text });
        }

        async aiExtractEntities(text) {
            return await this.post('/ai/extract-entities', { text });
        }

        async aiSummarize(messages) {
            return await this.post('/ai/summarize', { messages });
        }

        async aiTranslate(text, targetLanguage) {
            return await this.post('/ai/translate', { text, targetLanguage });
        }

        async aiScoreLead(contactId) {
            return await this.post('/ai/score-lead', { contactId });
        }

        async getAIProviders() {
            return await this.get('/ai/providers');
        }

        async getAIUsage(workspaceId) {
            return await this.get(`/ai/usage?workspaceId=${workspaceId}`);
        }

        async getAICredits(workspaceId) {
            return await this.get(`/ai/credits?workspaceId=${workspaceId}`);
        }

        // ====================================
        // CONTACTS
        // ====================================

        async getContacts(workspaceId, params = {}) {
            const query = new URLSearchParams(params).toString();
            return await this.get(`/contacts?workspaceId=${workspaceId}&${query}`);
        }

        async getContact(id) {
            return await this.get(`/contacts/${id}`);
        }

        async createContact(workspaceId, data) {
            return await this.post(`/contacts?workspaceId=${workspaceId}`, data);
        }

        async updateContact(id, data) {
            return await this.patch(`/contacts/${id}`, data);
        }

        async deleteContact(id) {
            return await this.delete(`/contacts/${id}`);
        }

        // ====================================
        // HEALTH CHECK
        // ====================================

        async healthCheck() {
            return await this.get('/health', { skipAuth: true });
        }

        async detailedHealth() {
            return await this.get('/health/detailed', { skipAuth: true });
        }
    }

    // Singleton instance
    if (!window.WHL_BackendClient) {
        window.WHL_BackendClient = new BackendClient();
    }

    // Export for modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = BackendClient;
    }

})();
