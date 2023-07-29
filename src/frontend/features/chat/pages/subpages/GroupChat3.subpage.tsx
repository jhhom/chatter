import { useState, useRef, useEffect, useCallback } from "react";
import { ok, err, fromPromise } from "neverthrow";
import type { GroupTopicId } from "~/api-contract/subscription/subscription";

import { useAppStore } from "~/frontend/stores/stores";

export function GroupChatPage3(props: { contactId: GroupTopicId }) {
  const store = useAppStore((s) => ({
    grp: s.grp.get(props.contactId),
  }));
  useEffect(() => {
    console.log("🔥 STORE GRP CHANGE", store.grp);
  }, [store.grp]);

  return (
    <div className="relative flex h-screen">
      <p>Group Chat 3</p>
    </div>
  );
}
