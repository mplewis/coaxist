import { isTruthy } from "remeda";

/** Credentials for connecting to Debrid. */
export type DebridCreds = {
  allDebridAPIKey?: string;
  debridLinkAPIKey?: string;
  offcloudAPIKey?: string;
  premiumizeAPIKey?: string;
  putio?: { clientID: string; token: string };
  realDebridAPIKey?: string;
};

export function parseDebridCreds(config: {
  ALLDEBRID_API_KEY?: string;
  DEBRIDLINK_API_KEY?: string;
  OFFCLOUD_API_KEY?: string;
  PREMIUMIZE_API_KEY?: string;
  PUTIO_CLIENT_ID?: string;
  PUTIO_TOKEN?: string;
  REALDEBRID_API_KEY?: string;
}): DebridCreds {
  const allAPIKeys: DebridCreds = {
    allDebridAPIKey: config.ALLDEBRID_API_KEY,
    debridLinkAPIKey: config.DEBRIDLINK_API_KEY,
    offcloudAPIKey: config.OFFCLOUD_API_KEY,
    premiumizeAPIKey: config.PREMIUMIZE_API_KEY,
    realDebridAPIKey: config.REALDEBRID_API_KEY,
  };
  if (config.PUTIO_CLIENT_ID && config.PUTIO_TOKEN) {
    allAPIKeys.putio = {
      clientID: config.PUTIO_CLIENT_ID,
      token: config.PUTIO_TOKEN,
    };
  }
  // For now, we only support one API key, because we only support one WebDAV mount.
  const present = Object.entries(allAPIKeys)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (present.length !== 1) {
    const names = present.join(", ");
    throw new Error(
      `Exactly one Debrid API key must be provided. Found: ${names}`
    );
  }
  return allAPIKeys;
}

export function buildDebridPathPart(creds: DebridCreds) {
  const bits = [
    creds.allDebridAPIKey && `alldebrid=${creds.allDebridAPIKey}`,
    creds.debridLinkAPIKey && `debridlink=${creds.debridLinkAPIKey}`,
    creds.offcloudAPIKey && `offcloud=${creds.offcloudAPIKey}`,
    creds.premiumizeAPIKey && `premiumize=${creds.premiumizeAPIKey}`,
    creds.putio && `putio=${creds.putio.clientID}@${creds.putio.token}`,
    creds.realDebridAPIKey && `realdebrid=${creds.realDebridAPIKey}`,
  ].filter(isTruthy);
  if (bits.length === 0) {
    throw new Error("At least one Debrid API key must be provided");
  }
  return bits.join("|");
}
