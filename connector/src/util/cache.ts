import { LRUCache } from "lru-cache";
import ms from "ms";

const fetchCache = new LRUCache({ ttl: ms("1h"), max: 1000 });

export function cacheFor(ns: string) {
  const get = async (
    key: string,
    callable: () => Promise<Response>
  ): Promise<{ ok: Boolean; res: Response }> => {
    const val = fetchCache.get(ns + key) as Response;
    if (val) return { ok: true, res: val };

    const res = await callable();
    if (res.status < 200 || res.status >= 300) return { ok: false, res };

    fetchCache.set(ns + key, res);
    return { ok: true, res };
  };

  const getJSON = async (
    key: string,
    callable: () => Promise<Response>
  ): Promise<{ ok: true; json: any } | { ok: false; res: Response }> => {
    const val = fetchCache.get(ns + key);
    if (val) return { ok: true, json: val };

    const res = await callable();
    if (res.status < 200 || res.status >= 300) return { ok: false, res };

    const json = await res.json();
    fetchCache.set(ns + key, json);
    return { ok: true, json };
  };

  return { get, getJSON };
}
