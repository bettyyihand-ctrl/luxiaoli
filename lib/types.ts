export type Role = "user" | "assistant";

export interface MessageContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface Message {
  id: string; // for React keys
  role: Role;
  content: MessageContent[];
  rawText?: string;
}

export type ActionMode = "计算" | "咨询" | "文书" | "霍格沃茨";

export interface ChatState {
  messages: Message[];
  isSending: boolean;
  selectedMode: ActionMode;
  userContext: Record<string, unknown>;
}
