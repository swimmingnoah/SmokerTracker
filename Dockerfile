# ---- Stage 1: Build React frontend ----
FROM node:20-alpine AS frontend-builder

ARG VITE_API_KEY=""
ENV VITE_API_KEY=${VITE_API_KEY}

WORKDIR /app
COPY smoker-app-frontend/package.json smoker-app-frontend/package-lock.json* ./
RUN npm ci
COPY smoker-app-frontend/ .
RUN npm run build

# ---- Stage 2: Combined nginx + Flask container ----
FROM python:3.11-slim

# Install nginx and supervisor
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
WORKDIR /app
COPY smoker-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Flask app
COPY smoker-backend/ .

# Copy built React frontend into nginx webroot
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy nginx config (replaces default site)
COPY nginx.conf /etc/nginx/sites-available/default

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 80

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
