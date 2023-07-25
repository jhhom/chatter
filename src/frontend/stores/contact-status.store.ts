import { StateCreator } from "zustand";
import { ProfileSlice } from "~/frontend/stores/profile.store";
import type {
  GroupTopicId,
  UserId,
} from "~/api-contract/subscription/subscription";
import { LastMessageOfTopic } from "~/backend/service/topics/common/get-user-topics/get-last-message-of-topic.repo";
import { AuthStatusSlice } from "~/frontend/stores/auth-status.store";

type P2PContactStatus =
  | {
      online: true;
      typing: boolean;
    }
  | {
      online: false;
      lastOnline: Date | null;
    };

type GrpContactStatus =
  | {
      online: false;
    }
  | {
      online: true;
      typing: {
        id: UserId;
        fullname: string;
      }[];
      latestTyping: { id: UserId; fullname: string } | null;
    };

type ContactProfile = {
  name: string;
  description: string;
  userPermissions: string;
  touchedAt: null | Date;
  profilePhotoUrl: string | null;
  lastMessage: LastMessageOfTopic | null;
};

export type P2PContactProfile = {
  profile: ContactProfile & {
    peerPermissions: string;
  };
} & {
  status: P2PContactStatus;
};

export type GrpContactProfile = {
  profile: ContactProfile & {
    defaultPermissions: string;
    ownerId: UserId;
  };
} & {
  status: GrpContactStatus;
};

export type PastGrpContactProfile = {
  profile: {
    name: string;
    description: string;
    touchedAt: null | Date;
    profilePhotoUrl: string | null;
    lastMessage: LastMessageOfTopic | null;
  };
};

export type ContactSlice = {
  p2p: Map<UserId, P2PContactProfile>;
  grp: Map<GroupTopicId, GrpContactProfile>;
  pastGrp: Map<GroupTopicId, PastGrpContactProfile>;
  newContacts: Map<UserId, ContactProfile>;
  deleteNewContact: (userId: UserId) => void;
  deleteGrp: (groupId: GroupTopicId) => void;
  deletePastGrp: (groupId: GroupTopicId) => void;
  setP2PContact: (userId: UserId, profile: P2PContactProfile) => void;
  setGrpContact: (
    groupTopicId: GroupTopicId,
    profile: GrpContactProfile
  ) => void;
  setPastGrpContact: (
    groupTopicId: GroupTopicId,
    profile: PastGrpContactProfile
  ) => void;
  addNewContact: (userId: UserId, profile: ContactProfile) => void;
  addCreatedGroupContact: (
    groupTopicId: GroupTopicId,
    profile: GrpContactProfile["profile"]
  ) => void;
  clearContacts: (
    contact: "p2p" | "grp" | "pastGrp" | "newContacts" | "all"
  ) => void;
};

export const createContactSlice: StateCreator<
  ContactSlice & ProfileSlice & AuthStatusSlice,
  [],
  [],
  ContactSlice
> = (set) => ({
  p2p: new Map(),
  grp: new Map(),
  pastGrp: new Map(),
  newContacts: new Map(),
  clearContacts: (
    contact: "p2p" | "grp" | "pastGrp" | "newContacts" | "all"
  ) => {
    if (contact === "p2p") {
      set(() => {
        return { p2p: new Map() };
      });
    } else if (contact === "grp") {
      set(() => {
        return { grp: new Map() };
      });
    } else if (contact === "pastGrp") {
      set(() => {
        return { pastGrp: new Map() };
      });
    } else if (contact === "newContacts") {
      set(() => {
        return { newContacts: new Map() };
      });
    } else {
      set(() => {
        return {
          p2p: new Map(),
          grp: new Map(),
          pastGrp: new Map(),
          newContacts: new Map(),
        };
      });
    }
  },
  deleteGrp: (groupId) => {
    set((state) => {
      const newMap = new Map(state.grp);
      newMap.delete(groupId);
      return { grp: newMap };
    });
  },
  deleteNewContact: (userId: UserId) => {
    set((state) => {
      const newMap = new Map(state.newContacts);
      newMap.delete(userId);
      return { newContacts: newMap };
    });
  },
  deletePastGrp: (groupId) => {
    set((state) => {
      const newMap = new Map(state.pastGrp);
      newMap.delete(groupId);
      return { pastGrp: newMap };
    });
  },
  setP2PContact: (userId: UserId, profile: P2PContactProfile) => {
    set((state) => {
      console.log("STATE", state.p2p);
      const newMap = new Map(state.p2p);
      newMap.set(userId, profile);
      return { p2p: newMap };
    });
  },
  setGrpContact: (groupTopicId: GroupTopicId, profile: GrpContactProfile) => {
    set((state) => {
      const newMap = new Map(state.grp);
      newMap.set(groupTopicId, profile);
      return { grp: newMap };
    });
  },
  setPastGrpContact: (
    groupTopicId: GroupTopicId,
    profile: PastGrpContactProfile
  ) => {
    set((state) => {
      const newMap = new Map(state.pastGrp);
      newMap.set(groupTopicId, profile);
      return { pastGrp: newMap };
    });
  },
  addNewContact(userId, profile) {
    set((state) => {
      const newMap = new Map(state.newContacts);
      newMap.set(userId, profile);
      return { newContacts: newMap };
    });
  },
  addCreatedGroupContact(groupTopicId, profile) {
    set((state) => {
      const newMap = new Map(state.grp);
      newMap.set(groupTopicId, {
        profile,
        status: {
          online: false,
        },
      });
      return { grp: newMap };
    });
  },
});
