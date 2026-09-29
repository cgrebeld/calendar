FROM node:24-alpine AS build
WORKDIR /app
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
ARG VITE_API_URL
ARG VITE_SCHEDULE_START
ARG VITE_SCHEDULE_END
ARG VITE_WEATHER_COLD_THRESHOLD
ARG VITE_THEME_MODE
ARG VITE_THEME_LIGHT_START
ARG VITE_THEME_DARK_START
ARG VITE_SKIN
ARG VITE_BACKGROUND
ARG VITE_BACKGROUND_LIGHT
ARG VITE_BACKGROUND_DARK
RUN npm run build

FROM node:24-alpine AS api
ARG APP_VERSION=dev
ARG APP_REVISION=unknown
ENV APP_VERSION=$APP_VERSION
LABEL org.opencontainers.image.source="https://github.com/cgrebeld/calendar" org.opencontainers.image.version=$APP_VERSION org.opencontainers.image.revision=$APP_REVISION io.calendar.component="api"
WORKDIR /app
COPY api/ ./
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.mjs"]

FROM nginx:1.29-alpine AS web
ARG APP_VERSION=dev
ARG APP_REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/cgrebeld/calendar" org.opencontainers.image.version=$APP_VERSION org.opencontainers.image.revision=$APP_REVISION io.calendar.component="web"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ || exit 1

FROM web AS release-web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
