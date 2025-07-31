const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from "public" folder
app.use(express.static(path.join(__dirname, "public")));

// Fallback route to serve index.html for "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// WebSocket matchmaking logic
let waitingClient = null;

wss.on("connection", (ws) => {
  console.log("New client connected");

  if (!waitingClient) {
    waitingClient = ws;
    ws.send(JSON.stringify({ type: "waiting" }));
  } else {
    const partner = waitingClient;
    waitingClient = null;

    ws.partner = partner;
    partner.partner = ws;

    ws.send(JSON.stringify({ type: "match" }));
    partner.send(JSON.stringify({ type: "match" }));
  }

  ws.on("message", (message) => {
    if (ws.partner && ws.partner.readyState === ws.OPEN) {
      ws.partner.send(message);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    if (ws.partner) {
      ws.partner.send(JSON.stringify({ type: "partner-disconnected" }));
      ws.partner.partner = null;
    } else if (waitingClient === ws) {
      waitingClient = null;
    }
  });
});

// Use Render's dynamic port or fallback to 3000 locally
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
