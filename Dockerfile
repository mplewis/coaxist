FROM node:20 AS builder-overseerr

RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get install -y \
	git \
	;

RUN corepack enable
RUN yarn set version classic

WORKDIR /build

RUN git clone https://github.com/sct/overseerr
WORKDIR /build/overseerr
RUN git checkout tags/v1.33.2

RUN yarn install --frozen-lockfile
RUN npx update-browserslist-db@latest

RUN yarn build
RUN yarn install --production --ignore-scripts --prefer-offline
RUN rm -rf src server .next/cache

########################################

FROM node:20 AS builder-connector

RUN apt-get update
RUN apt-get upgrade -y
RUN npm install -g pnpm

WORKDIR /build/connector
COPY connector/package.json connector/pnpm-lock.yaml /build/connector
RUN pnpm install --frozen-lockfile
COPY connector/ /build/connector/

########################################

FROM coaxist-pms-base

RUN apt-get update
RUN apt-get install -y ca-certificates curl gnupg
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list

RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get install -y \
	fuse3 \
	nodejs \
	p7zip-full \
	;
RUN curl https://rclone.org/install.sh | bash
RUN npm install -g pnpm

COPY --from=builder-overseerr /build/overseerr /app/overseerr
COPY --from=builder-connector /build/connector /app/connector
WORKDIR /app/connector
RUN pnpm prisma generate

ENV S6_KEEP_ENV=1

COPY root/ /

WORKDIR /
