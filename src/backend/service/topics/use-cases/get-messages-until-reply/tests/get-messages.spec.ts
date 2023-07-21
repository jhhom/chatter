/// <reference types="jest-extended" />
import { expect, describe, test } from "vitest";
import { pairArrays } from "~/backend/service/topics/use-cases/get-messages-until-reply/get-group-topic-messages";
import { testUtil } from "~/backend/service/test-utils";

const config = {
  DB_URL: "postgres://dbuser:dbuser@localhost/tinode_clone_test",
  JWT_KEY: "xxx-xxx",
};

describe("Topic", () => {
  test("sort subscription period bounds", async () => {
    console.log(pairArrays([6, 12, 19], [8, 14]));
    // CORRECT: [[6, 8], [12, 14], [19]]

    console.log(pairArrays([6, 12, 19, 24], [8, 14]));

    console.log(pairArrays([5], [8, 14]));
    // CORRECT: [ [ 5, 8 ] ]

    console.log(pairArrays([5], []));
    // CORRECT: [ [ 5 ] ]

    console.log(pairArrays([5], [3]));
    // CORRECT: [ [ 5 ] ]

    console.log(pairArrays([5], [8, 2]));
    // CORRECT: [[5, 8]]

    console.log(pairArrays([5], [2, 8]));
    // WRONG: [[5]]
  });
}, 120_000);
