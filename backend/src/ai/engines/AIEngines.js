/**
 * SmartRepliesEngine - Sugestões rápidas e contextuais
 * Gera 3-5 opções de resposta em diferentes tons
 */

import { getAIRouter } from '../services/AIRouterService.js';

export class SmartRepliesEngine {
  constructor(options = {}) {
    this.router = getAIRouter();
    this.defaultCount = options.count || 3;
  }

  /**
   * Gerar smart replies
   */
  async generate(message, context = {}, count = this.defaultCount) {
    const { conversationHistory = [], contactInfo = {} } = context;

    const systemPrompt = `Você é um gerador de respostas rápidas para WhatsApp Business.
Gere ${count} opções de resposta curtas (máximo 2-3 linhas) para a mensagem recebida.
Varie o tom: formal, neutro e amigável.
Cada resposta deve ser clara, útil e avançar a conversa.

Mensagem recebida: "${message}"

Retorne apenas as ${count} sugestões, uma por linha, sem numeração ou prefixos.`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    try {
      const result = await this.router.route(messages, {
        strategy: 'speed_optimized', // Preferir velocidade
        temperature: 0.8,
        maxTokens: 200
      });

      // Parse das sugestões
      const replies = this.parseReplies(result.content, count);

      return {
        replies,
        provider: result.provider,
        latency: result.latency
      };
    } catch (error) {
      console.error('[SmartRepliesEngine] Error:', error);
      // Fallback para respostas genéricas
      return {
        replies: this.getFallbackReplies(message),
        provider: 'fallback',
        latency: 0
      };
    }
  }

  /**
   * Parse das respostas
   */
  parseReplies(content, count) {
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, count);

    const tones = ['formal', 'neutral', 'friendly'];

    return lines.map((text, index) => ({
      text,
      tone: tones[index % tones.length],
      confidence: 0.85 - (index * 0.05)
    }));
  }

  /**
   * Respostas fallback genéricas
   */
  getFallbackReplies(message) {
    return [
      {
        text: 'Obrigado pela sua mensagem. Vou analisar e retornar em breve.',
        tone: 'formal',
        confidence: 0.7
      },
      {
        text: 'Recebi sua mensagem! Vou verificar isso para você.',
        tone: 'neutral',
        confidence: 0.7
      },
      {
        text: 'Olá! Vi sua mensagem e já vou te ajudar com isso 😊',
        tone: 'friendly',
        confidence: 0.7
      }
    ];
  }
}

/**
 * SentimentAnalyzer - Análise de sentimento
 */
export class SentimentAnalyzer {
  constructor() {
    this.router = getAIRouter();
  }

  async analyze(text) {
    const systemPrompt = `Analise o sentimento da seguinte mensagem e responda APENAS com um JSON no formato:
{"sentiment": "positive|neutral|negative", "score": 0.0-1.0, "emotions": ["emotion1", "emotion2"]}

Mensagem: "${text}"`;

    try {
      const result = await this.router.route([
        { role: 'system', content: systemPrompt }
      ], {
        strategy: 'speed_optimized',
        temperature: 0.3,
        maxTokens: 100
      });

      const analysis = JSON.parse(result.content);
      return {
        sentiment: analysis.sentiment,
        score: analysis.score,
        emotions: analysis.emotions || [],
        confidence: 0.9
      };
    } catch (error) {
      console.error('[SentimentAnalyzer] Error:', error);
      return this.basicSentimentAnalysis(text);
    }
  }

  /**
   * Análise básica de sentimento (fallback)
   */
  basicSentimentAnalysis(text) {
    const positiveWords = ['obrigado', 'ótimo', 'excelente', 'perfeito', 'adorei'];
    const negativeWords = ['ruim', 'péssimo', 'problema', 'reclamar', 'insatisfeito'];

    const lowerText = text.toLowerCase();
    let score = 0.5;

    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 0.1;
    });

    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score -= 0.1;
    });

    score = Math.max(0, Math.min(1, score));

    let sentiment = 'neutral';
    if (score > 0.6) sentiment = 'positive';
    if (score < 0.4) sentiment = 'negative';

    return { sentiment, score, emotions: [], confidence: 0.6 };
  }
}

/**
 * IntentClassifier - Classificação de intenção
 */
export class IntentClassifier {
  constructor() {
    this.router = getAIRouter();
  }

  async classify(text) {
    const systemPrompt = `Classifique a intenção do usuário nesta mensagem. Responda APENAS com JSON:
{"intent": "category", "confidence": 0.0-1.0, "entities": {}}

Categorias possíveis:
- product_inquiry (pergunta sobre produto)
- pricing (pergunta sobre preço)
- support (suporte/problema)
- complaint (reclamação)
- purchase (intenção de compra)
- information (pedido de informação)
- greeting (saudação)
- other (outro)

Mensagem: "${text}"`;

    try {
      const result = await this.router.route([
        { role: 'system', content: systemPrompt }
      ], {
        strategy: 'speed_optimized',
        temperature: 0.2,
        maxTokens: 150
      });

      return JSON.parse(result.content);
    } catch (error) {
      console.error('[IntentClassifier] Error:', error);
      return { intent: 'other', confidence: 0.5, entities: {} };
    }
  }
}

/**
 * EntityExtractor - Extração de entidades
 */
export class EntityExtractor {
  constructor() {
    this.router = getAIRouter();
  }

  async extract(text) {
    const systemPrompt = `Extraia entidades desta mensagem. Responda APENAS com JSON:
{"name": [], "email": [], "phone": [], "company": [], "date": [], "amount": []}

Mensagem: "${text}"`;

    try {
      const result = await this.router.route([
        { role: 'system', content: systemPrompt }
      ], {
        strategy: 'speed_optimized',
        temperature: 0.1,
        maxTokens: 200
      });

      return JSON.parse(result.content);
    } catch (error) {
      console.error('[EntityExtractor] Error:', error);
      return this.basicExtraction(text);
    }
  }

  /**
   * Extração básica com regex (fallback)
   */
  basicExtraction(text) {
    const entities = {
      name: [],
      email: [],
      phone: [],
      company: [],
      date: [],
      amount: []
    };

    // Email
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    entities.email = [...(text.match(emailRegex) || [])];

    // Phone (brasileiro)
    const phoneRegex = /(\+55\s?)?(\(?\d{2}\)?[\s-]?)?(9?\d{4}[\s-]?\d{4})/g;
    entities.phone = [...(text.match(phoneRegex) || [])];

    return entities;
  }
}

/**
 * SummarizerEngine - Resumo de conversas
 */
export class SummarizerEngine {
  constructor() {
    this.router = getAIRouter();
  }

  async summarize(messages, options = {}) {
    const { maxLength = 500 } = options;

    const conversationText = messages
      .map(msg => `[${msg.role}]: ${msg.content}`)
      .join('\n');

    const systemPrompt = `Resuma a seguinte conversa em português, destacando:
1. Pontos principais discutidos
2. Decisões ou acordos
3. Próximos passos ou ações necessárias

Máximo ${maxLength} caracteres.

Conversa:
${conversationText}`;

    try {
      const result = await this.router.route([
        { role: 'system', content: systemPrompt }
      ], {
        strategy: 'quality_optimized',
        temperature: 0.5,
        maxTokens: Math.ceil(maxLength / 3)
      });

      return {
        summary: result.content,
        keyPoints: this.extractKeyPoints(result.content),
        provider: result.provider
      };
    } catch (error) {
      console.error('[SummarizerEngine] Error:', error);
      throw error;
    }
  }

  extractKeyPoints(summary) {
    // Extrair linhas que começam com - ou *
    const lines = summary.split('\n');
    return lines
      .filter(line => line.trim().match(/^[-*]\s/))
      .map(line => line.replace(/^[-*]\s/, '').trim());
  }
}

/**
 * TranslatorEngine - Tradução automática
 */
export class TranslatorEngine {
  constructor() {
    this.router = getAIRouter();
  }

  async translate(text, targetLanguage, sourceLanguage = 'auto') {
    const systemPrompt = `Traduza o seguinte texto para ${targetLanguage}.
Mantenha o tom e a formalidade do original.
Responda APENAS com a tradução, sem explicações.

Texto: "${text}"`;

    try {
      const result = await this.router.route([
        { role: 'system', content: systemPrompt }
      ], {
        strategy: 'speed_optimized',
        temperature: 0.3,
        maxTokens: Math.ceil(text.length * 1.5)
      });

      return {
        translatedText: result.content.trim(),
        sourceLanguage: sourceLanguage === 'auto' ? 'pt' : sourceLanguage,
        targetLanguage,
        provider: result.provider
      };
    } catch (error) {
      console.error('[TranslatorEngine] Error:', error);
      throw error;
    }
  }
}

/**
 * LeadScoringEngine - Score preditivo de leads
 */
export class LeadScoringEngine {
  constructor() {
    this.router = getAIRouter();
  }

  async score(contactData) {
    const {
      messages = [],
      sentiment,
      company,
      position,
      engagement,
      responseTime
    } = contactData;

    // Análise baseada em regras + IA
    let score = 50; // Base

    // Fatores positivos
    if (sentiment === 'positive') score += 15;
    if (company) score += 10;
    if (position && ['ceo', 'diretor', 'gerente'].some(t => position.toLowerCase().includes(t))) score += 15;
    if (engagement > 5) score += 10;
    if (responseTime < 3600) score += 10; // < 1 hora

    // Análise de mensagens com IA
    if (messages.length > 0) {
      try {
        const recentMessages = messages.slice(-5).map(m => m.content).join('\n');
        const prompt = `Analise a intenção de compra (0-100) nestas mensagens:
${recentMessages}

Responda apenas com número.`;

        const result = await this.router.route([
          { role: 'system', content: prompt }
        ], {
          strategy: 'speed_optimized',
          temperature: 0.2,
          maxTokens: 10
        });

        const aiScore = parseInt(result.content) || 0;
        score = Math.round((score + aiScore) / 2);
      } catch (error) {
        console.error('[LeadScoringEngine] AI scoring error:', error);
      }
    }

    // Normalizar 0-100
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      factors: {
        sentiment: sentiment === 'positive' ? 15 : 0,
        company: company ? 10 : 0,
        position: position ? 15 : 0,
        engagement: Math.min(engagement * 2, 10),
        responseTime: responseTime < 3600 ? 10 : 0
      },
      recommendation: this.getRecommendation(score)
    };
  }

  getRecommendation(score) {
    if (score >= 80) return 'Hot lead - Contact immediately';
    if (score >= 60) return 'Warm lead - Follow up within 24h';
    if (score >= 40) return 'Cold lead - Nurture with content';
    return 'Low priority - Monitor for engagement';
  }
}

export default {
  SmartRepliesEngine,
  SentimentAnalyzer,
  IntentClassifier,
  EntityExtractor,
  SummarizerEngine,
  TranslatorEngine,
  LeadScoringEngine
};
