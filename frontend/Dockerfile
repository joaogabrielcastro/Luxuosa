# syntax=docker/dockerfile:1.6

# 1) Build estatico com Vite — cache limpo, deps so do build.
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Coolify: passe VITE_API_URL como Build Argument para a API publica (ex.: https://api.seu-dominio).
ARG VITE_API_URL=http://localhost:3001/api/v1
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_GIT_SHA=
ENV VITE_GIT_SHA=$VITE_GIT_SHA

RUN npm run build

# 2) Runtime mínimo: serve apenas os arquivos estáticos do dist/ com SPA fallback.
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
RUN npm i -g serve@14

COPY --from=builder /app/dist ./dist

ENV PORT=3000
EXPOSE 3000

# -s: SPA fallback para index.html (importante para react-router)
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
