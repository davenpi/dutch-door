# One image for both services. Pick which one runs with the command:
#   docker run ... node arbiter/server.js
#   docker run ... node frontdoor/server.js
# The core has no dependencies, so there is nothing to install.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY lib ./lib
COPY arbiter ./arbiter
COPY frontdoor ./frontdoor
ENV HOST=0.0.0.0
USER node
CMD ["node", "frontdoor/server.js"]
