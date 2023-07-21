import {
  GroupTopicId,
  P2PTopicId,
  TopicEventType,
  UserId,
} from "~/backend/drizzle/schema";
import { match } from "ts-pattern";

export function IsUserId(id: string): id is UserId {
  return id.length == 15 && id.substring(0, 3) == "usr";
}

export function IsGroupTopicId(id: string): id is GroupTopicId {
  return id.length == 15 && id.substring(0, 3) == "grp";
}

export function IsP2PTopicId(id: string): id is P2PTopicId {
  return id.length == 15 && id.substring(0, 3) == "p2p";
}

export function formatTopicEventLogMessage(
  topicEvent: TopicEventType,
  names: {
    actor: string;
    affected: string;
  }
) {
  const message = match(topicEvent)
    .with("add_member", () => `${names.actor} added ${names.affected}`)
    .with(
      "change_member_permission",
      () => `${names.actor} changed ${names.affected}'s permission`
    )
    .with("remove_member", () => `${names.actor} removed ${names.affected}`)
    .with("create_group", () => `${names.actor} created the group`)
    .with(
      "join-group-through-id",
      () => `${names.actor} joined the group by id`
    )
    .with(
      "join-group-through-invite-link",
      () => `${names.actor} joined the group through invite link`
    )
    .with("leave_group", () => `${names.actor} left the group`)
    .exhaustive();
  return message;
}
