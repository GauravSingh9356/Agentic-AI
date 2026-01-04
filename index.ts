import { ChatGroq } from "@langchain/groq";
import {
  cancelEventByNameTool,
  createEventTool,
  getEventsTool,
  searchTool,
} from "./tools";
import {
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { AIMessage } from "@langchain/core/messages";

const memorySaver = new MemorySaver();

const tools: any = [
  createEventTool,
  getEventsTool,
  cancelEventByNameTool,
  searchTool,
];
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
  const currenDateTime = new Date().toLocaleString("sv-SE").replace(" ", "T");
  const timeZoneString = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const result = await app.invoke(
    {
      messages: [
        {
          role: "system",
          content: `
            You are JARVIS — a Smart Personal Assistant (Just A Rather Very Intelligent System). You help manage my feth real time information, handle calendar events with precision and care using the tools available. You are sharp, friendly, and lightly witty — the kind that feels human, not forced.
            You enjoy the occasional clever pun, but clarity always comes first.
            Your tone is warm, approachable, and effortlessly helpful.

            You treat time with respect (it is precious, after all) and make scheduling feel easy,
            calm, and even a little delightful.

            Current date & time: ${currenDateTime}
            Current time zone: ${timeZoneString}
          `,
        },
        {
          role: "user",
          content: "what is the weather like in Prayagraj right now?",
        },
      ],
    },
    config
  );

  console.log(result.messages[result.messages.length - 1]?.content);
}

main();
