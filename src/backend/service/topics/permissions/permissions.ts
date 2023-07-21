import { KyselyDB, KyselyTransaction } from "~/backend/schema";
import { GroupTopicId, UserId } from "~/api-contract/subscription/subscription";
import { ok, err, fromPromise } from "neverthrow";
import { AppError } from "~/api-contract/errors/errors";
import { getPermissionInP2PTopic } from "~/backend/service/auth/common/repo";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { permission } from "~/backend/service/common/permissions";
import { ServiceResult } from "~/api-contract/types";


export function getUserDefaultPermission(
  db: KyselyDB | KyselyTransaction,
  arg: {
    userId: UserId;
  }
) {
  return fromPromise(
    db
      .selectFrom("users")
      .select("users.defaultPermissions")
      .where("users.id", "=", arg.userId)
      .executeTakeFirstOrThrow(),
    (e) => e
  );
}

export function getPeerPermission(
  db: KyselyDB,
  arg: {
    /** the user making the request */
    requesterUserId: UserId;
    /** peer id of which the permission is requested of */
    peerId: UserId;
  }
) {
  return getPermissionInP2PTopic(db, {
    peer1: arg.requesterUserId,
    peer2: arg.peerId,
    permissionRequested: "peer2",
  });
}



export function isPermissionStringValid(input: string): boolean {
  const validCharacters = ["J", "R", "W", "P", "S", "D", "A"];

  // Check if the string contains any invalid characters
  for (const char of input) {
    if (!validCharacters.includes(char)) {
      return false;
    }
  }

  // Check if the string contains repeating characters
  const hasRepeatingCharacters = new Set(input).size != input.length;

  return !hasRepeatingCharacters;
}
