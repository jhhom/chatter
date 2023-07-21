import { create } from "zustand";

export const useLoginSuccessfulNavigationTargetStore = create<{
  navigateTo: string | null;
  setNavigateTo: (navigateTo: string | null) => void;
}>((set) => ({
  navigateTo: null,
  setNavigateTo: (navigateTo) => {
    set(() => {
      return {
        navigateTo,
      };
    });
  },
}));
