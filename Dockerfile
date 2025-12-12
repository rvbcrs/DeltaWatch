# Build stage
FROM node:20-bookworm AS builder
WORKDIR /app
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm install
RUN cd server && npm install
RUN cd client && npm install
COPY . .
RUN cd client && npm run build
# Remove dev dependencies from server
RUN cd server && npm prune --production

# Production stage
FROM node:20-bookworm-slim
WORKDIR /app

# Install system dependencies for Playwright (Chromium)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && npx playwright install-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# Copy production artifacts
COPY --from=builder /app/server /app/server
COPY --from=builder /app/client/dist /app/client/dist
COPY --from=builder /app/package.json /app/package.json

# Install Chrome browser binary
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/index.js"]
