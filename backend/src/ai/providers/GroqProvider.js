/**
 * GroqProvider - Ultra-fast inference com Groq
 * Suporta: Llama 3.1 70B, Mixtral, Llama 2 70B
 */

import Groq from 'groq-sdk';
import BaseProvider from './BaseProvider.js';

export class GroqProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'groq',
      name: 'Groq',
      apiKey: config.apiKey || process.env.GROQ_API_KEY,
      defaultModel: config.defaultModel || process.env.GROQ_DEFAULT_MODEL || 'llama-3.1-70b-versatile',
      ...config
    });

    if (this.isConfigured()) {
      this.client = new Groq({
        apiKey: this.apiKey
      });
    }

    // Pricing per 1M tokens (USD) - Groq é muito barato
    this.pricing = {
      'llama-3.1-70b-versatile': { input: 0.59, output: 0.79 },
      'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
      'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },
      'llama2-70b-4096': { input: 0.70, output: 0.80 }
    };
  }

  async complete(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Groq provider not configured');
    }

    const model = options.model || this.defaultModel;
    const startTime = Date.now();

    try {
      const response = await this.withRetry(async () => {
        return await this.client.chat.completions.create({
          model,
          messages: this.formatMessages(messages),
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          top_p: options.topP,
          stop: options.stop
        });
      });

      const latency = Date.now() - startTime;
      const usage = this.extractUsage(response);
      const cost = this.estimateCost(usage.promptTokens, usage.completionTokens, model);

      this.recordSuccess();

      return {
        provider: this.id,
        model,
        content: response.choices[0].message.content,
        finishReason: response.choices[0].finish_reason,
        usage,
        cost,
        latency
      };
    } catch (error) {
      this.recordFailure(error);
      throw new Error(`Groq error: ${error.message}`);
    }
  }

  estimateCost(promptTokens, completionTokens, model) {
    const pricing = this.pricing[model] || this.pricing['llama-3.1-70b-versatile'];
    const inputCost = (promptTokens / 1000000) * pricing.input;
    const outputCost = (completionTokens / 1000000) * pricing.output;
    return inputCost + outputCost;
  }
}

export default GroqProvider;
