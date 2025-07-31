const ws = new WebSocket(`ws://${window.location.host}`);
const startBtn = document.getElementById("startBtn");
const hangupBtn = document.getElementById("hangupBtn");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const remoteAudio = document.getElementById("remoteAudio");
const statusText = document.getElementById("status");

let localStream, peerConnection;
const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// --- WebSocket Events ---
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
    statusText.textContent = "Partner disconnected.";
    hangUp();
  }
};

// --- Create Peer ---
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(servers);

  peerConnection.ontrack = async (event) => {
    if (event.track.kind === "video") {
      remoteVideo.srcObject = event.streams[0];
      await remoteVideo.play().catch(()=>{}); // Fix autoplay issue
    } else if (event.track.kind === "audio") {
      remoteAudio.srcObject = event.streams[0];
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

// --- Start Call ---
startBtn.onclick = async () => {
  try {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const constraints = mode === "video" ? { video: true, audio: true } : { video: false, audio: true };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;
    await localVideo.play().catch(()=>{});
    localVideo.style.display = mode === "video" ? "block" : "none";

    startBtn.disabled = true;
    hangupBtn.disabled = false;
    statusText.textContent = "Connecting...";
  } catch (err) {
    alert("Camera/mic access denied or not available!");
    console.error(err);
  }
};

// --- Hang Up ---
hangupBtn.onclick = hangUp;

function hangUp() {
  if (peerConnection) peerConnection.close();
  remoteVideo.srcObject = null;
  remoteAudio.srcObject = null;
  statusText.textContent = "Call ended.";
  startBtn.disabled = false;
  hangupBtn.disabled = true;
}
