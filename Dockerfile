# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:latest AS base
WORKDIR /usr/src/app

# install canvas dependencies
RUN if ["$TARGETPLATFORM" = "linux/amd64"] ; then echo "no worries" ; else apt-get update ; fi
RUN if ["$TARGETPLATFORM" = "linux/amd64"] ; then echo "no worries" ; else apt-get install -y python3 build-essential libcairo2-dev libpango1.0-dev ; fi

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# [optional] tests & build
ENV NODE_ENV=production
RUN bun test
RUN bun run build

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/package.json .
COPY --from=prerelease /usr/src/app/main.ts .
COPY --from=prerelease /usr/src/app/src src
COPY --from=prerelease /usr/src/app/fonts fonts
COPY --from=prerelease /usr/src/app/locales locales

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "main.ts" ]
