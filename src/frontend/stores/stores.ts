import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  type AfterLoginNavigateToSlice,
  createAfterLoginNavigateToStore,
} from "~/frontend/stores/after-login-navigate-to.store";
import {
  type AuthStatusSlice,
  createAuthStatusSlice,
} from "~/frontend/stores/auth-status.store";
import {
  type ContactSlice,
  createContactSlice,
} from "~/frontend/stores/contact.store";
import {
  type ProfileSlice,
  createProfileSlice,
} from "~/frontend/stores/profile.store";

// Reference: https://github.com/pmndrs/zustand/discussions/1796
export const useAppStore = create(
  immer<
    ContactSlice & ProfileSlice & AuthStatusSlice & AfterLoginNavigateToSlice
  >((...a) => ({
    ...createContactSlice(...a),
    ...createProfileSlice(...a),
    ...createAfterLoginNavigateToStore(...a),
    ...createAuthStatusSlice(...a),
  }))
);
