const STORAGE_KEYS = {
  session: "sem-docs-session",
  quickLogin: "sem-docs-quick-login",
  quickSignup: "sem-docs-quick-signup",
  theme: "sem-docs-theme",
};

const DEFAULT_QUICK_LOGIN = {
  username: "maplover",
  password: "StrongPassword123",
};

const DEFAULT_QUICK_SIGNUP = {
  email: "user@example.com",
  otp: "123456",
  username: "maplover",
  password: "StrongPassword123",
};

const AUTH_SCHEME_NAME = "bearerAuth";
const THEME_COLORS = {
  dark: "#08111f",
  light: "#f3f7fb",
};

function toSpecName(filename) {
  return filename.replace(/\.(yaml|yml)$/i, "");
}

function toDisplayName(name) {
  const title = name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

  return /(^|\s)API$/i.test(title) ? title : `${title} API`;
}

function normalizeSpec(filename) {
  const name = toSpecName(filename);

  return {
    name,
    displayName: toDisplayName(name),
    url: `./openapi/${filename}`,
  };
}

function extractSpecsFromDirectoryJson(entries) {
  if (!Array.isArray(entries)) {
    throw new Error("OpenAPI directory listing is invalid.");
  }

  return entries
    .filter((entry) => entry?.type === "file" && /\.(yaml|yml)$/i.test(entry.name))
    .map((entry) => normalizeSpec(entry.name));
}

function extractSpecsFromDirectoryHtml(markup) {
  const documentNode = new DOMParser().parseFromString(markup, "text/html");
  const links = Array.from(documentNode.querySelectorAll("a[href]"));
  const filenames = new Set();

  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href) {
      continue;
    }

    const filename = decodeURIComponent(href.replace(/\/$/, ""));
    if (/\.(yaml|yml)$/i.test(filename) && !filename.includes("/")) {
      filenames.add(filename);
    }
  }

  return Array.from(filenames, (filename) => normalizeSpec(filename));
}

async function loadDiscoveredSpecs() {
  const response = await fetch("./openapi/", {
    headers: {
      Accept: "application/json, text/html;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load OpenAPI directory listing: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return extractSpecsFromDirectoryJson(await response.json());
  }

  return extractSpecsFromDirectoryHtml(await response.text());
}

async function loadSpecs() {
  const specs = (await loadDiscoveredSpecs()).sort((left, right) =>
    getSpecDisplayName(left).localeCompare(getSpecDisplayName(right)),
  );
  if (specs.length === 0) {
    throw new Error("No OpenAPI YAML files were found.");
  }

  return specs;
}

function getPrimarySpec(specs) {
  const requestedSpec = new URLSearchParams(window.location.search).get("spec");
  return specs.find((spec) => spec.name === requestedSpec) ?? specs[0];
}

function getSpecDisplayName(spec) {
  return spec.displayName ?? spec.name;
}

function updateDocumentTitle(spec) {
  document.title = `Social Event Mapper Docs · ${getSpecDisplayName(spec)}`;
}

function renderError(error) {
  const container = document.getElementById("swagger-ui");
  const section = document.createElement("section");
  const heading = document.createElement("h1");
  const message = document.createElement("p");

  section.className = "docs-error";
  heading.textContent = "API docs could not be loaded";
  message.textContent = error.message;

  section.appendChild(heading);
  section.appendChild(message);
  container.replaceChildren(section);
}

function readJsonStorage(key, fallback) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_error) {
    // Ignore browser storage failures and keep the UI usable.
  }
}

function removeStorageItem(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (_error) {
    // Ignore browser storage failures and keep the UI usable.
  }
}

function dispatchDocsEvent(name) {
  window.dispatchEvent(new CustomEvent(name));
}

function readSession() {
  const session = readJsonStorage(STORAGE_KEYS.session, {});
  return {
    accessToken: typeof session.accessToken === "string" ? session.accessToken : "",
    refreshToken: typeof session.refreshToken === "string" ? session.refreshToken : "",
    updatedAt: typeof session.updatedAt === "string" ? session.updatedAt : "",
    username: typeof session.username === "string" ? session.username : "",
  };
}

function persistSession(partialSession) {
  const current = readSession();
  const nextSession = {
    accessToken: partialSession.accessToken ?? current.accessToken,
    refreshToken: partialSession.refreshToken ?? current.refreshToken,
    updatedAt: partialSession.updatedAt ?? new Date().toISOString(),
    username: partialSession.username ?? current.username,
  };

  writeJsonStorage(STORAGE_KEYS.session, nextSession);
  dispatchDocsEvent("docs:session-changed");
}

function clearSession() {
  removeStorageItem(STORAGE_KEYS.session);
  dispatchDocsEvent("docs:session-changed");
}

function readQuickLogin() {
  const quickLogin = readJsonStorage(STORAGE_KEYS.quickLogin, DEFAULT_QUICK_LOGIN);
  return {
    username:
      typeof quickLogin.username === "string" && quickLogin.username.trim().length > 0
        ? quickLogin.username
        : DEFAULT_QUICK_LOGIN.username,
    password:
      typeof quickLogin.password === "string" && quickLogin.password.length > 0
        ? quickLogin.password
        : DEFAULT_QUICK_LOGIN.password,
  };
}

function persistQuickLogin(nextQuickLogin) {
  writeJsonStorage(STORAGE_KEYS.quickLogin, nextQuickLogin);
}

function readQuickSignup() {
  const quickSignup = readJsonStorage(STORAGE_KEYS.quickSignup, DEFAULT_QUICK_SIGNUP);
  return {
    email:
      typeof quickSignup.email === "string" && quickSignup.email.trim().length > 0
        ? quickSignup.email
        : DEFAULT_QUICK_SIGNUP.email,
    otp:
      typeof quickSignup.otp === "string" && quickSignup.otp.trim().length > 0
        ? quickSignup.otp
        : DEFAULT_QUICK_SIGNUP.otp,
    username:
      typeof quickSignup.username === "string" && quickSignup.username.trim().length > 0
        ? quickSignup.username
        : DEFAULT_QUICK_SIGNUP.username,
    password:
      typeof quickSignup.password === "string" && quickSignup.password.length > 0
        ? quickSignup.password
        : DEFAULT_QUICK_SIGNUP.password,
  };
}

function persistQuickSignup(nextQuickSignup) {
  writeJsonStorage(STORAGE_KEYS.quickSignup, nextQuickSignup);
}

function resolvePreferredTheme() {
  let storedTheme = null;

  try {
    storedTheme = window.localStorage.getItem(STORAGE_KEYS.theme);
  } catch (_error) {
    storedTheme = null;
  }

  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;

  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
    themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", THEME_COLORS[theme]);
  }
}

function initializeThemeToggle() {
  applyTheme(resolvePreferredTheme());

  const themeToggle = document.getElementById("theme-toggle");
  if (!themeToggle || themeToggle.dataset.docsBound === "true") {
    return;
  }

  themeToggle.dataset.docsBound = "true";
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
    } catch (_error) {
      // Ignore browser storage failures and keep the theme switch working for the current page.
    }
    applyTheme(nextTheme);
  });
}

function isSessionPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      typeof payload.access_token === "string" &&
      payload.access_token.length > 0 &&
      typeof payload.refresh_token === "string" &&
      payload.refresh_token.length > 0,
  );
}

function extractSessionPayload(candidate) {
  if (!candidate) {
    return null;
  }

  const payloads = [
    candidate.body,
    candidate.data,
    candidate.obj,
    typeof candidate.text === "string" ? candidate.text : null,
  ];

  for (const payload of payloads) {
    if (!payload) {
      continue;
    }

    if (typeof payload === "string") {
      try {
        const parsed = JSON.parse(payload);
        if (isSessionPayload(parsed)) {
          return parsed;
        }
      } catch (_error) {
        // Ignore non-JSON response bodies.
      }
      continue;
    }

    if (isSessionPayload(payload)) {
      return payload;
    }
  }

  return null;
}

function formatTokenPreview(token) {
  if (!token) {
    return "missing";
  }

  if (token.length <= 18) {
    return token;
  }

  return `${token.slice(0, 10)}...${token.slice(-6)}`;
}

function syncSessionStatus(message) {
  const statusNode = document.getElementById("session-status");
  if (!statusNode) {
    return;
  }

  if (message) {
    statusNode.textContent = message;
    return;
  }

  const session = readSession();
  if (!session.accessToken) {
    statusNode.textContent = "No saved session yet.";
    return;
  }

  const pieces = [
    `Access token ready (${formatTokenPreview(session.accessToken)}).`,
    session.refreshToken
      ? `Refresh token saved (${formatTokenPreview(session.refreshToken)}).`
      : "Refresh token missing.",
  ];

  if (session.username) {
    pieces.unshift(`Signed in as ${session.username}.`);
  }

  statusNode.textContent = pieces.join(" ");
}

function setQuickSessionBusy(isBusy) {
  const actionIds = [
    "quick-login-submit",
    "quick-signup-request-otp",
    "quick-signup-submit",
    "quick-refresh-submit",
    "copy-access-token-submit",
    "copy-refresh-token-submit",
    "clear-session-submit",
  ];

  for (const actionId of actionIds) {
    const button = document.getElementById(actionId);
    if (button) {
      button.disabled = isBusy;
    }
  }
}

function syncQuickForms() {
  const quickLogin = readQuickLogin();
  const quickSignup = readQuickSignup();
  const usernameInput = document.getElementById("quick-login-username");
  const passwordInput = document.getElementById("quick-login-password");
  const signupEmailInput = document.getElementById("quick-signup-email");
  const signupOtpInput = document.getElementById("quick-signup-otp");
  const signupUsernameInput = document.getElementById("quick-signup-username");
  const signupPasswordInput = document.getElementById("quick-signup-password");

  if (usernameInput && document.activeElement !== usernameInput) {
    usernameInput.value = quickLogin.username;
  }

  if (passwordInput && document.activeElement !== passwordInput) {
    passwordInput.value = quickLogin.password;
  }

  if (signupEmailInput && document.activeElement !== signupEmailInput) {
    signupEmailInput.value = quickSignup.email;
  }

  if (signupOtpInput && document.activeElement !== signupOtpInput) {
    signupOtpInput.value = quickSignup.otp;
  }

  if (signupUsernameInput && document.activeElement !== signupUsernameInput) {
    signupUsernameInput.value = quickSignup.username;
  }

  if (signupPasswordInput && document.activeElement !== signupPasswordInput) {
    signupPasswordInput.value = quickSignup.password;
  }

  syncSessionStatus();
}

function saveQuickLoginInputs() {
  const usernameInput = document.getElementById("quick-login-username");
  const passwordInput = document.getElementById("quick-login-password");

  if (!usernameInput || !passwordInput) {
    return readQuickLogin();
  }

  const quickLogin = {
    username: usernameInput.value.trim() || DEFAULT_QUICK_LOGIN.username,
    password: passwordInput.value || DEFAULT_QUICK_LOGIN.password,
  };

  persistQuickLogin(quickLogin);
  return quickLogin;
}

function saveQuickSignupInputs() {
  const emailInput = document.getElementById("quick-signup-email");
  const otpInput = document.getElementById("quick-signup-otp");
  const usernameInput = document.getElementById("quick-signup-username");
  const passwordInput = document.getElementById("quick-signup-password");

  if (!emailInput || !otpInput || !usernameInput || !passwordInput) {
    return readQuickSignup();
  }

  const quickSignup = {
    email: emailInput.value.trim() || DEFAULT_QUICK_SIGNUP.email,
    otp: otpInput.value.trim() || DEFAULT_QUICK_SIGNUP.otp,
    username: usernameInput.value.trim() || DEFAULT_QUICK_SIGNUP.username,
    password: passwordInput.value || DEFAULT_QUICK_SIGNUP.password,
  };

  persistQuickSignup(quickSignup);
  return quickSignup;
}

function buildApiUrl(pathname) {
  return new URL(pathname, window.location.origin).toString();
}

function extractErrorMessage(payload, fallbackMessage) {
  if (payload && typeof payload === "object") {
    if (typeof payload.message === "string" && payload.message.length > 0) {
      return payload.message;
    }

    if (
      payload.error &&
      typeof payload.error === "object" &&
      typeof payload.error.message === "string" &&
      payload.error.message.length > 0
    ) {
      return payload.error.message;
    }
  }

  return fallbackMessage;
}

async function parseJsonResponse(response) {
  const responseText = await response.text();
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch (_error) {
    return null;
  }
}

function syncSwaggerAuthorization() {
  if (!window.ui) {
    return;
  }

  const session = readSession();

  if (!session.accessToken) {
    if (window.ui.authActions?.logout) {
      try {
        window.ui.authActions.logout([AUTH_SCHEME_NAME]);
      } catch (_error) {
        // Ignore Swagger UI authorization cleanup failures.
      }
    }
    return;
  }

  if (typeof window.ui.preauthorizeApiKey === "function") {
    try {
      window.ui.preauthorizeApiKey(AUTH_SCHEME_NAME, session.accessToken);
      return;
    } catch (_error) {
      // Fall through to the lower-level authorization action.
    }
  }

  if (window.ui.authActions?.authorize) {
    try {
      window.ui.authActions.authorize({
        [AUTH_SCHEME_NAME]: {
          name: AUTH_SCHEME_NAME,
          schema: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
          value: session.accessToken,
        },
      });
    } catch (_error) {
      // Ignore Swagger UI authorization sync failures.
    }
  }
}

async function signInWithQuickLogin() {
  const quickLogin = saveQuickLoginInputs();
  setQuickSessionBusy(true);
  syncSessionStatus("Signing in with saved credentials...");

  try {
    const response = await fetch(buildApiUrl("/api/auth/login"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(quickLogin),
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `Login failed with status ${response.status}.`));
    }

    if (!isSessionPayload(payload)) {
      throw new Error("Login succeeded but no session tokens were returned.");
    }

    persistSession({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      username: payload.user?.username ?? quickLogin.username,
    });
    syncSwaggerAuthorization();
    syncSessionStatus(`Signed in as ${payload.user?.username ?? quickLogin.username}. Protected requests will reuse this token automatically.`);
  } catch (error) {
    syncSessionStatus(error.message);
  } finally {
    setQuickSessionBusy(false);
  }
}

async function refreshQuickSession() {
  const session = readSession();
  if (!session.refreshToken) {
    syncSessionStatus("No refresh token is saved yet.");
    return;
  }

  setQuickSessionBusy(true);
  syncSessionStatus("Refreshing the saved session...");

  try {
    const response = await fetch(buildApiUrl("/api/auth/refresh"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: session.refreshToken,
      }),
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `Refresh failed with status ${response.status}.`));
    }

    if (!isSessionPayload(payload)) {
      throw new Error("Refresh succeeded but no rotated session tokens were returned.");
    }

    persistSession({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      username: payload.user?.username ?? session.username,
    });
    syncSwaggerAuthorization();
    syncSessionStatus("Session refreshed. New access token is active across the docs.");
  } catch (error) {
    syncSessionStatus(error.message);
  } finally {
    setQuickSessionBusy(false);
  }
}

async function requestQuickSignupOtp() {
  const quickSignup = saveQuickSignupInputs();
  setQuickSessionBusy(true);
  syncSessionStatus(`Requesting OTP for ${quickSignup.email}...`);

  try {
    const response = await fetch(buildApiUrl("/api/auth/register/email/request-otp"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: quickSignup.email,
      }),
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(
        extractErrorMessage(payload, `OTP request failed with status ${response.status}.`),
      );
    }

    syncSessionStatus(
      payload?.message ??
        "OTP request accepted. Use the code from the dev/mock mailer, then run quick sign up.",
    );
  } catch (error) {
    syncSessionStatus(error.message);
  } finally {
    setQuickSessionBusy(false);
  }
}

async function signUpWithQuickSignup() {
  const quickSignup = saveQuickSignupInputs();
  setQuickSessionBusy(true);
  syncSessionStatus(`Creating account for ${quickSignup.username}...`);

  try {
    const response = await fetch(buildApiUrl("/api/auth/register/email/verify"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: quickSignup.email,
        otp: quickSignup.otp,
        username: quickSignup.username,
        password: quickSignup.password,
      }),
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `Sign up failed with status ${response.status}.`));
    }

    if (!isSessionPayload(payload)) {
      throw new Error("Sign up succeeded but no session tokens were returned.");
    }

    persistQuickLogin({
      username: quickSignup.username,
      password: quickSignup.password,
    });
    persistSession({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      username: payload.user?.username ?? quickSignup.username,
    });
    syncSwaggerAuthorization();
    syncSessionStatus(`Signed up and signed in as ${payload.user?.username ?? quickSignup.username}.`);
  } catch (error) {
    syncSessionStatus(error.message);
  } finally {
    setQuickSessionBusy(false);
  }
}

async function copyCurrentToken(tokenKind) {
  const session = readSession();
  const token =
    tokenKind === "refresh" ? session.refreshToken : session.accessToken;

  if (!token) {
    syncSessionStatus(
      tokenKind === "refresh"
        ? "No refresh token is available to copy."
        : "No access token is available to copy.",
    );
    return;
  }

  if (!navigator.clipboard?.writeText) {
    syncSessionStatus("Clipboard access is not available in this browser.");
    return;
  }

  try {
    await navigator.clipboard.writeText(token);
    syncSessionStatus(
      tokenKind === "refresh"
        ? "Current refresh token copied to the clipboard."
        : "Current access token copied to the clipboard.",
    );
  } catch (_error) {
    syncSessionStatus("Clipboard write failed.");
  }
}

function bindQuickSessionControls() {
  const buttonHandlers = [
    ["quick-login-submit", signInWithQuickLogin],
    ["quick-signup-request-otp", requestQuickSignupOtp],
    ["quick-signup-submit", signUpWithQuickSignup],
    ["quick-refresh-submit", refreshQuickSession],
    ["copy-access-token-submit", () => copyCurrentToken("access")],
    ["copy-refresh-token-submit", () => copyCurrentToken("refresh")],
    [
      "clear-session-submit",
      () => {
        clearSession();
        syncSwaggerAuthorization();
        syncSessionStatus("Saved session cleared.");
      },
    ],
  ];

  for (const [buttonId, handler] of buttonHandlers) {
    const button = document.getElementById(buttonId);
    if (!button || button.dataset.docsBound === "true") {
      continue;
    }

    button.dataset.docsBound = "true";
    button.addEventListener("click", handler);
  }

  const formInputIds = [
    "quick-login-username",
    "quick-login-password",
    "quick-signup-email",
    "quick-signup-otp",
    "quick-signup-username",
    "quick-signup-password",
  ];
  for (const inputId of formInputIds) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.docsBound === "true") {
      continue;
    }

    input.dataset.docsBound = "true";
    input.addEventListener("change", () => {
      saveQuickLoginInputs();
      saveQuickSignupInputs();
    });
  }
}

function updateUrlForSelectedSpec(selectedSpec) {
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set("spec", selectedSpec.name);
  window.history.replaceState({}, "", currentUrl);
  updateDocumentTitle(selectedSpec);
}

function bindSpecSelector(specs) {
  const select = document.querySelector(".topbar select");
  if (!select || select.dataset.docsBound === "true") {
    return;
  }

  select.dataset.docsBound = "true";
  select.addEventListener("change", () => {
    const selectedLabel = select.options[select.selectedIndex]?.textContent?.trim();
    const selectedSpec = specs.find((spec) => getSpecDisplayName(spec) === selectedLabel);
    if (selectedSpec) {
      updateUrlForSelectedSpec(selectedSpec);
    }
  });
}

function extractBearerToken(headerValue) {
  if (typeof headerValue !== "string") {
    return "";
  }

  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function shouldAttachAccessToken(requestUrl) {
  if (!requestUrl) {
    return false;
  }

  const resolvedUrl = new URL(requestUrl, window.location.origin);
  return resolvedUrl.pathname.startsWith("/api/") && !resolvedUrl.pathname.startsWith("/api/docs/");
}

function shouldAutofillRefreshToken(requestUrl) {
  if (!requestUrl) {
    return false;
  }

  const resolvedUrl = new URL(requestUrl, window.location.origin);
  return resolvedUrl.pathname === "/api/auth/refresh" || resolvedUrl.pathname === "/api/auth/logout";
}

function shouldReplaceRefreshToken(value) {
  return typeof value !== "string" || value.trim().length === 0 || value.includes("...");
}

function attachStoredRefreshToken(request, session) {
  if (!session.refreshToken || !shouldAutofillRefreshToken(request.url)) {
    return request;
  }

  let requestBody = {};

  if (typeof request.body === "string" && request.body.trim().length > 0) {
    try {
      requestBody = JSON.parse(request.body);
    } catch (_error) {
      return request;
    }
  } else if (request.body && typeof request.body === "object") {
    requestBody = request.body;
  }

  if (shouldReplaceRefreshToken(requestBody.refresh_token)) {
    requestBody = {
      ...requestBody,
      refresh_token: session.refreshToken,
    };
    request.body = JSON.stringify(requestBody);
    request.headers["Content-Type"] = request.headers["Content-Type"] ?? "application/json";
  }

  return request;
}

function attachStoredAccessToken(request) {
  request.headers = request.headers ?? {};

  const outboundToken = extractBearerToken(request.headers.Authorization ?? request.headers.authorization);
  if (outboundToken) {
    persistSession({
      accessToken: outboundToken,
    });
    return attachStoredRefreshToken(request, readSession());
  }

  const session = readSession();
  if (session.accessToken && shouldAttachAccessToken(request.url)) {
    request.headers.Authorization = `Bearer ${session.accessToken}`;
  }

  return attachStoredRefreshToken(request, session);
}

function captureSessionFromResponse(response) {
  const payload = extractSessionPayload(response);
  if (!payload) {
    return response;
  }

  persistSession({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    username: payload.user?.username ?? readSession().username,
  });
  syncSwaggerAuthorization();
  return response;
}

function initializeDocsShell(specs) {
  initializeThemeToggle();
  bindQuickSessionControls();
  bindSpecSelector(specs);
  syncQuickForms();
  syncSwaggerAuthorization();
}

window.addEventListener("docs:session-changed", () => {
  syncQuickForms();
  syncSwaggerAuthorization();
});

window.addEventListener("storage", (event) => {
  if (
    event.key === STORAGE_KEYS.session ||
    event.key === STORAGE_KEYS.quickLogin ||
    event.key === STORAGE_KEYS.quickSignup ||
    event.key === STORAGE_KEYS.theme
  ) {
    applyTheme(resolvePreferredTheme());
    syncQuickForms();
    syncSwaggerAuthorization();
  }
});

window.onload = async function () {
  try {
    const specs = await loadSpecs();
    const primarySpec = getPrimarySpec(specs);
    updateDocumentTitle(primarySpec);
    initializeDocsShell(specs);

    window.ui = SwaggerUIBundle({
      dom_id: "#swagger-ui",
      customSiteTitle: `Social Event Mapper Docs · ${getSpecDisplayName(primarySpec)}`,
      deepLinking: true,
      displayRequestDuration: true,
      displayOperationId: false,
      docExpansion: "none",
      defaultModelExpandDepth: 2,
      defaultModelsExpandDepth: 0,
      defaultModelRendering: "example",
      filter: true,
      persistAuthorization: true,
      showCommonExtensions: false,
      showExtensions: false,
      syntaxHighlight: {
        activated: true,
        theme: "nord",
      },
      tagsSorter: "alpha",
      operationsSorter: "alpha",
      tryItOutEnabled: true,
      requestInterceptor: attachStoredAccessToken,
      responseInterceptor: captureSessionFromResponse,
      onComplete: () => {
        bindSpecSelector(specs);
        syncSwaggerAuthorization();
      },
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
      urls: specs.map((spec) => ({
        url: spec.url,
        name: getSpecDisplayName(spec),
      })),
      "urls.primaryName": getSpecDisplayName(primarySpec),
    });
  } catch (error) {
    renderError(error);
  }
};
