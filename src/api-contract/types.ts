import { z } from "zod";
import { Result } from "neverthrow";

import { AppErrorUnion } from "~/api-contract/errors/errors";
import { Contract, contract } from "~/api-contract/endpoints";

export type ServiceResult<T extends keyof Contract> = Promise<
  Result<z.infer<Contract[T]["output"]>, AppErrorUnion>
>;

export type ServiceSyncResult<T extends keyof Contract> = Result<
  z.infer<Contract[T]["output"]>,
  AppErrorUnion
>;

export type ServiceOutput<T extends keyof Contract> = z.infer<
  Contract[T]["output"]
>;

export type ServiceInput<T extends keyof Contract> = Contract[T] extends {
  input: z.ZodSchema;
}
  ? z.infer<Contract[T]["input"]>
  : never;
