const TENANT_ID="d48b4dfc-4161-4966-b876-0c52e9d733e7";
const CLIENT_ID="967c6051-40fd-4acf-adbf-8f61359f253d";

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: "https://matttsooo.github.io"
  }
};

const loginRequest = {
  scopes: ["openid", "profile", "email"]
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

async function setupAuth() {
  await msalInstance.initialize();

  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const response = await msalInstance.loginPopup(loginRequest);
      localStorage.setItem("id_token", response.idToken);
      localStorage.setItem("username", response.account?.username || "");
      console.log("Logged in as:", response.account?.username);
    });
  }
}

setupAuth();

function getIdToken() {
  return localStorage.getItem("id_token");
}