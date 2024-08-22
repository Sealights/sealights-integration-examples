FROM node:16.13.2-alpine AS runtime

WORKDIR /app
COPY . /app

ENV NODE_DEBUG=sl
ENV SL_LOG_LEVEL=debug

ENTRYPOINT ["npx", "slnodejs", "run", "--tokenfile", "sltoken.txt", "--buildsessionidfile", "buildSessionId", "--", "./index.js"]
