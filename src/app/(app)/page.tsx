"use client";

import { err, ok } from "neverthrow";

import storage from "~/components/hooks/stores/local-storage";
import { ServiceInput } from "~/api-contract/types";
import { SignIn } from "~/components/experiments/SignIn";
import { useClientContext } from "~/components/hooks/stores/client";
import { useContactStore } from "~/components/hooks/stores/contact-status.store";
import { useLayoutToShowStore } from "~/components/hooks/stores/layout-to-show";
import { useHandleLoginSuccess } from "~/components/hooks/actions/handle-login-success.hook";
import {
  ContactList,
  ContactListProps,
} from "~/components/contact-list/ContactList";

export default function Page() {
  const layout = useLayoutToShowStore((s) => s.layout);

  if (layout === "login") {
    return <LoginPage />;
  }

  return <ContactPage />;
}

function LoginPage() {
  const client = useClientContext();

  const handleLoginSuccess = useHandleLoginSuccess();

  return (
    <SignIn
      login={async (data: ServiceInput<"auth/login">) => {
        const r = await client["auth/login"](data);
        if (r.isOk()) {
          storage.setToken(r.value.token);
        }

        return r;
      }}
      onLoginSuccess={async () => {
        return await handleLoginSuccess();
      }}
    />
  );
}

function ContactPage() {
  const contact = useContactStore();

  const contactList: ContactListProps["contactList"] = (() => {
    const grpTopics = Array.from(contact.grp.entries()).map(([id, p]) => {
      let typing = null;
      if (p.status.online) {
        typing = p.status.latestTyping;
      }
      return {
        type: "grp" as const,
        topicId: id,
        name: p.profile.name,
        description: p.profile.description,
        online: p.status.online,
        typing,
        profilePhotoUrl: p.profile.profilePhotoUrl,
        touchedAt: p.profile.touchedAt,
        lastMessage: p.profile.lastMessage,
      };
    });
    const p2pTopics = Array.from(contact.p2p.entries()).map(([id, p]) => {
      return {
        type: "p2p" as const,
        topicId: id,
        name: p.profile.name,
        description: p.profile.description,
        online: p.status.online,
        typing: p.status.online && p.status.typing,
        profilePhotoUrl: p.profile.profilePhotoUrl,
        touchedAt: p.profile.touchedAt,
        lastMessage: p.profile.lastMessage,
      };
    });
    const pastGrpTopics = Array.from(contact.pastGrp.entries()).map(
      ([id, p]) => {
        return {
          type: "past-grp" as const,
          topicId: id,
          name: p.profile.name,
          description: p.profile.description,
          profilePhotoUrl: p.profile.profilePhotoUrl,
          touchedAt: p.profile.touchedAt,
          lastMessage: p.profile.lastMessage,
        };
      }
    );
    const newTopics = Array.from(contact.newContacts.entries()).map(
      ([id, p]) => {
        return {
          type: "new-p2p-contact" as const,
          topicId: id,
          name: p.name,
          description: p.description,
          profilePhotoUrl: p.profilePhotoUrl,
          touchedAt: p.touchedAt,
        };
      }
    );

    const topicList = [
      ...grpTopics,
      ...p2pTopics,
      ...pastGrpTopics,
      ...newTopics,
    ].sort((a, b) => {
      if (a.touchedAt === null) {
        return 1;
      }
      if (b.touchedAt === null) {
        return -1;
      }
      return a.touchedAt > b.touchedAt ? -1 : 1;
    });

    return topicList;
  })();

  return <ContactList contactList={contactList} />;
}
