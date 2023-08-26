FROM node:16 AS builder-overseerr

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

########################################

FROM coaxist-pms-base

RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash
RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get install -y \
	fuse3 \
	nodejs \
	p7zip-full \
	;
RUN curl https://rclone.org/install.sh | bash

COPY --from=builder-overseerr /build/overseerr /overseerr
COPY root/ /

# https://github.com/just-containers/s6-overlay/issues/158#issuecomment-266913426
RUN ln -s /init /initt

CMD ["/initt"]
