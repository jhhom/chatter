import { create } from "zustand";
import { type UserId } from "~/api-contract/subscription/subscription";

export type MemberProfile = {
  name: string;
  online: boolean;
  profilePhotoUrl: string | null;
};

export const useMemberStore = create<{
  members: Map<UserId, MemberProfile>;
  setMember: (id: UserId, profile: MemberProfile) => void;
}>((set) => ({
  members: new Map(),
  setMember: (id: UserId, profile: MemberProfile) =>
    set((s) => {
      const members = new Map(s.members);
      members.set(id, profile);
      return { members };
    }),
}));
