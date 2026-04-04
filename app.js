const chat = document.getElementById("chat");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const attachBtn = document.getElementById("attachBtn");
const attachmentInput = document.getElementById("attachmentInput");
const attachmentTray = document.getElementById("attachmentTray");
const composerStatus = document.getElementById("composerStatus");
const loginView = document.getElementById("loginView");
const chatApp = document.getElementById("chatApp");
const signedInUser = document.getElementById("signedInUser");
const topbarStatus = document.getElementById("topbarStatus");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const composerWrap = document.querySelector(".composer-wrap");
const topbarElement = document.querySelector(".topbar");

const BACKEND_URL = "https://bot0cba90.azurewebsites.net/audit";
const mobileMenuQuery = window.matchMedia("(max-width: 900px)");
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
let shouldStickToBottom = true;
let pendingAttachments = [];

function isNearBottom() {
  if (!chat) return true;
  const threshold = 72;
  return chat.scrollHeight - chat.scrollTop - chat.clientHeight <= threshold;
}

function resetComposerHeight() {
  if (!promptInput) return;
  promptInput.style.height = "auto";
  queueComposerMetrics();
}

function setComposerStatus(message = "", state = "") {
  if (!composerStatus) return;
  composerStatus.textContent = message;
  if (state) {
    composerStatus.dataset.state = state;
  } else {
    delete composerStatus.dataset.state;
  }
}

function updateComposerMetrics() {
  if (!composerWrap) return;
  const composerHeight = Math.ceil(composerWrap.getBoundingClientRect().height);
  const extraClearance = mobileMenuQuery.matches ? 28 : 20;
  document.documentElement.style.setProperty(
    "--composer-clearance",
    `${composerHeight + extraClearance}px`
  );

  if (topbarElement) {
    document.documentElement.style.setProperty(
      "--topbar-clearance",
      `${Math.ceil(topbarElement.getBoundingClientRect().height)}px`
    );
  }
}

function queueComposerMetrics() {
  window.requestAnimationFrame(updateComposerMetrics);
}

function summarizeAttachmentCount(count) {
  return `Attached ${count} image${count === 1 ? "" : "s"}.`;
}

function ensureMessageText(text, attachments = []) {
  const trimmed = (text || "").trim();
  if (trimmed) {
    return trimmed;
  }

  if (attachments.length) {
    return summarizeAttachmentCount(attachments.length);
  }

  return "";
}

function renderImageStrip(attachments, className) {
  const strip = document.createElement("div");
  strip.className = className;

  attachments.forEach((attachment, index) => {
    const item = document.createElement("div");
    item.className = `${className}-item`;

    const image = document.createElement("img");
    image.className = `${className}-image`;
    image.src = attachment.dataUrl;
    image.alt = attachment.name || `Attached image ${index + 1}`;

    item.appendChild(image);
    strip.appendChild(item);
  });

  return strip;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  document.body.removeChild(helper);
}

function setCopyButtonState(button, label) {
  if (!button) return;

  const originalLabel = button.dataset.defaultLabel || "Copy";
  button.textContent = label;

  if (button.copyResetTimer) {
    window.clearTimeout(button.copyResetTimer);
  }

  button.copyResetTimer = window.setTimeout(() => {
    button.textContent = originalLabel;
  }, 1600);
}

async function handleCopyMessage(content, button) {
  const text = content.textContent.trim();
  if (!text) return;

  try {
    await copyTextToClipboard(text);
    setCopyButtonState(button, "Copied");
  } catch (error) {
    setCopyButtonState(button, "Copy failed");
  }
}

function createMessageRow(role, text = "", attachments = []) {
  const row = document.createElement("div");
  row.className = "message-row";

  const message = document.createElement("div");
  message.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${role}`;
  avatar.textContent = role === "user" ? "You" : "Eclipse";

  const stack = document.createElement("div");
  stack.className = "message-stack";

  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = ensureMessageText(text, attachments);

  const actions = document.createElement("div");
  actions.className = "message-actions";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "message-copy-btn";
  copyBtn.textContent = "Copy";
  copyBtn.dataset.defaultLabel = "Copy";
  copyBtn.setAttribute(
    "aria-label",
    role === "user" ? "Copy your message" : "Copy Eclipse response"
  );
  copyBtn.addEventListener("click", () => handleCopyMessage(content, copyBtn));

  actions.appendChild(copyBtn);
  stack.appendChild(content);
  if (attachments.length) {
    stack.appendChild(renderImageStrip(attachments, "message-image-strip"));
  }
  stack.appendChild(actions);
  message.appendChild(avatar);
  message.appendChild(stack);
  row.appendChild(message);

  return { row, content };
}

function hydrateExistingCopyButtons() {
  document.querySelectorAll(".message-stack").forEach((stack) => {
    const content = stack.querySelector(".message-content");
    const button = stack.querySelector(".message-copy-btn");

    if (!content || !button || button.dataset.bound === "true") {
      return;
    }

    button.dataset.defaultLabel = button.textContent.trim() || "Copy";
    button.dataset.bound = "true";
    button.addEventListener("click", () => handleCopyMessage(content, button));
  });
}

function syncMobileMenuButton() {
  if (!mobileMenuBtn) return;
  mobileMenuBtn.setAttribute(
    "aria-expanded",
    document.body.classList.contains("menu-open") ? "true" : "false"
  );
}

function renderAttachmentTray() {
  if (!attachmentTray) return;

  attachmentTray.replaceChildren();
  attachmentTray.classList.toggle("hidden", pendingAttachments.length === 0);

  pendingAttachments.forEach((attachment) => {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";

    const preview = document.createElement("img");
    preview.className = "attachment-chip-image";
    preview.src = attachment.dataUrl;
    preview.alt = attachment.name;

    const label = document.createElement("div");
    label.className = "attachment-chip-label";
    label.textContent = attachment.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "attachment-chip-remove";
    removeBtn.textContent = "Remove";
    removeBtn.setAttribute("aria-label", `Remove ${attachment.name}`);
    removeBtn.addEventListener("click", () => {
      pendingAttachments = pendingAttachments.filter((item) => item.id !== attachment.id);
      renderAttachmentTray();
      queueComposerMetrics();
    });

    chip.appendChild(preview);
    chip.appendChild(label);
    chip.appendChild(removeBtn);
    attachmentTray.appendChild(chip);
  });
}

function clearPendingAttachments() {
  pendingAttachments = [];
  if (attachmentInput) {
    attachmentInput.value = "";
  }
  renderAttachmentTray();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function addAttachmentsFromFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const nextAttachments = [];

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setComposerStatus("Only PNG, JPG, WEBP, and GIF images are supported.", "error");
      continue;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setComposerStatus(`"${file.name}" is larger than 5 MB.`, "error");
      continue;
    }

    if (pendingAttachments.length + nextAttachments.length >= MAX_ATTACHMENTS) {
      setComposerStatus(`You can attach up to ${MAX_ATTACHMENTS} images at once.`, "error");
      break;
    }

    const dataUrl = await fileToDataUrl(file);
    nextAttachments.push({
      id: `${file.name}-${file.size}-${Date.now()}-${nextAttachments.length}`,
      name: file.name,
      mediaType: file.type,
      dataUrl
    });
  }

  if (!nextAttachments.length) {
    queueComposerMetrics();
    return;
  }

  pendingAttachments = [...pendingAttachments, ...nextAttachments];
  setComposerStatus(
    `${pendingAttachments.length} image${pendingAttachments.length === 1 ? "" : "s"} ready to send.`
  );
  renderAttachmentTray();
  queueComposerMetrics();
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

  if (attachBtn) {
    attachBtn.disabled = !isAuthenticated;
  }

  if (promptInput) {
    promptInput.disabled = !isAuthenticated;
    promptInput.placeholder = isAuthenticated
      ? "Message JGM Eclipse..."
      : "Sign in to start chatting";
    resetComposerHeight();
  }

  if (!isAuthenticated) {
    clearPendingAttachments();
    setComposerStatus("");
  }

  if (isAuthenticated) {
    promptInput.focus();
  }

  queueComposerMetrics();
}

function addMessage(role, text = "", attachments = []) {
  const { row, content } = createMessageRow(role, text, attachments);
  chat.appendChild(row);

  scrollChatToBottom(true);
  return content;
}

function scrollChatToBottom(force = false) {
  if (!force && !shouldStickToBottom) {
    return;
  }
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

async function typeText(contentEl, text, speed = 4) {
  contentEl.textContent = "";
  for (let i = 0; i < text.length; i++) {
    contentEl.textContent += text[i];
    scrollChatToBottom();
    await new Promise((resolve) => setTimeout(resolve, speed));
  }
}

function resetChat() {
  const welcome = createMessageRow(
    "bot",
    `Hi — I can help with blog posts and dashboards.

Use:
• /auditblog
• /auditdashboard
• /help

Or just ask a question.`
  );
  chat.replaceChildren(welcome.row);
  promptInput.value = "";
  resetComposerHeight();
  if (!promptInput.disabled) {
    promptInput.focus();
  }
}

async function sendMessage(text, attachments = []) {
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
    body: JSON.stringify({ text, images: attachments })
  });

  if (response.status === 401 && window.authClient?.refreshIdToken) {
    token = await window.authClient.refreshIdToken();
    response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ text, images: attachments })
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
  const attachments = pendingAttachments.map(({ name, mediaType, dataUrl }) => ({
    name,
    media_type: mediaType,
    data_url: dataUrl
  }));
  if (!text && attachments.length === 0) return;

  const token = window.authClient?.getIdToken() || localStorage.getItem("id_token");
  if (!token) {
    addMessage("bot", "Please log in with Microsoft first.");
    return;
  }

  addMessage("user", text, pendingAttachments);
  promptInput.value = "";
  clearPendingAttachments();
  setComposerStatus("");
  resetComposerHeight();
  sendBtn.disabled = true;
  if (attachBtn) {
    attachBtn.disabled = true;
  }

  const typing = showTypingIndicator();

  try {
    const data = await sendMessage(text, attachments);
    typing.stop();
    await typeText(typing.content, data.reply || "No response returned.");
  } catch (error) {
    typing.stop();
    await typeText(typing.content, `Error: ${error.message}`);
  } finally {
    sendBtn.disabled = false;
    if (attachBtn) {
      attachBtn.disabled = false;
    }
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
  queueComposerMetrics();
});

promptInput.addEventListener("paste", async (event) => {
  const imageFiles = Array.from(event.clipboardData?.files || []).filter((file) =>
    ALLOWED_IMAGE_TYPES.has(file.type)
  );
  const itemFiles = Array.from(event.clipboardData?.items || [])
    .map((item) => item.getAsFile?.())
    .filter((file) => file && ALLOWED_IMAGE_TYPES.has(file.type));
  const filesToAdd = imageFiles.length ? imageFiles : itemFiles;

  if (!filesToAdd.length) {
    return;
  }

  event.preventDefault();
  await addAttachmentsFromFiles(filesToAdd);
});

if (attachBtn && attachmentInput) {
  attachBtn.addEventListener("click", () => attachmentInput.click());
  attachmentInput.addEventListener("change", async (event) => {
    await addAttachmentsFromFiles(event.target.files);
    attachmentInput.value = "";
  });
}

if (newChatBtn) {
  newChatBtn.addEventListener("click", () => {
    resetChat();
    clearPendingAttachments();
    setComposerStatus("");
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

chat.addEventListener("scroll", () => {
  shouldStickToBottom = isNearBottom();
});

window.addEventListener("resize", () => {
  if (!mobileMenuQuery.matches) {
    closeMobileMenu();
  }
  shouldStickToBottom = isNearBottom();
  queueComposerMetrics();
});

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", queueComposerMetrics);
}

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
hydrateExistingCopyButtons();
renderAttachmentTray();
shouldStickToBottom = true;
queueComposerMetrics();
