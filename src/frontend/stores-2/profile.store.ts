import type { UserId } from "~/api-contract/subscription/subscription";
import { create } from "zustand";
import { produce } from "immer";

type Profile = {
  userId: UserId;
  username: string;
  email: string;
  fullname: string;
  defaultPermissions: string;
  profilePhotoUrl: string | null;
};

type ProfileStore = {
  profile: Profile | null;
  setProfile: (setter: (p: ProfileStore["profile"]) => void) => void;
};

export const useProfileStore = create<ProfileStore>((set) => ({
  profile: null,
  setProfile: (setter) => {
    set(produce((state: ProfileStore) => setter(state.profile)));
  },
}));
