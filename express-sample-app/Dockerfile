FROM node:22.23.4-alpine3.24 AS runtime

WORKDIR /app
COPY . /app

ENV NODE_DEBUG=sl
ENV SL_LOG_LEVEL=debug

ENTRYPOINT ["npx", "slnodejs", "run", "--tokenfile", "sltoken.txt", "--buildsessionidfile", "buildSessionId", "--", "./index.js"]
