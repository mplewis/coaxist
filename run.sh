#!/bin/bash
set -euxo pipefail

source .env

if docker ps -a --format '{{.Names}}' | grep -q '^coaxist$'; then
	echo "Starting existing coaxist container. To run a fresh copy, delete this container and run this script again."
	docker start -ai coaxist
	exit
fi

echo "Building coaxist container."

./build.sh

echo "Running coaxist container."

docker run \
	--cap-add SYS_ADMIN \
	--device /dev/fuse:/dev/fuse \
	--security-opt apparmor:unconfined \
	--mount type=bind,source="$(pwd)"/tmp/config,target=/config \
	--mount type=bind,source="$(pwd)"/tmp/transcode,target=/transcode \
	-p 32400:32400 \
	-p 5055:5055 \
	--name "coaxist" \
	-it "$APP_TAG" \
	"$@"
