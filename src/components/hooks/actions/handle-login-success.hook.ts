import { ok, err } from "neverthrow";

import { useClientContext } from "~/components/hooks/stores/client";
import { useContactStore } from "~/components/hooks/stores/contact-status.store";
import { useLayoutToShowStore } from "~/components/hooks/stores/layout-to-show";

export function useHandleLoginSuccess() {
  const client = useClientContext();
  const contact = useContactStore();
  const setLayout = useLayoutToShowStore((s) => s.setLayout);

  const handleLoginSuccess = async () => {
    {
      const r = await client["users/topics"]();
      if (r.isErr()) {
        return err(r.error);
      }
      contact.clearContact("grp");
      contact.clearContact("p2p");
      contact.clearContact("pastGrp");

      for (const t of r.value) {
        if (t.type == "p2p") {
          contact.setP2PContact(t.topicId, {
            profile: {
              name: t.topicName,
              description: "",
              touchedAt: t.touchedAt,
              peerPermissions: t.peerPermissions,
              userPermissions: t.userPermissions,
              profilePhotoUrl: t.profilePhotoUrl,
              lastMessage: t.lastMessage,
            },
            status: {
              lastOnline: t.lastOnline,
              online: false,
            },
          });
        } else if (t.type == "grp") {
          contact.setGrpContact(t.topicId, {
            profile: {
              defaultPermissions: t.defaultPermissions,
              name: t.topicName,
              description: "",
              touchedAt: t.touchedAt,
              userPermissions: t.userPermissions,
              profilePhotoUrl: t.profilePhotoUrl,
              lastMessage: t.lastMessage,
              ownerId: t.ownerId,
            },
            status: {
              online: false,
            },
          });
        } else {
          contact.setPastGrpContact(t.topicId, {
            profile: {
              name: t.topicName,
              description: "",
              touchedAt: t.touchedAt,
              profilePhotoUrl: t.profilePhotoUrl,
              lastMessage: t.lastMessage,
            },
          });
        }
      }
    }

    {
      const r = await client["users/contact_status"]();
      if (r.isErr()) {
        contact.clearContact("grp");
        contact.clearContact("p2p");
        contact.clearContact("pastGrp");
        return err(r.error);
      }

      for (const s of r.value.groupContactStatus) {
        const c = contact.grp.get(s.topicId);
        if (c == undefined) {
          continue;
        }
        if (s.online) {
          contact.setGrpContact(s.topicId, {
            ...c,
            status: {
              online: s.online,
              typing: [],
              latestTyping: null,
            },
          });
        } else {
          contact.setGrpContact(s.topicId, {
            ...c,
            status: { online: s.online },
          });
        }
      }
      for (const s of r.value.p2pContactStatus) {
        const c = contact.p2p.get(s.topicId);
        if (c == undefined) {
          continue;
        }
        if (s.online) {
          contact.setP2PContact(s.topicId, {
            ...c,
            status: {
              online: s.online,
              typing: s.typing ?? false,
            },
          });
        } else {
          contact.setP2PContact(s.topicId, {
            ...c,
            status: { online: s.online, lastOnline: s.lastOnline },
          });
        }
      }
    }

    setLayout("sidebar");

    return ok({});
  };

  return handleLoginSuccess;
}
