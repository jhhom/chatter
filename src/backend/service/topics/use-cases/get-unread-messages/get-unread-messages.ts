import { AppPgDatabase } from "~/backend/drizzle/db";
import { getAllUnreadMessages as db_getAllUnreadMessages } from "./get-unread-messages.repo";
import { UserId } from "~/backend/drizzle/schema";
import { ServiceResult } from "~/api-contract/types";

export async function getAllUnreadMessages(
  ctx: { db: AppPgDatabase },
  input: {
    userId: UserId;
  }
): ServiceResult<"topic/unread_messages"> {
  return db_getAllUnreadMessages(ctx.db, input);
}
