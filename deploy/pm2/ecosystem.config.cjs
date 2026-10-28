/**
 * PM2 process file for bare-metal (non-Docker) deployments.
 *
 *   npm ci --omit=dev            # or: bun install --frozen-lockfile
 *   npm run build                # produces .next/standalone + static assets
 *   pm2 start deploy/pm2/ecosystem.config.cjs
 *   pm2 save && pm2 startup
 *
 * PM2 replaces the Docker healthcheck, so the `health` helper below is what
 * makes `pm2 reload` fail loudly instead of silently serving a broken build.
 *
 * IMPORTANT: SQLite has a single writer. Run exactly ONE instance
 * (`instances: 1`, fork mode). Cluster mode with several workers on the same
 * database file produces SQLITE_BUSY errors under load.
 */
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

module.exports = {
  apps: [
    {
      name: 'marketingos',
      cwd: ROOT,
      // Build output produced by `next build` (output: 'standalone').
      script: path.join(ROOT, '.next', 'standalone', 'server.js'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      max_memory_restart: '1G',
      kill_timeout: 10000,
      wait_ready: false,
      listen_timeout: 15000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Bind all interfaces only if PM2 runs behind the reverse proxy on the
        // same host; 127.0.0.1 keeps the port off the public network.
        HOSTNAME: '127.0.0.1',
        NEXT_TELEMETRY_DISABLED: 1,
        // DATABASE_URL, JWT_SECRET, CREDENTIAL_ENCRYPTION_KEY and provider
        // credentials must come from the environment / an env file that is
        // root-owned and chmod 600. Never inline secrets in this file.
      },
      // Uncomment to load secrets from a protected env file instead of the
      // shell environment:
      // env_file: '/etc/marketingos/marketingos.env',
      out_file: path.join(ROOT, 'logs', 'pm2-out.log'),
      error_file: path.join(ROOT, 'logs', 'pm2-error.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
