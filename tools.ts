import { tool } from "@langchain/core/tools";
import { google } from "googleapis";
import z from "zod";
import { oauth2Client } from "./server";

const calendar = google.calendar({ version: "v3", auth: oauth2Client });

type paramsType = {
  q: string;
  timeMin: string;
  timeMax: string;
};

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
  async function (params: paramsType) {
    console.log(params);
    const { q, timeMin, timeMax } = params;

    console.log(params);

    try {
      const response = await calendar.events.list({
        calendarId: "primary",
        q,
        timeMin,
        timeMax,
      });

      const result =
        response.data.items?.map((event) => {
          return {
            summary: event.summary,
            description: event.description,
            location: event.location,
            status: event.status,
            creator: event.creator,
            organiser: event.organizer,
            attendees: event.attendees,
            meetingLink: event.hangoutLink,
            eventType: event.eventType,
            start: event.start,
            end: event.end,
          };
        }) || [];

      console.log(result);

      return JSON.stringify(result);
    } catch (error) {
      console.error("Error fetching events:", error);
    }
    return "Failed to fetch events.";
  },
  {
    name: "get-events",
    description: "Call to get the calendar events",
    schema: z.object({
      q: z
        .string()
        .describe(
          "The query to be used for searching events on Google Calendar. It can be one of values like : summary, description, location, attendees display name, attendees email, organiser's name, organiser's email"
        ),
      timeMin: z
        .string()
        .describe(
          "The start time to fetch events from (in UTC format) for the event"
        ),
      timeMax: z
        .string()
        .describe(
          "The end time to fetch events until (in UTC format) for the event"
        ),
    }),
  }
);
