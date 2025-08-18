# Multi-stage build for memory efficiency and smaller final image

# Build stage - includes all dependencies needed for building
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install ALL dependencies (including devDependencies for building)
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build the bot application
RUN npm run build:bot

# Production stage - lean runtime image
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership to app user
RUN chown -R botuser:nodejs /app
USER botuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/test-connection', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["dumb-init", "node", "dist/bot/index.js"]