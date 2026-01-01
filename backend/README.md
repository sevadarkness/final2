# WhatsHybrid Enterprise Backend

Backend enterprise robusto com sistema de IA multi-provider para WhatsHybrid.

## 🚀 Features

### Core Features
- **Multi-tenant Workspace Management**
- **Complete CRM System** (Contacts, Deals, Pipeline, Labels)
- **Task Management** with reminders
- **Campaign Management** with WhatsApp integration
- **Real-time Analytics** (Daily & Hourly metrics)
- **Audit Logging** (LGPD/GDPR compliant)
- **Webhook System** for external integrations

### AI System (8 Providers)
- **OpenAI** (GPT-4o, GPT-4-turbo, GPT-3.5-turbo)
- **Anthropic** (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
- **Google AI** (Gemini 1.5 Pro, Gemini 1.5 Flash)
- **Groq** (Llama 3.1 70B, Mixtral) - Ultra-fast
- **Mistral AI** (Mistral Large, Medium)
- **Cohere** (Command R+) - RAG optimized
- **Together AI** (Open-source models)
- **Ollama** (Local models)

### AI Capabilities
- **Intelligent Routing** (cost_optimized, speed_optimized, quality_optimized, balanced, failover)
- **AI Copilot** - Real-time response suggestions
- **Smart Replies** - Quick contextual responses
- **Sentiment Analysis** - Positive/Neutral/Negative
- **Intent Classification** - Understand user intent
- **Entity Extraction** - Extract names, emails, phones, etc.
- **Conversation Summarization**
- **Translation** - Multi-language support
- **Lead Scoring** - Predictive lead quality (0-100)
- **Circuit Breaker** - Automatic failover on provider failures
- **PII Masking** - Data privacy compliance
- **Safety Filter** - Content moderation

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- MongoDB 7+
- Qdrant (optional, for RAG)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio
npm run prisma:studio
```

### 4. Start Services with Docker

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- MongoDB (port 27017)
- Qdrant (port 6333)

### 5. Run Server

```bash
# Development
npm run dev

# Production
npm start
```

Server will run on `http://localhost:3000`

## 🔑 Environment Variables

### Required
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/whatshybrid"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# At least ONE AI provider
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
# OR
GOOGLE_AI_API_KEY=...
```

### Optional
```env
# Additional AI Providers
GROQ_API_KEY=...
MISTRAL_API_KEY=...
COHERE_API_KEY=...
TOGETHER_API_KEY=...
OLLAMA_BASE_URL=http://localhost:11434

# Billing (Stripe)
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Monitoring
SENTRY_DSN=...
```

## 📡 API Endpoints

### Authentication
```
POST /api/auth/register      - Register new user
POST /api/auth/login         - Login
POST /api/auth/refresh       - Refresh access token
POST /api/auth/logout        - Logout
POST /api/auth/forgot-password  - Request password reset
POST /api/auth/reset-password   - Reset password
GET  /api/auth/me            - Get current user
```

### AI Endpoints
```
POST /api/ai/copilot         - AI Copilot suggestions
POST /api/ai/smart-replies   - Generate smart replies
POST /api/ai/sentiment       - Analyze sentiment
POST /api/ai/intent          - Classify intent
POST /api/ai/extract-entities - Extract entities
POST /api/ai/summarize       - Summarize conversation
POST /api/ai/translate       - Translate text
POST /api/ai/score-lead      - Calculate lead score
GET  /api/ai/providers       - List available providers
GET  /api/ai/usage           - Get AI usage statistics
GET  /api/ai/credits         - Get workspace AI credits
```

### Health Check
```
GET /api/health              - Basic health check
GET /api/health/detailed     - Detailed system status
GET /api/health/ready        - Kubernetes readiness probe
GET /api/health/live         - Kubernetes liveness probe
```

### Other Endpoints
```
/api/users               - User management
/api/workspaces          - Workspace management
/api/contacts            - CRM contacts
/api/deals               - CRM deals
/api/labels              - Labels/tags
/api/tasks               - Task management
/api/campaigns           - Campaign management
/api/messages            - Message history
/api/analytics           - Analytics & metrics
/api/license             - License management
/api/billing             - Billing & subscriptions
/api/webhooks            - Webhook management
```

## 🤖 AI Usage Examples

### Copilot
```javascript
POST /api/ai/copilot
{
  "context": "Customer asking about pricing",
  "conversationHistory": [
    { "role": "user", "content": "How much does it cost?" }
  ],
  "dealStage": "qualification"
}
```

### Smart Replies
```javascript
POST /api/ai/smart-replies
{
  "message": "When can you deliver?",
  "count": 3
}
```

### Sentiment Analysis
```javascript
POST /api/ai/sentiment
{
  "text": "This is absolutely amazing! Thank you so much!"
}
```

## 🔧 AI Routing Strategies

Configure via environment variable `AI_ROUTING_STRATEGY` or per request:

- **cost_optimized** - Always choose cheapest provider
- **speed_optimized** - Prioritize fast inference (Groq, Ollama)
- **quality_optimized** - Best quality (Anthropic, OpenAI)
- **balanced** - Balance between cost, speed, and quality (default)
- **failover** - Use first available provider

## 🏗️ Architecture

```
backend/
├── prisma/
│   └── schema.prisma          # Database schema (30+ models)
├── src/
│   ├── index.js               # Entry point (Express + Socket.io)
│   ├── prisma.js              # Prisma client singleton
│   ├── middlewares/           # Authentication, rate limiting, validation
│   ├── routes/                # API routes
│   ├── services/              # Business logic
│   └── ai/
│       ├── providers/         # 8 AI providers
│       ├── services/          # AIRouter, Cache, Queue
│       ├── engines/           # Copilot, SmartReplies, etc.
│       ├── agents/            # Autonomous agents
│       ├── rag/               # RAG pipeline
│       ├── prompts/           # Prompt templates
│       └── utils/             # Utilities (PII masking, safety)
├── Dockerfile
└── docker-compose.yml
```

## 🔒 Security

- **JWT Authentication** with refresh tokens
- **Rate Limiting** (Redis-based)
- **PII Masking** before sending to AI
- **Content Safety Filter**
- **Audit Logging** (all actions logged)
- **LGPD/GDPR Compliant**
- **Environment-based secrets**

## 📊 Database Models

30+ Prisma models including:
- User, Session, PasswordReset
- Workspace, WorkspaceMember, WorkspaceInvite
- Contact, Label, ContactLabel
- Pipeline, PipelineStage, Deal
- Task, TaskReminder
- Campaign, CampaignItem
- Message, MessageTemplate
- License, AICredit, Subscription, Invoice
- AnalyticsDaily, AnalyticsHourly, AIUsageLog
- Webhook, WebhookDelivery
- AuditLog
- And more...

## 🧪 Testing

```bash
npm test
```

## 📝 Logging

Uses structured logging with Pino:
- Development: Verbose logging with pretty print
- Production: JSON logging for aggregation

## 🚢 Deployment

### Docker
```bash
docker build -t whatshybrid-backend .
docker run -p 3000:3000 --env-file .env whatshybrid-backend
```

### Docker Compose
```bash
docker-compose up -d
```

### Kubernetes
See `k8s/` directory for deployment manifests (TODO)

## 📈 Monitoring

- Health checks: `/api/health` and `/api/health/detailed`
- AI provider status: `/api/ai/providers`
- Usage metrics: `/api/ai/usage`
- Integrate with Sentry for error tracking

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit pull request

## 📄 License

MIT

## 🆘 Support

For issues and questions, open an issue on GitHub.
