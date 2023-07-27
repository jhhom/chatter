import { type StateCreator } from "zustand";

export type ImmerStateCreator<T, U = T> = StateCreator<
  T,
  [["zustand/immer", never], never],
  [],
  U
>;
