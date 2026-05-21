FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# `npm install` (not `ci`) tolerates the cpu-specific optional-dep entries
# that `@rolldown/binding-wasm32-wasi` adds to the lockfile but never
# resolves into node_modules on arm64/x64 hosts. Lockfile-pinned versions
# are still honored where present.
RUN npm install --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js rewrites() resolves destinations at build time, so BACKEND_URL
# must be set BEFORE `next build` or it bakes in the wrong host. Inside
# Docker Compose the backend service is reachable as "backend".
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=${BACKEND_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Next.js standalone output bundles only what server.js needs.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
