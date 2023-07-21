import { KyselyDB } from "~/backend/schema";
import { GroupTopicId } from "~/api-contract/subscription/subscription";
import { fromPromise, ok, err } from "neverthrow";
import { faker } from "@faker-js/faker";
import { AppError } from "~/api-contract/errors/errors";
import { ServiceResult } from "~/api-contract/types";

export async function getGroupInviteLink(
  db: KyselyDB,
  groupTopicId: GroupTopicId
): ServiceResult<"group/invite_link"> {
  const r = await fromPromise(
    db
      .selectFrom("groupTopicMeta")
      .select("inviteLink")
      .where("topicId", "=", groupTopicId)
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (r.isErr()) {
    return err(r.error);
  }

  if (r.value.inviteLink !== null) {
    return ok({ inviteLink: r.value.inviteLink });
  }

  const updateResult = await fromPromise(
    db
      .updateTable("groupTopicMeta")
      .set({
        inviteLink: faker.random.alphaNumeric(15),
      })
      .where("topicId", "=", groupTopicId)
      .returning("inviteLink")
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) => ({
    inviteLink: v.inviteLink!,
  }));
  return updateResult;
}
