import { DebridConfig } from "../uberconf/uberconf.types";

/** Credentials for connecting to Debrid. */
export type DebridCreds = {
  provider: string;
} & (
  | {
      apiKey: string;
    }
  | {
      username: string;
      password: string;
    }
);

export function toDebridCreds(c: DebridConfig) {
  if ("realDebrid" in c) {
    return {
      provider: "realdebrid",
      apiKey: c.realDebrid.apiKey,
    };
  }
  if ("allDebrid" in c) {
    return {
      provider: "alldebrid",
      apiKey: c.allDebrid.apiKey,
    };
  }
  const exhaustiveCheck: never = c;
  throw new Error(`unhandled debrid type: ${exhaustiveCheck}`);
}

export function buildDebridPathPart(creds: DebridCreds) {
  if ("apiKey" in creds) return `${creds.provider}=${creds.apiKey}`;
  return `${creds.provider}=${creds.username}@${creds.password}`;
}
