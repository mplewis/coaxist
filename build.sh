#!/bin/bash
set -euo pipefail

source .env

# default to Dockerfile if not set
DOCKERFILE=${DOCKERFILE:-Dockerfile}

(
	cd pms-docker
	docker build -t "$BASE_TAG" -f "$DOCKERFILE" .
)

docker build -t "$APP_TAG" .
