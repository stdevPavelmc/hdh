# Help Desk Helper — development image (lint, test, package).
# Dependencies live in /app/node_modules inside the image; the project is mounted at
# /app/project, so Node's module resolution finds them and the host folder stays clean.
FROM node:24-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

ENV PATH=/app/node_modules/.bin:$PATH \
    HOME=/tmp
WORKDIR /app/project
