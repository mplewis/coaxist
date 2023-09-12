import parseBytes from "bytes";
import { Classification, Numbering, classify } from "./classify";

export type TorrentInfo = Classification & {
  tracker: string;
  seeders: number;
  bytes: number;
  url: string;
};

const SEEDERS_PARSER = /👤\s*(\d+)/;
const SIZE_PARSER = /💾\s*([\d.]+\s*[A-Za-z]*B)/;
const TRACKER_PARSER = /⚙️\s*(.+)/;

function numberingFrom(
  prefer: Classification | null,
  fallback: Classification | null
): Numbering {
  if (prefer && "episode" in prefer) return prefer;
  if (fallback && "episode" in fallback) return fallback;
  if (prefer && "season" in prefer) return prefer;
  if (fallback && "season" in fallback) return fallback;
  return {};
}

export function parseTorrentInfo(
  torrentioTitle: string,
  url: string
): TorrentInfo | null {
  const lines = torrentioTitle.split("\n");

  // Always present. Looks like: 👤 89 💾 5.76 GB ⚙️ ThePirateBay
  const metaLineIdx = lines.findIndex((l) => l.includes("👤"));
  if (!metaLineIdx) return null;
  const metaLine = lines[metaLineIdx];

  const seedersMatch = metaLine.match(SEEDERS_PARSER);
  const seeders = seedersMatch ? parseInt(seedersMatch[1], 10) : -1;
  const sizeMatch = metaLine.match(SIZE_PARSER);
  const sizeRaw = sizeMatch ? sizeMatch[1] : null;
  const bytes = sizeRaw ? parseBytes(sizeRaw) : -1;
  const trackerMatch = metaLine.match(TRACKER_PARSER);
  const tracker = trackerMatch ? trackerMatch[1] : "<unknown>";

  // Always present. The name of the file. Doesn't always include an extension.
  const fnLineIdx = metaLineIdx - 1;
  const fnLine = lines[fnLineIdx];

  // Sometimes present. The name of the torrent, if it's for more than one file.
  const torrentLineIdx = metaLineIdx - 2;
  const torrentLine = lines[torrentLineIdx];

  const cl: Classification | null = (() => {
    if (!fnLine) return null;
    if (!torrentLine) return classify(fnLine);

    // The filename is often more descriptive than the torrent name, so prefer it
    const clF = classify(fnLine);
    const clT = classify(torrentLine);
    const quality = (clF && clF.quality) || (clT && clT.quality);
    if (!quality) return null;
    const tagsT = (clT && clT.tags) || [];
    const tagsF = (clF && clF.tags) || [];
    const tags = [...new Set([...tagsT, ...tagsF])].sort();
    return { quality, tags, ...numberingFrom(clF, clT) };
  })();
  if (!cl) return null;

  return { ...cl, tracker, seeders, bytes, url };
}
