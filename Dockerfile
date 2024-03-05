FROM node:20.11.1-alpine3.18 as builder
RUN corepack enable && \
    corepack prepare yarn@stable --activate
WORKDIR /app
COPY . .
RUN yarn

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
ENTRYPOINT ["node", "/app/server/dist/index.js"]
