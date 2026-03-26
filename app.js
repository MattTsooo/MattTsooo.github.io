const chat = document.getElementById("chat");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const modeSelect = document.getElementById("mode");

const BACKEND_URL = "bot0cba90.azurewebsites.net/audit";

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
  chat.scrollTop = chat.scrollHeight;

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

async function typeText(contentEl, text, speed = 12) {
  contentEl.textContent = "";
  for (let i = 0; i < text.length; i++) {
    contentEl.textContent += text[i];
    scrollChatToBottom();
    await new Promise((resolve) => setTimeout(resolve, speed));
  }
}

async function streamResponse(contentEl, response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  contentEl.textContent = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    contentEl.textContent += chunk;
    scrollChatToBottom();
  }
}

async function handleSend() {
  const text = promptInput.value.trim();
  const mode = modeSelect.value;

  if (!text) return;

  addMessage("user", text);
  promptInput.value = "";

  const typing = showTypingIndicator();

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ mode, text })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    typing.stop();

    const botContent = typing.content;

    const contentType = response.headers.get("content-type") || "";

    if (response.body && !contentType.includes("application/json")) {
      await streamResponse(botContent, response);
    } else {
      const data = await response.json();
      await typeText(botContent, data.reply || "No response returned.");
    }
  } catch (error) {
    typing.stop();
    await typeText(typing.content, `Error: ${error.message}`);
  }
}

sendBtn.addEventListener("click", handleSend);

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});