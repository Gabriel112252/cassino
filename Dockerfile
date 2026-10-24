# ---------------------------------------------------------------------------
# Cassino DEMO — Jaguar Gold
# Build multi-stage: compila o site estático com Vite e serve com nginx.
# Pensado para o Easypanel (ou qualquer host Docker): porta 80, sem variáveis obrigatórias.
# ---------------------------------------------------------------------------

# ---- etapa 1: build ---------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# dependências primeiro (cache de camada)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# código e assets
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY tests ./tests

# typecheck + testes da lógica + build de produção
RUN npm run typecheck && npm test && npm run build

# ---- etapa 2: runtime -------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
