/**
 * AIRouterService - Intelligent routing between AI providers
 * Strategies: cost_optimized, speed_optimized, quality_optimized, balanced, failover
 */

import OpenAIProvider from '../providers/OpenAIProvider.js';
import AnthropicProvider from '../providers/AnthropicProvider.js';
import GoogleAIProvider from '../providers/GoogleAIProvider.js';
import GroqProvider from '../providers/GroqProvider.js';
import { MistralProvider, CohereProvider, TogetherProvider, OllamaProvider } from '../providers/AdditionalProviders.js';

export class AIRouterService {
  constructor() {
    this.providers = new Map();
    this.circuitBreakers = new Map();
    this.initializeProviders();
  }

  /**
   * Inicializar todos os providers
   */
  initializeProviders() {
    const providerClasses = [
      OpenAIProvider,
      AnthropicProvider,
      GoogleAIProvider,
      GroqProvider,
      MistralProvider,
      CohereProvider,
      TogetherProvider,
      OllamaProvider
    ];

    for (const ProviderClass of providerClasses) {
      try {
        const provider = new ProviderClass();
        if (provider.isConfigured()) {
          this.providers.set(provider.id, provider);
          this.circuitBreakers.set(provider.id, {
            failures: 0,
            lastFailure: null,
            isOpen: false
          });
          console.log(`[AIRouter] ${provider.name} initialized`);
        }
      } catch (error) {
        console.warn(`[AIRouter] Failed to initialize provider: ${error.message}`);
      }
    }

    if (this.providers.size === 0) {
      console.warn('[AIRouter] No AI providers configured!');
    }
  }

  /**
   * Roteamento inteligente baseado em estratégia
   */
  async route(messages, options = {}) {
    const strategy = options.strategy || process.env.AI_ROUTING_STRATEGY || 'balanced';
    const preferredProvider = options.provider;

    // Se provider específico foi solicitado
    if (preferredProvider && this.providers.has(preferredProvider)) {
      const provider = this.providers.get(preferredProvider);
      if (this.isProviderAvailable(provider.id)) {
        return await this.executeWithFallback(provider, messages, options);
      }
    }

    // Selecionar provider baseado na estratégia
    const provider = this.selectProvider(strategy, messages);
    
    if (!provider) {
      throw new Error('No available AI providers');
    }

    return await this.executeWithFallback(provider, messages, options);
  }

  /**
   * Selecionar provider baseado na estratégia
   */
  selectProvider(strategy, messages) {
    const availableProviders = Array.from(this.providers.values())
      .filter(p => this.isProviderAvailable(p.id));

    if (availableProviders.length === 0) {
      return null;
    }

    switch (strategy) {
      case 'cost_optimized':
        return this.selectCheapest(availableProviders, messages);
      
      case 'speed_optimized':
        return this.selectFastest(availableProviders);
      
      case 'quality_optimized':
        return this.selectBestQuality(availableProviders);
      
      case 'balanced':
        return this.selectBalanced(availableProviders, messages);
      
      case 'failover':
        return availableProviders[0];
      
      default:
        return availableProviders[0];
    }
  }

  /**
   * Selecionar provider mais barato
   */
  selectCheapest(providers, messages) {
    const messageText = messages.map(m => m.content).join(' ');
    const estimatedTokens = Math.ceil(messageText.length / 4);

    let cheapest = providers[0];
    let lowestCost = Infinity;

    for (const provider of providers) {
      try {
        const cost = provider.estimateCost(estimatedTokens, estimatedTokens / 2, provider.defaultModel);
        if (cost < lowestCost) {
          lowestCost = cost;
          cheapest = provider;
        }
      } catch (error) {
        continue;
      }
    }

    return cheapest;
  }

  /**
   * Selecionar provider mais rápido
   */
  selectFastest(providers) {
    // Groq é sempre o mais rápido quando disponível
    const groq = providers.find(p => p.id === 'groq');
    if (groq) return groq;

    // Ollama (local) é segundo mais rápido
    const ollama = providers.find(p => p.id === 'ollama');
    if (ollama) return ollama;

    // Google Gemini Flash é rápido
    const google = providers.find(p => p.id === 'google');
    if (google) return google;

    return providers[0];
  }

  /**
   * Selecionar provider de melhor qualidade
   */
  selectBestQuality(providers) {
    // Ordem de preferência por qualidade
    const qualityOrder = ['anthropic', 'openai', 'google', 'mistral', 'cohere', 'groq', 'together', 'ollama'];

    for (const providerId of qualityOrder) {
      const provider = providers.find(p => p.id === providerId);
      if (provider) return provider;
    }

    return providers[0];
  }

  /**
   * Selecionar provider balanceado (custo vs qualidade vs velocidade)
   */
  selectBalanced(providers, messages) {
    // Score baseado em múltiplos fatores
    const messageText = messages.map(m => m.content).join(' ');
    const estimatedTokens = Math.ceil(messageText.length / 4);

    let best = providers[0];
    let bestScore = -Infinity;

    const qualityScores = {
      'anthropic': 10, 'openai': 9, 'google': 8, 'mistral': 7,
      'cohere': 6, 'groq': 5, 'together': 4, 'ollama': 3
    };

    const speedScores = {
      'groq': 10, 'ollama': 9, 'google': 7, 'anthropic': 6,
      'openai': 6, 'mistral': 5, 'cohere': 5, 'together': 4
    };

    for (const provider of providers) {
      try {
        const cost = provider.estimateCost(estimatedTokens, estimatedTokens / 2, provider.defaultModel);
        const costScore = 1 / (cost + 0.001); // Inverso do custo
        const qualityScore = qualityScores[provider.id] || 5;
        const speedScore = speedScores[provider.id] || 5;
        
        // Score balanceado (pode ajustar pesos)
        const score = (costScore * 3) + (qualityScore * 2) + (speedScore * 1);
        
        if (score > bestScore) {
          bestScore = score;
          best = provider;
        }
      } catch (error) {
        continue;
      }
    }

    return best;
  }

  /**
   * Executar com fallback automático
   */
  async executeWithFallback(primaryProvider, messages, options) {
    const enableFallback = process.env.AI_ENABLE_FALLBACK !== 'false';

    try {
      const result = await primaryProvider.complete(messages, options);
      this.recordSuccess(primaryProvider.id);
      return result;
    } catch (error) {
      this.recordFailure(primaryProvider.id, error);

      if (!enableFallback) {
        throw error;
      }

      // Tentar fallback com outro provider
      console.warn(`[AIRouter] ${primaryProvider.name} failed, attempting fallback...`);
      
      const fallbackProvider = this.selectFallbackProvider(primaryProvider.id);
      
      if (fallbackProvider) {
        try {
          const result = await fallbackProvider.complete(messages, options);
          console.log(`[AIRouter] Fallback successful with ${fallbackProvider.name}`);
          return result;
        } catch (fallbackError) {
          this.recordFailure(fallbackProvider.id, fallbackError);
          throw new Error(`All providers failed. Last error: ${fallbackError.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Selecionar provider para fallback
   */
  selectFallbackProvider(failedProviderId) {
    const availableProviders = Array.from(this.providers.values())
      .filter(p => p.id !== failedProviderId && this.isProviderAvailable(p.id));

    return availableProviders[0] || null;
  }

  /**
   * Verificar se provider está disponível (circuit breaker)
   */
  isProviderAvailable(providerId) {
    const breaker = this.circuitBreakers.get(providerId);
    if (!breaker) return false;

    // Se circuit breaker está aberto
    if (breaker.isOpen) {
      const timeSinceFailure = Date.now() - breaker.lastFailure;
      const resetTimeout = 60000; // 1 minuto

      // Tentar reset após timeout
      if (timeSinceFailure > resetTimeout) {
        breaker.isOpen = false;
        breaker.failures = 0;
        console.log(`[AIRouter] Circuit breaker reset for ${providerId}`);
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * Registrar falha no circuit breaker
   */
  recordFailure(providerId, error) {
    const breaker = this.circuitBreakers.get(providerId);
    if (!breaker) return;

    breaker.failures += 1;
    breaker.lastFailure = Date.now();

    // Abrir circuit breaker após 3 falhas
    if (breaker.failures >= 3) {
      breaker.isOpen = true;
      console.warn(`[AIRouter] Circuit breaker opened for ${providerId}`);
    }
  }

  /**
   * Registrar sucesso
   */
  recordSuccess(providerId) {
    const breaker = this.circuitBreakers.get(providerId);
    if (!breaker) return;

    breaker.failures = Math.max(0, breaker.failures - 1);
    if (breaker.failures === 0) {
      breaker.isOpen = false;
    }
  }

  /**
   * Health check de todos os providers
   */
  async checkHealth() {
    const results = {};

    for (const [id, provider] of this.providers) {
      const isHealthy = await provider.checkHealth();
      results[id] = provider.getStatus();
    }

    return results;
  }

  /**
   * Obter status de todos os providers
   */
  getStatus() {
    const status = {};

    for (const [id, provider] of this.providers) {
      status[id] = {
        ...provider.getStatus(),
        circuitBreaker: this.circuitBreakers.get(id)
      };
    }

    return status;
  }
}

// Singleton instance
let instance = null;

export const getAIRouter = () => {
  if (!instance) {
    instance = new AIRouterService();
  }
  return instance;
};

export default AIRouterService;
