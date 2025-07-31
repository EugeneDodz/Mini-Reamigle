const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "public"))); // Serve your HTML/CSS/JS in "public"

let waitingClient = null;

wss.on("connection", (ws) => {
  console.log("New client connected");
  
  if (waitingClient) {
    // Match with waiting client
    ws.partner = waitingClient;
    waitingClient.partner = ws;

    ws.send(JSON.stringify({ type: "match" }));
    waitingClient.send(JSON.stringify({ type: "match" }));

    waitingClient = null;
  } else {
    // Put in waiting queue
    waitingClient = ws;
    ws.send(JSON.stringify({ type: "waiting" }));
  }

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    console.log("Received:", data);

    if (ws.partner) {
      ws.partner.send(JSON.stringify(data));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    if (ws.partner) {
      ws.partner.send(JSON.stringify({ type: "partner-disconnected" }));
      ws.partner.partner = null;
    }
    if (waitingClient === ws) waitingClient = null;
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
