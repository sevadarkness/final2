/**
 * OpenAIProvider - Integração com OpenAI GPT models
 * Suporta: GPT-4o, GPT-4-turbo, GPT-3.5-turbo
 */

import OpenAI from 'openai';
import BaseProvider from './BaseProvider.js';

export class OpenAIProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'openai',
      name: 'OpenAI',
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      defaultModel: config.defaultModel || process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
      ...config
    });

    if (this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        organization: config.orgId || process.env.OPENAI_ORG_ID,
        timeout: this.timeout
      });
    }

    // Pricing per 1M tokens (USD)
    this.pricing = {
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4-turbo': { input: 10.00, output: 30.00 },
      'gpt-4': { input: 30.00, output: 60.00 },
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 }
    };
  }

  /**
   * Complete chat com OpenAI
   */
  async complete(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider not configured');
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
          frequency_penalty: options.frequencyPenalty,
          presence_penalty: options.presencePenalty,
          stop: options.stop,
          stream: false
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
      throw new Error(`OpenAI error: ${error.message}`);
    }
  }

  /**
   * Estimar custo da requisição
   */
  estimateCost(promptTokens, completionTokens, model) {
    const pricing = this.pricing[model] || this.pricing['gpt-4o'];
    const inputCost = (promptTokens / 1000000) * pricing.input;
    const outputCost = (completionTokens / 1000000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Generate embeddings
   */
  async generateEmbedding(text, model = 'text-embedding-3-small') {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider not configured');
    }

    try {
      const response = await this.client.embeddings.create({
        model,
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new Error(`OpenAI embedding error: ${error.message}`);
    }
  }

  /**
   * Moderation check
   */
  async moderate(text) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider not configured');
    }

    try {
      const response = await this.client.moderations.create({
        input: text
      });

      return {
        flagged: response.results[0].flagged,
        categories: response.results[0].categories,
        scores: response.results[0].category_scores
      };
    } catch (error) {
      throw new Error(`OpenAI moderation error: ${error.message}`);
    }
  }
}

export default OpenAIProvider;
