import { PrismaClient, Snatch } from "@prisma/client";

import { ToFetch } from "../logic/list";

import { Snatchable } from "./torrentio";

export class DbClient {
  constructor(private db: PrismaClient) {}

  snatchesFor(a: {
    media: ToFetch;
    profileHash: string;
    debridCredsHash: string;
  }): Promise<Snatch[]> {
    const { media, profileHash, debridCredsHash } = a;
    return this.db.snatch.findMany({
      where: {
        mediaType: media.type,
        imdbID: media.imdbID,
        season: "season" in media ? media.season : null,
        episode: "episode" in media ? media.episode : null,
        profileHash,
        debridCredsHash,
      },
    });
  }

  snatchesForConfig(a: {
    profileHashes: string[];
    debridCredsHash: string;
  }): Promise<Snatch[]> {
    const { profileHashes, debridCredsHash } = a;
    return this.db.snatch.findMany({
      where: {
        profileHash: { in: profileHashes },
        debridCredsHash,
      },
    });
  }

  async firstSnatchFor(a: {
    media: ToFetch;
    profileHash: string;
    debridCredsHash: string;
  }): Promise<Snatch | null> {
    const results = await this.snatchesFor(a);
    if (!results.length) return null;
    return results[0];
  }

  /** Upsert a snatch record for a piece of media.
   * If the record exists, update its lastSnatchedAt. */
  async upsertSnatch(a: {
    media: ToFetch;
    snatchable: Snatchable;
    profileHash: string;
    debridCredsHash: string;
  }): Promise<{ action: "create" | "update"; record: Snatch }> {
    const { media, snatchable, profileHash, debridCredsHash } = a;

    const pastSnatch = await this.firstSnatchFor({
      media,
      profileHash,
      debridCredsHash,
    });

    if (pastSnatch) {
      const record = await this.db.snatch.update({
        where: { id: pastSnatch.id },
        data: { lastSnatchedAt: new Date() },
      });
      return { action: "update", record };
    }

    const record = await this.db.snatch.create({
      data: {
        mediaType: media.type,
        imdbID: media.imdbID,
        refreshURL: snatchable.snatchURL,
        title: media.title,
        season: "season" in media ? media.season : null,
        episode: "episode" in media ? media.episode : null,
        profileHash,
        debridCredsHash,
      },
    });
    return { action: "create", record };
  }

  async deleteSnatch(id: number) {
    return this.db.snatch.delete({ where: { id } });
  }

  async overdueSnatches(a: {
    profileHashes: string[];
    debridCredsHash: string;
    fetchedBefore: Date;
  }) {
    return this.db.snatch.findMany({
      where: {
        profileHash: { in: a.profileHashes },
        debridCredsHash: a.debridCredsHash,
        lastSnatchedAt: { lt: a.fetchedBefore },
      },
    });
  }
}
