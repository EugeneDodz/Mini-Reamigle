const express = require("express");
const { WebSocketServer } = require("ws");
const http = require("http");
const path = require("path");
const os = require("os");

const app = express();

// --- View engine (EJS) ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- Static files ---
app.use(express.static(path.join(__dirname, "public")));

// --- Routes ---
app.get("/", (req, res) => {
  res.render("index"); // renders views/index.ejs
});

// --- Create HTTP Server ---
const server = http.createServer(app);

// --- WebSocket Signaling ---
const wss = new WebSocketServer({ server });
let waitingUser = null;

wss.on("connection", (ws) => {
  ws.partner = null;

  if (waitingUser) {
    ws.partner = waitingUser;
    waitingUser.partner = ws;
    ws.send(JSON.stringify({ type: "match" }));
    waitingUser.send(JSON.stringify({ type: "match" }));
    waitingUser = null;
  } else {
    waitingUser = ws;
    ws.send(JSON.stringify({ type: "waiting" }));
  }

  ws.on("message", (msg) => {
    if (ws.partner) ws.partner.send(msg);
  });

  ws.on("close", () => {
    if (ws.partner) {
      ws.partner.send(JSON.stringify({ type: "partner-disconnected" }));
      ws.partner.partner = null;
    }
    if (waitingUser === ws) waitingUser = null;
  });
});

// --- Get LAN IP ---
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (let iface in interfaces) {
    for (let config of interfaces[iface]) {
      if (config.family === "IPv4" && !config.internal) return config.address;
    }
  }
  return "localhost";
}

// --- Start HTTP Server ---
const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {  
  const localIP = getLocalIP();
  console.log("✅ Server running with HTTP");
  console.log(`💻 Desktop: http://localhost:${PORT}`);
  console.log(`📱 Mobile (same Wi-Fi): http://${localIP}:${PORT}`);
  console.log("⚠️ Camera/mic may be blocked without HTTPS.");
});
