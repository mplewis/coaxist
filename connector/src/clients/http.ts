import { SafeParseReturnType, ZodIssue } from "zod";

import log from "../log";
import { Result, Retryable, retry } from "../util/retry";

// eslint-disable-next-line no-restricted-globals
const nodeFetch = fetch;

export type RespData<T> = RespSuccess<T> | RespFailure;
export type RespSuccess<T> = {
  success: true;
  data: T;
};
export type RespFailure = {
  success: false;
  errors: (RequestError | ZodIssue)[];
};

type RequestableURL =
  | string
  | URL
  | { url: string | URL; query: Record<string, any> };
export type RequestError = { status: number; text: string };
export type Validator<T> = {
  safeParse: (data: any) => SafeParseReturnType<T, T>;
};

const euc = encodeURIComponent;
function queryToStr(query: Record<string, any>) {
  return Object.entries(query)
    .map(([k, v]) => `${euc(k)}=${euc(v)}`)
    .join("&");
}

/**
 * Make a request against an endpoint.
 * @param desc a description of the task the request is performing
 * @param url the URL to fetch
 * @param opts options for the `fetch` request
 * @returns the response, or the errors
 */
export function fetchResp(
  desc: string,
  url: RequestableURL,
  opts: RequestInit
): Promise<Result<Response, RequestError>> {
  const fn: Retryable<Response, RequestError> = async () => {
    let u =
      typeof url === "string" || url instanceof URL
        ? url
        : `${url.url}?${queryToStr(url.query)}`;

    log.debug({ u, opts }, `fetching: ${desc}`);
    const resp = await nodeFetch(u, opts);
    const { status, statusText } = resp;

    if (status >= 200 && status < 300) {
      return { state: "done", data: resp };
    }

    if (status >= 300 && status < 400) {
      const loc = resp.headers.get("Location");
      if (!loc) {
        return {
          state: "error",
          error: {
            status,
            statusText,
            text: "no location header for redirect",
          },
        };
      }
      u = loc;
      return {
        state: "retry",
        error: { status, statusText, text: `redirecting to ${loc}` },
      };
    }

    if (status >= 500) {
      const text = await resp.text();
      return { state: "retry", error: { status, statusText, text } };
    }

    const text = await resp.text();
    return { state: "error", error: { status, statusText, text } };
  };

  return retry(`${opts.method ?? "fetch"} ${url}`, fn);
}

/**
 * Make a request against an endpoint which returns JSON.
 * @param desc a description of the task the request is performing
 * @param url the URL to fetch
 * @param schema the schema to use to parse the response
 * @param opts options for the `fetch` request
 * @returns the requested data, or the errors
 */
async function fetchJSON<T>(
  desc: string,
  url: RequestableURL,
  schema: Validator<T>,
  opts: RequestInit
): Promise<RespData<T>> {
  const o = {
    ...opts,
    headers: { Accept: "application/json", ...(opts.headers ?? {}) },
  };

  const result = await fetchResp(desc, url, o);
  if (!result.success) return result;

  const data = await result.data.json();
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    return { success: false as const, errors: parsed.error.errors };

  return { success: true as const, data: parsed.data };
}

/**
 * Make a GET request against an endpoint.
 * @param desc a description of the task the request is performing
 * @param url the URL to fetch
 * @param opts options for the `fetch` request
 * @returns the response, or the errors
 */
export async function get(
  desc: string,
  url: RequestableURL,
  opts: RequestInit = {}
): Promise<Result<Response, RequestError>> {
  return fetchResp(desc, url, { ...opts, method: "GET" });
}

/**
 * Make a GET request against an endpoint which returns JSON.
 * @param desc a description of the task the request is performing
 * @param url the URL to fetch
 * @param schema the schema to use to parse the response
 * @param opts options for the `fetch` request
 * @returns the requested data, or the errors
 */
export async function getJSON<T>(
  desc: string,
  url: RequestableURL,
  schema: Validator<T>,
  opts: RequestInit = {}
) {
  return fetchJSON(desc, url, schema, { ...opts, method: "GET" });
}

/**
 * Make a POST request against an endpoint which returns JSON.
 * @param desc a description of the task the request is performing
 * @param url the URL to fetch
 * @param body the body to send
 * @param schema the schema to use to parse the response
 * @param opts options for the `fetch` request
 * @returns the requested data, or the errors
 */
export async function postJSON<T>(
  desc: string,
  url: RequestableURL,
  body: BodyInit,
  schema: Validator<T>,
  opts: RequestInit = {}
) {
  return fetchJSON(desc, url, schema, { ...opts, method: "POST", body });
}
