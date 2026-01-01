/**
 * AnthropicProvider - Integração com Claude models
 * Suporta: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
 */

import Anthropic from '@anthropic-ai/sdk';
import BaseProvider from './BaseProvider.js';

export class AnthropicProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      id: 'anthropic',
      name: 'Anthropic Claude',
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      defaultModel: config.defaultModel || process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
      ...config
    });

    if (this.isConfigured()) {
      this.client = new Anthropic({
        apiKey: this.apiKey,
        timeout: this.timeout
      });
    }

    // Pricing per 1M tokens (USD)
    this.pricing = {
      'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
      'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
      'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
    };
  }

  /**
   * Complete chat com Anthropic
   */
  async complete(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Anthropic provider not configured');
    }

    const model = options.model || this.defaultModel;
    const startTime = Date.now();

    try {
      // Separar system message
      let systemMessage = '';
      const formattedMessages = [];

      for (const msg of messages) {
        if (msg.role === 'system') {
          systemMessage = msg.content;
        } else {
          formattedMessages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          });
        }
      }

      const response = await this.withRetry(async () => {
        return await this.client.messages.create({
          model,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
          top_p: options.topP,
          system: systemMessage || undefined,
          messages: formattedMessages,
          stop_sequences: options.stop
        });
      });

      const latency = Date.now() - startTime;
      const usage = {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      };
      const cost = this.estimateCost(usage.promptTokens, usage.completionTokens, model);

      this.recordSuccess();

      return {
        provider: this.id,
        model,
        content: response.content[0].text,
        finishReason: response.stop_reason,
        usage,
        cost,
        latency
      };
    } catch (error) {
      this.recordFailure(error);
      throw new Error(`Anthropic error: ${error.message}`);
    }
  }

  /**
   * Estimar custo da requisição
   */
  estimateCost(promptTokens, completionTokens, model) {
    const pricing = this.pricing[model] || this.pricing['claude-3-5-sonnet-20241022'];
    const inputCost = (promptTokens / 1000000) * pricing.input;
    const outputCost = (completionTokens / 1000000) * pricing.output;
    return inputCost + outputCost;
  }
}

export default AnthropicProvider;
