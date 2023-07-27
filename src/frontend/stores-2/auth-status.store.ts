import { create } from "zustand";

type AuthStatus = "loading" | "logged-out" | "logged-in";

export type AuthStatusSlice = {
  authStatus: AuthStatus;
  setAuthStatus: (s: AuthStatus) => void;
};

export const useAuthStatusStore = create((set) => ({
  authStatus: false,
  setAuthStatus: (authStatus: boolean) => {
    set(() => ({ authStatus }));
  },
}));
