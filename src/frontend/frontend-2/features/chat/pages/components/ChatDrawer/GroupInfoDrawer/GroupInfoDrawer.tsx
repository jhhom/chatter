import { useState } from "react";
import type { UserId } from "~/api-contract/subscription/subscription";

import ChatInfoDrawer from "~/frontend/frontend-2/features/chat/pages/components/ChatDrawer/Drawer";

type Content =
  | "display-info"
  | "add-member"
  | "security"
  | "invite-link"
  | "member-security";

export default function GroupInfoDrawer(props: {
  onClose: () => void;
  children: (props: {
    content: Content;
    checkingOutMember: UserId | null;
    setContent: (content: Content) => void;
    setCheckingOutMember: (userId: UserId | null) => void;
    memberSecurityContentEditable: boolean;
    setMemberSecurityContentEditable: (editable: boolean) => void;
  }) => React.ReactNode;
}) {
  const [content, setContent] = useState<Content>("display-info");
  const [checkingOutMember, setCheckingOutMember] = useState<UserId | null>(
    null
  );
  const [memberSecurityContentEditable, setMemberSecurityContentEditable] =
    useState(false);

  return (
    <ChatInfoDrawer onClose={props.onClose}>
      {props.children({
        content: content,
        setContent,
        checkingOutMember: checkingOutMember,
        setCheckingOutMember,
        memberSecurityContentEditable: memberSecurityContentEditable,
        setMemberSecurityContentEditable,
      })}
    </ChatInfoDrawer>
  );
}
