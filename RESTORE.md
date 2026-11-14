# MarketingOS Disaster Recovery Runbook

## Quick Restore
1. Extract: tar -xzf $(ls -t /home/alamin/storage/backups/daily/*.tar.gz | head -1) -C /tmp/restore
2. Restore DB: PGPASSWORD=xxx pg_restore -h localhost -U marketingos_user -d marketingos_prod --clean /tmp/restore/marketingos_prod.dump
3. Restore env: cp /tmp/restore/marketingos/.env /home/alamin/MarketingOS/.env
4. Restart: su - alamin -c "cd /home/alamin/MarketingOS && pm2 start deploy/pm2/ecosystem.config.cjs"

## Full Rebuild
1. git clone https://github.com/engralaminn-collab/MarketingOS.git
2. npm install && npx prisma db push
3. Restore .env and DB from backup
4. npm run build && pm2 start deploy/pm2/ecosystem.config.cjs
