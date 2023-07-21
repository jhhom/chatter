import { StateCreator } from "zustand";
import { UserId } from "~/api-contract/subscription/subscription";

import { ContactSlice } from "~/frontend/stores/contact-status.store";

export type ProfileSlice = {
  profile:
    | {
        userId: UserId;
        username: string;
        email: string;
        fullname: string;
        defaultPermissions: string;
        profilePhotoUrl: string | null;
      }
    | undefined;
};

export const createProfileSlice: StateCreator<
  ProfileSlice & ContactSlice,
  [],
  [],
  ProfileSlice
> = (set) => ({
  profile: undefined,
});
