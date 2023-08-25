#!/usr/bin/env bash
set -euo pipefail

rclone mount \
	--config /config/rclone.conf \
	--allow-other \
	--buffer-size=0 \
	--cutoff-mode=cautious \
	--dir-cache-time 10s \
	--multi-thread-streams=0 \
	--network-mode \
	--read-only \
	--vfs-cache-mode minimal \
	provider:/links /media
