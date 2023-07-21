import { InferModel } from "drizzle-orm";
import { Result, ok, err } from "neverthrow";

import { messages } from "~/backend/drizzle/schema";

import { MessageInput } from "./schema";
import { saveMedia } from "./media";

export async function saveMessageMedia(
  message: MessageInput,
  config: {
    projectRoot: string;
  }
): Promise<
  Result<NonNullable<InferModel<typeof messages, "insert">["content"]>, unknown>
> {
  if (message.type == "text") {
    return ok({
      type: "text",
      forwarded: false,
      content: message.content,
    });
  } else if (message.type == "file") {
    const r = await saveMedia(
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
    const r = await saveMedia(
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
