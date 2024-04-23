FROM node:20.11.1-alpine3.18 as base
RUN corepack enable && \
    corepack prepare yarn@4.1.0 --activate
WORKDIR /app

COPY . .
RUN yarn install --immutable

RUN cd /app/server && \
    yarn prettier && \
    yarn lint && \
    yarn build

RUN cd /app/www && \
    yarn prettier && \
    yarn lint && \
    yarn build

ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["node", "/app/server/dist/server/src/index.js"]
