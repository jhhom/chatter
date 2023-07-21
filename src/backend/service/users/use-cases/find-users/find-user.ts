import { AppPgDatabase } from "~/backend/drizzle/db";
import { findUsers } from "./find-user.repo";
import { ServiceResult } from "~/api-contract/types";

export async function findUsersToAddContact(
  ctx: {
    db: AppPgDatabase;
  },
  input: {
    email: string | undefined;
  }
): ServiceResult<"users/find_users_to_add_as_contact"> {
  return findUsers(ctx, input);
}
