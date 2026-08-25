export type MistralPrompt = Array<MistralMessage>;

export type MistralMessage =
  | MistralSystemMessage
  | MistralUserMessage
  | MistralAssistantMessage
  | MistralToolMessage;

export interface MistralSystemMessage {
  role: 'system';
  content: string;
}

export interface MistralUserMessage {
  role: 'user';
  content: Array<MistralUserMessageContent>;
}

export type MistralUserMessageContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: string }
  | { type: 'document_url'; document_url: string };

export interface MistralAssistantMessage {
  role: 'assistant';
  content: string | Array<MistralAssistantMessageContent>;
  prefix?: boolean;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export type MistralAssistantMessageContent =
  | { type: 'text'; text: string }
  | MistralThinkChunk;

export type MistralThinkChunk = {
  type: 'thinking';
  thinking: Array<MistralThinkingContent>;
  closed?: boolean;
  signature?: string | null;
};

export type MistralThinkingContent =
  | { type: 'text'; text: string }
  | {
      type: 'tool_reference';
      tool: string;
      title: string;
      url?: string | null;
      favicon?: string | null;
      description?: string | null;
    }
  | { type: 'reference'; reference_ids: Array<string | number> };

export interface MistralToolMessage {
  role: 'tool';
  name: string;
  content: string;
  tool_call_id: string;
}

export type MistralToolChoice =
  | { type: 'function'; function: { name: string } }
  | 'auto'
  | 'none'
  | 'any';
