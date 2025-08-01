const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files (HTML/JS/CSS)
app.use(express.static(path.join(__dirname, "public")));

// ✅ Handle root route to serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

let waitingClient = null;

wss.on("connection", (ws) => {
  console.log("Client connected");

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

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
      ws.partner.send(JSON.stringify(data));
    } else if (data.type === "ready" && !waitingClient) {
      waitingClient = ws;
      ws.send(JSON.stringify({ type: "waiting" }));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
      ws.partner.send(JSON.stringify({ type: "partner-disconnected" }));
      ws.partner.partner = null;
    }
    if (waitingClient === ws) waitingClient = null;
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
