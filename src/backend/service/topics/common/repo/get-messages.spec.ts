import {
  CamelCasePlugin,
  Insertable,
  Kysely,
  PostgresDialect,
  sql,
} from "kysely";
import { expect, describe, test } from "vitest";
import { Pool } from "pg";
import { testUtil } from "~/backend/service/test-utils/test-utils";

import { DB } from "~/backend/schema";
import { sendMessage } from "~/backend/service/topics/send-message/send-message.service";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { replyMessage } from "~/backend/service/topics/reply-message/reply-message.service";
import { getMessages } from "~/backend/service/topics/get-messages/get-messages";

// 1. seed users
// 2. seed messages
// 3. get messages

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: config.DB_URL,
    max: 10,
  }),
});

const db = new Kysely<DB>({
  dialect,
  log(event) {
    if (event.level === "query") {
      console.log(event.query.sql);
      console.log(event.query.parameters);
    }
  },
  plugins: [new CamelCasePlugin()],
});

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
      { projectRoot: "" }
    );

    const m = (
      await getMessages(db, {
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
