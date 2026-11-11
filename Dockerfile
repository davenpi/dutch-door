# One image for both services. Pick which one runs with the command:
#   docker run ... node arbiter/server.ts
#   docker run ... node frontdoor/server.ts
# The core has no dependencies and no build step, so there is nothing to
# install: Node runs the TypeScript files as they are. That needs Node 22.18
# or newer. If the container stops with ERR_UNKNOWN_FILE_EXTENSION, the local
# copy of this base image is older than that: pull it again.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY lib ./lib
COPY arbiter ./arbiter
COPY frontdoor ./frontdoor
ENV HOST=0.0.0.0
USER node
CMD ["node", "frontdoor/server.ts"]
