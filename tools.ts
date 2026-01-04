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

type Attendee = {
  email: string;
  displayName?: string;
};

type EventData = {
  summary: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees: Attendee[];
};

export const createEventTool = tool(
  async function (params: EventData) {
    try {
      const { summary, start, end, attendees } = params;

      console.log(params);

      const response = await calendar.events.insert({
        calendarId: "primary",
        sendUpdates: "all",
        conferenceDataVersion: 1,
        requestBody: {
          summary: summary,
          start: {
            dateTime: start.dateTime,
            timeZone: start.timeZone,
          },
          end: {
            dateTime: end.dateTime,
            timeZone: end.timeZone,
          },
          attendees: attendees,
          conferenceData: {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: {
                type: "hangoutsMeet",
              },
            },
          },
        },
      } as any);

      console.log(response.data);
      return "Event created successfully.";
    } catch (error) {
      console.error("Error creating event:", error);
    }
    return "Failed to create event.";
  },
  {
    name: "create-event",
    description: "Call to create the calendar event",
    schema: z.object({
      summary: z.string().describe("The event summary"),
      start: z.object({
        dateTime: z.string().describe("The start date and time of the event"),
        timeZone: z.string().describe("The time zone of the event"),
      }),
      end: z.object({
        dateTime: z.string().describe("The end date and time of the event"),
        timeZone: z.string().describe("The time zone of the event"),
      }),
      attendees: z
        .array(
          z.object({
            email: z.string().describe("The email address of the attendee"),
            displayName: z
              .string()
              .optional()
              .describe("The display name of the attendee"),
          })
        )
        .describe("List of attendees for the event"),
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
        .describe("The start time to fetch events from for the event"),
      timeMax: z
        .string()
        .describe("The end time to fetch events until for the event"),
    }),
  }
);
