import { faker } from "@faker-js/faker";
import { ok, err } from "neverthrow";

import { AppPgDatabase, AppPgTransaction } from "~/backend/drizzle/db";
import { bcrypt } from "~/backend/wrapper/wrapper";
import {
  saveMedia,
  completeMediaUrl,
  extractFileExtensionFromBase64,
} from "~/backend/service/topics/use-cases/send-message/media";

import { createUser } from "./create-user.repo";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function registerUser(
  ctx: {
    db: AppPgDatabase | AppPgTransaction;
  },
  input: {
    username: string;
    fullname: string;
    email: string;
    password: string;
    photoBase64: string | null;
  },
  config: {
    projectRoot: string;
  }
): ServiceResult<"users/create_user"> {
  const passHash = await bcrypt.hash(input.password, 8);
  if (passHash.isErr()) {
    return err(new AppError("UNKNOWN", { cause: passHash.error }));
  }

  let profilePhotoUrl: string | undefined = undefined;
  if (input.photoBase64 !== null) {
    const fileExtension = extractFileExtensionFromBase64(input.photoBase64);
    const result = await saveMedia(
      {
        filename: `${input.username}-profile${
          fileExtension ? `.${fileExtension}` : ""
        }`,
        base64: input.photoBase64,
        type: "profile-photo.user",
      },
      config
    );
    if (result.isErr()) {
      return err(
        new AppError("SAVE_MEDIA_FAILED", {
          media: "photo",
          cause: result.error,
        })
      );
    }
    profilePhotoUrl = result.value.assetPath;
  }

  const userResult = await ctx.db.transaction(async (tx) => {
    const result = await createUser(
      { db: tx },
      {
        id: `usr${faker.random.alphaNumeric(12)}`,
        defaultPermissions: "JRW",
        username: input.username,
        fullname: input.fullname,
        email: input.email,
        password: input.password,
        passwordHash: passHash.value,
        profilePhotoUrl,
      }
    );
    if (result.isErr()) {
      tx.rollback();
      return err(result.error);
    }
    return ok(result.value);
  });

  if (userResult.isErr()) {
    return err(new AppError("UNKNOWN", { cause: userResult.error }));
  }

  const user = userResult.value;

  return ok({
    username: user.username,
    email: user.email,
    createdAt: new Date(user.createdAt),
    profilePhotoUrl: user.profilePhotoUrl
      ? completeMediaUrl(user.profilePhotoUrl)
      : null,
  });
}
