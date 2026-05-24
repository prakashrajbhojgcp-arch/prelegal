import type { NdaData } from "./nda-schema";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  current_fields: NdaData;
};

export type ChatResponse = {
  assistantMessage: string;
  mergedFields: NdaData;
  isComplete: boolean;
};
