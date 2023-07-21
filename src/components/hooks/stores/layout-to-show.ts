import { create } from "zustand";

export const useLayoutToShowStore = create<{
  layout: "login" | "sidebar";
  setLayout: (layout: "login" | "sidebar") => void;
}>((set) => ({
  layout: "login",
  setLayout: (layout) => {
    set(() => {
      return {
        layout,
      };
    });
  },
}));
