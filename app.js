const createBtn = document.getElementById('createSession');
const joinBtn = document.getElementById('joinSession');
const simpleCodeInput = document.getElementById('simpleCodeInput');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const progressBar = document.getElementById('progressBar');
const notifications = document.getElementById('notifications');

let peer = null;
let connection = null;

// Simple code to PeerJS ID mapping
const peerIdMap = {};

function notify(message) {
  notifications.textContent = message;
}

function resetUI() {
  fileInput.value = '';
  fileInput.disabled = true;
  fileInfo.textContent = '';
  progressBar.value = 0;
}

// Generate short random code (6 chars A-Z0-9)
function generateSimpleCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for(let i=0; i<6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function createSession() {
  resetUI();

  peer = new Peer();

  peer.on('open', id => {
    notify(`Session started. Your Peer ID: ${id}`);

    // Generate simple code & map
    const code = generateSimpleCode();
    peerIdMap[code] = id;
    simpleCodeInput.value = code;
    notify(`Share this code with your partner: ${code}`);
  });

  peer.on('connection', conn => {
    connection = conn;
    setupConnection();
  });

  peer.on('error', err => {
    notify(`Error: ${err.type}`);
  });
}

function joinSession() {
  const code = simpleCodeInput.value.trim().toUpperCase();
  if (!code) {
    notify('Please enter a simple code to join.');
    return;
  }

  resetUI();

  peer = new Peer();

  peer.on('open', () => {
    // Map simple code to real peer ID here
    const targetPeerId = peerIdMap[code];
    if (!targetPeerId) {
      notify('Invalid code or peer not available.');
      return;
    }
    connection = peer.connect(targetPeerId);
    setupConnection();
  });

  peer.on('error', err => {
    notify(`Error: ${err.type}`);
  });
}

function setupConnection() {
  connection.on('open', () => {
    notify(`Connected to ${connection.peer}`);
    fileInput.disabled = false;
  });

  connection.on('data', data => {
    if (data.meta) {
      fileInfo.textContent = `Receiving file: ${data.meta.name} (${formatBytes(data.meta.size)})`;
      progressBar.value = 0;
    } else if (data.chunk) {
      receiveFileChunk(data.chunk);
    }
  });

  connection.on('close', () => {
    notify('Connection closed.');
    resetUI();
  });

  connection.on('error', err => {
    notify(`Connection error: ${err}`);
    resetUI();
  });
}

let receivedBuffers = [];
let receivedSize = 0;
let expectedSize = 0;

function receiveFileChunk(chunk) {
  const uint8Array = new Uint8Array(chunk);
  receivedBuffers.push(uint8Array);
  receivedSize += uint8Array.length;
  progressBar.value = (receivedSize / expectedSize) * 100;

  if (receivedSize >= expectedSize) {
    const blob = new Blob(receivedBuffers);
    downloadBlob(blob, 'received_file');
    notify('File received successfully!');
    receivedBuffers = [];
    receivedSize = 0;
    expectedSize = 0;
    fileInfo.textContent = '';
    progressBar.value = 0;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

fileInput.addEventListener('change', () => {
  if (!connection || connection.open === false) {
    notify('No active connection.');
    fileInput.value = '';
    return;
  }

  const file = fileInput.files[0];
  if (!file) return;

  notify(`Sending file: ${file.name} (${formatBytes(file.size)})`);

  connection.send({ meta: { name: file.name, size: file.size } });

  const chunkSize = 64 * 1024;
  let offset = 0;
  const reader = new FileReader();

  reader.onload = e => {
    connection.send({ chunk: e.target.result });
    offset += e.target.result.byteLength;
    progressBar.value = (offset / file.size) * 100;

    if (offset < file.size) {
      readSlice(offset);
    } else {
      notify('File sent successfully!');
      fileInput.value = '';
    }
  };

  function readSlice(o) {
    const slice = file.slice(o, o + chunkSize);
    reader.readAsArrayBuffer(slice);
  }

  readSlice(0);
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024,
    sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

createBtn.addEventListener('click', createSession);
joinBtn.addEventListener('click', joinSession);