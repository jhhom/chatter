import { create } from "zustand";
import {
  AuthStatusSlice,
  createAuthStatusSlice,
} from "~/frontend/stores/auth-status.store";
import {
  type ContactSlice,
  createContactSlice,
} from "~/frontend/stores/contact-status.store";
import {
  type ProfileSlice,
  createProfileSlice,
} from "~/frontend/stores/profile.store";

export const useAppStore = create<
  ContactSlice & ProfileSlice & AuthStatusSlice
>()((...a) => ({
  ...createContactSlice(...a),
  ...createProfileSlice(...a),
  ...createAuthStatusSlice(...a),
}));
