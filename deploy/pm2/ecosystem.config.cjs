const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

module.exports = {
  apps: [
    {
      name: 'marketingos',
      cwd: ROOT,
      script: path.join(ROOT, '.next', 'standalone', 'server.js'),
      interpreter: '/usr/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '20s',
      max_memory_restart: '1G',
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: '3055',
        HOSTNAME: '127.0.0.1',
        NEXT_TELEMETRY_DISABLED: '1',
        DATABASE_URL: 'postgresql://marketingos_user:HkLb1VWkR5XBblEdnkDnMlLh6AKCRr@localhost:5432/marketingos_prod?schema=public'
      },
      out_file: path.join(ROOT, 'logs', 'pm2-out.log'),
      error_file: path.join(ROOT, 'logs', 'pm2-error.log'),
      merge_logs: true,
      time: true
    }
  ]
};
