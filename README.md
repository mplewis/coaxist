<img src="docs/banner.jpg" alt="Coaxist" width="100%">

# TODO

- [x] Run tests in GitHub Actions
- [x] Deploy to Docker Hub on release tag
- [ ] Write usage readme
- [ ] Auto-grab Overseerr API key from config file
- [x] Remove Next cache from Overseerr bit of image:
      `RUN rm -rf src server .next/cache`
- [x] Configure Overseerr to only run with prod deps:
      `RUN yarn install --production --ignore-scripts --prefer-offline`
- [ ] Auto-template config files from superconfig
- [ ] Read Overseerr API key and copy into Connector

# Quick Start Guide

- Run the container, mounting /config
- Sign into Plex at [localhost:32400/web](http://localhost:32400/web)
- Sign into Overseerr at [localhost:5055](http://localhost:5055)
- Copy your Overseerr API key into `/config/connector/config.yaml`
- Configure your Debrid API key in `/config/connector/config.yaml`
- Configure your desired media profiles in `/config/connector/profiles.yaml`
- Configure your Debrid WebDAV credentials in `/config/rclone/rclone.conf`

# Configuration

This container stores all of its data in the `/config` directory. Mount
`/config` inside the contianer to a real directory on your system with
read-write permissions.

After starting the container, configure the applications:

## [Rclone](https://rclone.org/)

Rclone mounts your Debrid provider's WebDAV storage as a local directory, so
that Plex can index and play its files.

Set your Debrid provider's WebDAV credentials in `/config/rclone/rclone.conf`:

```ini
url = https://webdav.example.com/
user = some-username
pass = some-obscured-password
```

To obscure your WebDAV password so that Rclone can use it, run
`rclone obscure my-password` and copy the obscured value into `rclone.conf`.

Find your WebDAV URL and credentials here:

- Real-Debrid:
  - `url = https://dav.real-debrid.com/`
  - `user`, `pass` from [My Account](https://real-debrid.com/account)
- AllDebrid:
  - `url = https://webdav.debrid.it/`
  - `user = ` an API key from [API Keys](https://alldebrid.com/apikeys/)
  - `pass = ` any value
- For other Debrid providers, follow the instructions to connect to WebDAV in
  their documentation.

If you need to further configure Rclone or the WebDAV settings, you can
customize the startup command in `/config/rclone/start.sh`.
