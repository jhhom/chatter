import { ContactSlice } from "./contact.store";
import { ProfileSlice } from "./profile.store";
import { ImmerStateCreator } from "./types";

type AuthStatus = "loading" | "logged-out" | "logged-in";

export type AuthStatusSlice = {
  authStatus: AuthStatus;
  setAuthStatus: (s: AuthStatus) => void;
};

export const createAuthStatusSlice: ImmerStateCreator<
  ContactSlice & ProfileSlice & AuthStatusSlice,
  AuthStatusSlice
> = (set) => ({
  authStatus: "loading",
  setAuthStatus: (status) => set((s) => (s.authStatus = status)),
});
