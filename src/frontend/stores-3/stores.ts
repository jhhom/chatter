import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  type AuthStatusSlice,
  createAuthStatusSlice,
} from "~/frontend/stores-3/auth-status.store";
import {
  type ContactSlice,
  createContactSlice,
} from "~/frontend/stores-3/contact.store";
import {
  type ProfileSlice,
  createProfileSlice,
} from "~/frontend/stores-3/profile.store";

export const useAppStore = create(
  immer<ContactSlice & ProfileSlice & AuthStatusSlice>((...a) => ({
    ...createContactSlice(...a),
    ...createProfileSlice(...a),
    ...createAuthStatusSlice(...a),
  }))
);
