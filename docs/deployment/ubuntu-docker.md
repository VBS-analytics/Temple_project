# Production deployment on Ubuntu

The stack runs completely in Docker: PostgreSQL, Django/Gunicorn, and an Nginx container that serves the React build, proxies `/api` to Django, and exposes `/static` + `/media`. Follow the steps below on the Ubuntu host where you plan to run the production stack.

## 1. Prerequisites
- Ubuntu 22.04+ with sudo access and outbound internet.
- Docker Engine and Compose V2. Install/upgrade with:
  ```bash
  sudo apt update
  sudo apt install ca-certificates curl gnupg -y
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt update
  sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
  ```
- Allow inbound HTTP:
  ```bash
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp   # only if you plan to terminate TLS later
  ```

## 2. Prepare environment secrets
1. Copy the template and edit values:
   ```bash
  cp .env.production.example .env.production
  ```
2. Update `.env.production` with:
   - A strong `DJANGO_SECRET_KEY`.
   - `DJANGO_ALLOWED_HOSTS=localhost,backend,web` (replace or supplement with the public hostname(s) you assign to this host later).
   - Non-default `POSTGRES_PASSWORD`.
   - Keep `VITE_API_BASE_URL=/api` so the React build talks to the same origin exposed by Nginx.

## 3. Build and start the stack
From the repo root:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```
This performs:
- PostgreSQL bootstrap with a persistent `postgres_data` volume.
- Django migrations + `collectstatic` during container start; static and media assets land in shared volumes `static_data` and `media_data`.
- React production build baked into the `web` (Nginx) image; Nginx serves the SPA on port 80 and proxies `/api` to the backend container.

### Health checks & logs
- Check container status: `docker compose -f docker-compose.prod.yml ps`
- Tail backend logs: `docker compose -f docker-compose.prod.yml logs -f backend`
- The default admin (phone `9999999999`, password `adminpass`) is auto-seeded; change it immediately inside the Django admin.

## 4. Verification
1. Browse to `http://<your-hostname>` (or whichever domain you assigned to the Ubuntu host) from another machine on the LAN.
2. Confirm the landing page renders and the calls to `/api/...` succeed (HTTP 200).
3. Hit `http://<your-hostname>/admin/` and ensure you can sign in with the seeded admin, then change the password and create real accounts.

## 5. Managing the service
- **Stop / start:** `docker compose -f docker-compose.prod.yml down` / `up -d`
- **Upgrade code:** pull the latest git commit, then rerun the `up -d --build` command (containers rebuild automatically).
- **Database backup:** `docker compose -f docker-compose.prod.yml exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > temple_backup.sql`
- **Volumes:** Docker keeps `postgres_data`, `static_data`, and `media_data`. Back them up before OS upgrades or major schema changes.

## 6. Optional hardening
1. Put the containers behind HTTPS using a reverse proxy (Caddy, Traefik) or by extending the `web` image with certbot.
2. Lock down SSH with key-only auth and keep the OS patched (`sudo unattended-upgrades`).
3. Convert the compose command into a systemd unit:
   ```bash
   sudo tee /etc/systemd/system/temple-platform.service <<'EOF'
   [Unit]
   Description=Temple Platform
   Requires=docker.service
   After=docker.service

   [Service]
   WorkingDirectory=/home/vbs-blr-dt-1064/Documents/Temple_project
   ExecStart=/usr/bin/docker compose --env-file .env.production -f docker-compose.prod.yml up -d
   ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
   Restart=always

   [Install]
   WantedBy=multi-user.target
   EOF
   sudo systemctl daemon-reload
   sudo systemctl enable --now temple-platform
   ```

With this setup, the application will keep running on the host you configured and can safely serve the ~10 internal users you expect. Adjust resource limits (CPU/memory) via Docker if the load grows.
