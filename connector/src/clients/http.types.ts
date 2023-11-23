import { ZodIssue } from "zod";

export type CommonError = (Error | ZodIssue | RequestError | Object) & {
  errorCategory:
    | "network" // network error
    | "server" // 5xx, or e.g. missing redirect header
    | "client" // 4xx
    | "validation" // zod validation error
    | "internal"; // internal error
};

export type RespData<T> = RespSuccess<T> | RespFailure;
export type RespSuccess<T> = {
  success: true;
  data: T;
};
export type RespFailure = {
  success: false;
  errors: CommonError[];
};
export type RequestError = {
  errorCategory: "network" | "server" | "client";
  method: string;
  url: string;
  status: number;
  statusText: string;
  text: string;
};

/** Flatten a list of results with nested errors into a list of errors. */
export function justErrors(
  datas: ({ success: true } | RespFailure)[]
): CommonError[] {
  return datas.flatMap((d) => (d.success ? [] : d.errors));
}
