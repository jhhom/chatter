import React from "react";
import {
  ContactList,
  ContactListProps,
} from "~/components/contact-list/ContactList";

const data: ContactListProps["contactList"] = [
  {
    type: "grp",
    topicId: "grp5nmh6bxqs3cm",
    name: "HS Tutor Group 1",
    description: "",
    online: false,
    typing: null,
    profilePhotoUrl: null,
    touchedAt: new Date("2023-07-07T02:16:50.483Z"),
    lastMessage: {
      type: "message",
      content:
        "It's an exhibit on modern art. I'm thinking of checking it out this weekend.",
      sequenceId: 175,
    },
  },
  {
    type: "p2p",
    topicId: "usr_______FRANK",
    name: "Frank Singer",
    description: "",
    online: false,
    typing: false,
    profilePhotoUrl: null,
    touchedAt: new Date("2023-07-07T02:16:50.457Z"),
    lastMessage: {
      type: "message",
      content:
        "I couldn't agree more. Let's keep each other posted on any job opportunities we come across in Singapore, and maybe we can even explore the city together if we end up living there!",
      sequenceId: 132,
    },
  },
  {
    type: "p2p",
    topicId: "usr_________EVE",
    name: "Eve Adamas",
    description: "",
    online: false,
    typing: false,
    profilePhotoUrl: null,
    touchedAt: new Date("2023-07-07T02:16:50.439Z"),
    lastMessage: {
      type: "message",
      content:
        "Hey Eve, I'm inviting you to my sister's wedding, please RSVP before 11th March",
      sequenceId: 17,
    },
  },
  {
    type: "p2p",
    topicId: "usr_______ALICE",
    name: "Alice Hatter",
    description: "",
    online: false,
    typing: false,
    profilePhotoUrl: null,
    touchedAt: new Date("2023-07-07T02:16:50.409Z"),
    lastMessage: {
      type: "message",
      content: "🔥 Haven't gone to a party in such a long time!",
      sequenceId: 16,
    },
  },
];

export default function Page() {
  return (
    <div className="w-[22rem]">
      <ContactList contactList={data} />;
    </div>
  );
}
