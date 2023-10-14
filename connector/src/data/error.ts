import { ZodIssue } from "zod";

import { RequestError } from "../clients/http";

export type CommonError = Error | ZodIssue | RequestError;
