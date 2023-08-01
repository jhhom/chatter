import { expect, describe, test } from "vitest";
import {
  peerConversationDisplayMode,
  userPeerConversationDisplayMode,
} from "./utils";

describe("Permission", () => {
  test("Peer permission cannot write", () => {
    const p = userPeerConversationDisplayMode("JPR", "JRWP", false, () => {
      // empty
    });
    expect(p.type).toBe(peerConversationDisplayMode["WRITE_DISABLED"]);
  });
});
