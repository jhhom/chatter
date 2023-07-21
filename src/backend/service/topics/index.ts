import { getMessages } from "~/backend/service/topics/get-messages/get-messages";
import { sendMessage } from "~/backend/service/topics/send-message/send-message.service";
import { updateMessageReadStatus } from "~/backend/service/topics/update-message-read-status/update-message-read-status.service";
import { getUserTopics } from "~/backend/service/topics/common/get-user-topics/get-user-topics.service";
import { getContactStatus } from "~/backend/service/topics/get-contact-status/get-contact-status.service";
import { getAllUnreadMessages } from "~/backend/service/topics/get-unread-messages/get-unread-messages.service";
import notifyIsTyping from "~/backend/service/topics/notify-typing.service";
import { createGroupTopic } from "~/backend/service/topics/create-group-topic.service";
import { getGroupMembers } from "~/backend/service/topics/get-group-members.service";
import { addMembersToGroup } from "~/backend/service/topics/add-members-to-group.service";
import { findNewMembersForGroup } from "~/backend/service/topics/find-new-members-for-group.service";
import { removeGroupMember } from "~/backend/service/topics/remove-group-member.service";
import hasMessagesEarlierThan from "~/backend/service/topics/has-messages-earlier-than.service";
import { joinGroupViaId } from "~/backend/service/topics/join-group/join-group-via-id.service";
import { joinGroupViaInviteLink } from "~/backend/service/topics/join-group/join-group-via-invite-link.service";
import {
  getMemberPermissionInGroup,
  updateGroupDefaultPermission,
  updateGroupMemberPermission,
  updateUserDefaultPermission,
  updatePeerPermission,
} from "~/backend/service/topics/permissions/permissions.service";
import { deleteMessage } from "~/backend/service/topics/delete-message.service";
import { forwardMessage } from "~/backend/service/topics/forward-message/forward-message.service";
import { replyMessage } from "~/backend/service/topics/reply-message/reply-message.service";
import { getMessagesUntilReply } from "~/backend/service/topics/get-messages-until-reply/get-messages-until-reply";
import { getGroupInviteLink } from "~/backend/service/topics/get-group-invite-link.service";
import { getGroupPreviewInfo } from "~/backend/service/topics/get-group-preview-info.service";
import { isUserAlreadyAMemberOfGroup } from "~/backend/service/topics/is-user-already-a-member-of-group.service";
import { leaveGroup } from "~/backend/service/topics/leave-group.service";
import { blockPeer } from "~/backend/service/topics/permissions/block-user.service";
import { getContactPreviewInfo } from "~/backend/service/topics/get-contact-preview-info.service";
import { clearMessages } from "~/backend/service/topics/clear-messages.service";

const topicUsecase = {
  getMessages,
  getMessagesUntilReply,
  getGroupMembers,
  sendMessage,
  forwardMessage,
  deleteMessage,
  replyMessage,
  updateMessageReadStatus,
  getUserTopics,
  notifyIsTyping,
  getContactStatus,
  getAllUnreadMessages,
  createGroupTopic,
  leaveGroup,
  getGroupInviteLink,
  getGroupPreviewInfo,
  joinGroupViaId,
  joinGroupViaInviteLink,
  addMembersToGroup,
  findNewMembersForGroup,
  removeGroupMember,
  hasMessagesEarlierThan,
  updateUserDefaultPermission,
  updateGroupDefaultPermission,
  updateGroupMemberPermission,
  updatePeerPermission,
  getMemberPermissionInGroup,
  isUserAlreadyAMemberOfGroup,
  getContactPreviewInfo,
  blockPeer,
  clearMessages,
};

export { topicUsecase };
