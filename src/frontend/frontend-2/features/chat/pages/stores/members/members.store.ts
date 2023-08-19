import { create } from "zustand";
import { type UserId } from "~/api-contract/subscription/subscription";

export type MemberProfile = {
  name: string;
  online: boolean;
  profilePhotoUrl: string | null;
};

export const useMembersStore = create<{
  members: Map<UserId, MemberProfile>;
  getMembers: () => Map<UserId, MemberProfile>;
  setMember: (id: UserId, profile: MemberProfile) => void;
  deleteMember: (id: UserId) => void;
  clear: () => void;
}>((set, get) => ({
  members: new Map(),
  getMembers: () => get().members,
  setMember: (id: UserId, profile: MemberProfile) =>
    set((s) => {
      const members = new Map(s.members);
      members.set(id, profile);
      return { members };
    }),
  deleteMember: (id) => {
    set((s) => {
      const members = new Map(s.members);
      members.delete(id);
      return { members };
    });
  },
  clear: () => {
    set(() => {
      return { members: new Map() };
    });
  },
}));
