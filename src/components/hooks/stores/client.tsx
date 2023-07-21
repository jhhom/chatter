import { create } from "zustand";

import { IApiClient } from "~/api-contract/client";
import { Client } from "~/client/trpc/client";
import { UserId } from "~/backend/drizzle/schema";
import { ServiceInput } from "~/api-contract/types";
import storage from "~/components/hooks/stores/local-storage";

import { ok, err } from "neverthrow";

import { createContext, useContext } from "react";

const client: IApiClient = new Client();

type Profile = {
  userId: UserId;
  username: string;
  email: string;
  fullname: string;
  defaultPermissions: string;
  profilePhotoUrl: string | null;
};

const useProfileStore = create<{
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
}>((set) => ({
  profile: null,
  setProfile: (profile) => {
    set(() => {
      return { profile };
    });
  },
}));

class AppClient {
  readonly #api: IApiClient;
  readonly #profile: Profile | null;
  readonly #setProfile: (profile: Profile | null) => void;

  readonly addListener: IApiClient["addListener"] = (event, listener) => {
    return this.#api.addListener(event, listener);
  };
  readonly removeListener: IApiClient["removeListener"] = (event, listenerId) =>
    this.#api.removeListener(event, listenerId);

  constructor(props: {
    profile: Profile | null;
    setProfile: (profile: Profile | null) => void;
  }) {
    this.#profile = props.profile;
    this.#setProfile = props.setProfile;
    this.#api = client;
  }

  profile() {
    return this.#profile;
  }

  isAuthed() {
    return this.#profile !== null;
  }

  reset() {
    this.#setProfile(null);
    this.#api.resetListeners();
  }

  async ["auth/login"](arg: ServiceInput<"auth/login">) {
    this.reset();

    const r = await this.#api["auth/login"](arg);
    if (r.isErr()) {
      return err(r.error);
    }
    this.#setProfile(r.value);
    return ok(r.value);
  }

  async ["auth/login_with_token"](arg: ServiceInput<"auth/login_with_token">) {
    this.reset();

    const r = await this.#api["auth/login_with_token"](arg);
    if (r.isErr()) {
      return err(r.error);
    }
    this.#setProfile(r.value);
    return ok(r.value);
  }

  async ["auth/logout"]() {
    const r = await this.#api["auth/logout"]();
    this.reset();
    if (r.isErr()) {
      return err(r.error);
    }
    storage.clearToken();
    return ok(r.value);
  }

  async ["users/find_users_to_add_as_contact"](
    arg: ServiceInput<"users/find_users_to_add_as_contact">
  ) {
    return this.#api["users/find_users_to_add_as_contact"](arg);
  }

  async ["users/topics"]() {
    return this.#api["users/topics"]();
  }

  async ["users/contact_status"]() {
    return this.#api["users/contact_status"]();
  }

  async ["group/add_members"](arg: ServiceInput<"group/add_members">) {
    return this.#api["group/add_members"](arg);
  }

  async ["users/create_user"](arg: ServiceInput<"users/create_user">) {
    return this.#api["users/create_user"](arg);
  }

  async ["group/find_new_members"](
    arg: ServiceInput<"group/find_new_members">
  ) {
    return this.#api["group/find_new_members"](arg);
  }

  async ["group/create_group"](arg: ServiceInput<"group/create_group">) {
    return this.#api["group/create_group"](arg);
  }

  async ["group/preview_info"](arg: ServiceInput<"group/preview_info">) {
    return this.#api["group/preview_info"](arg);
  }

  async ["group/members"](arg: ServiceInput<"group/members">) {
    return this.#api["group/members"](arg);
  }

  async ["group/invite_link"](arg: ServiceInput<"group/invite_link">) {
    return this.#api["group/invite_link"](arg);
  }

  async ["group/remove_member"](arg: ServiceInput<"group/remove_member">) {
    return this.#api["group/remove_member"](arg);
  }

  async ["group/leave_group"](arg: ServiceInput<"group/leave_group">) {
    return this.#api["group/leave_group"](arg);
  }

  async ["group/join_group_via_id"](
    arg: ServiceInput<"group/join_group_via_id">
  ) {
    return this.#api["group/join_group_via_id"](arg);
  }

  async ["group/join_group_via_invite_link"](
    arg: ServiceInput<"group/join_group_via_invite_link">
  ) {
    return this.#api["group/join_group_via_invite_link"](arg);
  }

  async ["group/am_i_group_member_of"](
    arg: ServiceInput<"group/am_i_group_member_of">
  ) {
    return this.#api["group/am_i_group_member_of"](arg);
  }

  async ["topic/reply_message"](arg: ServiceInput<"topic/reply_message">) {
    return this.#api["topic/reply_message"](arg);
  }

  async ["topic/delete_message"](arg: ServiceInput<"topic/delete_message">) {
    return this.#api["topic/delete_message"](arg);
  }

  async ["topic/clear_messages"](arg: ServiceInput<"topic/clear_messages">) {
    return this.#api["topic/clear_messages"](arg);
  }

  async ["topic/messages"](arg: ServiceInput<"topic/messages">) {
    return this.#api["topic/messages"](arg);
  }

  async ["topic/unread_messages"]() {
    return this.#api["topic/unread_messages"]();
  }

  async ["topic/get_messages_until_reply"](
    arg: ServiceInput<"topic/get_messages_until_reply">
  ) {
    return this.#api["topic/get_messages_until_reply"](arg);
  }

  async ["topic/has_messages_earlier_than"](
    arg: ServiceInput<"topic/has_messages_earlier_than">
  ) {
    return this.#api["topic/has_messages_earlier_than"](arg);
  }

  async ["topic/update_message_read_status"](
    arg: ServiceInput<"topic/update_message_read_status">
  ) {
    return this.#api["topic/update_message_read_status"](arg);
  }

  async ["topic/forward_message"](arg: ServiceInput<"topic/forward_message">) {
    return this.#api["topic/forward_message"](arg);
  }

  async ["topic/send_message"](arg: ServiceInput<"topic/send_message">) {
    return this.#api["topic/send_message"](arg);
  }

  async ["topic/preview_info"](arg: ServiceInput<"topic/preview_info">) {
    return this.#api["topic/preview_info"](arg);
  }

  async ["topic/notify_typing"](arg: ServiceInput<"topic/notify_typing">) {
    return this.#api["topic/notify_typing"](arg);
  }

  async ["permissions/update_user_default_permission"](
    arg: ServiceInput<"permissions/update_user_default_permission">
  ) {
    const r = await this.#api["permissions/update_user_default_permission"](
      arg
    );
    if (r.isErr()) {
      return err(r.error);
    }
    const p = this.#profile;
    if (p !== null) {
      this.#setProfile({
        ...p,
        defaultPermissions: r.value.defaultPermission,
      });
    }
    return ok(r.value);
  }

  async ["permissions/update_peer_permission"](
    arg: ServiceInput<"permissions/update_peer_permission">
  ) {
    return this.#api["permissions/update_peer_permission"](arg);
  }

  async ["permissions/block_peer"](
    arg: ServiceInput<"permissions/block_peer">
  ) {
    return this.#api["permissions/block_peer"](arg);
  }

  async ["permissions/update_group_default_permission"](
    arg: ServiceInput<"permissions/update_group_default_permission">
  ) {
    return this.#api["permissions/update_group_default_permission"](arg);
  }

  async ["permissions/update_group_member_permission"](
    arg: ServiceInput<"permissions/update_group_member_permission">
  ) {
    return this.#api["permissions/update_group_member_permission"](arg);
  }

  async ["permissions/get_group_member_permission"](
    arg: ServiceInput<"permissions/get_group_member_permission">
  ) {
    return this.#api["permissions/get_group_member_permission"](arg);
  }
}

const ClientContext = createContext<null | AppClient>(null);

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const { profile, setProfile } = useProfileStore();

  const appClient = new AppClient({
    profile,
    setProfile,
  });

  return (
    <ClientContext.Provider value={appClient}>
      {children}
    </ClientContext.Provider>
  );
}

export const useClientContext = () => useContext(ClientContext)!;
