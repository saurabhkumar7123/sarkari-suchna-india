# VPS deployment (simple)

No Docker: **Node + PM2** on a Linux VPS. NGINX (or Caddy) in front is optional but recommended for HTTPS.

## One-time setup on the server

1. **Install Node.js** (LTS, e.g. 20.x) and **Git**.

2. **Clone** your repo and enter the folder:
   ```bash
   git clone <your-repo-url> sarkari-suchna
   cd sarkari-suchna
   ```

3. **Environment**
   ```bash
   cp .env.example .env
   nano .env   # set DB, Redis, JWT_SECRET, ADMIN_PASS_HASH, SITE_URL, TRUST_PROXY=1 behind proxy, etc.
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **PM2** (install globally once: `npm install -g pm2`)
   ```bash
   chmod +x deploy.sh
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```
   Follow the command `pm2 startup` prints so PM2 restarts after a server reboot.

## Deploy updates (git pull + install + reload)

From the project root:
```bash
./deploy.sh
```

This runs: `git pull` → `npm install` → `pm2 reload` (or `pm2 start` if the app was never started).

## How to run the app

| Goal | Command |
|------|--------|
| **Production (foreground, no PM2)** | `npm start` |
| **Start with PM2 (cluster)** | `npm run pm2:start` or `pm2 start ecosystem.config.js --env production` |
| **After code/config change** | `npm run pm2:reload` or `./deploy.sh` |

## How to restart

| Goal | Command |
|------|--------|
| **Zero-downtime reload (cluster)** | `npm run pm2:reload` |
| **Hard restart all workers** | `pm2 restart sarkari-suchna` |
| **Stop** | `npm run pm2:stop` or `pm2 stop sarkari-suchna` |
| **Status / logs** | `pm2 status` · `pm2 logs sarkari-suchna` |

## PM2 behaviour

- **Cluster mode**: `ecosystem.config.js` uses `exec_mode: "cluster"` and `instances: max` (override with env `PM2_INSTANCES`, e.g. `2`).
- **Auto-restart**: PM2 restarts crashed workers; `max_memory_restart` limits runaway memory use.

## NGINX (optional, recommended)

Example config is in the repo root: **`nginx.conf`**.

1. Replace **`/var/www/sarkari-suchna`** with your project path everywhere in that file.
2. Set **`server_name`** to your domain.
3. Point **`127.0.0.1:3000`** to where PM2 listens (default port from `.env`).
4. Test and reload:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

Static files (`/assets`, `/css`, `/js`, uploads, parts of `generated/`) are served by nginx; **`/`**, **`/{slug}`**, **`/api`**, **`/sitemap.xml`**, etc. are proxied to Node.

Set **`TRUST_PROXY=1`** in `.env` when using nginx.

## More detail

See [DEPLOYMENT.md](./DEPLOYMENT.md) for SSL and extra tuning notes.
