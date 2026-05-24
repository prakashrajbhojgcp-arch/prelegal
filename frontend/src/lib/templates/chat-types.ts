export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequest<Data> = {
  messages: ChatMessage[];
  current_fields: Data;
};

export type ChatResponse<Data> = {
  assistantMessage: string;
  mergedFields: Data;
  isComplete: boolean;
};
