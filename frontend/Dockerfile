FROM node:20-alpine AS builder
WORKDIR /app
# Accept BACKEND_URL as build arg so next.config.ts rewrites() can use it at build time
ARG BACKEND_URL=http://api:8000
ENV BACKEND_URL=${BACKEND_URL}
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
