import type { IApiClient } from "~/api-contract/client";
import { Client } from "~/client/trpc/client";
import { config } from "~/frontend/config/config";

const client: IApiClient = new Client(config.SERVER_URL);

export { client };
