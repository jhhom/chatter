import { AppPgDatabase } from "~/backend/drizzle/db";
import { UserId } from "~/backend/drizzle/schema";
import { getUserTopics } from "./get-user-topics.repo";
import { ServiceResult } from "~/api-contract/types";

export function getTopicsOfUser(
  ctx: { db: AppPgDatabase },
  input: { userId: UserId }
): ServiceResult<"users/topics"> {
  return getUserTopics(ctx, input);
}
