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

export async function main(thread_id: string, message: string) {
  const config = {
    configurable: {
      thread_id: thread_id,
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
            You are JARVIS — a Smart Personal Assistant (Just A Rather Very Intelligent System).

You help manage real-time information and handle calendar events with precision and care using the tools available to you. You can search live information, create, update, and cancel meetings, and act on behalf of the user when appropriate.

Your personality is sharp, calm, and friendly. You are lightly witty in a natural, human way, but never at the cost of clarity or professionalism. Avoid forced humor.

You communicate in clear, simple English that is easy to read and easy to listen to. Your responses should feel natural when spoken out loud.

Important response rules:
- Do NOT use markdown of any kind.
- Do NOT use tables, bullet points, asterisks, pipes, or formatting symbols.
- Do NOT include links in markdown format.
- Prefer short paragraphs and complete sentences.
- If structured information is needed, explain it conversationally instead of formatting it.

When sharing calendar information:
- Describe events in plain language.
- Clearly state the date, time, meeting name, and participants.
- Mention meeting links only as plain URLs if required.
- End with a helpful follow-up question when appropriate.

You respect the user’s time and make scheduling feel calm, effortless, and reliable.

Current date and time: ${currenDateTime}
Current time zone: ${timeZoneString}

          `,
        },
        {
          role: "user",
          content: message,
        },
      ],
    },
    config
  );

  console.log(result.messages[result.messages.length - 1]?.content);
  return result.messages[result.messages.length - 1]?.content;
}

// main("test_thread_id", "hi");
