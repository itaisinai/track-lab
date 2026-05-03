import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";

const model = new ChatOpenAI({
  model: "gpt-5-nano",
});

export const agent = createAgent({
  model,
  tools: [],
});
