const TENANT_ID = "d48b4dfc-4161-4966-b876-0c52e9d733e7";
const CLIENT_ID = "967c6051-40fd-4acf-adbf-8f61359f253d";

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
