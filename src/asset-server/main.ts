import express from "express";
import path from "path";
import { z } from "zod";
import * as dotenv from "dotenv";
import { ok, err } from "neverthrow";

const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_KEY: z.string().min(1),
  PROJECT_ROOT: z.string().min(1),
});

const loadConfig = () => {
  dotenv.config();
  const result = configSchema.safeParse(process.env);
  if (result.success == false) {
    return err(result.error);
  }
  return ok(result.data);
};

export { loadConfig };

const config = loadConfig();
if (config.isErr()) {
  throw config.error;
}

const app = express();
const port = 4002;

const assetPath = path.join(config.value.PROJECT_ROOT, "src/backend/assets");

// Serve static files
app.use(express.static(assetPath));

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
