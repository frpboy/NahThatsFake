FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY tma/package*.json ./

# Install deps
RUN npm ci --only=production

# Copy app files
COPY tma/server.js ./
COPY tma/public ./public

# Security user
RUN addgroup -S nodejs && adduser -S tma -G nodejs
USER tma

EXPOSE 3000
CMD ["npm", "start"]