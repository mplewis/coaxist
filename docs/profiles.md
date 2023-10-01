# Media Profiles

When you request movies or TV shows, Connector needs to figure out what version
of the media you want. Your media profiles are what Connector uses as the
criteria to select the best search result for the media you request.

If you want multiple copies of the same media, you can configure multiple
profiles and Connector will select the best media to fulfill each one. For
example, you might want a 1080p copy for remote streaming and a 4K HDR copy for
in-home streaming.

# Config

Specify your media profiles in `config.yaml` as an array under the key
`mediaProfiles`. For example:

```yaml
mediaProfiles:
  - name: 4K HDR
    minimum:
      quality: 2160p
    preferred:
      - cached
    forbidden:
      - cam

  - name: Most Compatible
    maximum:
      quality: 1080p
    preferred:
      - cached
    forbidden:
      - h265
      - hdr
      - cam
```

The type definition of a media profile is found in
[`profile.ts`](https://github.com/mplewis/coaxist/blob/main/connector/src/data/profile.ts).
The fields you can specify are:

| Name              | Type                                         | Required | Description                                                                                                                                           |
| ----------------- | -------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`            | string                                       | yes      | The name of this media profile. Shown in log messages.                                                                                                |
| `sort`            | `largestFileSize` (default) or `mostSeeders` | no       | How to sort results of similar quality.<br>`largestFileSize`: Sort by file size, descending.<br>`mostSeeders`: Sort by number of seeders, descending. |
| `minimum.quality` | `480p`, `576p`, `720p`, `1080p`, `2160p`     | no       | Ignore items lower than this quality.                                                                                                                 |
| `minimum.seeders` | number                                       | no       | Ignore items with fewer than this many seeders.                                                                                                       |
| `maximum.quality` | `480p`, `576p`, `720p`, `1080p`, `2160p`     | no       | Ignore items higher than this quality.                                                                                                                |
| `maximum.seeders` | number                                       | no       | Ignore items with more than this many seeders.                                                                                                        |
| `required`        | array of **tags**                            | no       | Ignore items that do not have all of these tags.                                                                                                      |
| `preferred`       | array of **tags**                            | no       | Prefer items with any of these tags (more are better).                                                                                                |
| `discouraged`     | array of **tags**                            | no       | Prefer items without any of these tags (fewer are better).                                                                                            |
| `forbidden`       | array of **tags**                            | no       | Ignore items with any of these tags.                                                                                                                  |

# Quality

In Coaxist, "quality" is the term used for "media resolution."

If we can't determine the quality for a search result, we assume 1080p.

# Tags

Tags are parsed and defined in
[`tag.ts`](https://github.com/mplewis/coaxist/blob/main/connector/src/data/tag.ts).
When Connector parses search results, it parses data from the name of the
torrent and the name of the file within the torrent into useful tags.

You can use tags as part of your `required`, `preferred`, `discouraged`, and
`forbidden` criteria to encourage Connector to pick media with certain
attributes. For example, if you prefer to watch in HDR when available, but your
devices don't support Dolby Vision, you can specify:

```yaml
- name: My Profile
  preferred:
    - hdr
  forbidden:
    - dolbyvision
```

| Tag         | Description                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cached      | A copy of this media is already cached on the Debrid provider.<br>**Recommended:** setting this in your `preferred` criteria will prefer "instant" downloads. |
| hdr         | This video is encoded in HDR                                                                                                                                  |
| hdr10       | This video is encoded in [HDR10](https://en.wikipedia.org/wiki/HDR10)                                                                                         |
| hdr10plus   | This video is encoded in [HDR10+](https://en.wikipedia.org/wiki/HDR10%2B)                                                                                     |
| dolbyvision | This video is encoded in [Dolby Vision](https://en.wikipedia.org/wiki/Dolby_Vision) HDR                                                                       |
| h265        | This video is encoded using [H.265 HEVC](https://en.wikipedia.org/wiki/High_Efficiency_Video_Coding)                                                          |
| h264        | This video is encoded using [H.264 AVC](https://en.wikipedia.org/wiki/Advanced_Video_Coding)                                                                  |
| remux       | This is a ["remux" direct copy](https://scenelingo.wordpress.com/2015/09/09/what-does-remux-mean/) of the streams from the source media                       |
| bluray      | This media was captured from a Blu-Ray source                                                                                                                 |
| web         | This media was captured from a web download source                                                                                                            |
| hdtv        | This media was captured from a HDTV source                                                                                                                    |
| cam         | This media was filmed off of another screen using a camera                                                                                                    |
| hardsub     | The subtitles are burned into the video's pixels                                                                                                              |
| multisub    | Subtitles for multiple languages are included                                                                                                                 |
| dualaudio   | Audio streams for two different languages are included                                                                                                        |
| multiaudio  | Audio streams for multiple languages are included                                                                                                             |

# Behavior

Connector uses the following logic to select a torrent for a media profile from
a list of search results:

- Drop items that don't meet _all_ `required` criteria.
- Drop items that meet _any_ `forbidden` criteria.
- Sort all other items into tiers based on their `preferred` and `discouraged`
  criteria.
  - An item with 3 preferred tags and 0 discouraged tags is in tier 3.
  - An item with 2 preferred tags and 1 discouraged tag is in tier -1
    (discouraged tags take precedence).
- Drop items that are not in the highest preference tier.
- Sort items into tiers based on their quality.
- Drop items that are not in the highest quality tier.
  - i.e. if we have 1080p and 720p items, we will only consider the 1080p items.
- Pick the highest-scoring item based on the `sort` criteria.
