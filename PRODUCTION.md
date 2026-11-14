# MarketingOS - Production Deployment Guide

## Architecture
- Framework: Next.js 16.4.6 (App Router, standalone)
- Database: PostgreSQL 14 (localhost:5432)
- Cache: Redis 6 (localhost:6379)
- AI: Ollama (localhost:11434, qwen3:8b)
- Process Manager: PM2 (alamin user)
- Reverse Proxy: Nginx 1.18 + Cloudflare SSL
- Domain: https://marketing.alolabs.net

## Key Paths
- Project: /home/alamin/MarketingOS
- PM2 Config: deploy/pm2/ecosystem.config.cjs
- Environment: .env (623 lines, 235 vars)
- Prisma Schema: prisma/schema.prisma (119 models)
- Nginx Config: /etc/nginx/sites-enabled/marketing.alolabs.net.conf
- SSL Certs: /etc/nginx/ssl/alolabs.net.*
- Backups: /home/alamin/storage/backups/daily/
- Logs: logs/pm2-*.log, logs/server-health.log
- Restore Guide: RESTORE.md

## Common Commands
- Status: su - alamin -c "pm2 list"
- Health: curl -s http://localhost:3055/api/health
- Logs: su - alamin -c "pm2 logs marketingos --lines 50"
- Restart: su - alamin -c "cd /home/alamin/MarketingOS && pm2 restart marketingos"
- Rebuild: su - alamin -c "cd /home/alamin/MarketingOS && npm run build && pm2 restart marketingos"
- Backup: su - alamin -c "/home/alamin/scripts/alo-backup.sh"

## Scheduled Jobs
- Daily 2 AM: alo-backup.sh (full backup)
- Every 5 min: pm2-healthcheck.sh (restart crashed apps)
- Every 15 min: server-healthcheck.sh (disk/RAM/DB monitoring)

## Security
- Global auth middleware on all API routes
- JWT HS256, 7-day expiry
- Cloudflare Origin SSL (Full Strict)
- HSTS, X-Frame-Options, CORS headers
- Nginx version hidden, fail2ban active

## Admin Login
- URL: https://marketing.alolabs.net
- Email: admin@alolabs.net
- Password: see ADMIN_SEED_PASSWORD in .env
