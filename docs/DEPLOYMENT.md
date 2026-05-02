# Production deployment (VPS / AWS)

This guide matches the upgraded stack: Node.js + Express behind **NGINX**, **PM2 cluster**, **MySQL**, **Redis**, **Let’s Encrypt** SSL.

## 1. Server layout

| Layer | Role |
|--------|------|
| NGINX | TLS termination, gzip/brotli, static file caching, reverse proxy to Node |
| PM2 | Cluster workers (`ecosystem.config.js`), auto-restart |
| Node | `server/server.js` — API + dynamic responses |
| MySQL | Primary data |
| Redis | Response cache + shared rate-limit store across workers |

Target **~1 lakh visits/day** is realistic with: DB indexes (`database/suggested_indexes.sql`), Redis caching, cluster mode, and CDN for static assets.

## 2. Environment

1. Copy `.env.example` → `.env` on the server.
2. Set `NODE_ENV=production`, strong `JWT_SECRET`, real `ADMIN_PASS_HASH`, DB credentials, `CORS_ORIGINS` to your public domain(s).
3. Set `TRUST_PROXY=1` so rate limits and access logs see the real client IP behind NGINX.

## 3. PM2 (cluster)

```bash
npm ci --omit=dev
npm run pm2:start
```

Use `npm run pm2:reload` for zero-downtime code updates after `git pull`.

### Windows PowerShell: “running scripts is disabled”

If `pm2` fails loading `pm2.ps1`:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Or avoid the shim:

```powershell
npx pm2 start ecosystem.config.js --env production
```

## 4. NGINX reverse proxy (example)

**Authoritative example:** use the checked-in **`nginx.conf`** at the repo root (paths match `public/assets`, `storage/uploads`, `generated/`). The snippet below is illustrative only.

Place a server block like this (paths and `server_name` are examples):

```nginx
upstream sarkari_node {
    least_conn;
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Optional: ssl_stapling on; resolver ...

    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    # Static files — optional: serve directly from disk for lower Node load
    location /css/ { alias /var/www/sarkari/public/css/; expires 7d; add_header Cache-Control "public, immutable"; }
    location /js/  { alias /var/www/sarkari/public/js/;  expires 7d; add_header Cache-Control "public, immutable"; }
    location /image/ { alias /var/www/sarkari/public/image/; expires 30d; }

    location / {
        proxy_pass http://sarkari_node;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

Health checks for monitors/load balancers:

- `GET /health` — process liveness (no DB).
- `GET /ready` — DB readiness (returns 503 if MySQL down).

## 5. SSL (Let’s Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Renewal is usually automatic via cron/systemd timer.

## 6. CDN (recommended)

Put **static** assets behind a CDN (Cloudflare, CloudFront, Bunny, etc.):

- Cache `/css/*`, `/js/*`, `/image/*`, `/static/*` with long TTL.
- Keep **HTML** cache short or “bypass” so job updates appear quickly, or purge CDN on publish.

## 7. Horizontal scaling (future)

- Terminate SSL at NGINX or a load balancer; run **multiple app servers** with the same `REDIS_HOST` (shared cache + rate limits) and one MySQL primary (read replicas later if needed).
- Sticky sessions are **not** required (JWT in httpOnly cookie + stateless API).

## 8. Security checklist

- Firewall: only 80/443 public; MySQL/Redis bound to private network or localhost.
- `helmet` enabled; tighten **CSP** when you can move inline scripts to files.
- All queries use **parameterized** SQL (already in this project).
- Secrets only in `.env`, never committed.
