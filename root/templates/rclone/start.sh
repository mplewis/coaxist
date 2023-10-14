#!/usr/bin/env bash
set -euxo pipefail

# --config: location of the config file
# mount provider:/ /media: connect to the source named [provider] in rclone.conf and mount the remote / directory into local /media
# --allow-other: allow user `plex` to access our files
# everything else are recommended settings for AllDebrid: https://help.alldebrid.com/en/faq/rclone-webdav

rclone \
	--config /config/rclone/rclone.conf \
	--allow-other \
	--buffer-size=0 \
	--cutoff-mode=cautious \
	--dir-cache-time 10s \
	--multi-thread-streams=0 \
	--network-mode \
	--read-only \
	--vfs-cache-mode minimal \
	mount provider:/ /media
