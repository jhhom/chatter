import { InferModel } from "drizzle-orm";
import { Result, ok, err } from "neverthrow";

import { Messages } from "~/backend/schema";

import { MessageInput } from "~/backend/service/topics/send-message/send-message.schema";
import { saveMedia } from "~/backend/service/common/media";
import { Insertable } from "kysely";

export function saveMessageMedia(
  message: MessageInput,
  config: {
    projectRoot: string;
    assetServerUrl: string;
  }
): Result<NonNullable<Insertable<Messages>["content"]>, unknown> {
  if (message.type == "text") {
    return ok({
      type: "text",
      forwarded: false,
      content: message.content,
    });
  } else if (message.type == "file") {
    const r = saveMedia(
      {
        filename: message.filename,
        base64: message.base64,
        type: "message.file",
      },
      config
    );
    if (r.isErr()) {
      return err(r.error);
    }

    return ok({
      type: "file",
      filename: message.filename,
      forwarded: false,
      caption: message.caption,
      size: r.value.fileSize,
      url: r.value.assetPath,
    });
  } else {
    const r = saveMedia(
      {
        filename: message.filename,
        base64: message.base64,
        type: "message.picture",
      },
      config
    );
    if (r.isErr()) {
      return err(r.error);
    }

    return ok({
      filename: message.filename,
      type: "picture",
      forwarded: false,
      caption: message.caption,
      size: r.value.fileSize,
      url: r.value.assetPath,
    });
  }
}
