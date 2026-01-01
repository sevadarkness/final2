# WhatsHybrid Enterprise - Deployment Guide

Complete guide for deploying WhatsHybrid Enterprise backend to production.

## 📋 Prerequisites

### Required
- Server with Ubuntu 20.04+ or similar Linux distro
- Node.js 18+ installed
- Docker & Docker Compose installed
- Domain name (for SSL/HTTPS)
- SSL certificate (Let's Encrypt recommended)

### Recommended
- Minimum 2GB RAM
- 2 CPU cores
- 20GB storage
- Reverse proxy (Nginx/Caddy)

## 🔧 Production Setup

### 1. Clone Repository

```bash
git clone https://github.com/sevadarkness/final2.git
cd final2/backend
```

### 2. Environment Configuration

```bash
cp .env.example .env.production
nano .env.production
```

**Critical Production Settings:**

```env
# Environment
NODE_ENV=production
PORT=3000

# Database (Use strong password)
DATABASE_URL="postgresql://prod_user:STRONG_PASSWORD@localhost:5432/whatshybrid_prod?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=STRONG_REDIS_PASSWORD

# JWT (Generate strong secrets)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# AI Providers (Add your keys)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
# ... add others as needed

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AI_MAX_REQUESTS=20

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Logging
LOG_LEVEL=info
LOG_TO_FILE=true

# Security
ENABLE_PII_MASKING=true
ENABLE_AUDIT_LOGS=true
ENABLE_RATE_LIMITING=true

# Monitoring (Optional)
SENTRY_DSN=your-sentry-dsn
```

### 3. Install Dependencies

```bash
npm ci --production
```

### 4. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations (PRODUCTION)
npm run prisma:deploy

# Verify connection
npm run prisma:studio
```

### 5. Start Services with Docker

Edit `docker-compose.yml` for production:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: whatshybrid-postgres-prod
    restart: always
    environment:
      POSTGRES_USER: prod_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: whatshybrid_prod
    ports:
      - "127.0.0.1:5432:5432"  # Only localhost
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    networks:
      - whatshybrid-network

  redis:
    image: redis:7-alpine
    container_name: whatshybrid-redis-prod
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    ports:
      - "127.0.0.1:6379:6379"  # Only localhost
    volumes:
      - redis_prod_data:/data
    networks:
      - whatshybrid-network

  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: whatshybrid-backend-prod
    restart: always
    ports:
      - "127.0.0.1:3000:3000"  # Only localhost (use nginx)
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    networks:
      - whatshybrid-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_prod_data:
  redis_prod_data:

networks:
  whatshybrid-network:
    driver: bridge
```

Start services:

```bash
docker-compose -f docker-compose.yml up -d
```

### 6. Nginx Configuration

Create `/etc/nginx/sites-available/whatshybrid`:

```nginx
upstream backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/whatshybrid_access.log;
    error_log /var/log/nginx/whatshybrid_error.log;

    # Body size (for file uploads)
    client_max_body_size 10M;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Cache
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint (no auth)
    location /api/health {
        proxy_pass http://backend;
        access_log off;
    }
}
```

Enable and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/whatshybrid /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### 8. Process Manager (PM2)

For better process management:

```bash
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name whatshybrid-backend

# Enable startup script
pm2 startup
pm2 save

# Monitor
pm2 status
pm2 logs whatshybrid-backend
```

## 🔒 Security Checklist

- [ ] Strong database passwords
- [ ] Strong JWT secrets (min 32 chars)
- [ ] Redis password protection
- [ ] Firewall configured (UFW)
- [ ] Only localhost database ports
- [ ] HTTPS enabled (SSL)
- [ ] Rate limiting enabled
- [ ] PII masking enabled
- [ ] Audit logging enabled
- [ ] Regular backups configured
- [ ] Security updates automated

## 🔥 Firewall Configuration (UFW)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

## 📦 Backup Strategy

### Database Backup

```bash
# Create backup script
cat > /opt/whatshybrid/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/whatshybrid"
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec whatshybrid-postgres-prod pg_dump -U prod_user whatshybrid_prod | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_$DATE.sql.gz"
EOF

chmod +x /opt/whatshybrid/backup.sh
```

### Cron Job (Daily at 2 AM)

```bash
crontab -e

# Add line:
0 2 * * * /opt/whatshybrid/backup.sh >> /var/log/whatshybrid_backup.log 2>&1
```

## 📊 Monitoring

### Health Checks

```bash
# Check backend health
curl https://api.yourdomain.com/api/health/detailed

# Check services
docker-compose ps
```

### Logs

```bash
# Backend logs
docker logs -f whatshybrid-backend-prod

# Nginx logs
tail -f /var/log/nginx/whatshybrid_access.log
tail -f /var/log/nginx/whatshybrid_error.log

# PM2 logs (if using PM2)
pm2 logs whatshybrid-backend
```

### Monitoring Tools

Integrate with:
- **Sentry** - Error tracking
- **New Relic** - APM
- **DataDog** - Infrastructure monitoring
- **UptimeRobot** - Uptime monitoring

## 🔄 Update/Deployment Process

```bash
# 1. Pull latest code
cd /path/to/final2/backend
git pull origin main

# 2. Install dependencies
npm ci --production

# 3. Run migrations
npm run prisma:deploy

# 4. Rebuild Docker images
docker-compose build

# 5. Restart services
docker-compose down
docker-compose up -d

# 6. Verify
curl https://api.yourdomain.com/api/health
```

## 🚨 Troubleshooting

### Backend Won't Start

```bash
# Check logs
docker logs whatshybrid-backend-prod

# Check environment
docker exec whatshybrid-backend-prod env

# Test database connection
docker exec whatshybrid-backend-prod npm run prisma:studio
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection
docker exec whatshybrid-postgres-prod psql -U prod_user -d whatshybrid_prod -c "SELECT 1"
```

### High CPU/Memory Usage

```bash
# Check Docker stats
docker stats

# Check Node.js memory
pm2 monit

# Restart if needed
docker-compose restart backend
```

## 📈 Performance Tuning

### Node.js Options

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=2048" npm start
```

### PostgreSQL Tuning

Edit `postgresql.conf`:

```conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
```

## 🌐 Scaling

### Horizontal Scaling

Use load balancer (HAProxy/AWS ELB) with multiple backend instances:

```yaml
# docker-compose.yml
  backend-1:
    <<: *backend
    container_name: whatshybrid-backend-1
  
  backend-2:
    <<: *backend
    container_name: whatshybrid-backend-2
```

### Database Scaling

- **Read Replicas** for high read loads
- **Connection Pooling** (already enabled with Prisma)
- **Redis Cluster** for caching

## 📞 Support

For deployment issues:
1. Check logs first
2. Verify all environment variables
3. Test each service individually
4. Open GitHub issue with details

---

**Last Updated**: January 2026  
**Deployment Guide Version**: 1.0
