import { getMessages } from "./use-cases/get-messages/get-messages";
import { sendMessage } from "./use-cases/send-message/send-message";
import { updateMessageReadStatus } from "./use-cases/update-message-read-status/update-message-read-status";
import { getTopicsOfUser } from "./use-cases/get-user-topics/get-user-topics";
import { getContactStatus } from "./use-cases/get-contact-status/get-contact-status";
import { getAllUnreadMessages } from "./use-cases/get-unread-messages/get-unread-messages";
import notifyIsTyping from "./use-cases/notify-typing/notify-typing";
import { createGroupTopic } from "./use-cases/create-group-topic/create-group-topic";
import { getGroupMembers } from "./use-cases/get-group-members/get-group-members";
import { addMembersToGroup } from "./use-cases/add-members-to-group/add-members-to-group";
import { findNewMembersForGroup } from "./use-cases/find-new-members-for-group/find-new-members-for-group";
import { removeGroupMember } from "./use-cases/remove-group-member/remove-group-member";
import hasMessagesEarlierThan from "./use-cases/has-messages-earlier-than/has-messages-earlier-than";
import { subscribeToGroupTopic } from "./use-cases/subscribe-group-topic/subscribe-group-topic";
import { subscribeToGroupTopicViaInviteLink } from "./use-cases/subscribe-group-topic/subscribe-group-topic-via-invite-link";
import {
  updateGroupDefaultPermission,
  updateGroupMemberPermission,
  updateUserDefaultPermission,
  updatePeerPermission,
  getPeerPermission,
  getMemberPermissionInGroup,
} from "./use-cases/permissions/permissions";
import { deleteMessage } from "./use-cases/delete-message/delete-message";
import { forwardMessage } from "./use-cases/forward-message/forward-message";
import { replyMessage } from "./use-cases/reply-message/reply-message";
import { getMessagesUntilReply } from "./use-cases/get-messages-until-reply/get-messages-until-reply";
import { getGroupInviteLink } from "./use-cases/get-group-invite-link/get-group-invite-link";
import { getGroupPreviewInfo } from "./use-cases/get-group-preview-info/get-group-preview-info";
import { isUserAlreadyAMemberOfGroup } from "./use-cases/is-user-already-a-member-of-group/is-user-already-a-member-of-group";
import { leaveGroup } from "./use-cases/leave-group/leave-group";
import { blockPeer } from "~/backend/service/topics/use-cases/permissions/block-user";
import { getContactPreviewInfo } from "~/backend/service/topics/use-cases/get-contact-preview-info/get-contact-preview-info";
import { clearMessages } from "~/backend/service/topics/use-cases/clear-messages/clear-messages";

const topicUsecase = {
  getMessages,
  getMessagesUntilReply,
  getGroupMembers,
  sendMessage,
  forwardMessage,
  deleteMessage,
  replyMessage,
  updateMessageReadStatus,
  getTopicsOfUser,
  notifyIsTyping,
  getContactStatus,
  getAllUnreadMessages,
  createGroupTopic,
  leaveGroup,
  getGroupInviteLink,
  getGroupPreviewInfo,
  subscribeToGroupTopic,
  subscribeToGroupTopicViaInviteLink,
  addMembersToGroup,
  findNewMembersForGroup,
  removeGroupMember,
  hasMessagesEarlierThan,
  updateUserDefaultPermission,
  updateGroupDefaultPermission,
  updateGroupMemberPermission,
  updatePeerPermission,
  getPeerPermission,
  getMemberPermissionInGroup,
  isUserAlreadyAMemberOfGroup,
  getContactPreviewInfo,
  blockPeer,
  clearMessages,
};

export { topicUsecase };
