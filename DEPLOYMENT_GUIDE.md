# Edu Wire Team Tracker — Production Deployment & Operations Guide

## 1. Architecture Overview
Edu Wire Team Tracker is built with:
- **Frontend SPA**: React 18 + Vite + TypeScript (served via Nginx).
- **Backend API**: Node.js 22 + Express 5 + TypeScript.
- **Background Workers**: Standalone Node.js process running BullMQ queue consumers.
- **Primary Database**: MongoDB Atlas (Replica Set M10+ recommended for production).
- **Queue / Cache**: Redis 7+ (AOF persistence enabled).
- **Notification Services**: Expo Push Notifications SDK + WhatsApp Business API Adapter.

---

## 2. Server Prerequisites
- **OS**: Ubuntu 22.04 LTS or 24.04 LTS (or equivalent enterprise Linux).
- **Compute**: Minimum 2 vCPU, 4GB RAM.
- **Software**:
  - Docker Engine 24.0+ and Docker Compose v2.
  - Optional native: Node.js 22 LTS, Redis 7.2.
- **Network Ports**:
  - Port `80` (HTTP, redirects to HTTPS)
  - Port `443` (HTTPS SSL/TLS)
  - Port `5000` (Internal Express API, reverse proxied)
  - Port `6379` (Redis, bind strictly to `127.0.0.1` or Docker bridge)

---

## 3. Quick Deployment via Docker Compose

### Step 1: Clone and Configure Environment
```bash
git clone https://github.com/eduwire/edu-wire-tracker.git /opt/edu-wire-tracker
cd /opt/edu-wire-tracker

# Copy and populate production variables
cp backend/.env.production.example backend/.env
nano backend/.env
```

### Step 2: Build and Start Containers
```bash
# Build multi-stage production images and start in background
docker compose up -d --build

# Verify container health
docker compose ps
```

### Step 3: Seed Initial System Roles & Administrative Account
```bash
docker compose exec backend-api npm run seed
```

---

## 4. Production Nginx & HTTPS Configuration (Host Level)

Install Certbot for automated Let's Encrypt TLS:
```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
```

Configure `/etc/nginx/sites-available/eduwire-tracker`:
```nginx
# Upstream to container frontend or backend
upstream frontend_app {
    server 127.0.0.1:80;
}

upstream backend_api {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name tracker.eduwire.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tracker.eduwire.com;

    # SSL Certificates managed by Certbot
    ssl_certificate /etc/letsencrypt/live/tracker.eduwire.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tracker.eduwire.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Backend API proxy
    location /api/v1/ {
        proxy_pass http://backend_api/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }

    # Frontend SPA proxy
    location / {
        proxy_pass http://frontend_app/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable site and acquire SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/eduwire-tracker /etc/nginx/sites-enabled/
sudo certbot --nginx -d tracker.eduwire.com
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. MongoDB Atlas Backup & Retention Policies
1. **Continuous Cloud Backups**:
   - Enable **Point-in-Time Recovery (PITR)** in MongoDB Atlas cluster settings (7-day granularity).
   - Configure Daily snapshots retained for 30 days.
   - Configure Weekly snapshots retained for 52 weeks.
2. **Disaster Recovery Drill**:
   - Verify cluster restore to an isolated staging tier quarterly.
3. **Index Verification**:
   - Ensure the compound indexes defined in `Task`, `Notification`, and `Activity` schemas match MongoDB Atlas Index Advisor recommendations.

---

## 6. Process Monitoring & Log Rotation
1. **Container Logs**:
   ```bash
   # Stream API logs
   docker compose logs -f backend-api

   # Stream Background Worker logs
   docker compose logs -f backend-workers
   ```
2. **Log Rotation**:
   Docker daemon should have standard json-file logging limits in `/etc/docker/daemon.json`:
   ```json
   {
     "log-driver": "json-file",
     "log-opts": {
       "max-size": "50m",
       "max-file": "5"
     }
   }
   ```
3. **Health Check Endpoint**:
   - Monitoring services (e.g. UptimeRobot, Datadog) should query:
     `GET https://tracker.eduwire.com/api/v1/health`
   - Returns HTTP 200 with `{ status: "ok", database: "connected", redis: "connected" }`.

---

## 7. Graceful Shutdown & Maintenance
- When stopping or updating the application:
  ```bash
  docker compose down --timeout 30
  ```
  This signals `SIGTERM` to both Express and BullMQ workers, allowing in-flight database transactions and jobs to finish cleanly without data corruption.

