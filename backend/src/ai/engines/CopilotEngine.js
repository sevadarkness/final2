/**
 * CopilotEngine - Motor principal de IA
 * Sugestões de resposta em tempo real com análise de contexto
 */

import { getAIRouter } from '../services/AIRouterService.js';
import prisma from '../../prisma.js';

export class CopilotEngine {
  constructor(options = {}) {
    this.router = getAIRouter();
    this.defaultProvider = options.provider || process.env.AI_DEFAULT_PROVIDER || 'openai';
    this.defaultModel = options.model;
  }

  /**
   * Gerar sugestão de resposta baseada em contexto
   */
  async generateSuggestion(context) {
    const {
      currentMessage,
      conversationHistory = [],
      contactId,
      dealStage,
      userId,
      workspaceId,
      persona = 'professional'
    } = context;

    // Buscar informações adicionais do contato se disponível
    let contactInfo = '';
    if (contactId) {
      const contact = await this.getContactInfo(contactId);
      contactInfo = this.formatContactInfo(contact);
    }

    // Construir prompt com contexto
    const systemPrompt = this.buildSystemPrompt(persona, dealStage, contactInfo);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: currentMessage }
    ];

    try {
      // Rotear para melhor provider
      const result = await this.router.route(messages, {
        provider: this.defaultProvider,
        model: this.defaultModel,
        temperature: 0.7,
        maxTokens: 500
      });

      // Log de uso
      await this.logUsage(userId, workspaceId, result, 'copilot');

      return {
        suggestion: result.content,
        confidence: this.calculateConfidence(result),
        provider: result.provider,
        model: result.model,
        reasoning: this.extractReasoning(result.content),
        alternatives: [] // TODO: Gerar alternativas
      };
    } catch (error) {
      console.error('[CopilotEngine] Error:', error);
      throw error;
    }
  }

  /**
   * Construir prompt do sistema
   */
  buildSystemPrompt(persona, dealStage, contactInfo) {
    const personaPrompts = {
      professional: 'Você é um assistente profissional de vendas e atendimento. Seja cordial, direto e focado em resolver o problema do cliente.',
      friendly: 'Você é um assistente amigável e prestativo. Use um tom caloroso e empático nas respostas.',
      formal: 'Você é um assistente executivo formal. Mantenha um tom corporativo e profissional.',
      casual: 'Você é um assistente descontraído. Use uma linguagem informal e acessível.'
    };

    let prompt = personaPrompts[persona] || personaPrompts.professional;

    if (dealStage) {
      const stageGuidance = {
        'lead': 'O cliente está na fase de descoberta. Foque em entender suas necessidades.',
        'qualification': 'Qualifique o lead. Faça perguntas sobre budget, autoridade, necessidade e timing (BANT).',
        'proposal': 'O cliente está avaliando propostas. Destaque valor e diferenciais.',
        'negotiation': 'Estamos em negociação. Seja flexível mas mantenha o valor.',
        'closed-won': 'Cliente fechou! Foque em onboarding e próximos passos.',
        'closed-lost': 'Negócio perdido. Mantenha relacionamento para futuras oportunidades.'
      };

      prompt += `\n\nEstágio do negócio: ${stageGuidance[dealStage] || 'Indefinido'}`;
    }

    if (contactInfo) {
      prompt += `\n\nInformações do contato:\n${contactInfo}`;
    }

    prompt += '\n\nGere uma resposta apropriada, clara e que avance a conversa de forma positiva.';

    return prompt;
  }

  /**
   * Buscar informações do contato
   */
  async getContactInfo(contactId) {
    try {
      return await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          name: true,
          company: true,
          position: true,
          notes: true,
          tags: true,
          sentiment: true,
          leadScore: true
        }
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Formatar informações do contato
   */
  formatContactInfo(contact) {
    if (!contact) return '';

    const parts = [];
    if (contact.name) parts.push(`Nome: ${contact.name}`);
    if (contact.company) parts.push(`Empresa: ${contact.company}`);
    if (contact.position) parts.push(`Cargo: ${contact.position}`);
    if (contact.sentiment) parts.push(`Sentimento: ${contact.sentiment}`);
    if (contact.leadScore) parts.push(`Score: ${contact.leadScore}/100`);
    if (contact.tags?.length) parts.push(`Tags: ${contact.tags.join(', ')}`);

    return parts.join('\n');
  }

  /**
   * Calcular confiança da sugestão
   */
  calculateConfidence(result) {
    // Baseado em vários fatores
    let confidence = 0.7; // Base

    // Provider mais confiável aumenta score
    const providerBonus = {
      'anthropic': 0.15,
      'openai': 0.15,
      'google': 0.10,
      'groq': 0.05
    };
    confidence += providerBonus[result.provider] || 0;

    // Latência baixa aumenta confiança
    if (result.latency < 2000) confidence += 0.05;

    // Normalizar entre 0-1
    return Math.min(confidence, 1.0);
  }

  /**
   * Extrair raciocínio da resposta (se houver)
   */
  extractReasoning(content) {
    // Placeholder - pode ser melhorado com análise mais sofisticada
    return 'Resposta gerada com base no contexto da conversa e estágio do negócio.';
  }

  /**
   * Log de uso de IA
   */
  async logUsage(userId, workspaceId, result, engine) {
    try {
      await prisma.aIUsageLog.create({
        data: {
          workspaceId,
          userId,
          provider: result.provider,
          model: result.model,
          engine,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          costUsd: result.cost,
          latencyMs: result.latency,
          success: true
        }
      });
    } catch (error) {
      console.error('[CopilotEngine] Failed to log usage:', error);
    }
  }

  /**
   * Gerar múltiplas variações de resposta
   */
  async generateVariations(context, count = 3) {
    const variations = [];

    for (let i = 0; i < count; i++) {
      try {
        // Variar temperatura para diferentes tons
        const temperature = 0.6 + (i * 0.2);
        const result = await this.generateSuggestion({
          ...context,
          temperature
        });
        variations.push(result);
      } catch (error) {
        console.error(`[CopilotEngine] Failed to generate variation ${i}:`, error);
      }
    }

    return variations;
  }
}

export default CopilotEngine;
