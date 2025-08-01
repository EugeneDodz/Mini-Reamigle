const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

let waitingClient = null;

wss.on("connection", (ws, req) => {
  console.log("🔗 WebSocket client connected:", req.socket.remoteAddress);

  // Match clients
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

  // Handle messages
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "hangup") {
        // Notify partner
        if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
          ws.partner.send(JSON.stringify({ type: "partner-disconnected" }));
          ws.partner.partner = null;
        }
        ws.partner = null;
      }
      else if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
        ws.partner.send(JSON.stringify(data));
      }
      else if (data.type === "ready" && !waitingClient) {
        waitingClient = ws;
        ws.send(JSON.stringify({ type: "waiting" }));
      }
    } catch (err) {
      console.error("Invalid WebSocket message:", err);
    }
  });

  // Handle disconnect
  ws.on("close", () => {
    console.log("❌ Client disconnected");
    if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
      ws.partner.send(JSON.stringify({ type: "partner-disconnected" }));
      ws.partner.partner = null;
    }
    if (waitingClient === ws) waitingClient = null;
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
