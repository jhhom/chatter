import { KyselyDB } from "~/backend/schema";
import { ServiceResult } from "~/api-contract/types";
import { fromPromise } from "neverthrow";
import { AppError } from "~/api-contract/errors/errors";
import { completeMediaUrl } from "~/backend/service/common/media";

export async function findUsersToAddContact(
  db: KyselyDB,
  email: string | undefined
): ServiceResult<"users/find_users_to_add_as_contact"> {
  let query = db.selectFrom("users").selectAll();
  if (email !== undefined) {
    query = query.where("email", "ilike", `%${email}%`);
  }
  return fromPromise(
    query.execute(),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) =>
    v.map((u) => {
      const r = {
        ...u,
        passwordHash: undefined,
        profilePhotoUrl: u.profilePhotoUrl
          ? completeMediaUrl(u.profilePhotoUrl)
          : null,
      };
      delete r["passwordHash"];
      return r;
    })
  );
}
