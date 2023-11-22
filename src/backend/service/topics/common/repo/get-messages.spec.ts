import {
  CamelCasePlugin,
  Insertable,
  Kysely,
  PostgresDialect,
  sql,
} from "kysely";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { setupDb, testUtil } from "~/backend/service/test-utils/test-utils";

import { DB } from "~/backend/schema";
import { sendMessage } from "~/backend/service/topics/send-message/send-message.service";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { replyMessage } from "~/backend/service/topics/reply-message/reply-message.service";
import { getMessages } from "~/backend/service/topics/get-messages/get-messages";
import { loadConfig } from "~/config/config";

// 1. seed users
// 2. seed messages
// 3. get messages

const config = loadConfig("test");
if (config.isErr()) {
  throw config.error;
}

const db = setupDb(config.value.DATABASE_URL);

describe("Get messages", () => {
  test("get messages with reply", async () => {
    // 1. ARRANGE
    await sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE;`.execute(db);

    const seedResult = await testUtil.seed(db);
    if (seedResult.isErr()) {
      throw seedResult.error;
    }
    const [seededUsers, _] = seedResult.value;

    (
      await sendMessage(
        { db, currentOnlineUsers: new OnlineUsers() },
        {
          content: {
            type: "text",
            content: "Hello bob",
          },
          topicId: seededUsers.bob.id,
          authorId: seededUsers.carol.id,
        },
        { projectRoot: "" }
      )
    )._unsafeUnwrap();

    const helloBobMessage = await db
      .selectFrom("messages")
      .selectAll()
      .where("authorId", "=", seededUsers.carol.id)
      .orderBy("id", "desc")
      .limit(1)
      .executeTakeFirstOrThrow();

    await replyMessage(
      { db, currentOnlineUsers: new OnlineUsers() },
      {
        content: {
          type: "text",
          content: "Hello to you carol!!",
        },
        topicId: seededUsers.carol.id,
        authorId: seededUsers.bob.id,
        replyToMessageSeqId: helloBobMessage.sequenceId,
      },
      { assetServerUrl: config.value.DATABASE_URL, projectRoot: "" }
    );

    const m = (
      await getMessages(db, config.value.DATABASE_URL, {
        requesterUserId: seededUsers.carol.id,
        topicId: seededUsers.bob.id,
        beforeSequenceId: 99999,
        numberOfMessages: 24,
      })
    )._unsafeUnwrap();

    const bobMessage = m.msgs[1];

    console.log(bobMessage.content);

    expect(
      bobMessage.type === "message" &&
        bobMessage.content.type === "text" &&
        bobMessage.content.replyTo !== null
    ).toBeTruthy();
  });
});
