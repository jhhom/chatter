import fs from "fs-extra";
import * as path from "path";
import { ok, err } from "neverthrow";
import { faker } from "@faker-js/faker";

const MEDIA_FOLDER = {
  "message.picture": "messages/pictures",
  "message.file": "messages/files",
  "profile-photo.group": "profile-photos/group",
  "profile-photo.user": "profile-photos/user",
} as const;

export function saveMedia(
  arg: {
    filename: string;
    base64: string;
    type: keyof typeof MEDIA_FOLDER;
  },
  config: {
    projectRoot: string;
    assetServerUrl: string;
  }
) {
  const base64Data = arg.base64.split("base64,")[1];

  const buffer = Buffer.from(base64Data, "base64");
  const randomFolderPath = faker.string.alphanumeric(15);

  const assetFolderPath = path.join(
    "src/backend/assets",
    MEDIA_FOLDER[arg.type],
    randomFolderPath
  );
  const assetPath = path.join(assetFolderPath, arg.filename);
  const writeFilePath = path.join(config.projectRoot, assetPath);

  try {
    fs.ensureDirSync(path.join(config.projectRoot, assetFolderPath));
    fs.writeFileSync(writeFilePath, buffer);
  } catch (e) {
    return err(e);
  }
  return ok({
    assetPath: path.join(
      MEDIA_FOLDER[arg.type],
      randomFolderPath,
      arg.filename
    ),
    fileSize: buffer.byteLength,
  });
}

export function completeMediaUrl(assetServerUrl: string, partialUrl: string) {
  return assetServerUrl + "/" + partialUrl;
}

export function extractFileExtensionFromBase64(base64: string) {
  let s = base64.split(";");
  if (s.length == 0) {
    return null;
  }
  s = s[0].split("/");
  if (s.length < 2) {
    return null;
  }
  return s[1];
}
