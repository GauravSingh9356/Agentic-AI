import { tool } from "@langchain/core/tools";
import { google } from "googleapis";
import tokens from "./tokens.json";
import { TavilySearch } from "@langchain/tavily";

import z from "zod";

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

type CancelByNameParams = {
  query: string; // e.g. "abc"
  date: string; // e.g. "2026-01-04"
};

export const searchTool = new TavilySearch({
  maxResults: 5,
  topic: "general",
});

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
);
oauth2Client.setCredentials(tokens);

const calendar = google.calendar({ version: "v3", auth: oauth2Client });

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

export const cancelEventByNameTool = tool(
  async function (params: CancelByNameParams) {
    try {
      const { query, date } = params;

      const timeMin = new Date(`${date}T00:00:00`).toISOString();
      const timeMax = new Date(`${date}T23:59:59`).toISOString();

      const events = await findMatchingEvents({
        query,
        timeMin,
        timeMax,
      });

      if (events.length === 0) {
        return `I couldn’t find any meetings today matching "${query}".`;
      }

      if (events.length > 1) {
        return (
          "I found multiple matching meetings:\n" +
          events
            .map(
              (e, i) =>
                `${i + 1}. ${e.summary} at ${
                  e.start?.dateTime || e.start?.date
                }`
            )
            .join("\n") +
          "\nPlease tell me which one to cancel."
        );
      }

      const event = events[0];

      if (!event || !event.id) {
        console.error("Event not found or missing id:", event);
        return "I ran into trouble while cancelling the meeting.";
      }

      await calendar.events.delete({
        calendarId: "primary",
        eventId: event.id,
        sendUpdates: "all",
      });

      return `I've cancelled "${event.summary}" for today and notified everyone.`;
    } catch (error) {
      console.error("Error cancelling event:", error);
      return "I ran into trouble while cancelling the meeting.";
    }
  },
  {
    name: "cancel-event-by-name",
    description:
      "Cancel a calendar meeting using natural language like name and date",
    schema: z.object({
      query: z.string().describe("Meeting title or attendee name (e.g. 'abc')"),
      date: z.string().describe("Date of the meeting in YYYY-MM-DD format"),
    }),
  }
);

async function findMatchingEvents({
  query,
  timeMin,
  timeMax,
}: {
  query: string;
  timeMin: string;
  timeMax: string;
}) {
  const response = await calendar.events.list({
    calendarId: "primary",
    q: query, // matches title + attendees
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
  });

  return response.data.items || [];
}
