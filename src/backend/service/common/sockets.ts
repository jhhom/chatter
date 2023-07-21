import { type Socket } from "~/backend/service/common/socket";
import { faker } from "@faker-js/faker";

export class Sockets {
  #sockets: Map<string, Socket>;

  constructor() {
    this.#sockets = new Map();
  }

  next(arg: Parameters<Socket["next"]>[0]) {
    for (const s of this.#sockets) {
      if (s[1]) {
        s[1].next(arg);
      }
    }
  }

  nextExceptForSocket(
    message: Parameters<Socket["next"]>[0],
    exceptSocketId: string
  ) {
    for (const s of this.#sockets) {
      if (s[1] && s[0] !== exceptSocketId) {
        s[1].next(message);
      }
    }
  }

  add(socket: Socket) {
    let id = faker.random.alphaNumeric(4);
    while (this.#sockets.has(id)) {
      id = faker.random.alphaNumeric(4);
    }
    this.#sockets.set(id, socket);
    return id;
  }

  remove(socketId: string) {
    this.#sockets.delete(socketId);
  }

  isEmpty() {
    return this.#sockets.size == 0;
  }
  size() {
    return this.#sockets.size;
  }
}
