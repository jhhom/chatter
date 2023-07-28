import { create } from "zustand";
import { ContactSlice } from "./contact.store";
import { AuthStatusSlice } from "./auth-status.store";
import { ImmerStateCreator } from "./types";
import { UserId } from "~/api-contract/subscription/subscription";
// import { produce } from "immer";

type Profile = {
  profile: {
    userId: UserId;
    username: string;
    email: string;
    fullname: string;
    defaultPermissions: string;
    profilePhotoUrl: string | null;
  } | null;
};

export type ProfileSlice = {
  profile: Profile;
  setProfile: (p: Profile["profile"]) => void;
};

export const useProfileStore = create<ProfileSlice>(() => ({
  profile: {
    profile: null,
  },
  setProfile: () => {
    //
  },
}));

export const createProfileSlice: ImmerStateCreator<
  ProfileSlice & ContactSlice & AuthStatusSlice,
  ProfileSlice
> = (set) => ({
  profile: {
    profile: null,
  },
  setProfile(profile) {
    set({
      profile: {
        profile,
      },
    });
  },
});
