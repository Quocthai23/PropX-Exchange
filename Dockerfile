# Stage 1: Builder - This stage compiles the TypeScript to JavaScript
FROM node:22-alpine AS builder
WORKDIR /app

# Enable corepack to use yarn
RUN corepack enable

# Copy package manager files and install dependencies
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable || (echo "Retrying yarn install..." && yarn cache clean && yarn install --immutable)
# Copy the rest of the source code
COPY . .
# Generate Prisma client once before TypeScript compile.
RUN yarn prisma generate
# Build the application
RUN yarn nest build

# Stage 2: Production - This stage creates a lean image for running the app
FROM node:22-alpine
WORKDIR /app

# Enable corepack to use yarn
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built application and prisma schema from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

ENV NODE_ENV production
# Expose the application port
EXPOSE ${PORT:-3000}

# Command to run migrations and start the application
CMD ["sh", "-c", "echo 'Waiting for database...' && until nc -z mariadb 3306; do sleep 1; done && echo 'Database is ready! Giving it a moment...' && sleep 5 && yarn prisma migrate deploy && node dist/main.js"]
