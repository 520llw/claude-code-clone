# =============================================================================
# Claude Code Clone - Docker Image
# =============================================================================
# Multi-stage build for production-ready container
#
# Build:
#   docker build -t claude-code-clone:latest .
#
# Run:
#   docker run -it --rm -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY claude-code-clone
#
# Run with volume mount:
#   docker run -it --rm -v $(pwd):/workspace -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY claude-code-clone
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder
# -----------------------------------------------------------------------------
FROM node:18-alpine AS builder

# Build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build:prod

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:18-alpine AS production

# Metadata
LABEL maintainer="Your Name <your.email@example.com>" \
      org.opencontainers.image.title="Claude Code Clone" \
      org.opencontainers.image.description="AI-powered terminal coding assistant" \
      org.opencontainers.image.url="https://github.com/yourorg/claude-code-clone" \
      org.opencontainers.image.source="https://github.com/yourorg/claude-code-clone" \
      org.opencontainers.image.licenses="MIT"

# Install runtime dependencies
RUN apk add --no-cache \
    git \
    openssh-client \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1000 claude && \
    adduser -u 1000 -G claude -s /bin/sh -D claude

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=claude:claude /app/dist ./dist
COPY --from=builder --chown=claude:claude /app/node_modules ./node_modules
COPY --from=builder --chown=claude:claude /app/package*.json ./

# Create config directory
RUN mkdir -p /home/claude/.config/claude-code-clone && \
    chown -R claude:claude /home/claude

# Switch to non-root user
USER claude

# Set environment variables
ENV NODE_ENV=production \
    HOME=/home/claude \
    TERM=xterm-256color \
    COLORTERM=truecolor

# Health check - simple node process check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Default command
ENTRYPOINT ["node", "/app/dist/cli.js"]
CMD ["--help"]

# -----------------------------------------------------------------------------
# Stage 3: Development
# -----------------------------------------------------------------------------
FROM node:18-alpine AS development

# Development dependencies
RUN apk add --no-cache \
    git \
    openssh-client \
    ca-certificates \
    tzdata \
    bash \
    vim \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including dev)
RUN npm ci && \
    npm cache clean --force

# Copy source code
COPY . .

# Set environment
ENV NODE_ENV=development \
    TERM=xterm-256color \
    COLORTERM=truecolor

# Expose port for debugging (if needed)
EXPOSE 9229

# Default command for development
CMD ["npm", "run", "dev"]
