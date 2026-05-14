import type { AgentToolCall } from "@track-lab/api-types";

export type ToolExecution = {
  call: AgentToolCall;
  result: unknown | null;
};
