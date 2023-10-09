import parseTorrent from "parse-torrent";
import { get } from "../clients/http";

interface ParsedFile {
  path: string;
  name: string;
  length: number;
  offset: number;
}

async function fetchTorrent(infoHash: string) {
  const url = `https://itorrents.org/torrent/${infoHash}.torrent`;
  const resp = await get(url);
  if (!resp.success) return resp;
  return { success: true as const, data: resp.data };
}

export async function parseTorrentFilenames(
  t: { downloadUrl: string } | { infoHash: string }
) {
  // TODO: Cache
  const resp =
    "downloadUrl" in t
      ? await get(t.downloadUrl)
      : await fetchTorrent(t.infoHash);
  if (!resp.success) return resp;
  const raw = await resp.data.arrayBuffer();
  const buf = Buffer.from(raw);

  let torrent: { files?: ParsedFile[] };
  try {
    const tor = parseTorrent(buf);
    if (!tor)
      return { success: false as const, errors: ["could not parse torrent"] };
    torrent = tor as { files?: ParsedFile[] };
  } catch (e) {
    return { success: false as const, errors: [e as Error] };
  }

  const filenames = (torrent.files || []).map((f) => f.name);
  return { success: true as const, data: filenames };
}
