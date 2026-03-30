const chat = document.getElementById("chat");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const loginView = document.getElementById("loginView");
const chatApp = document.getElementById("chatApp");
const signedInUser = document.getElementById("signedInUser");
const topbarStatus = document.getElementById("topbarStatus");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");

const BACKEND_URL = "https://bot0cba90.azurewebsites.net/audit";
const mobileMenuQuery = window.matchMedia("(max-width: 900px)");

function resetComposerHeight() {
  if (!promptInput) return;
  promptInput.style.height = "auto";
}

function syncMobileMenuButton() {
  if (!mobileMenuBtn) return;
  mobileMenuBtn.setAttribute(
    "aria-expanded",
    document.body.classList.contains("menu-open") ? "true" : "false"
  );
}

function closeMobileMenu() {
  document.body.classList.remove("menu-open");
  syncMobileMenuButton();
}

function toggleMobileMenu() {
  if (!mobileMenuQuery.matches) return;
  document.body.classList.toggle("menu-open");
  syncMobileMenuButton();
}

function setAuthenticatedUI(isAuthenticated, username = "") {
  document.body.classList.toggle("authenticated", isAuthenticated);

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

  if (!isAuthenticated || !mobileMenuQuery.matches) {
    closeMobileMenu();
  }

  if (sendBtn) {
    sendBtn.disabled = !isAuthenticated;
  }

  if (promptInput) {
    promptInput.disabled = !isAuthenticated;
    promptInput.placeholder = isAuthenticated
      ? "Message JGM Eclipse..."
      : "Sign in to start chatting";
    resetComposerHeight();
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
  avatar.textContent = role === "user" ? "You" : "Eclipse";

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
        <div class="avatar bot">Eclipse</div>
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
  resetComposerHeight();
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
  resetComposerHeight();
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
  promptInput.style.height = Math.min(promptInput.scrollHeight, 160) + "px";
});

if (newChatBtn) {
  newChatBtn.addEventListener("click", () => {
    resetChat();
    closeMobileMenu();
  });
}

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener("click", toggleMobileMenu);
  syncMobileMenuButton();
}

if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener("click", closeMobileMenu);
}

window.addEventListener("resize", () => {
  if (!mobileMenuQuery.matches) {
    closeMobileMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileMenu();
  }
});

window.addEventListener("auth-state-changed", (event) => {
  const { isAuthenticated, username } = event.detail;
  setAuthenticatedUI(isAuthenticated, username);

  if (!isAuthenticated) {
    resetChat();
  }
});

setAuthenticatedUI(false, "");
