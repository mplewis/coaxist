import { LRUCache } from "lru-cache";
import ms from "ms";

const fetchCache = new LRUCache({ ttl: ms("1h"), max: 1000 });

export function cacheFor(ns: string) {
  const get = async (key: string, callable: () => Promise<any>) => {
    const val = fetchCache.get(ns + key);
    if (val) return val;
    const res = await callable();
    fetchCache.set(ns + key, res);
    return res;
  };
  const getJSON = async (key: string, callable: () => Promise<Response>) => {
    const val = fetchCache.get(ns + key);
    if (val) return val;
    const res = await callable();
    const json = await res.json();
    fetchCache.set(ns + key, json);
    return json;
  };
  return { get, getJSON };
}
