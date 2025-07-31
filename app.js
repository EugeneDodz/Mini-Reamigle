const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "public"))); // Serve HTML/CSS/JS

let waitingClient = null;

wss.on("connection", (ws) => {
  console.log("New client connected");
  ws.isReady = false;

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "ready") {
      ws.isReady = true;
      if (waitingClient && waitingClient.isReady) {
        // ✅ Match both clients
        ws.partner = waitingClient;
        waitingClient.partner = ws;

        ws.send(JSON.stringify({ type: "match" }));
        waitingClient.send(JSON.stringify({ type: "match" }));

        waitingClient = null;
      } else {
        waitingClient = ws;
        ws.send(JSON.stringify({ type: "waiting" }));
      }
    }
    else if (["offer", "answer", "ice-candidate"].includes(data.type)) {
      if (ws.partner) ws.partner.send(JSON.stringify(data));
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
