# TODO

- [x] Install Prisma
- [x] Define snatch models and DB schema
- [x] Build DB accessor
- [x] Build API client for Torrentio
- [x] Set up proper logging
- [x] Run on schedule
- [x] Profile improvements:
  - [x] Preferred tags
  - [x] Minimum seeders
  - [x] Sort by: size desc, seeders desc
- [x] Understand which results are cached (`[AD+]`, `[RD+]`)
  - [x] Populate the `cached` tag for cached results
- [ ] Upgrade fetch when better quality is available
  - [ ] If full season is not available, snatch episodes
- [x] Use shorter hashes
- [x] Move all vars to config
- [x] Integrate into Coaxist
- [ ] API client should crash on 4xx/5xx status codes
- [x] Read Plex watchlist
- [x] Better config templates
- [ ] Watch downloads dir and symlink with proper names for Plex into new dir
- [ ] Migrate DB to unify dependency hash
- [x] Fix template
- [x] Unit test for templates
- [ ] Dry run mode
- [ ] Rename QUALITY to RESOLUTION
- [x] Write file and function docstrings and enforce with ESLint
- [ ] Use Prowlarr
- [ ] Holistic handling of episode coverage in TV torrents - walk-forward
      algorithm
- [ ] Rework DB to use schema for episode coverage
- [ ] Drop snatches
- [x] Tag improvements
  - [x] Mark torrents with ads
  - [x] FHD = 1080p
  - [x] "Dubbed"
  - [x] HC = Hardsubs
- [ ] Prioritize specific trackers
- [ ] Support interrogation of torrent files by URL
- [ ] Support interrogation of magnet links
- [ ] Convert all HTTP calls to use the new fetch interface
- [x] Make bare use of `fetch` illegal
- [ ] Deal with searching by non-IMDB ID in Prowlarr – parse title by tokens
      preceding numbering identifier
- [x] Disk caching option
- [x] Cache storage by namespace
- [x] Keep version in sync with package.json
- [x] Log tags in "snatched media" and "all snatches complete" msg
- [x] Summarize "all snatches complete" as count – redundant
- [x] Auto-order TS imports
- [x] Don't throw in Overseerr Client
- [x] Fix quality parsing fallback when at least one quality is present on
      filename/torrent
- [x] Pass name of call along to http calls for logging
- [ ] Figure out sane way to do optionals in UberConf to not disrupt existing
      users on upgrade
