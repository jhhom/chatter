import { Insertable } from "kysely";
import { fromPromise, err, ok } from "neverthrow";
import { faker } from "@faker-js/faker";

import { KyselyDB, KyselyTransaction, Users } from "~/backend/schema";
import { ServiceResult } from "~/api-contract/types";
import { bcrypt } from "~/backend/wrapper/wrapper";
import { AppError } from "~/api-contract/errors/errors";
import {
  saveMedia,
  completeMediaUrl,
  extractFileExtensionFromBase64,
} from "~/backend/service/common/media";

export async function registerUser(
  db: KyselyDB | KyselyTransaction,
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

  const userResult = await fromPromise(
    db.transaction().execute(async (tx) => {
      return await tx
        .insertInto("users")
        .values({
          id: `usr${faker.random.alphaNumeric(12)}`,
          defaultPermissions: "JRW",
          username: input.username,
          fullname: input.fullname,
          email: input.email,
          password: input.password,
          passwordHash: passHash.value,
          profilePhotoUrl,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }),
    (e) => e
  );

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
