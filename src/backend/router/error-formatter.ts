import { ZodError } from "zod";
import { TRPCError } from "@trpc/server";
import { DefaultErrorShape } from "@trpc/server";

import { IContext } from "~/backend/router/context";

import {
  ErrorMessage,
  AppError,
  type ErrorPayload,
} from "~/api-contract/errors/errors";

type TRPCErrorDataDetails = {
  [k in keyof ErrorPayload]: { type: k; info: ErrorPayload[k] };
}[keyof ErrorPayload];

export const serializeTRPCSourceError = (opts: {
  error: TRPCError;
  type: "query" | "mutation" | "subscription" | "unknown";
  path: string | undefined;
  input: unknown;
  ctx: IContext | undefined;
  shape: DefaultErrorShape;
}): {
  code: number;
  message: string;
  data: {
    details: TRPCErrorDataDetails;
    message: string;
  };
} => {
  if (opts.error.cause instanceof ZodError) {
    return {
      code: 400,
      message: "Request invalid",
      data: {
        details: {
          type: "REQUEST_VALIDATION",
          info: {
            issues: opts.error.cause.issues,
          },
        },
        message: ErrorMessage["REQUEST_VALIDATION"],
      },
    };
  } else if (opts.error.cause instanceof AppError) {
    return {
      code: 400,
      message: "Application error",
      data: {
        details: opts.error.cause.details,
        message: opts.error.cause.message,
      },
    };
  } else {
    return {
      code: 400,
      message: "Unexpected error",
      data: {
        details: {
          type: "UNKNOWN",
          info: {
            cause: opts.error.cause,
            info: opts.error,
          },
        },
        message: ErrorMessage["UNKNOWN"],
      },
    };
  }
};
