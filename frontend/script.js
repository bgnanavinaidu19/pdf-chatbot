const chatBox = document.getElementById("chatBox");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const fileNameDisplay = document.getElementById("fileName");
const uploadStatus = document.getElementById("uploadStatus");
const questionInput = document.getElementById("question");
const sendBtn = document.getElementById("sendBtn");
const statusDot = document.querySelector(".status-dot");
const systemStatus = document.getElementById("systemStatus");
const dropZone = document.getElementById("dropZone");

let isDocumentReady = false;

// File Selection logic
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    if (file.type !== "application/pdf") {
      showUploadStatus("Please select a valid PDF file.", "error");
      fileInput.value = "";
      fileNameDisplay.innerText = "Drop your PDF or click to browse";
      uploadBtn.disabled = true;
      return;
    }
    fileNameDisplay.innerText = file.name;
    uploadBtn.disabled = false;
    hideUploadStatus();
  }
});

// Drag and Drop
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    fileInput.dispatchEvent(new Event("change"));
  }
});

function createMessageElement(text, role, isError = false) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  
  let icon = role === "bot" ? "book" : "user";
  const formattedText = parseMarkdown(escapeHTML(text));
  
  div.innerHTML = `
    <div class="avatar"><i data-feather="${icon}"></i></div>
    <div class="bubble ${isError ? 'error' : ''}">${formattedText}</div>
  `;
  
  return div;
}

function parseMarkdown(text) {
  // Handle bold with higher priority
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    .replace(/^\* (.*?)$/gm, '<li>$1</li>');
    
  // Wrap list items in <ul>
  if (html.includes('<li>')) {
    html = html.replace(/(<li>.*?<\/li>)+/gs, (match) => `<ul>${match}</ul>`);
  }
  
  // Convert newlines to <br> (only those not part of <li> / <ul> / <h> / <br>)
  // But first, normalize multiple newlines to double <br> for paragraph effect
  html = html.replace(/\n\n/g, '<br><br>');
  
  return html.split('\n').map(line => {
    if (line.match(/^<(ul|li|h[1-3]|br)/)) return line;
    return line + '<br>';
  }).join('');
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function addMessage(text, role, isError = false) {
  const msgEl = createMessageElement(text, role, isError);
  chatBox.appendChild(msgEl);
  feather.replace();
  scrollToBottom();
}

function showTypingIndicator() {
  const div = document.createElement("div");
  div.className = "message bot typing";
  div.id = "typingIndicator";
  
  div.innerHTML = `
    <div class="avatar"><i data-feather="book"></i></div>
    <div class="bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  
  chatBox.appendChild(div);
  feather.replace();
  scrollToBottom();
}

function removeTypingIndicator() {
  const indicator = document.getElementById("typingIndicator");
  if (indicator) {
    indicator.remove();
  }
}

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

function showUploadStatus(message, type) {
  uploadStatus.className = `upload-status ${type}`;
  if (type === 'loading') {
    uploadStatus.innerHTML = `<i data-feather="loader" class="spin"></i> ${message}`;
  } else {
    uploadStatus.innerText = message;
  }
  feather.replace();
}

function hideUploadStatus() {
  uploadStatus.className = "upload-status";
}

function setSystemReady() {
  isDocumentReady = true;
  statusDot.classList.add("active");
  systemStatus.innerText = "Ready to Chat";
  questionInput.disabled = false;
  sendBtn.disabled = false;
  questionInput.placeholder = "Ask anything about the document...";
  questionInput.focus();
}

async function uploadFile() {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  uploadBtn.disabled = true;
  const originalBtnText = uploadBtn.querySelector('span').innerText;
  uploadBtn.querySelector('span').innerText = "Indexing...";
  showUploadStatus("DocBot is reading your file...", "loading");

  try {
    const response = await fetch("http://localhost:5001/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to upload file");
    }

    // Defensive check for new properties (in case server wasn't restarted)
    const charCount = data.charCount || 0;
    const isFullIndex = !!data.isFullIndex;

    showUploadStatus(`Document indexed: ${charCount.toLocaleString()} chars`, "success");
    setSystemReady();
    
    uploadBtn.querySelector('span').innerText = isFullIndex ? "Pro Recall Active" : "DocBot Ready";
    
    const indexTypeMsg = isFullIndex 
      ? "I have successfully indexed the **unabridged document** using **Pro Intelligence**. I have 100% visibility of the story!"
      : `I have indexed **${file.name}**. Due to its size, I will use high-density search for our chat.`;

    addMessage(`**DocBot Pro** is now connected to "${file.name}". ${indexTypeMsg}`, "bot");
    
  } catch (error) {
    showUploadStatus(error.message, "error");
    uploadBtn.disabled = false;
    uploadBtn.querySelector('span').innerText = originalBtnText;
  }
}

function handleKeyPress(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function sendMessage() {
  const question = questionInput.value.trim();
  if (!question || !isDocumentReady) return;

  // Add user message to UI
  addMessage(question, "user");
  
  // Clear and disable input
  questionInput.value = "";
  questionInput.disabled = true;
  sendBtn.disabled = true;

  showTypingIndicator();

  try {
    const res = await fetch("http://localhost:5001/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });

    const data = await res.json();
    removeTypingIndicator();

    if (!res.ok) {
      throw new Error(data.error || "Failed to get an answer.");
    }

    addMessage(data.answer, "bot");
  } catch (error) {
    removeTypingIndicator();
    // Special handling for Quota/Cooling errors
    const isQuota = error.message.includes("Google") || error.message.includes("wait") || error.message.includes("Quota");
    addMessage(error.message, "bot", isQuota);
  } finally {
    // Re-enable input instantly
    questionInput.disabled = false;
    sendBtn.disabled = false;
    questionInput.focus();
  }
}

const style = document.createElement('style');
style.innerHTML = `
  .spin { animation: spin 2s linear infinite; }
  @keyframes spin { 100% { transform: rotate(360deg); } }
`;
document.head.appendChild(style);