# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
# This allows Docker to cache the npm install step
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
# Use --no-audit and --no-fund to reduce memory usage and speed up install
RUN npm ci --no-audit --no-fund --prefer-offline

# Copy the rest of the application code
COPY . .

# Build the TypeScript bot application
RUN npm run build:bot

# Remove devDependencies to reduce image size
RUN npm prune --production --no-audit

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S botuser -u 1001

# Change ownership of the app directory to the botuser
RUN chown -R botuser:nodejs /app
USER botuser

# Expose the port your backend server listens on
EXPOSE 3001

# Health check to ensure the container is running properly
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/test-connection || exit 1

# Command to run the application
CMD ["npm", "run", "start:bot"]