import { UserId, GroupTopicId } from "~/backend/drizzle/schema";
import { z } from "zod";

export const zUserId = z.custom<`usr${string}`>((val) => {
  return (val as string).startsWith("usr");
});

export const zGroupId = z.custom<`grp${string}`>((val) => {
  return (val as string).startsWith("grp");
});

export const zP2PTopicId = z.custom<`p2p${string}`>((val) => {
  return (val as string).startsWith("p2p");
});

export const zUserOrGroupId = z.custom<UserId | GroupTopicId>((val) => {
  const v = val as string;
  return v.length == 15 && (v.startsWith("usr") || v.startsWith("grp"));
});
