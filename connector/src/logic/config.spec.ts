import { writeFile } from "fs/promises";
import { join } from "path";

import { describe, expect, it } from "vitest";

import { loadConfig } from "../data/config";

const uberConfYaml = `
debrid:
  allDebrid:
    apiKey: SOME_ALLDEBRID_API_KEY

connector:
  search:
    outstandingSearchInterval: 1h
    beforeReleaseDate: 7d
  snatch:
    debridExpiry: 14d
    refreshWithinExpiry: 2d
    refreshCheckInterval: 1h
  overseerr:
    pollInterval: 15s
    requestConcurrency: 5
  torrentio:
    requestConcurrency: 5
    cacheExpiry: 1h

mediaProfiles:
  - name: Best Available
    preferred:
      - cached
`;

const overseerrConfJson = JSON.stringify({
  main: { apiKey: "SOME_OVERSEERR_API_KEY" },
});

describe("loadConfig", () => {
  it("loads properly using an Overseerr config file", async () => {
    const uberConfPath = join("/tmp", "_connector_spec_config.yaml");
    const overseerrConfPath = join(
      "/tmp",
      "_connector_spec_overseerr.config.json"
    );
    await writeFile(uberConfPath, uberConfYaml);
    await writeFile(overseerrConfPath, overseerrConfJson);

    const result = loadConfig({
      UBERCONF_PATH: uberConfPath,
      OVERSEERR_CONFIG_PATH: overseerrConfPath,
      STORAGE_DIR: "/tmp",
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "debridCreds": {
          "apiKey": "SOME_ALLDEBRID_API_KEY",
          "provider": "alldebrid",
        },
        "debridCredsHash": "hICA1b9H",
        "envConf": {
          "OVERSEERR_CONFIG_PATH": "/tmp/_connector_spec_overseerr.config.json",
          "OVERSEERR_HOST": "http://localhost:5055",
          "STORAGE_DIR": "/tmp",
          "UBERCONF_PATH": "/tmp/_connector_spec_config.yaml",
        },
        "overseerrAPIKey": "SOME_OVERSEERR_API_KEY",
        "uberConf": {
          "connector": {
            "overseerr": {
              "pollInterval": 15000,
              "requestConcurrency": 5,
            },
            "search": {
              "beforeReleaseDate": 604800000,
              "outstandingSearchInterval": 3600000,
            },
            "snatch": {
              "debridExpiry": 1209600000,
              "refreshCheckInterval": 3600000,
              "refreshWithinExpiry": 172800000,
            },
            "torrentio": {
              "cacheExpiry": 3600000,
              "requestConcurrency": 5,
            },
          },
          "debrid": {
            "allDebrid": {
              "apiKey": "SOME_ALLDEBRID_API_KEY",
            },
          },
          "mediaProfiles": [
            {
              "name": "Best Available",
              "preferred": [
                "cached",
              ],
              "sort": "largestFileSize",
            },
          ],
        },
      }
    `);
  });

  it("loads properly using an Overseerr API key", async () => {
    const uberConfPath = join("/tmp", "_connector_spec_config.yaml");
    await writeFile(uberConfPath, uberConfYaml);

    const result = loadConfig({
      UBERCONF_PATH: uberConfPath,
      OVERSEERR_API_KEY: "SOME_OTHER_OVERSEERR_API_KEY",
      STORAGE_DIR: "/tmp",
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "debridCreds": {
          "apiKey": "SOME_ALLDEBRID_API_KEY",
          "provider": "alldebrid",
        },
        "debridCredsHash": "hICA1b9H",
        "envConf": {
          "OVERSEERR_API_KEY": "SOME_OTHER_OVERSEERR_API_KEY",
          "OVERSEERR_HOST": "http://localhost:5055",
          "STORAGE_DIR": "/tmp",
          "UBERCONF_PATH": "/tmp/_connector_spec_config.yaml",
        },
        "overseerrAPIKey": "SOME_OTHER_OVERSEERR_API_KEY",
        "uberConf": {
          "connector": {
            "overseerr": {
              "pollInterval": 15000,
              "requestConcurrency": 5,
            },
            "search": {
              "beforeReleaseDate": 604800000,
              "outstandingSearchInterval": 3600000,
            },
            "snatch": {
              "debridExpiry": 1209600000,
              "refreshCheckInterval": 3600000,
              "refreshWithinExpiry": 172800000,
            },
            "torrentio": {
              "cacheExpiry": 3600000,
              "requestConcurrency": 5,
            },
          },
          "debrid": {
            "allDebrid": {
              "apiKey": "SOME_ALLDEBRID_API_KEY",
            },
          },
          "mediaProfiles": [
            {
              "name": "Best Available",
              "preferred": [
                "cached",
              ],
              "sort": "largestFileSize",
            },
          ],
        },
      }
    `);
  });
});
