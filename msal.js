const TENANT_ID = "d48b4dfc-4161-4966-b876-0c52e9d733e7";
const CLIENT_ID = "967c6051-40fd-4acf-adbf-8f61359f253d";
const ASSET_VERSION = "20260330-10";

function ensureFreshStylesheet() {
  const stylesheet = document.querySelector('link[rel="stylesheet"]');

  if (!stylesheet) {
    return;
  }

  const expectedHref = `style.css?v=${ASSET_VERSION}`;
  if (!stylesheet.getAttribute("href")?.includes(expectedHref)) {
    stylesheet.setAttribute("href", expectedHref);
  }
}

function ensureCurrentAppShell() {
  const hasCurrentShell = document.getElementById("loginView") && document.getElementById("chatApp");
  if (hasCurrentShell) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="app-shell">
      <section id="loginView" class="login-view">
        <div class="login-card">
          <div class="login-copy">
            <p class="eyebrow">JGM Eclipse</p>
            <h1>Sign in before using the chatbot.</h1>
            <p class="login-text">
              Use your Microsoft work account to access blog and dashboard audits.
            </p>
          </div>

          <div class="login-actions">
            <button id="loginBtn" class="login-btn">Continue with Microsoft</button>
            <p id="authMessage" class="auth-message" aria-live="polite"></p>
          </div>
        </div>
      </section>

      <div id="chatApp" class="chat-app hidden" aria-hidden="true">
        <button id="sidebarBackdrop" class="sidebar-backdrop" type="button" aria-label="Close menu"></button>

        <aside id="sidebarPanel" class="sidebar">
          <div class="brand-block">
            <p class="eyebrow">Workspace</p>
            <h2>JGM Eclipse</h2>
          </div>

          <div id="signedInBadge" class="signed-in-badge" aria-live="polite">
            <span class="status-dot"></span>
            <div>
              <p class="status-label">Signed in</p>
              <p id="signedInUser" class="status-user">Loading account...</p>
            </div>
          </div>

          <button id="newChatBtn" class="new-chat-btn">+ New chat</button>
          <button id="logoutBtn" class="secondary-btn" type="button">Sign out</button>
        </aside>

        <main class="main">
          <div class="topbar">
            <div class="topbar-main">
              <button
                id="mobileMenuBtn"
                class="mobile-menu-btn"
                type="button"
                aria-label="Open menu"
                aria-controls="sidebarPanel"
                aria-expanded="false"
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
              <a
                class="brand-logo-shell brand-logo-link"
                href="https://www.jgminnovation.org/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open JGM Innovation website in a new tab"
              >
                <img src="Screenshot 2026-03-14 at 2.47.50 PM (1).png" alt="JGM logo" class="logo-image" />
              </a>
              <span class="topbar-title">Eclipse</span>
            </div>
            <span id="topbarStatus" class="topbar-status">Checking sign-in...</span>
          </div>

          <section class="chat-container" id="chat">
            <div class="message-row">
              <div class="message bot">
                <div class="avatar bot">Eclipse</div>
                <div class="message-content">
Hi — I can audit blog posts and dashboards.

Try:
• /auditblog
• /auditdashboard
• /help

Or just ask a question.
                </div>
              </div>
            </div>
          </section>

          <div class="composer-wrap">
            <div class="composer">
              <textarea id="prompt" placeholder="Message JGM Eclipse..."></textarea>
              <div class="composer-actions">
                <button id="sendBtn" class="send-btn">Send</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  Array.from(document.body.children)
    .filter((element) => element.tagName !== "SCRIPT")
    .forEach((element) => element.remove());

  document.body.prepend(wrapper.firstElementChild);
}

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: `${window.location.origin}${window.location.pathname}`
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

const loginRequest = {
  scopes: ["openid", "profile", "email"]
};

const msalInstance = new msal.PublicClientApplication(msalConfig);
let activeAccount = null;

function dispatchAuthState() {
  const detail = {
    isAuthenticated: Boolean(activeAccount),
    username: activeAccount?.username || "",
    name: activeAccount?.name || activeAccount?.username || "",
    token: getIdToken()
  };

  window.dispatchEvent(new CustomEvent("auth-state-changed", { detail }));
}

function setAuthMessage(message, isError = false) {
  const authMessage = document.getElementById("authMessage");
  if (!authMessage) return;

  authMessage.textContent = message;
  authMessage.dataset.state = isError ? "error" : "info";
}

function persistLogin(response) {
  if (!response?.account) {
    return;
  }

  activeAccount = response.account;
  msalInstance.setActiveAccount(activeAccount);

  if (response.idToken) {
    localStorage.setItem("id_token", response.idToken);
  }

  localStorage.setItem("username", activeAccount.username || "");
  dispatchAuthState();
}

async function refreshIdToken() {
  if (!activeAccount) {
    localStorage.removeItem("id_token");
    dispatchAuthState();
    return null;
  }

  try {
    const tokenResponse = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: activeAccount
    });

    localStorage.setItem("id_token", tokenResponse.idToken);
    dispatchAuthState();
    return tokenResponse.idToken;
  } catch (error) {
    console.error("Silent token refresh failed", error);
    localStorage.removeItem("id_token");
    dispatchAuthState();
    throw error;
  }
}

async function signIn() {
  setAuthMessage("Redirecting to Microsoft sign-in...");

  try {
    await msalInstance.loginRedirect(loginRequest);
  } catch (error) {
    console.error("Microsoft login failed", error);
    setAuthMessage(error.message || "Sign-in failed. Check your Azure redirect URI settings.", true);
  }
}

async function signOut() {
  const account = activeAccount || msalInstance.getActiveAccount();

  localStorage.removeItem("id_token");
  localStorage.removeItem("username");
  activeAccount = null;
  msalInstance.setActiveAccount(null);
  dispatchAuthState();

  if (!account) {
    setAuthMessage("Signed out.");
    return;
  }

  try {
    await msalInstance.logoutRedirect({
      account,
      postLogoutRedirectUri: `${window.location.origin}${window.location.pathname}`
    });
  } catch (error) {
    console.error("Microsoft logout failed", error);
    setAuthMessage("Signed out locally, but Microsoft logout failed.", true);
  }
}

async function restoreSession() {
  await msalInstance.initialize();

  try {
    const redirectResponse = await msalInstance.handleRedirectPromise();
    if (redirectResponse?.account) {
      persistLogin(redirectResponse);
    }
  } catch (error) {
    console.error("MSAL redirect handling failed", error);
  }

  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0] || null;
  if (account) {
    activeAccount = account;
    msalInstance.setActiveAccount(account);

    try {
      await refreshIdToken();
    } catch (error) {
      setAuthMessage("Your session expired. Sign in again.", true);
    }
  } else {
    dispatchAuthState();
  }
}

async function setupAuth() {
  ensureFreshStylesheet();
  ensureCurrentAppShell();

  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginBtn) {
    loginBtn.addEventListener("click", signIn);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", signOut);
  }

  await restoreSession();
}

function getIdToken() {
  return localStorage.getItem("id_token");
}

window.authClient = {
  getIdToken,
  refreshIdToken,
  signIn,
  signOut
};

setupAuth();
