#!/bin/bash
set -euo pipefail

source .env

./build.sh

docker run \
	--cap-add SYS_ADMIN \
	--device /dev/fuse:/dev/fuse \
	--security-opt apparmor:unconfined \
	--mount type=bind,source="$(pwd)"/tmp/config,target=/config \
	--mount type=bind,source="$(pwd)"/tmp/transcode,target=/transcode \
	-p 32400:32400 \
	-p 5055:5055 \
	-it --rm "$APP_TAG" \
	"$@"
