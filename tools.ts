import { tool } from "@langchain/core/tools";
import z from "zod";

export const createEventTool = tool(
  async function ({ input: string }) {
    return "The meeting has been scheduled.";
  },
  {
    name: "create-event",
    description: "Call to create a calendar event",
    schema: z.object({
      input: z.string().describe("The event details in natural language"),
    }),
  }
);

export const getEventsTool = tool(
  async function ({ input: string }) {
    return JSON.stringify([
      {
        title: "Team Meeting",
        date: "2024-07-01",
        time: "10:00 AM",
      },
      {
        title: "Doctor Appointment",
        date: "2024-07-02",
        time: "3:00 PM",
      },
    ]);
  },
  {
    name: "get-events",
    description: "Call to get the calendar events",
    schema: z.object({}),
  }
);
