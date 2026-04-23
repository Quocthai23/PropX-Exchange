# Stage 1: Builder - This stage compiles the TypeScript to JavaScript
FROM node:22-alpine AS builder
WORKDIR /app

# Enable corepack to use yarn
RUN corepack enable

# Copy package manager files and install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile || (echo "Retrying yarn install..." && yarn cache clean && yarn install --frozen-lockfile)
# Copy the rest of the source code
COPY . .
# Generate Prisma client
RUN yarn prisma generate
# Build the application
RUN yarn run build

# Stage 2: Production - This stage creates a lean image for running the app
FROM node:22-alpine
WORKDIR /app

# Enable corepack to use yarn
RUN corepack enable

COPY package.json yarn.lock ./
# Install only production dependencies. `prisma` must be a production dependency for migrations.
RUN yarn install --production --frozen-lockfile || (echo "Retrying yarn install..." && yarn cache clean && yarn install --production --frozen-lockfile)

# Copy built application and prisma schema from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
RUN yarn prisma generate

ENV NODE_ENV production
# Expose the application port
EXPOSE ${PORT:-3000}

# Command to run migrations and start the application
CMD ["sh", "-c", "echo 'Waiting for database...' && until nc -z mariadb 3306; do sleep 1; done && echo 'Database is ready! Giving it a moment...' && sleep 5 && yarn prisma migrate deploy && node dist/src/main.js"]