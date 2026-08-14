# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first for caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the code and build
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# The backend usually runs on port 3000 by default in NestJS
EXPOSE 3000

# Start the NestJS application
CMD ["npm", "run", "start:prod"]
