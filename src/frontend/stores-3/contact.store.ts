import type {
  GroupTopicId,
  UserId,
} from "~/api-contract/subscription/subscription";
import type { LastMessageOfTopic } from "~/backend/service/topics/common/get-user-topics/get-last-message-of-topic.repo";
import type { ProfileSlice } from "~/frontend/stores/profile.store";
import type { AuthStatusSlice } from "~/frontend/stores/auth-status.store";
import { type StateCreator, create } from "zustand";
import { produce } from "immer";
import { ImmerStateCreator } from "~/frontend/stores-3/types";

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
  setContact: (
    setter: (state: Omit<ContactSlice, "setContact">) => void
  ) => void;
};

export const createContactSlice: ImmerStateCreator<
  ContactSlice & ProfileSlice & AuthStatusSlice,
  ContactSlice
> = (set) => ({
  p2p: new Map(),
  grp: new Map(),
  pastGrp: new Map(),
  newContacts: new Map(),
  setContact: (setter) => {
    set((s) =>
      setter({
        p2p: s.p2p,
        grp: s.grp,
        pastGrp: s.pastGrp,
        newContacts: s.newContacts,
      })
    );
  },
});
