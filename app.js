const chat = document.getElementById("chat");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const loginView = document.getElementById("loginView");
const chatApp = document.getElementById("chatApp");
const signedInUser = document.getElementById("signedInUser");
const topbarStatus = document.getElementById("topbarStatus");

const BACKEND_URL = "https://bot0cba90.azurewebsites.net/audit";

function setAuthenticatedUI(isAuthenticated, username = "") {
  if (loginView) {
    loginView.classList.toggle("hidden", isAuthenticated);
    loginView.setAttribute("aria-hidden", isAuthenticated ? "true" : "false");
  }

  if (chatApp) {
    chatApp.classList.toggle("hidden", !isAuthenticated);
    chatApp.setAttribute("aria-hidden", !isAuthenticated ? "true" : "false");
  }

  if (signedInUser) {
    signedInUser.textContent = username || "No active account";
  }

  if (topbarStatus) {
    topbarStatus.textContent = isAuthenticated
      ? `Signed in as ${username || "Microsoft user"}`
      : "Signed out";
  }

  if (sendBtn) {
    sendBtn.disabled = !isAuthenticated;
  }

  if (promptInput) {
    promptInput.disabled = !isAuthenticated;
    promptInput.placeholder = isAuthenticated
      ? "Message JGM Eclipse..."
      : "Sign in to start chatting";
  }

  if (isAuthenticated) {
    promptInput.focus();
  }
}

function addMessage(role, text = "") {
  const row = document.createElement("div");
  row.className = "message-row";

  const message = document.createElement("div");
  message.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${role}`;
  avatar.textContent = role === "user" ? "You" : "AI";

  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = text;

  message.appendChild(avatar);
  message.appendChild(content);
  row.appendChild(message);
  chat.appendChild(row);

  scrollChatToBottom();
  return content;
}

function scrollChatToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

function showTypingIndicator() {
  const content = addMessage("bot", "Thinking");
  let dots = 0;

  const interval = setInterval(() => {
    dots = (dots + 1) % 4;
    content.textContent = "Thinking" + ".".repeat(dots);
    scrollChatToBottom();
  }, 400);

  return {
    content,
    stop() {
      clearInterval(interval);
    }
  };
}

async function typeText(contentEl, text, speed = 8) {
  contentEl.textContent = "";
  for (let i = 0; i < text.length; i++) {
    contentEl.textContent += text[i];
    scrollChatToBottom();
    await new Promise((resolve) => setTimeout(resolve, speed));
  }
}

function resetChat() {
  chat.innerHTML = `
    <div class="message-row">
      <div class="message bot">
        <div class="avatar bot">AI</div>
        <div class="message-content">Hi — I can help with blog posts and dashboards.

Use:
• /auditblog
• /auditdashboard
• /help

Or just ask a question.</div>
      </div>
    </div>
  `;
  promptInput.value = "";
  if (!promptInput.disabled) {
    promptInput.focus();
  }
}

async function sendMessage(text) {
  let token = window.authClient?.getIdToken() || localStorage.getItem("id_token");

  if (!token) {
    throw new Error("Please log in first.");
  }

  let response = await fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ text })
  });

  if (response.status === 401 && window.authClient?.refreshIdToken) {
    token = await window.authClient.refreshIdToken();
    response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Please log in again.");
    }
    if (response.status === 403) {
      throw new Error("You are not authorized to use this app.");
    }
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function handleSend() {
  const text = promptInput.value.trim();
  if (!text) return;

  const token = window.authClient?.getIdToken() || localStorage.getItem("id_token");
  if (!token) {
    addMessage("bot", "Please log in with Microsoft first.");
    return;
  }

  addMessage("user", text);
  promptInput.value = "";
  sendBtn.disabled = true;

  const typing = showTypingIndicator();

  try {
    const data = await sendMessage(text);
    typing.stop();
    await typeText(typing.content, data.reply || "No response returned.");
  } catch (error) {
    typing.stop();
    await typeText(typing.content, `Error: ${error.message}`);
  } finally {
    sendBtn.disabled = false;
    promptInput.focus();
  }
}

sendBtn.addEventListener("click", handleSend);

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

promptInput.addEventListener("input", () => {
  promptInput.style.height = "auto";
  promptInput.style.height = Math.min(promptInput.scrollHeight, 220) + "px";
});

if (newChatBtn) {
  newChatBtn.addEventListener("click", resetChat);
}

window.addEventListener("auth-state-changed", (event) => {
  const { isAuthenticated, username } = event.detail;
  setAuthenticatedUI(isAuthenticated, username);

  if (!isAuthenticated) {
    resetChat();
  }
});

setAuthenticatedUI(false, "");
