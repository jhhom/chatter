import type { ContactSlice } from "./contact.store";
import type { ProfileSlice } from "./profile.store";
import type { AuthStatusSlice } from "~/frontend/stores/auth-status.store";
import type { ImmerStateCreator } from "./types";

export type AfterLoginNavigateToSlice = {
  afterLoginNavigateTo: string | null;
  setAfterLoginNavigateTo: (s: string | null) => void;
};

export const createAfterLoginNavigateToStore: ImmerStateCreator<
  ContactSlice & ProfileSlice & AuthStatusSlice & AfterLoginNavigateToSlice,
  AfterLoginNavigateToSlice
> = (set) => ({
  afterLoginNavigateTo: null,
  setAfterLoginNavigateTo: (navigateTo) =>
    set((s) => {
      s.afterLoginNavigateTo = navigateTo;
    }),
});
