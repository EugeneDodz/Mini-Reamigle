const protocol = window.location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${protocol}://${window.location.host}`);

const startBtn = document.getElementById("startBtn");
const hangupBtn = document.getElementById("hangupBtn");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const remoteAudio = document.getElementById("remoteAudio");
const statusText = document.getElementById("status");
const micBar = document.getElementById("mic-bar");

let localStream, peerConnection;
const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

ws.onmessage = async (msg) => {
  const data = JSON.parse(msg.data);

  if (data.type === "waiting") {
    statusText.textContent = "Waiting for a partner...";
  } 
  else if (data.type === "match") {
    statusText.textContent = "Partner found!";
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
    ws.send(JSON.stringify({ type: "ready" })); // Auto requeue
  }
};

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(servers);

  peerConnection.ontrack = async (event) => {
    const stream = event.streams[0];
    if (event.track.kind === "video") {
      remoteVideo.srcObject = stream;
      await remoteVideo.play().catch(()=>{});
    } else if (event.track.kind === "audio") {
      console.log("Remote audio received:", stream.getAudioTracks());
      remoteAudio.srcObject = stream;
      remoteAudio.autoplay = true;
      remoteAudio.volume = 1.0;
      await remoteAudio.play().catch(()=>{});
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }));
    }
  };
}

function addTracksToPeer(stream) {
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
}

startBtn.onclick = async () => {
  try {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const constraints = { 
      audio: { echoCancellation: true, noiseSuppression: true },
      video: mode === "video"
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log("Local audio tracks:", localStream.getAudioTracks());

    localVideo.srcObject = localStream;
    localVideo.muted = true;
    await localVideo.play().catch(()=>{});
    localVideo.style.display = mode === "video" ? "block" : "none";

    setupMicIndicator(localStream); // 🎤 Mic Level Visualizer

    ws.send(JSON.stringify({ type: "ready" })); // Enter queue

    startBtn.disabled = true;
    hangupBtn.disabled = false;
    statusText.textContent = "Connecting...";
  } catch (err) {
    alert("Camera/mic access denied or not available!");
    console.error(err);
  }
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

// 🎤 Mic Level Indicator
function setupMicIndicator(stream) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioCtx.createAnalyser();
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function updateMic() {
    analyser.getByteFrequencyData(dataArray);
    const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const level = Math.floor(volume / 15); // Scale level
    micBar.textContent = "█".repeat(level) || "▁";
    requestAnimationFrame(updateMic);
  }
  updateMic();
}

// Autoplay workaround (mobile browsers)
document.body.addEventListener("click", () => {
  if (remoteAudio.srcObject) remoteAudio.play().catch(()=>{});
  if (remoteVideo.srcObject) remoteVideo.play().catch(()=>{});
});
