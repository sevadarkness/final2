/**
 * MistralProvider, CohereProvider, TogetherProvider, OllamaProvider
 * Implementações simplificadas para providers adicionais
 */

import axios from 'axios';
import BaseProvider from './BaseProvider.js';

// ====================================
// MISTRAL PROVIDER
// ====================================
export class MistralProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'mistral',
      name: 'Mistral AI',
      apiKey: config.apiKey || process.env.MISTRAL_API_KEY,
      baseURL: 'https://api.mistral.ai/v1',
      defaultModel: config.defaultModel || process.env.MISTRAL_DEFAULT_MODEL || 'mistral-large-latest',
      ...config
    });

    this.pricing = {
      'mistral-large-latest': { input: 4.00, output: 12.00 },
      'mistral-medium-latest': { input: 2.70, output: 8.10 },
      'mistral-small-latest': { input: 1.00, output: 3.00 }
    };
  }

  async complete(messages, options = {}) {
    if (!this.isConfigured()) throw new Error('Mistral provider not configured');

    const model = options.model || this.defaultModel;
    const startTime = Date.now();

    try {
      const response = await this.withRetry(async () => {
        return await axios.post(`${this.baseURL}/chat/completions`, {
          model,
          messages: this.formatMessages(messages),
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          top_p: options.topP
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
          timeout: this.timeout
        });
      });

      const latency = Date.now() - startTime;
      const data = response.data;
      const usage = this.extractUsage(data);
      const cost = this.estimateCost(usage.promptTokens, usage.completionTokens, model);

      this.recordSuccess();

      return {
        provider: this.id,
        model,
        content: data.choices[0].message.content,
        finishReason: data.choices[0].finish_reason,
        usage,
        cost,
        latency
      };
    } catch (error) {
      this.recordFailure(error);
      throw new Error(`Mistral error: ${error.message}`);
    }
  }

  estimateCost(promptTokens, completionTokens, model) {
    const pricing = this.pricing[model] || this.pricing['mistral-large-latest'];
    return ((promptTokens / 1000000) * pricing.input) + ((completionTokens / 1000000) * pricing.output);
  }
}

// ====================================
// COHERE PROVIDER
// ====================================
export class CohereProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'cohere',
      name: 'Cohere',
      apiKey: config.apiKey || process.env.COHERE_API_KEY,
      baseURL: 'https://api.cohere.ai/v1',
      defaultModel: config.defaultModel || process.env.COHERE_DEFAULT_MODEL || 'command-r-plus',
      ...config
    });

    this.pricing = {
      'command-r-plus': { input: 3.00, output: 15.00 },
      'command-r': { input: 0.50, output: 1.50 },
      'command': { input: 1.00, output: 2.00 }
    };
  }

  async complete(messages, options = {}) {
    if (!this.isConfigured()) throw new Error('Cohere provider not configured');

    const model = options.model || this.defaultModel;
    const startTime = Date.now();

    try {
      // Cohere usa formato diferente
      const lastMessage = messages[messages.length - 1].content;
      const chatHistory = messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
        message: m.content
      }));

      const response = await this.withRetry(async () => {
        return await axios.post(`${this.baseURL}/chat`, {
          model,
          message: lastMessage,
          chat_history: chatHistory,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
          timeout: this.timeout
        });
      });

      const latency = Date.now() - startTime;
      const data = response.data;
      
      const promptTokens = this.countTokens(messages.map(m => m.content).join(' '));
      const completionTokens = this.countTokens(data.text);
      const usage = { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
      const cost = this.estimateCost(usage.promptTokens, usage.completionTokens, model);

      this.recordSuccess();

      return {
        provider: this.id,
        model,
        content: data.text,
        finishReason: 'stop',
        usage,
        cost,
        latency
      };
    } catch (error) {
      this.recordFailure(error);
      throw new Error(`Cohere error: ${error.message}`);
    }
  }

  estimateCost(promptTokens, completionTokens, model) {
    const pricing = this.pricing[model] || this.pricing['command-r-plus'];
    return ((promptTokens / 1000000) * pricing.input) + ((completionTokens / 1000000) * pricing.output);
  }
}

// ====================================
// TOGETHER AI PROVIDER
// ====================================
export class TogetherProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'together',
      name: 'Together AI',
      apiKey: config.apiKey || process.env.TOGETHER_API_KEY,
      baseURL: 'https://api.together.xyz/v1',
      defaultModel: config.defaultModel || process.env.TOGETHER_DEFAULT_MODEL || 'meta-llama/Llama-3-70b-chat-hf',
      ...config
    });

    this.pricing = {
      'meta-llama/Llama-3-70b-chat-hf': { input: 0.90, output: 0.90 },
      'meta-llama/Llama-3-8b-chat-hf': { input: 0.20, output: 0.20 },
      'mistralai/Mixtral-8x7B-Instruct-v0.1': { input: 0.60, output: 0.60 }
    };
  }

  async complete(messages, options = {}) {
    if (!this.isConfigured()) throw new Error('Together AI provider not configured');

    const model = options.model || this.defaultModel;
    const startTime = Date.now();

    try {
      const response = await this.withRetry(async () => {
        return await axios.post(`${this.baseURL}/chat/completions`, {
          model,
          messages: this.formatMessages(messages),
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          top_p: options.topP
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
          timeout: this.timeout
        });
      });

      const latency = Date.now() - startTime;
      const data = response.data;
      const usage = this.extractUsage(data);
      const cost = this.estimateCost(usage.promptTokens, usage.completionTokens, model);

      this.recordSuccess();

      return {
        provider: this.id,
        model,
        content: data.choices[0].message.content,
        finishReason: data.choices[0].finish_reason,
        usage,
        cost,
        latency
      };
    } catch (error) {
      this.recordFailure(error);
      throw new Error(`Together AI error: ${error.message}`);
    }
  }

  estimateCost(promptTokens, completionTokens, model) {
    const pricing = this.pricing[model] || { input: 0.50, output: 0.50 };
    return ((promptTokens / 1000000) * pricing.input) + ((completionTokens / 1000000) * pricing.output);
  }
}

// ====================================
// OLLAMA PROVIDER (Local)
// ====================================
export class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'ollama',
      name: 'Ollama',
      baseURL: config.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      defaultModel: config.defaultModel || process.env.OLLAMA_DEFAULT_MODEL || 'llama2',
      apiKey: 'not-required',
      ...config
    });
  }

  async complete(messages, options = {}) {
    const model = options.model || this.defaultModel;
    const startTime = Date.now();

    try {
      const response = await this.withRetry(async () => {
        return await axios.post(`${this.baseURL}/api/chat`, {
          model,
          messages: this.formatMessages(messages),
          stream: false,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens
          }
        }, {
          timeout: this.timeout
        });
      });

      const latency = Date.now() - startTime;
      const data = response.data;
      
      const promptTokens = this.countTokens(messages.map(m => m.content).join(' '));
      const completionTokens = this.countTokens(data.message.content);
      const usage = { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };

      this.recordSuccess();

      return {
        provider: this.id,
        model,
        content: data.message.content,
        finishReason: 'stop',
        usage,
        cost: 0, // Local = free
        latency
      };
    } catch (error) {
      this.recordFailure(error);
      throw new Error(`Ollama error: ${error.message}`);
    }
  }

  estimateCost() {
    return 0; // Local models are free
  }
}

export default {
  MistralProvider,
  CohereProvider,
  TogetherProvider,
  OllamaProvider
};
