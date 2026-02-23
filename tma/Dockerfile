
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY server.js ./
COPY index.html ./
COPY public ./public

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S tma -u 1001
RUN chown -R tma:nodejs /app

USER tma

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
