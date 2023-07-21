import superjson from "superjson";
import { inferRouterError } from "@trpc/server";
import { wsLink, createWSClient, createTRPCProxyClient } from "@trpc/client";
import { loggerLink } from "@trpc/client/links/loggerLink";
import { fromPromise, ok, err } from "neverthrow";

import type { ServiceInput, ServiceSyncResult } from "~/api-contract/types";
import { IAppRouter } from "~/backend/router";
import { AppError, AppErrorUnion } from "~/api-contract/errors/errors";
import { IApiClient } from "~/api-contract/client";
import { Unsubscribable } from "@trpc/server/observable";
import { EventPayload } from "~/api-contract/subscription/subscription";

import { config } from "~/client/config/config";

type RouterError = inferRouterError<IAppRouter>;

export class Client implements IApiClient {
  #trpc: ReturnType<typeof createTRPCProxyClient<IAppRouter>>;
  #subscription: Unsubscribable | undefined;
  #socketListeners: {
    [k in keyof EventPayload]: Map<number, (arg: EventPayload[k]) => void>;
  };

  constructor() {
    this.#trpc = createTRPCProxyClient<IAppRouter>({
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (opts) =>
            (process.env.NODE_ENV === "development" &&
              typeof window !== "undefined") ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        wsLink<IAppRouter>({
          client: createWSClient({
            url: config.SERVER_URL,
          }),
        }),
      ],
    });
    this.#socketListeners = {
      message: new Map(),
      "message.from-new-topic": new Map(),
      "notification.off": new Map(),
      "notification.on": new Map(),
      "notification.typing": new Map(),
      "group-chat-notification.online-members": new Map(),
      "notification.p2p-topic-permission-update": new Map(),
      "notification.grp-topic-permission-update": new Map(),
      "notification.topic-event": new Map(),
      "notification.message-deleted": new Map(),
      "notification.added-to-group": new Map(),
      "notification.group-deleted": new Map(),
      read: new Map(),
    };
  }

  #fromApiPromise<T>(promise: Promise<T>) {
    return fromPromise(promise, (e) => e as RouterError).mapErr(
      (e) =>
        new AppError(e.data.details.type, e.data.details.info) as AppErrorUnion
    );
  }

  addListener<T extends keyof EventPayload>(
    event: T,
    listener: (payload: EventPayload[T]) => void
  ) {
    const min = Math.ceil(1);
    const max = Math.floor(10_000);
    let uniqueRandomInt = Math.floor(Math.random() * (max - min + 1)) + min;

    while (this.#socketListeners[event].has(uniqueRandomInt)) {
      uniqueRandomInt = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    this.#socketListeners[event].set(uniqueRandomInt, listener);

    if (this.#socketListeners[event].size > 100) {
      throw new Error(
        "Number of listeners exceeded maximum numer of listeners, which is 100"
      );
    }

    return uniqueRandomInt;
  }

  removeListener(event: keyof EventPayload, listenerId: number) {
    this.#socketListeners[event].delete(listenerId);
  }

  resetListeners() {
    this.#socketListeners = {
      message: new Map(),
      "message.from-new-topic": new Map(),
      "notification.off": new Map(),
      "notification.on": new Map(),
      "group-chat-notification.online-members": new Map(),
      "notification.typing": new Map(),
      "notification.p2p-topic-permission-update": new Map(),
      "notification.grp-topic-permission-update": new Map(),
      "notification.topic-event": new Map(),
      "notification.message-deleted": new Map(),
      "notification.added-to-group": new Map(),
      "notification.group-deleted": new Map(),
      read: new Map(),
    };
  }

  #runListener<T extends keyof EventPayload>(
    event: T,
    payload: EventPayload[T]
  ) {
    for (const listener of this.#socketListeners[event].values()) {
      listener(payload);
    }
  }

  async ["auth/login_with_token"](arg: ServiceInput<"auth/login_with_token">) {
    if (this.#subscription !== undefined) {
      this.#subscription.unsubscribe();
    }

    return new Promise<ServiceSyncResult<"auth/login_with_token">>(
      (resolve) => {
        this.#subscription = this.#trpc.registerSocket.subscribe(undefined, {
          onStarted: async () => {
            // Why the need for this delay?
            // For some really weird reason, which I still don't understand why
            // Without this delay before we make a request for login, there will be unused background socket connections identified as the login identity
            // The unused socket connections will cause the contact to have an online status even while contact is offline
            // There doesn't seem to be any logic error
            // This unused socket connection is triggered by a chunk...js file that is generated from the build
            // Adding this delay solves this problem as the unused socket connection will not be identified as the contact login
            // The script (chunk-xxx.js) will somehow stop executing after this delay
            await new Promise((r) => setTimeout(() => r(undefined), 10));

            const r = await this.#fromApiPromise(
              this.#trpc["auth/login_with_token"].mutate(arg)
            );
            if (r.isErr()) {
              resolve(err(r.error));
              return;
            }
            resolve(ok(r.value));
          },
          onData: (d) => {
            this.#runListener(d.event, d.payload);
          },
          onComplete: () => {
            this.#subscription = undefined;
          },
          onError: (e) => {
            if (e.data) {
              resolve(
                err(
                  new AppError(
                    e.data.details.type,
                    e.data.details.info
                  ) as AppErrorUnion
                )
              );
            } else {
              resolve(err(new AppError("UNKNOWN", { cause: e })));
            }
          },
        });
      }
    );
  }

  async ["auth/login"](arg: ServiceInput<"auth/login">) {
    if (this.#subscription !== undefined) {
      this.#subscription.unsubscribe();
    }

    return new Promise<ServiceSyncResult<"auth/login">>((resolve) => {
      this.#subscription = this.#trpc.registerSocket.subscribe(undefined, {
        onStarted: async () => {
          // Why the need for this delay?
          // For some really weird reason, which I still don't understand why
          // Without this delay before we make a request for login, there will be unused background socket connections identified as the login identity
          // The unused socket connections will cause the contact to have an online status even while contact is offline
          // There doesn't seem to be any logic error
          // This unused socket connection is triggered by a chunk...js file that is generated from the build
          // Adding this delay solves this problem as the unused socket connection will not be identified as the contact login
          // The script (chunk-xxx.js) will somehow stop executing after this delay
          await new Promise((r) => setTimeout(() => r(undefined), 10));

          const r = await this.#fromApiPromise(
            this.#trpc["auth/login"].mutate(arg)
          );
          if (r.isErr()) {
            resolve(err(r.error));
            return;
          }
          resolve(ok(r.value));
        },
        onData: (d) => {
          this.#runListener(d.event, d.payload);
        },
        onComplete: () => {
          this.#subscription = undefined;
        },
        onError: (e) => {
          if (e.data) {
            resolve(
              err(
                new AppError(
                  e.data.details.type,
                  e.data.details.info
                ) as AppErrorUnion
              )
            );
          } else {
            resolve(err(new AppError("UNKNOWN", { cause: e })));
          }
        },
      });
    });
  }

  async ["auth/logout"]() {
    const r = await this.#fromApiPromise(this.#trpc["auth/logout"].mutate());
    return r;
  }

  async ["users/create_user"](arg: ServiceInput<"users/create_user">) {
    const r = await this.#fromApiPromise(
      this.#trpc["users/create_user"].mutate(arg)
    );
    return r;
  }

  async ["users/find_users_to_add_as_contact"](
    arg: ServiceInput<"users/find_users_to_add_as_contact">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["users/find_users_to_add_as_contact"].query(arg)
    );
    return r;
  }

  async ["users/topics"]() {
    const r = await this.#fromApiPromise(this.#trpc["users/topics"].query());
    return r;
  }

  async ["users/contact_status"]() {
    const r = await this.#fromApiPromise(
      this.#trpc["users/contact_status"].query()
    );
    return r;
  }

  async ["group/find_new_members"](
    arg: ServiceInput<"group/find_new_members">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["group/find_new_members"].mutate(arg)
    );
    return r;
  }

  async ["group/add_members"](arg: ServiceInput<"group/add_members">) {
    const r = await this.#fromApiPromise(
      this.#trpc["group/add_members"].mutate(arg)
    );
    return r;
  }

  async ["group/create_group"](arg: ServiceInput<"group/create_group">) {
    const r = await this.#fromApiPromise(
      this.#trpc["group/create_group"].mutate(arg)
    );
    return r;
  }

  async ["group/preview_info"](arg: ServiceInput<"group/preview_info">) {
    const r = await this.#fromApiPromise(
      this.#trpc["group/preview_info"].query(arg)
    );
    return r;
  }

  async ["group/members"](arg: ServiceInput<"group/members">) {
    const r = await this.#fromApiPromise(
      this.#trpc["group/members"].query(arg)
    );
    return r;
  }

  async ["group/invite_link"](arg: ServiceInput<"group/invite_link">) {
    const r = await this.#fromApiPromise(
      this.#trpc["group/invite_link"].query(arg)
    );
    return r;
  }

  async ["group/remove_member"](arg: ServiceInput<"group/remove_member">) {
    const r = await this.#fromApiPromise(
      this.#trpc["group/remove_member"].mutate(arg)
    );
    return r;
  }

  async ["group/leave_group"](arg: ServiceInput<"group/leave_group">) {
    const r = await this.#fromApiPromise(
      this.#trpc["group/leave_group"].mutate(arg)
    );
    return r;
  }

  async ["group/join_group_via_id"](
    arg: ServiceInput<"group/join_group_via_id">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["group/join_group_via_id"].mutate(arg)
    );
    return r;
  }

  async ["group/join_group_via_invite_link"](
    arg: ServiceInput<"group/join_group_via_invite_link">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["group/join_group_via_invite_link"].mutate(arg)
    );
    return r;
  }

  async ["group/am_i_group_member_of"](
    arg: ServiceInput<"group/am_i_group_member_of">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["group/am_i_group_member_of"].query(arg)
    );
    return r;
  }

  async ["topic/reply_message"](arg: ServiceInput<"topic/reply_message">) {
    const r = await this.#fromApiPromise(
      this.#trpc["topic/reply_message"].mutate(arg)
    );
    return r;
  }

  async ["topic/delete_message"](arg: ServiceInput<"topic/delete_message">) {
    const r = await this.#fromApiPromise(
      this.#trpc["topic/delete_message"].mutate(arg)
    );
    return r;
  }

  async ["topic/clear_messages"](arg: ServiceInput<"topic/clear_messages">) {
    const r = await this.#fromApiPromise(
      this.#trpc["topic/clear_messages"].mutate(arg)
    );
    return r;
  }

  async ["topic/messages"](arg: ServiceInput<"topic/messages">) {
    const r = await this.#fromApiPromise(
      this.#trpc["topic/messages"].query(arg)
    );
    return r;
  }

  async ["topic/unread_messages"]() {
    const r = await this.#fromApiPromise(
      this.#trpc["topic/unread_messages"].query()
    );
    if (r.isErr()) {
      console.log(r.error.details);
    }
    return r;
  }

  async ["topic/get_messages_until_reply"](
    arg: ServiceInput<"topic/get_messages_until_reply">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["topic/get_messages_until_reply"].query(arg)
    );
    return r;
  }

  async ["topic/has_messages_earlier_than"](
    arg: ServiceInput<"topic/has_messages_earlier_than">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["topic/has_messages_earlier_than"].query(arg)
    );
    return r;
  }

  async ["topic/update_message_read_status"](
    arg: ServiceInput<"topic/update_message_read_status">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["topic/update_message_read_status"].mutate(arg)
    );
    return r;
  }

  async ["topic/forward_message"](arg: ServiceInput<"topic/forward_message">) {
    const r = await this.#fromApiPromise(
      this.#trpc["topic/forward_message"].mutate(arg)
    );
    return r;
  }

  async ["topic/send_message"](arg: ServiceInput<"topic/send_message">) {
    const r = await this.#fromApiPromise(
      this.#trpc["topic/send_message"].mutate(arg)
    );
    return r;
  }

  async ["topic/preview_info"](arg: ServiceInput<"topic/preview_info">) {
    const r = await this.#fromApiPromise(
      this.#trpc["topic/preview_info"].query(arg)
    );
    return r;
  }

  async ["topic/notify_typing"](arg: ServiceInput<"topic/notify_typing">) {
    const r = await this.#fromApiPromise(
      this.#trpc["topic/notify_typing"].mutate(arg)
    );
    return r;
  }

  async ["permissions/update_user_default_permission"](
    arg: ServiceInput<"permissions/update_user_default_permission">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["permissions/update_user_default_permission"].mutate(arg)
    );
    return r;
  }

  async ["permissions/update_peer_permission"](
    arg: ServiceInput<"permissions/update_peer_permission">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["permissions/update_peer_permission"].mutate(arg)
    );
    return r;
  }

  async ["permissions/block_peer"](
    arg: ServiceInput<"permissions/block_peer">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["permissions/block_peer"].mutate(arg)
    );
    return r;
  }

  async ["permissions/update_group_default_permission"](
    arg: ServiceInput<"permissions/update_group_default_permission">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["permissions/update_group_default_permission"].mutate(arg)
    );
    return r;
  }

  async ["permissions/update_group_member_permission"](
    arg: ServiceInput<"permissions/update_group_member_permission">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["permissions/update_group_member_permission"].mutate(arg)
    );
    return r;
  }

  async ["permissions/get_group_member_permission"](
    arg: ServiceInput<"permissions/get_group_member_permission">
  ) {
    const r = await this.#fromApiPromise(
      this.#trpc["permissions/get_group_member_permission"].query(arg)
    );
    return r;
  }
}
