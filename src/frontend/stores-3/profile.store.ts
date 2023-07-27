import { create } from "zustand";
import { ContactSlice } from "./contact.store";
import { AuthStatusSlice } from "./auth-status.store";
import { ImmerStateCreator } from "./types";
// import { produce } from "immer";

type Profile = {
  profile: {
    username: string;
    email: string;
    fullname: string;
    defaultPermissions: string;
    profilePhotoUrl: string | null;
  };
};

export type ProfileSlice = {
  profile: Profile | null;
};

export const useProfileStore = create<ProfileSlice>(() => ({
  profile: null,
}));

export const createProfileSlice: ImmerStateCreator<
  ProfileSlice & ContactSlice & AuthStatusSlice,
  ProfileSlice
> = () => ({
  profile: null,
});
