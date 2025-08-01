const protocol = window.location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${protocol}://${window.location.hostname}:3000`);

const startBtn = document.getElementById("startBtn");
const hangupBtn = document.getElementById("hangupBtn");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const remoteAudio = document.getElementById("remoteAudio");
const statusText = document.getElementById("status");
const micBar = document.getElementById("mic-bar");
const debugLog = document.getElementById("debugLog");
const micSelect = document.getElementById("micSelect");

let localStream, peerConnection;
const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function logDebug(msg) {
  console.log(msg);
  debugLog.textContent += `\n${msg}`;
  debugLog.scrollTop = debugLog.scrollHeight;
}

// ===========================
// WebSocket Signaling
// ===========================
ws.onmessage = async (msg) => {
  const data = JSON.parse(msg.data);

  if (data.type === "waiting") {
    statusText.textContent = "Waiting for a partner...";
    logDebug("Server: Waiting...");
  } 
  else if (data.type === "match") {
    statusText.textContent = "Partner found!";
    logDebug("Server: Partner matched!");
    createPeerConnection();
    if (localStream) addTracksToPeer(localStream);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", offer }));
  } 
  else if (data.type === "offer") {
    createPeerConnection();
    if (localStream) addTracksToPeer(localStream);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: "answer", answer }));
  } 
  else if (data.type === "answer") {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  } 
  else if (data.type === "ice-candidate") {
    try { await peerConnection.addIceCandidate(data.candidate); } 
    catch (e) { console.error("ICE Error:", e); }
  } 
  else if (data.type === "partner-disconnected") {
    statusText.textContent = "Partner disconnected. Returning to waiting...";
    hangUp();
    ws.send(JSON.stringify({ type: "ready" }));
  }
};

// ===========================
// Peer Connection
// ===========================
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(servers);

  peerConnection.ontrack = async (event) => {
    logDebug("Remote tracks: " + event.streams[0].getTracks().map(t => t.kind).join(", "));
    const stream = event.streams[0];
    if (event.track.kind === "video") {
      remoteVideo.srcObject = stream;
      await remoteVideo.play().catch(()=>{});
    } else if (event.track.kind === "audio") {
      remoteAudio.srcObject = stream;
      await remoteAudio.play().catch(()=>{});
    }
  };

  peerConnection.onconnectionstatechange = () => {
    logDebug("Connection state: " + peerConnection.connectionState);
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }));
    }
  };
}

function addTracksToPeer(stream) {
  stream.getTracks().forEach(track => {
    logDebug("Adding track: " + track.kind);
    peerConnection.addTrack(track, stream);
  });
}

// ===========================
// Mic Device Handling
// ===========================
async function populateMicDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  micSelect.innerHTML = "";
  devices.filter(d => d.kind === "audioinput").forEach((d) => {
    const option = document.createElement("option");
    option.value = d.deviceId;
    option.textContent = d.label || `Mic ${micSelect.length + 1}`;
    micSelect.appendChild(option);
  });
}

async function setupMedia() {
  await populateMicDevices();
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const micDeviceId = micSelect.value;

  const constraints = { 
    audio: { 
      deviceId: micDeviceId ? { exact: micDeviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true 
    },
    video: mode === "video"
  };

  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  logDebug("Mic tracks: " + localStream.getAudioTracks().length);

  if (localStream.getAudioTracks().length === 0) {
    alert("⚠ No mic detected! Check browser/device settings.");
  }

  localVideo.srcObject = localStream;
  localVideo.muted = true;
  await localVideo.play().catch(()=>{});

  setupMicIndicator(localStream);
}

// ===========================
// Buttons & Events
// ===========================
startBtn.onclick = async () => {
  await setupMedia();
  ws.send(JSON.stringify({ type: "ready" }));
  startBtn.disabled = true;
  hangupBtn.disabled = false;
  statusText.textContent = "Connecting...";
};

hangupBtn.onclick = hangUp;
function hangUp() {
  if (peerConnection) peerConnection.close();
  remoteVideo.srcObject = null;
  remoteAudio.srcObject = null;
  statusText.textContent = "Call ended.";
  startBtn.disabled = false;
  hangupBtn.disabled = true;
}

// ===========================
// Mic Level Indicator
// ===========================
function setupMicIndicator(stream) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioCtx.createAnalyser();
  const source = audioCtx.createMediaStreamSource(stream);
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 2.0; // Boost mic gain

  source.connect(gainNode);
  gainNode.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function updateMic() {
    analyser.getByteFrequencyData(dataArray);
    const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const level = Math.min(8, Math.floor(volume / 15));
    micBar.textContent = "█".repeat(level) || "▁";
    requestAnimationFrame(updateMic);
  }
  updateMic();
}

// ===========================
// Autoplay Unlock
// ===========================
document.body.addEventListener("click", () => {
  if (remoteAudio.srcObject) remoteAudio.play().catch(()=>{});
});

// Debug Mic State
setInterval(() => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) logDebug("Mic state: " + audioTrack.readyState + " | Muted: " + audioTrack.muted);
  }
}, 2000);
