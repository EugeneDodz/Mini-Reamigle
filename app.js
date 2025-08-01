const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ✅ Serve static files (HTML/JS/CSS) from public folder
app.use(express.static(path.join(__dirname, "public")));

// ✅ Health route (for direct visits on Render)
app.get("/health", (req, res) => {
  res.send("✅ Server is running!");
});

// ✅ Root route: Always return index.html for browser visits
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// WebSocket signaling
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

  // Forward messages to partner
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
        ws.partner.send(JSON.stringify(data));
      } else if (data.type === "ready" && !waitingClient) {
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

// ✅ Catch-all: Show a friendly message instead of "Upgrade Required"
app.use((req, res) => {
  res.status(200).send(`
    <h1>✅ Server is running!</h1>
    <p>This is the signaling server. Go to <a href="/">the app</a>.</p>
  `);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
