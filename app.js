const createBtn = document.getElementById("create");
const joinBtn = document.getElementById("join");
const peerIdInput = document.getElementById("peerId");
const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("status");
const bar = document.getElementById("bar");
const toggle = document.getElementById("toggleTheme");

let peer, conn;

function log(s){statusEl.innerText = "Status: "+s;}
function setProgress(p){bar.style.width = p+"%";}

toggle.onclick = ()=>{
  document.body.classList.toggle("dark");
  document.body.classList.toggle("light");
};

createBtn.onclick = () => {
  peer = new Peer();
  peer.on("open", id=>{
    log("Session তৈরি হয়েছে: "+id);
    peerIdInput.value = id;
  });
  peer.on("connection", c=>{
    conn = c;
    setupConnection();
  });
};

joinBtn.onclick = () => {
  const id = peerIdInput.value.trim();
  if(!id) return alert("ID দিন!");
  peer = new Peer();
  peer.on("open", () => {
    conn = peer.connect(id);
    setupConnection();
  });
};

function setupConnection(){
  conn.on("open",()=>{
    log("Connected to: "+conn.peer);
    fileInput.disabled = false;
  });
  // Receive chunks
  let buf=[], filesize=0, received=0;
  conn.on("data", data=>{
    if(data.meta){
      filesize = data.meta.size;
      log("Transfer শুরু হয়েছে...");
    } else {
      buf.push(data.chunk);
      received += data.chunk.byteLength;
      setProgress((received/filesize*100).toFixed(1));
      if(received >= filesize){
        download(new Blob(buf));
        log("সম্পূর্ণ ডাউনলোড হয়েছে!");
        buf=[]; received=0; setProgress(0);
      }
    }
  });
}

fileInput.onchange = () => {
  const file = fileInput.files[0];
  if(file && conn && conn.open){
    const CHUNK = 64*1024;
    conn.send({meta:{name:file.name, size:file.size}});
    const reader = new FileReader();
    let offset=0;
    reader.onload = e => {
      conn.send({chunk:e.target.result});
      offset += e.target.result.byteLength;
      setProgress((offset/file.size*100).toFixed(1));
      if(offset < file.size){
        readSlice(offset);
      } else log("Transfer সম্পূর্ণ!");
    };
    function readSlice(i){
      const blob = file.slice(i, i+CHUNK);
      reader.readAsArrayBuffer(blob);
    }
    readSlice(0);
  }
};

function download(blob){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "received_" + Date.now();
  a.click();
}

// safety
peer?.on("error", err=>log("Error: "+err));
