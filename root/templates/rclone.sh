#!/usr/bin/env bash
set -euxo pipefail

args=(
	# location of the config file
	--config /config/rclone.conf

	# connect to the source named [provider] in rclone.conf
	# and mount the remote /links directory into local /media
	mount
	provider:/links
	/media

	# allow user `plex` to access our files
	--allow-other

	# recommended settings for AllDebrid:
	# https://help.alldebrid.com/en/faq/rclone-webdav
	--buffer-size=0
	--cutoff-mode=cautious
	--dir-cache-time 10s
	--multi-thread-streams=0
	--network-mode
	--read-only
	--vfs-cache-mode minimal
)

rclone "${args[@]}"
