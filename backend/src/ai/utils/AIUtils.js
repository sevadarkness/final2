/**
 * AI Utilities - TokenCounter, CostCalculator, PIIMasker, SafetyFilter
 */

// ====================================
// TOKEN COUNTER
// ====================================
export class TokenCounter {
  /**
   * Contar tokens aproximadamente (baseado em GPT tokenizer)
   * Método simples: ~4 caracteres = 1 token
   */
  static count(text) {
    if (!text) return 0;
    
    // Aproximação mais precisa
    const words = text.split(/\s+/).length;
    const chars = text.length;
    
    // Média ponderada
    return Math.ceil((chars / 4 + words) / 2);
  }

  /**
   * Contar tokens de mensagens
   */
  static countMessages(messages) {
    return messages.reduce((total, msg) => {
      return total + this.count(msg.content) + 4; // +4 para overhead por mensagem
    }, 0);
  }

  /**
   * Estimar tokens de resposta baseado no prompt
   */
  static estimateResponseTokens(promptTokens, ratio = 0.5) {
    return Math.ceil(promptTokens * ratio);
  }
}

// ====================================
// COST CALCULATOR
// ====================================
export class CostCalculator {
  constructor() {
    // Pricing per 1M tokens (USD) - atualizado Jan 2026
    this.pricing = {
      'openai': {
        'gpt-4o': { input: 2.50, output: 10.00 },
        'gpt-4o-mini': { input: 0.15, output: 0.60 },
        'gpt-4-turbo': { input: 10.00, output: 30.00 },
        'gpt-3.5-turbo': { input: 0.50, output: 1.50 }
      },
      'anthropic': {
        'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
        'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
        'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
      },
      'google': {
        'gemini-1.5-pro': { input: 1.25, output: 5.00 },
        'gemini-1.5-flash': { input: 0.075, output: 0.30 }
      },
      'groq': {
        'llama-3.1-70b-versatile': { input: 0.59, output: 0.79 },
        'mixtral-8x7b-32768': { input: 0.24, output: 0.24 }
      }
    };
  }

  /**
   * Calcular custo de uma requisição
   */
  calculate(provider, model, promptTokens, completionTokens) {
    const providerPricing = this.pricing[provider];
    if (!providerPricing) return 0;

    const modelPricing = providerPricing[model];
    if (!modelPricing) return 0;

    const inputCost = (promptTokens / 1000000) * modelPricing.input;
    const outputCost = (completionTokens / 1000000) * modelPricing.output;

    return inputCost + outputCost;
  }

  /**
   * Estimar custo antes de fazer requisição
   */
  estimate(provider, model, text, responseRatio = 0.5) {
    const promptTokens = TokenCounter.count(text);
    const completionTokens = TokenCounter.estimateResponseTokens(promptTokens, responseRatio);
    
    return this.calculate(provider, model, promptTokens, completionTokens);
  }

  /**
   * Comparar custos entre providers
   */
  compare(text, providers = ['openai', 'anthropic', 'google', 'groq']) {
    const results = [];
    const promptTokens = TokenCounter.count(text);
    const completionTokens = TokenCounter.estimateResponseTokens(promptTokens);

    for (const provider of providers) {
      const providerPricing = this.pricing[provider];
      if (!providerPricing) continue;

      for (const [model, pricing] of Object.entries(providerPricing)) {
        const cost = this.calculate(provider, model, promptTokens, completionTokens);
        results.push({ provider, model, cost });
      }
    }

    return results.sort((a, b) => a.cost - b.cost);
  }
}

// ====================================
// PII MASKER
// ====================================
export class PIIMasker {
  constructor() {
    this.patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /(\+?\d{1,3}[\s-]?)?(\(?\d{2,3}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}/g,
      cpf: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
      cnpj: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g,
      creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      ip: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g
    };
  }

  /**
   * Mascarar PII em texto
   */
  mask(text, options = {}) {
    if (!text) return text;

    const {
      maskEmail = true,
      maskPhone = true,
      maskCPF = true,
      maskCNPJ = true,
      maskCreditCard = true,
      maskIP = false,
      placeholder = '[REDACTED]'
    } = options;

    let masked = text;

    if (maskEmail) {
      masked = masked.replace(this.patterns.email, (match) => {
        const [local, domain] = match.split('@');
        return `${local[0]}***@${domain}`;
      });
    }

    if (maskPhone) {
      masked = masked.replace(this.patterns.phone, placeholder);
    }

    if (maskCPF) {
      masked = masked.replace(this.patterns.cpf, (match) => {
        return `***.***.***-${match.slice(-2)}`;
      });
    }

    if (maskCNPJ) {
      masked = masked.replace(this.patterns.cnpj, '**.***/****-**');
    }

    if (maskCreditCard) {
      masked = masked.replace(this.patterns.creditCard, (match) => {
        return `****-****-****-${match.slice(-4)}`;
      });
    }

    if (maskIP) {
      masked = masked.replace(this.patterns.ip, '***.***.***. ***');
    }

    return masked;
  }

  /**
   * Detectar presença de PII
   */
  detect(text) {
    const detected = {
      hasPII: false,
      types: []
    };

    for (const [type, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(text)) {
        detected.hasPII = true;
        detected.types.push(type);
      }
    }

    return detected;
  }

  /**
   * Remover completamente PII
   */
  remove(text, placeholder = '') {
    if (!text) return text;

    let cleaned = text;
    for (const pattern of Object.values(this.patterns)) {
      cleaned = cleaned.replace(pattern, placeholder);
    }

    return cleaned;
  }
}

// ====================================
// SAFETY FILTER
// ====================================
export class SafetyFilter {
  constructor() {
    this.blockedCategories = [
      'hate',
      'harassment',
      'self-harm',
      'sexual',
      'violence'
    ];

    // Palavras-chave para detecção básica (português)
    this.unsafeKeywords = [
      'matar', 'suicídio', 'drogas', 'arma',
      // Add more as needed
    ];
  }

  /**
   * Verificar segurança do conteúdo
   */
  async check(text) {
    // Verificação básica com keywords
    const basicCheck = this.basicCheck(text);
    
    if (basicCheck.isSafe === false) {
      return basicCheck;
    }

    // TODO: Integrar com OpenAI Moderation API se disponível
    
    return {
      isSafe: true,
      categories: [],
      scores: {},
      confidence: 0.8
    };
  }

  /**
   * Verificação básica com keywords
   */
  basicCheck(text) {
    if (!text) {
      return { isSafe: true, categories: [], scores: {} };
    }

    const lowerText = text.toLowerCase();
    const foundKeywords = [];

    for (const keyword of this.unsafeKeywords) {
      if (lowerText.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }

    if (foundKeywords.length > 0) {
      return {
        isSafe: false,
        categories: ['unsafe_content'],
        scores: { unsafe_content: 0.9 },
        confidence: 0.7,
        foundKeywords
      };
    }

    return {
      isSafe: true,
      categories: [],
      scores: {},
      confidence: 0.7
    };
  }

  /**
   * Filtrar conteúdo inseguro
   */
  filter(text) {
    if (!text) return text;

    let filtered = text;
    
    for (const keyword of this.unsafeKeywords) {
      const regex = new RegExp(keyword, 'gi');
      filtered = filtered.replace(regex, '[FILTERED]');
    }

    return filtered;
  }
}

// ====================================
// PROMPT MANAGER
// ====================================
export class PromptManager {
  constructor() {
    this.templates = new Map();
    this.loadDefaultTemplates();
  }

  /**
   * Carregar templates padrão
   */
  loadDefaultTemplates() {
    this.templates.set('copilot_professional', {
      system: 'Você é um assistente profissional de vendas e atendimento. Seja cordial, direto e focado em resolver o problema do cliente.',
      variables: ['context', 'dealStage', 'contactInfo']
    });

    this.templates.set('smart_replies', {
      system: 'Gere ${count} respostas curtas e úteis para: "${message}"',
      variables: ['count', 'message']
    });

    this.templates.set('sentiment', {
      system: 'Analise o sentimento: "${text}". Responda com JSON: {"sentiment": "positive|neutral|negative", "score": 0-1}',
      variables: ['text']
    });
  }

  /**
   * Obter template
   */
  get(name) {
    return this.templates.get(name);
  }

  /**
   * Adicionar template customizado
   */
  add(name, template) {
    this.templates.set(name, template);
  }

  /**
   * Renderizar template com variáveis
   */
  render(name, variables = {}) {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template ${name} not found`);
    }

    let rendered = template.system;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      rendered = rendered.replace(regex, value);
    }

    return rendered;
  }
}

export default {
  TokenCounter,
  CostCalculator,
  PIIMasker,
  SafetyFilter,
  PromptManager
};
