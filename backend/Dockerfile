FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create storage directories
RUN mkdir -p /app/storage/uploads /app/storage/results /app/storage/exports /app/storage/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV STORAGE_PATH=/app/storage

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start the application
CMD ["node", "src/app.js"]
