const os = require("os");

/**
 * PM2 — cluster mode for multi-core VPS (load-ready; put NGINX in front for SSL + static).
 * IMPORTANT: never use `instances: "max"` on low-resource laptops.
 * It can spawn too many processes, causing high CPU/RAM usage and poor stability.
 *
 * Safe defaults:
 * - development: 2 instances
 * - production: 4 instances
 * With CPU-safe fallback: min(default, available CPU cores).
 *
 * Optional manual override:
 * - PM2_INSTANCES=3
 *
 * Windows: if `pm2` fails with execution policy, run:
 *   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
 */
const cpuCores = Math.max(1, Number(os.cpus()?.length || 1));
const DEV_DEFAULT_INSTANCES = Math.min(2, cpuCores);
const PROD_DEFAULT_INSTANCES = Math.min(4, cpuCores);
const targetEnv = (process.env.PM2_TARGET_ENV || "development").toLowerCase();
const defaultInstances =
  targetEnv === "production" ? PROD_DEFAULT_INSTANCES : DEV_DEFAULT_INSTANCES;
const resolvedInstances = Math.max(
  1,
  Number(process.env.PM2_INSTANCES || defaultInstances)
);

module.exports = {
  apps: [
    {
      name: "sarkari-suchna",
      script: "./server/server.js",
      instances: resolvedInstances,
      exec_mode: "cluster",
      autorestart: true,
      max_restarts: 50,
      min_uptime: "5s",
      restart_delay: 3000,
      max_memory_restart: process.env.PM2_MAX_MEMORY || "512M",
      watch: false,
      merge_logs: true,
      time: true,
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      env: {
        NODE_ENV: "development"
      },
      env_production: {
        NODE_ENV: "production"
      }
    },
    {
      name: "worker",
      script: "./server/services/workers/siteWorker.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 50,
      min_uptime: "5s",
      restart_delay: 3000,
      watch: false,
      merge_logs: true,
      time: true,
      error_file: "./logs/pm2-worker-error.log",
      out_file: "./logs/pm2-worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      env: {
        NODE_ENV: "development"
      },
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
};
