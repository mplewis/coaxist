# Quick Start

Get up and running with Coaxist right now.

# Prerequisites

The host system must have a container host such as
[Docker](https://www.docker.com/) or [Podman](https://podman.io/) installed.

[FUSE](https://en.wikipedia.org/wiki/Filesystem_in_Userspace) must be installed
on the host system.

# Start the container

Coaxist stores all of its data in a single directory. The easiest way to manage
this data is to mount it into your host system. Pick a directory, e.g.
`/home/myuser/coaxist`, and mount it into the container:

```
docker run \
	--device /dev/fuse:/dev/fuse \
	--cap-add SYS_ADMIN \
	--mount type=bind,source="/home/myuser/coaxist/config,target=/config \
	--mount type=bind,source="/home/myuser/coaxist/transcode,target=/transcode \
	-p 5055:5055 \
	-p 32400:32400 \
	--name "coaxist" \
	--restart always \
	--detach mplewis/coaxist:latest
```

The `config` directory holds state – configs, databases, credentials, etc., and
is fully transferrable between containers. The `transcode` directory holds
temporary transcoded media files and can be safely mounted into a temp
directory.

# Configure Coaxist in `config.yaml`

After starting the container, Coaxist creates `/config/config.yaml` with some
[default values](../connector/src/uberconf/default.yaml). Edit this file to your
liking, then delete the placeholder lines at the top. If you don't delete these
lines, Coaxist assumes you haven't finished configuring it yet and will refuse
to start.

## Debrid

Configure credentials for your Debrid provider in the `debrid` section. This
will allow Coaxist to request content for download into your account and mount
it locally for Plex to serve.

```yaml
debrid:
	realDebrid:
		username: YOUR_ACCOUNT_USERNAME
		password: YOUR_ACCOUNT_PASSWORD
		apiKey: SOME_VALID_API_KEY
```

Supported providers:

- [`allDebrid`](https://alldebrid.com/)
  - `apiKey` from the [API Keys](https://alldebrid.com/apikeys/) page
- [`realDebrid`](https://real-debrid.com/)
  - `apiKey` from the [API Token](https://real-debrid.com/apitoken) page
    - sorry – Torrentio wants the API key, even though it is a high-privilege
      key
  - `username` from _WebDAV Login_ on the
    [My Account](https://real-debrid.com/account) page
  - `password` from _WebDAV Password_ on the
    [My Account](https://real-debrid.com/account) page

## Connector

Connector is the program whch watches for new requests, finds matching torrents,
and sends the downloads to Debrid. The values in the `connector` section are
sane defaults and you shouldn't need to change them, but you're welcome to.

Please be polite to our upstream providers who are providing a free service to
us. Torrentio has a rate limit, so if you increase values such as
`connector.search.outstandingSearchInterval`, the service may ask you to back
off.

## Media Profiles

The `mediaProfiles` section specifies the media profiles that the connector uses
to pick the best media for your devices. See [Media Profiles](profiles.md) for
detailed information.

# Sign in

Sign into the new Plex instance at
[localhost:32400/web](http://localhost:32400/web).
