import { IApiClient } from "~/api-contract/client";
import { Client } from "~/client/trpc/client";

const client: IApiClient = new Client();

export { client };
