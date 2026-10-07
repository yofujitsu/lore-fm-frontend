FROM node:22-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src src
COPY public public
RUN npm test -- --run && npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /build/dist /srv
COPY LICENSE THIRD_PARTY_NOTICES.md /usr/share/doc/ninefold/
