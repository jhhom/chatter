import { z } from "zod";

export const messageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), content: z.string() }),
  z.object({
    type: z.literal("picture"),
    base64: z.string().min(1),
    caption: z.string(),
    filename: z.string().min(1),
  }),
  z.object({
    type: z.literal("file"),
    base64: z.string(),
    caption: z.string(),
    filename: z.string().min(1),
  }),
]);

export type MessageInput = z.infer<typeof messageSchema>;
