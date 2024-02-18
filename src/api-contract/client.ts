import { z } from "zod";

import { contract } from "~/api-contract/endpoints";
import { ServiceResult } from "~/api-contract/types";
import type { EventPayload } from "~/api-contract/subscription/subscription";

type IClient = {
  [k in keyof typeof contract]: (typeof contract)[k] extends {
    input: z.ZodSchema;
  }
    ? (arg: z.infer<(typeof contract)[k]["input"]>) => ServiceResult<k>
    : () => ServiceResult<k>;
};

type ISubscription = {
  addListener: <T extends keyof EventPayload>(
    event: T,
    listener: (payload: EventPayload[T]) => void
  ) => number;
  removeListener: <T extends keyof EventPayload>(
    event: T,
    listenerId: number
  ) => void;
  resetListeners: () => void;
};

export type IApiClient = object & IClient & ISubscription;
