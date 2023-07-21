import type { Observer } from "@trpc/server/observable";
import type { EventPayload } from "~/api-contract/subscription/subscription";

// https://effectivetypescript.com/2020/05/12/unionize-objectify/
export type SubscriptionMessage = {
  [k in keyof EventPayload]: { event: k; payload: EventPayload[k] };
}[keyof EventPayload];

export type Socket = Observer<SubscriptionMessage, unknown>;
