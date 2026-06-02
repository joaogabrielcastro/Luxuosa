FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

# Ordem: cliente Prisma → migrações (PRD) → servidor. start:prod já inclui migrate deploy.
CMD ["sh", "-c", "npx prisma generate && npm run start:prod"]
