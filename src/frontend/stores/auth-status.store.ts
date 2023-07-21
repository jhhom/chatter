import { StateCreator } from "zustand";
import { ContactSlice } from "~/frontend/stores/contact-status.store";
import { ProfileSlice } from "~/frontend/stores/profile.store";

type AuthStatus = "loading" | "logged-out" | "logged-in";

export type AuthStatusSlice = {
  authStatus: AuthStatus;
  setAuthStatus: (s: AuthStatus) => void;
};

export const createAuthStatusSlice: StateCreator<
  ContactSlice & ProfileSlice & AuthStatusSlice,
  [],
  [],
  AuthStatusSlice
> = (set) => ({
  authStatus: "loading",
  setAuthStatus: (s) => set({ authStatus: s }),
});
