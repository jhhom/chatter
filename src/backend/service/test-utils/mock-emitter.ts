import {
  SubscriptionMessage,
  EventPayload,
} from "~/api-contract/subscription/subscription";
import { Socket } from "~/backend/service/common/socket";

export class MockEmitter {
  receivedMessages: SubscriptionMessage[];
  socket: Socket;

  constructor() {
    this.receivedMessages = [];
    this.socket = {
      next: (value) => {
        this.receivedMessages.push(value);
      },
      error: (err) => {
        //
      },
      complete: () => {
        //
      },
    };
  }

  lastReceived() {
    if (this.receivedMessages.length === 0) {
      return undefined;
    }
    return this.receivedMessages[this.receivedMessages.length - 1];
  }

  lastReceivedNotificationByEvent<T extends SubscriptionMessage["event"]>(
    event: T
  ) {
    const filtered = this.receivedMessages.filter((x) => x.event == event);
    if (filtered.length == 0) {
      return undefined;
    }
    return filtered[filtered.length - 1] as {
      event: T;
      payload: EventPayload[T];
    };
  }
}
