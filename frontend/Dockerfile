FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Injeta a URL da API no build (Coolify: VITE_API_URL no buildtime)
ARG VITE_API_URL=http://localhost:3001/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Alinhado a Coolify / proxys que expõem 3000 (sobrescreva PORT se necessário)
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port ${PORT:-3000}"]
