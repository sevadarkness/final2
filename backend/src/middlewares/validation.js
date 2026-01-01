/**
 * Validation Middleware
 * Request validation using Joi schemas
 */

import Joi from 'joi';

/**
 * Valida request body, query ou params com schema Joi
 */
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid request data',
        errors
      });
    }

    // Replace with validated value
    req[property] = value;
    next();
  };
};

// ====================================
// COMMON SCHEMAS
// ====================================

export const schemas = {
  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // ID params
  idParam: Joi.object({
    id: Joi.string().required()
  }),

  // Workspace ID
  workspaceIdParam: Joi.object({
    workspaceId: Joi.string().required()
  }),

  // Auth
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required()
  }),

  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().min(2).required(),
    phone: Joi.string().optional()
  }),

  // Contact
  createContact: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    email: Joi.string().email().optional(),
    company: Joi.string().optional(),
    position: Joi.string().optional(),
    notes: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    customFields: Joi.object().optional()
  }),

  updateContact: Joi.object({
    name: Joi.string().optional(),
    phone: Joi.string().optional(),
    email: Joi.string().email().optional(),
    company: Joi.string().optional(),
    position: Joi.string().optional(),
    notes: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    customFields: Joi.object().optional(),
    sentiment: Joi.string().valid('positive', 'neutral', 'negative').optional(),
    leadScore: Joi.number().integer().min(0).max(100).optional()
  }),

  // Deal
  createDeal: Joi.object({
    contactId: Joi.string().required(),
    stageId: Joi.string().required(),
    title: Joi.string().required(),
    value: Joi.number().min(0).required(),
    currency: Joi.string().default('BRL'),
    probability: Joi.number().integer().min(0).max(100).default(0),
    expectedCloseDate: Joi.date().optional(),
    notes: Joi.string().optional(),
    customFields: Joi.object().optional()
  }),

  // Task
  createTask: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().optional(),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
    dueDate: Joi.date().optional()
  }),

  // Campaign
  createCampaign: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    messageTemplate: Joi.string().required(),
    mediaUrl: Joi.string().uri().optional(),
    scheduledAt: Joi.date().optional()
  }),

  // AI Request
  aiCopilot: Joi.object({
    context: Joi.string().required(),
    conversationHistory: Joi.array().items(Joi.object({
      role: Joi.string().valid('user', 'assistant').required(),
      content: Joi.string().required()
    })).optional(),
    contactId: Joi.string().optional(),
    dealStage: Joi.string().optional()
  }),

  aiSmartReplies: Joi.object({
    message: Joi.string().required(),
    context: Joi.string().optional(),
    count: Joi.number().integer().min(1).max(5).default(3)
  }),

  aiSentiment: Joi.object({
    text: Joi.string().required()
  }),

  aiIntent: Joi.object({
    text: Joi.string().required()
  }),

  aiEntity: Joi.object({
    text: Joi.string().required()
  }),

  aiSummary: Joi.object({
    messages: Joi.array().items(Joi.object({
      content: Joi.string().required(),
      timestamp: Joi.date().required()
    })).min(1).required()
  }),

  aiTranslate: Joi.object({
    text: Joi.string().required(),
    targetLanguage: Joi.string().required()
  })
};

export default {
  validate,
  schemas
};
