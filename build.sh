#!/bin/bash
set -euo pipefail

source .env

# default to Dockerfile if not set
PMS_DOCKERFILE=${PMS_DOCKERFILE:-Dockerfile}

(
	cd pms-docker
	docker build -t "$BASE_TAG" -f "$PMS_DOCKERFILE" .
)

docker build -t "$APP_TAG" .
