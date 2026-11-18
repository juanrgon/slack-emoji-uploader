/** Sent by the slackmojis.com content script when someone clicks an emoji there. */
export interface AddSlackmojiMessage {
  type: "add-slackmoji";
  name: string;
  imageUrl: string;
}

export function isAddSlackmojiMessage(message: unknown): message is AddSlackmojiMessage {
  if (typeof message !== "object" || message === null) return false;
  const { type, name, imageUrl } = message as Record<string, unknown>;
  return type === "add-slackmoji" && typeof name === "string" && typeof imageUrl === "string";
}
