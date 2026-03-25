# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json* ./

# Install all deps (including devDependencies needed for Vite build)
RUN npm ci

# Copy source
COPY . .

# Produce the dist/ directory
RUN npm run build

# ---- Stage 2: Serve ----
FROM nginx:1.27-alpine

# Remove the default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy the Vite build output from stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom nginx config (replaces the default)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
