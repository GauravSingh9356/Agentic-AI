import { ChatGroq } from "@langchain/groq";
import { createEventTool, getEventsTool } from "./tools";
import {
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { AIMessage } from "@langchain/core/messages";

const memorySaver = new MemorySaver();

const tools: any = [createEventTool, getEventsTool];
const toolNode = new ToolNode(tools);

const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
  temperature: 0,
}).bindTools(tools);

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

function shoudContinue(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  return (lastMessage.tool_calls?.length ?? 0) > 0 ? "tools" : "__end__";
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode("assistant", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "assistant")
  .addEdge("tools", "assistant")
  .addConditionalEdges("assistant", shoudContinue, {
    __end__: END,
    tools: "tools",
  });

const app = graph.compile({ checkpointer: memorySaver });

async function main() {
  const config = {
    configurable: {
      thread_id: "personal-assistant-chat",
    },
  };
  const result = await app.invoke(
    {
      messages: [
        {
          role: "user",
          content: "Do I have any meeting today and tomorrow?",
        },
      ],
    },
    config
  );

  console.log(result.messages[result.messages.length - 1]?.content);
}

main();
