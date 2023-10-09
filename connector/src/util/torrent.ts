import parseTorrent from "parse-torrent";
import { get } from "../clients/http";

export async function parseTorrentFilenames(url: string) {
  const resp = await get(url);
  if (!resp.success) return resp;

  const raw = await resp.data.arrayBuffer();
  let torrent: parseTorrent.Instance;
  try {
    torrent = await parseTorrent(raw);
  } catch (e) {
    return { success: false as const, errors: [e as Error] };
  }

  const filenames = (torrent.files || []).map((f) => f.name);
  return { success: true as const, data: filenames };
}
