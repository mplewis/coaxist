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

_Coming soon: support for Debrid-Link, Offcloud, Premiumize, and Put.io_

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
to pick the best media for your devices.

See [Media Profiles](profiles.md) for detailed information on how you can
configure your own media profile.

# Sign In

## Sign into Plex

Sign into the new Plex instance at
[localhost:32400/web](http://localhost:32400/web). You will need to sign in with
a Plex account to connect Overseerr and allow Connector to watch for requests.

As you go through the initial setup wizard, configure a **TV Shows** and a
**Movies** library, both for folder `/media` – this is where Debrid downloads
are mounted into the container by Rclone.

Since your files are stored over a network and not on a local disk, Plex will
waste a lot of bandwidth trying to run media analysis on all of your downloaded
files. To avoid this, go to **Settings → <your server> → Settings → Library**
and disable the following options (if present), then click **Save Changes** at
the bottom:

- Marker source: only online (no local detection)
- Generate video preview thumbnails: never
- Generate intro video markers: never
- Generate credits video markers: never
- Generate chapter thumbnails: never
- Analyze audio tracks for loudness: never
- Analyze audio tracks for sonic features: never

## Sign into Overseerr

Sign into the new Overseerr instance at [localhost:5055](http://localhost:5055)
using the same Plex account, then select your Plex server and libraries as you
go through the initial setup wizard.

# Request Content

Once Plex and Overseerr are both configured, you can start requesting content in
one of two ways:

- Search for items in Plex and add them to your Watchlist
- Open Overseerr, submit requests for items, and approve the requests

Connector automatically watches for new requests, finds matching media, and
downloads them using Debrid.
