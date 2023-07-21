import { create } from "zustand";

import { GroupTopicId, UserId } from "~/backend/drizzle/schema";
import { LastMessageOfTopic } from "~/backend/service/topics/use-cases/get-user-topics/get-last-message-of-topic";

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

type P2PContactProfile = {
  profile: ContactProfile & {
    peerPermissions: string;
  };
} & {
  status: P2PContactStatus;
};

type GrpContactProfile = {
  profile: ContactProfile & {
    defaultPermissions: string;
    ownerId: UserId;
  };
} & {
  status: GrpContactStatus;
};

type PastGrpContactProfile = {
  profile: {
    name: string;
    description: string;
    touchedAt: null | Date;
    profilePhotoUrl: string | null;
    lastMessage: LastMessageOfTopic | null;
  };
};

export const useContactStore = create<{
  p2p: Map<UserId, P2PContactProfile>;
  grp: Map<GroupTopicId, GrpContactProfile>;
  pastGrp: Map<GroupTopicId, PastGrpContactProfile>;
  newContacts: Map<UserId, ContactProfile>;
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
  clearContact: (contact: "p2p" | "grp" | "pastGrp" | "newContacts") => void;
}>((set) => ({
  p2p: new Map(),
  grp: new Map(),
  pastGrp: new Map(),
  newContacts: new Map(),
  clearContact: (contact: "p2p" | "grp" | "pastGrp" | "newContacts") => {
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
    } else {
      set(() => {
        return { newContacts: new Map() };
      });
    }
  },
  setP2PContact: (userId: UserId, profile: P2PContactProfile) => {
    set((state) => {
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
}));
