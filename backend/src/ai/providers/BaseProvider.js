/**
 * BaseProvider - Interface base para todos os providers de IA
 * Define métodos e estrutura comum
 */

export class BaseProvider {
  constructor(config = {}) {
    this.id = config.id;
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.defaultModel = config.defaultModel;
    this.enabled = config.enabled !== false;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 30000;
    this.health = {
      isHealthy: true,
      lastCheck: null,
      failureCount: 0,
      lastError: null
    };
  }

  /**
   * Método principal para completar chat
   * Deve ser implementado por cada provider
   */
  async complete(messages, options = {}) {
    throw new Error('complete() must be implemented by provider');
  }

  /**
   * Estimar custo da requisição
   */
  estimateCost(promptTokens, completionTokens, model) {
    throw new Error('estimateCost() must be implemented by provider');
  }

  /**
   * Contar tokens (aproximado)
   */
  countTokens(text) {
    // Aproximação simples: ~4 caracteres por token
    return Math.ceil(text.length / 4);
  }

  /**
   * Validar se provider está configurado
   */
  isConfigured() {
    return !!this.apiKey && this.enabled;
  }

  /**
   * Health check
   */
  async checkHealth() {
    try {
      // Implementação básica - cada provider pode sobrescrever
      const result = await this.complete([
        { role: 'user', content: 'Hi' }
      ], { maxTokens: 10 });
      
      this.health.isHealthy = true;
      this.health.lastCheck = new Date();
      this.health.failureCount = 0;
      this.health.lastError = null;
      
      return true;
    } catch (error) {
      this.health.isHealthy = false;
      this.health.lastCheck = new Date();
      this.health.failureCount += 1;
      this.health.lastError = error.message;
      
      return false;
    }
  }

  /**
   * Registrar falha
   */
  recordFailure(error) {
    this.health.failureCount += 1;
    this.health.lastError = error.message;
    
    // Marcar como unhealthy após múltiplas falhas
    if (this.health.failureCount >= 3) {
      this.health.isHealthy = false;
    }
  }

  /**
   * Registrar sucesso
   */
  recordSuccess() {
    this.health.failureCount = Math.max(0, this.health.failureCount - 1);
    if (this.health.failureCount === 0) {
      this.health.isHealthy = true;
    }
  }

  /**
   * Formatar mensagens para formato padrão
   */
  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Extrair uso de tokens da resposta
   */
  extractUsage(response) {
    return {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0
    };
  }

  /**
   * Obter status do provider
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      isConfigured: this.isConfigured(),
      isHealthy: this.health.isHealthy,
      failureCount: this.health.failureCount,
      lastCheck: this.health.lastCheck,
      lastError: this.health.lastError
    };
  }

  /**
   * Retry com exponential backoff
   */
  async withRetry(fn, maxRetries = this.maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Não fazer retry em erros de validação
        if (error.status === 400 || error.status === 401) {
          throw error;
        }
        
        // Aguardar antes de retry (exponential backoff)
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}

export default BaseProvider;
