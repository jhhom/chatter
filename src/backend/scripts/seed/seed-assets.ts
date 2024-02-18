import * as fs from "fs";
import path from "path";

const SOURCE_ASSET_PATH = "src/backend/scripts/seed/seed-assets";
const TARGET_ASSET_PATH = "src/backend/assets";

export function seedAssets() {
  const dir = fs.readdirSync(SOURCE_ASSET_PATH);
  fs.rmSync(TARGET_ASSET_PATH, {
    force: true,
    recursive: true,
  });
  fs.cpSync(SOURCE_ASSET_PATH, TARGET_ASSET_PATH, {
    recursive: true,
  });
}
