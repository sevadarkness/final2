/**
 * WhatsHybrid Enterprise Backend
 * Main entry point with Express + Socket.io
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

// Routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import workspacesRoutes from './routes/workspaces.js';
import contactsRoutes from './routes/contacts.js';
import dealsRoutes from './routes/deals.js';
import labelsRoutes from './routes/labels.js';
import tasksRoutes from './routes/tasks.js';
import campaignsRoutes from './routes/campaigns.js';
import messagesRoutes from './routes/messages.js';
import analyticsRoutes from './routes/analytics.js';
import aiRoutes from './routes/ai.js';
import licenseRoutes from './routes/license.js';
import billingRoutes from './routes/billing.js';
import webhooksRoutes from './routes/webhooks.js';
import settingsRoutes from './routes/settings.js';
import healthRoutes from './routes/health.js';

// Middleware
import { errorHandler } from './middlewares/errorHandler.js';
import { rateLimitMiddleware } from './middlewares/rateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// ====================================
// MIDDLEWARE
// ====================================

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Rate limiting
if (process.env.ENABLE_RATE_LIMITING === 'true') {
  app.use(rateLimitMiddleware);
}

// Request ID
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substring(7);
  next();
});

// ====================================
// SOCKET.IO
// ====================================

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Join workspace room
  socket.on('join:workspace', (workspaceId) => {
    socket.join(`workspace:${workspaceId}`);
    console.log(`[Socket.io] Client ${socket.id} joined workspace ${workspaceId}`);
  });

  // Leave workspace room
  socket.on('leave:workspace', (workspaceId) => {
    socket.leave(`workspace:${workspaceId}`);
    console.log(`[Socket.io] Client ${socket.id} left workspace ${workspaceId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Make io available to routes
app.set('io', io);

// ====================================
// ROUTES
// ====================================

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/labels', labelsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/settings', settingsRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsHybrid Enterprise API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler (must be last)
app.use(errorHandler);

// ====================================
// START SERVER
// ====================================

httpServer.listen(PORT, () => {
  console.log('====================================');
  console.log('🚀 WhatsHybrid Enterprise Backend');
  console.log('====================================');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server running on port ${PORT}`);
  console.log(`API URL: http://localhost:${PORT}`);
  console.log(`Socket.io: Enabled`);
  console.log('====================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, io };
