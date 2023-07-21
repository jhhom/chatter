import { StateCreator } from "zustand";
import { UserId } from "~/api-contract/subscription/subscription";
import { AuthStatusSlice } from "~/frontend/stores/auth-status.store";

import { ContactSlice } from "~/frontend/stores/contact-status.store";

type Profile = {
  userId: UserId;
  username: string;
  email: string;
  fullname: string;
  defaultPermissions: string;
  profilePhotoUrl: string | null;
};

export type ProfileSlice = {
  profile: Profile | undefined;
  setProfile: (p: Profile | undefined) => void;
};

export const createProfileSlice: StateCreator<
  ProfileSlice & ContactSlice & AuthStatusSlice,
  [],
  [],
  ProfileSlice
> = (set) => ({
  profile: undefined,
  setProfile: (profile: Profile | undefined) => {
    set({ profile });
  },
});
