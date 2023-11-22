import type { inferAsyncReturnType } from "@trpc/server";

import { NodeHTTPCreateContextFnOptions } from "@trpc/server/adapters/node-http";
import { IncomingMessage } from "http";
import ws from "ws";

import type { Socket } from "~/backend/service/common/socket";
import type { ConfigSchema } from "~/config/config";

import type { UserId } from "~/api-contract/subscription/subscription";
import type { KyselyDB } from "~/backend/schema";

type ContextConfig = Pick<
  ConfigSchema,
  "DATABASE_URL" | "JWT_KEY" | "PROJECT_ROOT" | "ASSET_SERVER_URL"
>;

type Session = {
  auth?: {
    userId: UserId;
    username: string;
    email: string;
    socketId: string;
  };
  socket?: Socket;
};

export class Context {
  readonly session: Session;
  readonly config: ContextConfig;
  readonly db: KyselyDB;

  constructor(config: ContextConfig, db: KyselyDB) {
    this.session = {};
    this.config = config;
    this.db = db;
  }

  get auth() {
    return this.session.auth;
  }

  get socket() {
    return this.session.socket;
  }

  setAuth(userId: UserId, username: string, email: string, socketId: string) {
    this.session.auth = {
      userId,
      username,
      email,
      socketId,
    };
  }

  resetAuth() {
    this.session.auth = undefined;
  }

  setSocket(socket: Socket | undefined) {
    this.session.socket = socket;
  }
}

// TODO: Return an instance of a class, that provides mutation methods to mutate only certain properties
// Which can act as an interface to the service class
export const createContextInner = (
  opts: NodeHTTPCreateContextFnOptions<IncomingMessage, ws>,
  config: ConfigSchema,
  db: KyselyDB
) => {
  return {
    opts,
    ctx: new Context(config, db),
    config,
  };
};

export const createContextBuilder = (config: ConfigSchema, db: KyselyDB) => {
  const createContext = (
    opts: NodeHTTPCreateContextFnOptions<IncomingMessage, ws>
  ) => {
    return createContextInner(opts, config, db);
  };
  return createContext;
};

export type IContext = Omit<
  inferAsyncReturnType<ReturnType<typeof createContextBuilder>>,
  "#options" | "#session"
>;

export type IServiceContext = Context;

export type IServiceAuthContext = Omit<Context, "auth" | "socket"> & {
  auth: NonNullable<Context["auth"]>;
  socket: NonNullable<Context["socket"]>;
};
