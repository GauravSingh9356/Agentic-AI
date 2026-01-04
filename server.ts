import express from "express";
import { google } from "googleapis";
import cors from "cors";
import { main } from ".";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3600;

// generate a url that asks permissions for Google Calendar scopes
const scopes = ["https://www.googleapis.com/auth/calendar"];

app.post("/", async (req, res) => {
  const { threadId, message } = req.body;
  if (!threadId || !message) {
    return res.status(400).json({
      message: "threadId and message are required",
    });
  }

  const assistantReply = await main(threadId, message);

  return res.json({
    message: assistantReply,
  });
});

app.get("/auth", (req, res) => {
  // genetate a URL to authenticate with Google OAuth2
  const url = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });
  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code as string;

  const { tokens } = await oauth2Client.getToken(code);
  console.log(tokens);
  // exchange the code with access token and refresh token
  // (This would involve making an HTTP request to Google's OAuth2 token endpoint)

  res.send("Authentication successful. You can close this window.");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
