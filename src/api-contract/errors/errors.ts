import { type z } from "zod";

export type ErrorPayload = {
  REQUEST_VALIDATION: {
    issues: z.ZodIssue[];
  };
  RESOURCE_NOT_FOUND: {
    resource: string;
  };
  DATABASE: {
    cause: unknown;
  };
  UNKNOWN: {
    cause: unknown;
    info?: unknown;
  };
  SAVE_MEDIA_FAILED: { media: string; cause: unknown };
  "AUTH.INCORRECT_PASSWORD": undefined;
  "TOPIC.REPLY_MESSAGE_NOT_EXIST": undefined;
  "GROUP.NO_JOIN_PERMISSION": undefined;
};

export const ErrorMessage: { [k in keyof ErrorPayload]: string } = {
  REQUEST_VALIDATION: "Invalid request",
  RESOURCE_NOT_FOUND: "Requested resource is not found",
  DATABASE: "An error has occured from database operation",
  UNKNOWN: "An unexpected error has occured",
  SAVE_MEDIA_FAILED: "Failed to save media",
  "AUTH.INCORRECT_PASSWORD": "Incorrect password",
  "GROUP.NO_JOIN_PERMISSION": "Group doesn't allow new joiners",
  "TOPIC.REPLY_MESSAGE_NOT_EXIST": "Couldn't find the message replied to",
};

export class AppError<T extends keyof ErrorPayload> extends Error {
  readonly details: {
    type: T;
    info: ErrorPayload[T];
  };
  readonly message: string;
  constructor(type: T, info: ErrorPayload[T]) {
    super();
    this.details = {
      type,
      info,
    };
    this.message = ErrorMessage[type];
  }
}

export const isAppError = (e: unknown): e is AppErrorUnion => {
  const assertedE = e as AppErrorUnion;
  return (
    assertedE.details !== undefined &&
    typeof assertedE.details === "object" &&
    typeof assertedE.message === "string" &&
    assertedE.details.type in ErrorMessage
  );
};

export type AppErrorUnion = {
  [K in keyof ErrorPayload]: AppError<K>;
}[keyof ErrorPayload];
