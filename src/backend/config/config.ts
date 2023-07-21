import { ok, err } from "neverthrow";
import * as dotenv from "dotenv";
import { z } from "zod";

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

export type ConfigSchema = z.infer<typeof configSchema>;
