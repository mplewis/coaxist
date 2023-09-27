import type { Config } from "../util/config";

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

export function buildDebridPathPart({ DEBRID_CREDS: creds }: Config) {
  if ("apiKey" in creds) return `${creds.provider}=${creds.apiKey}`;
  return `${creds.provider}=${creds.username}@${creds.password}`;
}
