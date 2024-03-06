FROM node:20.11.1-alpine3.18 as base
RUN apk add --no-cache git
RUN corepack enable && \
    corepack prepare yarn@4.1.0 --activate
WORKDIR /app

FROM base as yarn
COPY package.json yarn.lock server/package.json www/package.json ./
RUN yarn

FROM yarn as builder
COPY . .

FROM builder as builder_backend
RUN yarn
RUN cd /app/server && \
    yarn prettier && \
    yarn lint && \
    yarn build

FROM builder as builder_frontend
RUN yarn
RUN cd /app/www && \
    yarn prettier && \
    yarn lint && \
    yarn build

FROM builder
COPY --from=builder_backend /app/server/dist ./server/dist
COPY --from=builder_frontend /app/www/dist ./www/dist
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["node", "/app/server/dist/index.js"]
