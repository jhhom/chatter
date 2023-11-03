import { type StateCreator } from "zustand";

// Reference: https://github.com/pmndrs/zustand/discussions/1796
export type ImmerStateCreator<T, U = T> = StateCreator<
  T,
  [["zustand/immer", never], never],
  [],
  U
>;
