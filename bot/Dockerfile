FROM node:18-alpine

WORKDIR /app

# Copy package & config
COPY bot/package*.json ./
COPY bot/tsconfig.json ./

# Install deps
RUN npm ci

# Copy source
COPY bot/src ./src

# Build
RUN npm run build

# Prune dev deps
RUN npm prune --production

# Security user
RUN addgroup -S nodejs && adduser -S bot -G nodejs
USER bot

CMD ["npm", "start"]