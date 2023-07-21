import { create } from "zustand";
import {
  type ContactSlice,
  createContactSlice,
} from "~/frontend/stores/contact-status.store";
import {
  type ProfileSlice,
  createProfileSlice,
} from "~/frontend/stores/profile.store";

export const useContactStore = create<ContactSlice & ProfileSlice>()(
  (...a) => ({
    ...createContactSlice(...a),
    ...createProfileSlice(...a),
  })
);
