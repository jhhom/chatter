import {
  CamelCasePlugin,
  Insertable,
  Kysely,
  PostgresDialect,
  sql,
} from "kysely";
import {
  DB,
  KyselyDB,
  KyselyTransaction,
  Messages,
  Subscriptions,
  Topics,
  Users,
} from "~/backend/schema";
import { fromPromise, ok, err } from "neverthrow";
import {
  GroupTopicId,
  P2PTopicId,
  UserId,
} from "~/api-contract/subscription/subscription";
import * as bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";
import { Pool } from "pg";

type SeedUser = Omit<
  Insertable<Users>,
  "id" | "passwordHash" | "updatedAt" | "createdAt" | "userAgent"
>;

type SeedMessages<T1 extends string, T2 extends string> = {
  topicId: P2PTopicId | null;
  user1: T1;
  user2: T2;
  messages: [string, T1 | T2][];
};

const seedUser = [
  {
    id: `usr_______CAROL`,
    username: "carol",
    fullname: "Carol Xmas",
    email: "carol@example.com",
    password: "carol123",
    profilePhotoUrl: "profile-photos/user/carol/carol.jpg",
  },
  {
    id: "usr_______ALICE",
    username: "alice",
    fullname: "Alice Hatter",
    email: "alice@example.com",
    password: "alice123",
    profilePhotoUrl: "profile-photos/user/alice/alice.jpg",
  },
  {
    id: "usr_________EVE",
    username: "eve",
    fullname: "Eve Adamas",
    email: "eve@example.com",
    password: "eve123",
    profilePhotoUrl: "profile-photos/user/eve/eve.jpg",
  },
  {
    id: "usr_______FRANK",
    username: "frank",
    fullname: "Frank Singer",
    email: "frank@example.com",
    password: "frank123",
    profilePhotoUrl: "profile-photos/user/frank/frank.jpg",
  },
  {
    id: "usr_________BOB",
    username: "bob",
    fullname: "Bob Smitch",
    email: "bob@example.com",
    password: "bob123",
    profilePhotoUrl: "profile-photos/user/bob/bob.jpg",
  },
  {
    id: "usr________DAVE",
    username: "dave",
    fullname: "Dave Goliathsson",
    email: "dave@example.com",
    password: "dave123",
    profilePhotoUrl: "profile-photos/user/dave/dave.jpg",
  },
  {
    id: "usr_________KEN",
    username: "ken",
    fullname: "Ken Hopkins",
    email: "ken@example.com",
    password: "ken123",
    profilePhotoUrl: "profile-photos/user/ken/ken.jpg",
  },
] as const;

const userIdFromUsername = (username: string): UserId => {
  const user = seedUser.find((x) => x.username == username);
  if (user == undefined) {
    throw new Error("User with the username is not found in the seed");
  }
  return user.id;
};

// 3 topics for carol
// carol - alice: contain some messages
// carol - eve: contain one message
// carol - frank: contain so much messages it's enough to test infinite scrolling

// 1 group topic
// carol - admin
// members: ken, dave, bob
// Note that the test scenario will be based around 'carol'
// 🔴 None of the members 'ken', 'dave', 'bob', should be a contact of 'carol'
// This is so that testing is much easier, we can test group notifications received by 'carol'
// without involving any notifications triggered by P2P topics

const groupTopicSeed: {
  members: UserId[];
  messages: ["carol" | "ken" | "dave" | "bob", string][];
  groupName: string;
} = {
  groupName: "HS Tutor Group 1",
  members: ["carol", "ken", "dave", "bob"].map((s) => userIdFromUsername(s)),
  messages: [
    ["carol", "Hey guys, what's up?"],
    ["bob", "Not much, just finishing up an essay. How about you?"],
    ["ken", "Just got back from the gym. I'm exhausted!"],
    ["dave", "Same here, I've been working on a programming project all day."],
    ["carol", "That's great, guys! Keep up the good work."],
    ["bob", "Hey Carol, have you heard back from that internship yet?"],
    ["carol", "No, not yet. But I'm hoping to hear back soon."],
    ["ken", "Good luck! I'm sure you'll get it."],
    ["dave", "Yeah, let us know if you need any help with your application."],
    ["carol", "Thanks, guys! I really appreciate it."],
    ["bob", "So, what are you guys up to this weekend?"],
    ["ken", "I'm going to visit my family. How about you?"],
    ["dave", "I'm going to a hackathon with some friends."],
    [
      "carol",
      "I'm planning to catch up on some reading and maybe go for a hike.",
    ],
    ["bob", "Sounds like a productive weekend for everyone!"],
    [
      "ken",
      "Hey, did you guys hear about that new restaurant that just opened up?",
    ],
    ["dave", "No, what's it called?"],
    ["ken", "It's called “The Green Kitchen”. They serve vegan food."],
    ["carol", "That sounds interesting. I'd be down to try it out sometime."],
    ["bob", "Me too! Let's plan a group dinner there."],
    ["dave", "Sounds like a plan. When do you guys want to go?"],
    ["ken", "How about next Friday?"],
    ["carol", "That works for me. What time?"],
    ["bob", "How about 7 PM?"],
    ["dave", "Perfect. I'll make a reservation for 4."],
    [
      "ken",
      "Speaking of food, have you guys tried the new coffee shop on Main Street?",
    ],
    ["carol", "No, I haven't. What's it called?"],
    [
      "ken",
      "It's called “Brew Culture”. They have the best latte I've ever tasted!",
    ],
    [
      "bob",
      "I'm a fan of coffee too. Let's plan a study session there sometime.",
    ],
    ["dave", "Good idea. When are you guys free?"],
    ["carol", "I'm free on Tuesday evenings."],
    ["ken", "I'm free on Wednesday afternoons."],
    ["bob", "I'm free on Thursday mornings."],
    ["dave", "How about next Wednesday at 2 PM?"],
    ["ken", "Sounds good to me!"],
    ["carol", "Same here. See you guys then."],
    ["bob", "Hey, have you guys heard about that new museum exhibit?"],
    ["dave", "No, what's it about?"],
    [
      "bob",
      "It's an exhibit on modern art. I'm thinking of checking it out this weekend.",
    ],
  ],
};

const seedMessagesData: {
  "carol-alice": SeedMessages<"carol", "alice">;
  "carol-eve": SeedMessages<"carol", "eve">;
  "carol-frank": SeedMessages<"carol", "frank">;
} = {
  "carol-alice": {
    topicId: null,
    user1: "carol",
    user2: "alice",
    messages: [
      ["Hey, what's up", "alice"],
      ["Not much, just studying for finals. How about you?", "carol"],
      ["Same here. I'm so stressed out!", "alice"],
      ["I know, right? I can't wait for this semester to be over.", "carol"],
      ["Me too. What are your plans for the summer?", "alice"],
      ["I'm thinking of doing an internship. You?", "carol"],
      ["Same here. Have you started applying yet?", "alice"],
      ["Not yet, but I'm going to start this week.", "carol"],
      ["Cool. Let me know if you find any good opportunities.", "alice"],
      ["Will do. Hey, have you heard about the party this weekend?", "carol"],
      ["No, what party?", "alice"],
      [
        "One of my friends is throwing a housewarming party on Saturday. You should come.",
        "carol",
      ],
      ["Sounds fun! What time should I come over?", "alice"],
      ["Around 7 pm. I'll send you the address later.", "carol"],
      ["Great, can't wait!", "alice"],
      ["🔥 Haven't gone to a party in such a long time!", "alice"],
    ],
  },
  "carol-eve": {
    topicId: null,
    user1: "carol",
    user2: "eve",
    messages: [
      [
        `Hey Eve, I'm inviting you to my sister's wedding, please RSVP before 11th March`,
        "carol",
      ],
    ],
  },
  "carol-frank": {
    topicId: null,
    user1: "carol",
    user2: "frank",
    messages: [
      [
        `Hey Eve, I'm inviting you to my sister's wedding, please RSVP before 11th March`,
        "carol",
      ],
      [
        `Hey, did you see the new policy rates for our life insurance plans?`,
        "carol",
      ],
      [
        `Yeah, I did. They're definitely more competitive than before.`,
        "frank",
      ],
      [
        `Agreed. I think we'll see a lot more interest from potential customers now.`,
        "carol",
      ],
      [
        `Definitely. But we'll also need to keep an eye on our risk exposure with the new rates.`,
        "frank",
      ],
      [
        `Good point. We should run some stress tests and see how the new rates impact our solvency.`,
        "carol",
      ],
      [
        `Absolutely. And we should also monitor any changes in the mortality or morbidity rates.`,
        "frank",
      ],
      [`Yeah, that's definitely a risk factor we need to consider.`, "carol"],
      [
        `Speaking of risk, have you reviewed the latest mortality tables?`,
        "frank",
      ],
      [
        `Yes, I have. It looks like we'll need to adjust our assumptions for certain age groups.`,
        "carol",
      ],
      [
        `I agree. I think we should revisit our pricing models and make sure we're accounting for any changes.`,
        "frank",
      ],
      [
        `Definitely. We don't want to underestimate our risk exposure.`,
        "carol",
      ],
      [
        `Exactly. It's always better to err on the side of caution when it comes to life insurance.`,
        "frank",
      ],
      [
        `Agreed. Hey, did you hear about the new policyholder who just passed away?`,
        "carol",
      ],
      [`No, I didn't. What happened?`, "frank"],
      [
        `Apparently, they had a pre-existing condition that wasn't disclosed on their application.`,
        "carol",
      ],
      [
        `Yikes. That could be a big problem for us if their beneficiaries decide to file a claim.`,
        "frank",
      ],
      [
        `Yeah, we'll need to review their application and see if there were any red flags we missed.`,
        "carol",
      ],
      [
        `Definitely. We don't want any surprises when it comes to claims payouts.`,
        "frank",
      ],
      [
        `Speaking of claims, have you reviewed our claims experience for the last quarter?`,
        "carol",
      ],
      [
        `Yes, I have. It looks like our claims frequency is within our expected range, but our severity is slightly higher than anticipated.`,
        "frank",
      ],
      [`Hmm, that's something we'll need to keep an eye on.`, "carol"],
      [
        `Agreed. We should review our claims reserve and make sure we're adequately reserving for potential future payouts.`,
        "frank",
      ],
      [
        `Good idea. Hey, have you had a chance to review the latest industry reports?`,
        "carol",
      ],
      [
        `Yes, I have. It looks like our competitors are starting to offer more innovative products and services.`,
        "frank",
      ],
      [
        `Interesting. We'll need to make sure we're keeping up with the latest trends in the market.`,
        "carol",
      ],
      [
        `Hey, I was thinking about our latest mortality table review. Do you think we should adjust our underwriting guidelines to reflect the changes?`,
        "carol",
      ],
      [
        `That's a good question. I think we should at least consider it, especially for our higher-risk policies.`,
        "frank",
      ],
      [
        `Agreed. And speaking of underwriting, have you reviewed our latest lapse rate trends?`,
        "carol",
      ],
      [
        `Yes, I have. It looks like we may need to revisit our policyholder retention strategies.`,
        "frank",
      ],
      [
        `That's a good point. We don't want to lose too many policyholders due to lapses.`,
        "carol",
      ],
      [
        `Right. We should also review our premium rate structures and see if there are any changes we can make to improve policyholder retention.`,
        "frank",
      ],
      [
        `Definitely. Hey, have you had a chance to review our latest investment portfolio performance?`,
        "carol",
      ],
      [
        `Yes, I have. It looks like we're slightly underperforming our benchmarks.`,
        "frank",
      ],
      [
        `Hmm, that's something we'll need to address. Do you think we need to adjust our investment strategy?`,
        "carol",
      ],
      [
        `It's possible. We should review our asset allocation and see if there are any changes we can make to improve our returns.`,
        "frank",
      ],
      [
        `Agreed. Hey, I was also thinking about our reinsurance program. Do you think we should explore new reinsurance partners?`,
        "carol",
      ],
      [
        `That's a good question. I think it's always a good idea to review our reinsurance program periodically.`,
        "frank",
      ],
      [
        `Definitely. And we should also make sure we're taking advantage of any available reinsurance solutions to manage our risk exposure.`,
        "carol",
      ],
      [
        `Right. And we should review our reinsurance contracts to make sure we're getting the best terms possible.`,
        "frank",
      ],
      [
        `Hey, speaking of risk management, have you reviewed our latest catastrophe modeling results?`,
        "carol",
      ],
      [
        `Yes, I have. It looks like our exposure to certain catastrophes may be higher than anticipated.`,
        "frank",
      ],
      [
        `That's concerning. We should review our risk mitigation strategies and see if there are any changes we can make to reduce our exposure.`,
        "carol",
      ],
      [
        `Agreed. And we should also make sure our catastrophe reserves are adequate to cover any potential losses.`,
        "frank",
      ],
      [
        `Definitely. Hey, have you had a chance to review our latest regulatory filings?`,
        "carol",
      ],
      [
        `Yes, I have. It looks like there are some changes we'll need to make to comply with the latest regulations.`,
        "frank",
      ],
      [
        `That's always a challenge. We'll need to make sure we have a solid compliance program in place.`,
        "carol",
      ],
      [
        `Right. And we should also make sure our compliance team is up-to-date on the latest regulations and requirements.`,
        "frank",
      ],
      [
        `Hey, speaking of teams, how's your team doing? Have you been able to fill that open position yet?`,
        "carol",
      ],
      [
        `Not yet, but we have a few strong candidates in the pipeline.`,
        "frank",
      ],
      [
        `That's good to hear. It's always tough to find the right talent in such a specialized field.`,
        "carol",
      ],
      [
        `Definitely. And we should also make sure we're providing our existing team members with the resources and support they need to succeed.`,
        "frank",
      ],
      [
        `Agreed. It's important to invest in our people and build a strong culture of collaboration and innovation.`,
        "carol",
      ],
      [`Hey, have you been studying for the next actuarial exam?`, "carol"],
      [
        `Yes, I have. It's been a bit of a challenge to balance studying with work, but I'm making progress.`,
        "frank",
      ],
      [
        `I know what you mean. It can be tough to find the time and energy to study after a long day at the office.`,
        "carol",
      ],
      [
        `Definitely. But I think it's worth it in the long run. Passing these exams is a key part of advancing our careers.`,
        "frank",
      ],
      [
        `Agreed. Hey, have you heard about the new changes to the SOA's exam structure?`,
        "carol",
      ],
      [
        `Yes, I have. It looks like they're shifting towards a more modular exam structure, with more flexibility in the order of exams.`,
        "frank",
      ],
      [
        `That's interesting. It could make it easier to tailor our exam progression to our specific career goals.`,
        "carol",
      ],
      [
        `Right. And it could also make it easier for us to balance work and study by taking exams at different times throughout the year.`,
        "frank",
      ],
      [
        `Definitely. Hey, have you had a chance to review the syllabus for the next exam?`,
        "carol",
      ],
      [
        `Yes, I have. It looks like it's going to be a challenging one, with a lot of new material to cover.`,
        "frank",
      ],
      [
        `That's always a bit daunting. But we've been through this before, and we know how to prepare.`,
        "carol",
      ],
      [
        `That's true. And I think we're in a good position to succeed, especially with our experience and knowledge from working in the industry.`,
        "frank",
      ],
      [
        `Agreed. Hey, have you thought about using any study aids or resources to help prepare for the exam?`,
        "carol",
      ],
      [
        `Yes, I've been looking into some of the study manuals and online courses that are available. Have you found any that you'd recommend?`,
        "frank",
      ],
      [
        `I've heard good things about the ASM and ACTEX study manuals, and I've also found some helpful videos and tutorials online.`,
        "carol",
      ],
      [
        `Thanks for the recommendations. I'll definitely check those out.`,
        "frank",
      ],
      [
        `No problem. And don't forget to use the resources that are available to us through the company, like the study groups and mentorship programs.`,
        "carol",
      ],
      [
        `Right. It's always helpful to have a support system to lean on during the exam process.`,
        "frank",
      ],
      [
        `Absolutely. Hey, have you thought about taking any of the VEE courses to fulfill our professional education requirements?`,
        "carol",
      ],
      [
        `Yes, I have. I'm actually planning on taking one of the economics courses next quarter.`,
        "frank",
      ],
      [
        `That's great. It's important to stay on top of our continuing education requirements, and the VEE courses are a great way to do that.`,
        "carol",
      ],
      [
        `Definitely. And it's also a good opportunity to deepen our understanding of the various areas of actuarial science.`,
        "frank",
      ],
      [
        `Hey, have you thought about pursuing any of the other actuarial designations, like the CFA or FRM?`,
        "carol",
      ],
      [
        `Yes, I have. I'm actually planning on taking the CFA Level 1 exam next year.`,
        "frank",
      ],
      [
        `That's ambitious. But I think it's a great way to broaden our skillset and increase our career opportunities.`,
        "carol",
      ],
      [
        `Agreed. And it's always good to keep learning and growing as professionals.`,
        "frank",
      ],
      [
        `Hey, have you ever thought about exploring other career paths outside of actuarial science?`,
        "carol",
      ],
      [
        `Actually, I have been giving it some thought lately. Don't get me wrong, I love the work we do, but sometimes I wonder if there are other areas where my skills could be put to use.`,
        "frank",
      ],
      [
        `I know what you mean. It's always good to explore different options and see what else is out there.`,
        "carol",
      ],
      [
        `Right. And I think we've developed a lot of valuable skills and experience through our work as actuaries that could be applied in other industries.`,
        "frank",
      ],
      [
        `Absolutely. What kinds of career paths have you been considering?`,
        "carol",
      ],
      [
        `Well, I've been looking into some opportunities in data science and analytics. It seems like there's a lot of demand for those skills right now, and I think it could be a good fit for me.`,
        "frank",
      ],
      [
        `That's interesting. And I think you're right that our background in actuarial science gives us a strong foundation in those areas.`,
        "carol",
      ],
      [
        `Yeah, I think so too. What about you? Have you ever thought about making a career change?`,
        "frank",
      ],
      [
        `I have, actually. I've been considering exploring some opportunities in risk management or consulting.`,
        "carol",
      ],
      [
        `Those both sound like good options. What's appealing to you about those areas?`,
        "frank",
      ],
      [
        `I think it's the opportunity to work with a variety of clients and industries, and to use my analytical skills to help solve complex problems.`,
        "carol",
      ],
      [
        `I can see why that would be appealing. And I think the experience we've gained as actuaries could be a real asset in those kinds of roles.`,
        "frank",
      ],
      [
        `Definitely. I think it's important to be open to different possibilities and not get too complacent in our current roles.`,
        "carol",
      ],
      [
        `Agreed. And I think it's always good to keep learning and growing, both personally and professionally.`,
        "frank",
      ],
      [
        `Hey, have you thought about pursuing any additional education or certifications to help make a career change?`,
        "carol",
      ],
      [
        `Yes, actually. I've been looking into some online courses and certifications in data science and programming to help build up my skills in those areas.`,
        "frank",
      ],
      [
        `That's a good idea. And I think it's important to keep investing in our education and professional development, even if we're not sure exactly where our careers will take us.`,
        "carol",
      ],
      [
        `Absolutely. It's always good to stay curious and keep exploring new possibilities.`,
        "frank",
      ],
      [
        `Speaking of exploring new possibilities, have you ever considered working overseas? I've been thinking about looking for job opportunities in Singapore.`,
        "carol",
      ],
      [
        `Really? That's interesting. What's appealing to you about Singapore?`,
        "frank",
      ],
      [
        `Well, for one thing, it's a major financial hub in Asia, so there are a lot of opportunities in the finance and insurance industries. Plus, it's a vibrant and cosmopolitan city with a great quality of life.`,
        "carol",
      ],
      [
        `I can see why that would be appealing. I've heard that there are a lot of opportunities in Singapore for people with analytical skills, too.`,
        "frank",
      ],
      [
        `Yes, that's definitely a draw. And I think it would be an exciting adventure to live and work in a new country for a while.`,
        "carol",
      ],
      [
        `I agree. I've always been interested in experiencing different cultures and lifestyles.`,
        "frank",
      ],
      [
        `Have you thought about looking for job opportunities in Singapore as well?`,
        "carol",
      ],
      [
        `Actually, I have. I've been doing some research on the job market there, and it seems like there are a lot of opportunities in areas like risk management and data analytics.`,
        "frank",
      ],
      [
        `That's great. I think we could both bring a lot of valuable skills and experience to potential employers in Singapore.`,
        "carol",
      ],
      [
        `Definitely. So, what's your plan for finding job opportunities in Singapore?`,
        "frank",
      ],
      [
        `Well, I've been looking at job postings online and trying to network with people in the industry who have connections in Singapore.`,
        "carol",
      ],
      [
        `That's a good strategy. Have you looked into any recruiting firms or headhunters that specialize in placing people in jobs overseas?`,
        "frank",
      ],
      [
        `I haven't yet, but that's a good idea. I think it would be helpful to have someone who knows the local job market and can help us navigate the visa and work permit process.`,
        "carol",
      ],
      [
        `Yes, definitely. And it might also be helpful to attend some job fairs or conferences in Singapore to make connections and learn more about the job market there.`,
        "frank",
      ],
      [
        `That's a great idea. I think it would be really valuable to meet with potential employers and get a sense of the culture and work environment in different companies.`,
        "carol",
      ],
      [
        `Absolutely. And I think it's important to keep an open mind and be flexible when it comes to finding a job in a new country.`,
        "frank",
      ],
      [
        `Agreed. It's definitely a big step, but I think it could be a really rewarding experience both personally and professionally.`,
        "carol",
      ],
      [
        `I couldn't agree more. Let's keep each other posted on any job opportunities we come across in Singapore, and maybe we can even explore the city together if we end up living there!`,
        "frank",
      ],
    ],
  },
};

const truncateAllTables = async (db: KyselyDB) =>
  await sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE;`.execute(db);

const seed = async (db: KyselyDB | KyselyTransaction) => {
  await truncateAllTables(db);

  {
    const result = await fromPromise(
      db
        .insertInto("users")
        .values(
          seedUser.map((v) => ({
            id: v.id,
            username: v.username,
            fullname: v.fullname,
            email: v.email,
            password: v.password,
            passwordHash: bcrypt.hashSync(v.password, 8),
            defaultPermissions: "JRWP",
            profilePhotoUrl: v.profilePhotoUrl,
          }))
        )
        .execute(),
      (e) => e
    );
    if (result.isErr()) {
      return err(result.error);
    }
  }

  for (const [k, v] of Object.entries(seedMessagesData)) {
    const result = await seedMessages(db, v);
    if (result.isErr()) {
      return err(result.error);
    }
    v.topicId = result.value as P2PTopicId;
  }

  const a = seedUser.reduce((acc) => {
    return acc;
  }, {} as { [k in (typeof seedUser)[number]["username"]]: Insertable<Users> });
  for (const [k, v] of Object.entries(seedUser)) {
    const r = await db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", v.email)
      .executeTakeFirstOrThrow();
    a[v.username] = r;
  }

  const group = await seedGroupTopic(db);

  return ok([a, seedMessagesData, group] as const);
};

const seedGroupTopic = async (db: KyselyDB | KyselyTransaction) => {
  const groupTopic: Insertable<Topics> = {
    id: `grp${faker.random.alphaNumeric(12)}`,
    topicType: "group",
  };
  const profilePhotoUrl =
    "profile-photos/group/hs-tutor-group-1/abstract-art.jpg";

  const subscriptionsToSeed: Insertable<Subscriptions>[] =
    groupTopicSeed.members.map((usrId) => ({
      topicId: groupTopic.id,
      userId: usrId,
      permissions: "JRWPSDA",
    }));
  const messagesToSeed: Insertable<Messages>[] = groupTopicSeed.messages.map(
    (m) => ({
      topicId: groupTopic.id,
      authorId: userIdFromUsername(m[0]),
      content: {
        type: "text",
        content: m[1],
        forwarded: false,
      },
    })
  );
  const createdTopic = await db
    .insertInto("topics")
    .values(groupTopic)
    .returningAll()
    .executeTakeFirstOrThrow();

  const createdTopicMeta = await db
    .insertInto("groupTopicMeta")
    .values({
      groupName: groupTopicSeed.groupName,
      topicId: groupTopic.id as GroupTopicId,
      defaultPermissions: "JRWPSDA",
      ownerId: userIdFromUsername("carol"),
      profilePhotoUrl: profilePhotoUrl,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const createdSub = await db
    .insertInto("subscriptions")
    .values(subscriptionsToSeed)
    .returningAll()
    .executeTakeFirstOrThrow();

  for (const s of subscriptionsToSeed) {
    const createdMessage = await db
      .insertInto("messages")
      .values({ topicId: s.topicId })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (s.userId == userIdFromUsername("carol")) {
      await db
        .insertInto("topicEventLogs")
        .values({
          messageId: createdMessage.id,
          topicEvent: "create_group",
          topicId: createdTopic.id,
          actorUserId: userIdFromUsername("carol"),
        })
        .execute();
    } else {
      await db
        .insertInto("topicEventLogs")
        .values({
          messageId: createdMessage.id,
          topicEvent: "add_member",
          topicId: createdTopic.id,
          actorUserId: userIdFromUsername("carol"),
          affectedUserId: s.userId,
        })
        .execute();
    }
  }

  const createdMessages = await db
    .insertInto("messages")
    .values(messagesToSeed)
    .returningAll()
    .execute();

  return {
    topic: {
      ...createdTopic,
      id: createdTopic.id as GroupTopicId,
    },
    topicMeta: createdTopicMeta,
    subs: createdSub,
    messages: createdMessages,
  };
};

const seedP2PTopic = async (
  db: KyselyDB | KyselyTransaction,
  username1: string,
  username2: string
) => {
  const topicId = (
    await db
      .insertInto("topics")
      .values({
        id: `p2p${faker.string.alphanumeric(12)}`,
        topicType: "p2p",
      })
      .returning("topics.id")
      .executeTakeFirstOrThrow()
  ).id;

  await db
    .insertInto("subscriptions")
    .values({
      topicId,
      userId: userIdFromUsername(username1),
      permissions: "JRWP",
    })
    .execute();

  await db
    .insertInto("subscriptions")
    .values({
      topicId,
      userId: userIdFromUsername(username2),
      permissions: "JRWP",
    })
    .execute();
  return topicId;
};

const seedMessages = async <T1 extends string, T2 extends string>(
  db: KyselyDB | KyselyTransaction,
  seed: SeedMessages<T1, T2>
) => {
  const topicId = await seedP2PTopic(db, seed.user1, seed.user2);

  return fromPromise(
    db
      .insertInto("messages")
      .values(
        seed.messages.map((m) => ({
          content: {
            type: "text" as const,
            content: m[0],
            forwarded: false,
          },
          authorId: userIdFromUsername(m[1]),
          topicId,
        }))
      )
      .execute(),
    (e) => e
  ).map(() => topicId);
};

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone",
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

void seed(db);
