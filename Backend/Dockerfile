# Build
FROM node:20-alpine AS builder

WORKDIR /application

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

# Production
FROM node:20-alpine
LABEL maintainer="lhw080917@gmail.com"

RUN apk add --no-cache openssl
WORKDIR /application

COPY package*.json ./
COPY --from=builder /application/prisma ./prisma

RUN npm ci --only=production
RUN npx prisma generate

COPY --from=builder /application/dist ./dist

EXPOSE 3000
CMD ["node", "dist/src/main"]