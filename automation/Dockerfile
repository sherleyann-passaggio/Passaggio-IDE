# ─── Passaggio Automation — Production Dockerfile ───────────────────────────
# Lightweight Node.js Alpine image for continuous cloud deployment on
# Railway, Render, or any container host.
#
# Build:
#   docker build -t passaggio-automation .
#
# Run:
#   docker run -d \
#     -p 8080:8080 \
#     -e TELEGRAM_TOKEN=your_token \
#     -e ALLOWED_USER_ID=7916710756 \
#     -e ENVIRONMENT=cloud \
#     passaggio-automation

FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci --include=dev && \
    npm cache clean --force

# ─── Production Stage ──────────────────────────────────────────────────────

FROM node:18-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY . .

# Ensure scripts directory exists
RUN mkdir -p /app/scripts /app/public/images && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# The app reads PORT from environment (default 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" || exit 1

# Start the automation server
CMD ["node", "server.js"]