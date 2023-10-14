import { ZodIssue } from "zod";

export type CommonError = Error | ZodIssue | RequestError;

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
  method: string;
  url: string;
  status: number;
  statusText: string;
  text: string;
};
