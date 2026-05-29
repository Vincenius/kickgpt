FROM node:24-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-alpine
WORKDIR /app

# native deps for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

RUN mkdir -p data

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/predictor.db

EXPOSE 3000
CMD ["node", "backend/index.js"]
