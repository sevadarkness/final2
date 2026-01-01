/**
 * GoogleAIProvider - Integração com Google Gemini models
 * Suporta: Gemini 1.5 Pro, Gemini 1.5 Flash
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import BaseProvider from './BaseProvider.js';

export class GoogleAIProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'google',
      name: 'Google AI',
      apiKey: config.apiKey || process.env.GOOGLE_AI_API_KEY,
      defaultModel: config.defaultModel || process.env.GOOGLE_AI_DEFAULT_MODEL || 'gemini-1.5-pro',
      ...config
    });

    if (this.isConfigured()) {
      this.client = new GoogleGenerativeAI(this.apiKey);
    }

    // Pricing per 1M tokens (USD)
    this.pricing = {
      'gemini-1.5-pro': { input: 1.25, output: 5.00 },
      'gemini-1.5-flash': { input: 0.075, output: 0.30 },
      'gemini-1.0-pro': { input: 0.50, output: 1.50 }
    };
  }

  async complete(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Google AI provider not configured');
    }

    const model = options.model || this.defaultModel;
    const startTime = Date.now();

    try {
      const genModel = this.client.getGenerativeModel({ model });

      // Converter mensagens para formato Google
      const history = [];
      let lastMessage = '';

      for (const msg of messages) {
        if (msg.role === 'system') {
          // System message vai no início do histórico
          history.unshift({ role: 'user', parts: [{ text: msg.content }] });
          history.push({ role: 'model', parts: [{ text: 'Understood.' }] });
        } else if (msg.role === 'user') {
          lastMessage = msg.content;
        } else if (msg.role === 'assistant') {
          if (lastMessage) {
            history.push({ role: 'user', parts: [{ text: lastMessage }] });
            lastMessage = '';
          }
          history.push({ role: 'model', parts: [{ text: msg.content }] });
        }
      }

      const chat = genModel.startChat({
        history,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens,
          topP: options.topP
        }
      });

      const response = await this.withRetry(async () => {
        return await chat.sendMessage(lastMessage);
      });

      const latency = Date.now() - startTime;
      const text = response.response.text();
      
      // Estimar tokens (Google não retorna contagem exata)
      const promptTokens = this.countTokens(messages.map(m => m.content).join(' '));
      const completionTokens = this.countTokens(text);
      
      const usage = {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      };
      
      const cost = this.estimateCost(usage.promptTokens, usage.completionTokens, model);

      this.recordSuccess();

      return {
        provider: this.id,
        model,
        content: text,
        finishReason: 'stop',
        usage,
        cost,
        latency
      };
    } catch (error) {
      this.recordFailure(error);
      throw new Error(`Google AI error: ${error.message}`);
    }
  }

  estimateCost(promptTokens, completionTokens, model) {
    const pricing = this.pricing[model] || this.pricing['gemini-1.5-pro'];
    const inputCost = (promptTokens / 1000000) * pricing.input;
    const outputCost = (completionTokens / 1000000) * pricing.output;
    return inputCost + outputCost;
  }
}

export default GoogleAIProvider;
