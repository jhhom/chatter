import { AppPgDatabase } from "~/backend/drizzle/db";
import { eq } from "drizzle-orm";
import { GroupTopicId, groupTopicMeta } from "~/backend/drizzle/schema";
import { fromPromise, ok, err } from "neverthrow";
import { faker } from "@faker-js/faker";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function getGroupInviteLink(
  db: AppPgDatabase,
  arg: {
    groupTopicId: GroupTopicId;
  }
): ServiceResult<"group/invite_link"> {
  const r = await fromPromise(
    db
      .select({
        inviteLink: groupTopicMeta.inviteLink,
      })
      .from(groupTopicMeta)
      .where(eq(groupTopicMeta.topicId, arg.groupTopicId)),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (r.isErr()) {
    return err(r.error);
  }

  if (r.value.length == 0) {
    return err(new AppError("RESOURCE_NOT_FOUND", { resource: "group meta" }));
  }

  const grp = r.value[0];

  if (grp.inviteLink === null) {
    const updateResult = await fromPromise(
      db
        .update(groupTopicMeta)
        .set({
          inviteLink: faker.random.alphaNumeric(15),
        })
        .where(eq(groupTopicMeta.topicId, arg.groupTopicId))
        .returning({ inviteLink: groupTopicMeta.inviteLink }),
      (e) => new AppError("DATABASE", { cause: e })
    );
    if (updateResult.isErr()) {
      return err(updateResult.error);
    }
    if (updateResult.value.length == 0) {
      return err(
        new AppError("RESOURCE_NOT_FOUND", { resource: "updated group meta" })
      );
    }
    return ok({ inviteLink: updateResult.value[0].inviteLink! });
  }

  return ok({ inviteLink: grp.inviteLink! });
}
