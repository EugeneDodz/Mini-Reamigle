const WebSocket = require("ws");
const server = new WebSocket.Server({ port: 3000 });

let waitingClient = null;

server.on("connection", (ws) => {
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

console.log("WebSocket signaling server running on ws://localhost:3000");
