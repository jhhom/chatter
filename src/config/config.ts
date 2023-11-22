import { type Result, ok, err } from "neverthrow";
import * as dotenv from "dotenv";
import { z } from "zod";

export const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_KEY: z.string().min(1),
  PROJECT_ROOT: z.string().min(1),

  SERVER_PORT: z.string().transform((x) => Number.parseInt(x)),
  ASSET_SERVER_PORT: z.string().transform((x) => Number.parseInt(x)),
  ASSET_SERVER_URL: z.string(),
});

export const testConfigSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_KEY: z.string().min(1),
  PROJECT_ROOT: z.string().min(1),
  ASSET_SERVER_URL: z.string().min(1),
});

export type ConfigSchema = z.infer<typeof configSchema>;

export type TestConfigSchema = z.infer<typeof testConfigSchema>;

type Config = {
  production: ConfigSchema;
  test: TestConfigSchema;
};

const config = {
  production: configSchema,
  test: testConfigSchema,
};

const loadConfig = <T extends keyof Config>(
  environment: T
): Result<Config[T], unknown> => {
  dotenv.config({
    path: environment === "production" ? "config/.env" : "config/.env.test",
  });
  const result = config[environment].safeParse(process.env);
  if (result.success == false) {
    return err(result.error);
  }
  return ok(result.data as Config[T]);
};

export { loadConfig };
