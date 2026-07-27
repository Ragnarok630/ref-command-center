/* =========================================================
   K630-REF SPA ROUTER
   File: assets/js/app.js
   Version: 630.2.0
   Release Mode - AFK Service Integration

   Responsibilities:
   - Load SPA page templates
   - Control navigation
   - Enforce protected routes through K630Auth
   - Render login and account status controls
   - Initialize page modules
   - Update the global topbar
   - Dispatch page and authentication events

   Security:
   - Contains no usernames or passwords
   - Contains no user database
   - Does not authenticate credentials itself
   - Authentication is delegated to window.K630Auth
========================================================= */

(function initializeK630Application(global) {
  "use strict";

  /* =====================================================
     CONFIGURATION
  ===================================================== */

  const MODULE_NAME =
    "K630 Application Router";

  const MODULE_VERSION =
    "630.2.0";

  const RELEASE_NAME =
    "Gold Master";

  const DEFAULT_PAGE =
    "home";

  const CONTENT_ELEMENT_ID =
    "app-content";

  const PAGE_DIRECTORY =
    "pages";

  const PAGE_EXTENSION =
    ".html";

  const STORAGE_KEYS =
    Object.freeze({
      LAST_PAGE:
        "k630_last_page"
    });

  const EVENT_NAMES =
    Object.freeze({
      PAGE_LOADING:
        "k630:page-loading",

      PAGE_LOADED:
        "k630:page-loaded",

      PAGE_FAILED:
        "k630:page-failed",

      AUTH_CHANGED:
        "k630:auth-changed",

      ROLE_CHANGED:
        "k630:user-role-changed"
    });

  const ALLOWED_PAGES =
    Object.freeze([
      "home",
      "active-average",
      "season-info",
      "server-vs-server",
      "player-id-info",
      "old-players",
      "old-seasons",
      "afk-service",
      "admin-center"
    ]);

  const PROTECTED_ROUTES =
    Object.freeze({
      "admin-center":
        Object.freeze([
          "owner",
          "admin",
          "officer"
        ]),

      "afk-service":
        Object.freeze([
          "owner",
          "admin",
          "officer"
        ])
    });

  /* =====================================================
     PRIVATE STATE
  ===================================================== */

  let initialized =
    false;

  let currentPage =
    "";

  let requestedPage =
    "";

  let activeLoadController =
    null;

  let activeLoadSequence =
    0;

  let navigationBound =
    false;

  let authenticationEventsBound =
    false;

  /* =====================================================
     GENERAL HELPERS
  ===================================================== */

  function normalizeText(value) {
    return String(
      value ?? ""
    ).trim();
  }

  function normalizeLower(value) {
    return normalizeText(value)
      .toLowerCase();
  }

  function cloneData(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return value;
    }

    if (
      typeof structuredClone ===
      "function"
    ) {
      try {
        return structuredClone(value);
      } catch (error) {
        console.warn(
          `[${MODULE_NAME}] structuredClone failed.`,
          error
        );
      }
    }

    try {
      return JSON.parse(
        JSON.stringify(value)
      );
    } catch (error) {
      return value;
    }
  }

  function escapeHtml(value) {
    return normalizeText(value)
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );
  }

  function dispatchApplicationEvent(
    eventName,
    detail = {}
  ) {
    document.dispatchEvent(
      new CustomEvent(
        eventName,
        {
          detail: {
            module:
              MODULE_NAME,

            version:
              MODULE_VERSION,

            timestamp:
              new Date().toISOString(),

            ...cloneData(detail)
          }
        }
      )
    );
  }

  function getContentElement() {
    return document.getElementById(
      CONTENT_ELEMENT_ID
    );
  }

  function getAuthenticationModule() {
    return global.K630Auth || null;
  }

  function authenticationAvailable() {
    const auth =
      getAuthenticationModule();

    return Boolean(
      auth &&
      typeof auth.getSession ===
        "function"
    );
  }

  function normalizeRole(role) {
    const normalized =
      normalizeLower(role);

    return [
      "owner",
      "admin",
      "officer"
    ].includes(normalized)
      ? normalized
      : "guest";
  }

  function getSession() {
    const auth =
      getAuthenticationModule();

    if (
      !auth ||
      typeof auth.getSession !==
        "function"
    ) {
      return null;
    }

    try {
      return auth.getSession() || null;
    } catch (error) {
      console.error(
        `[${MODULE_NAME}] Authentication session could not be read.`,
        error
      );

      return null;
    }
  }

  function getCurrentRole() {
    const auth =
      getAuthenticationModule();

    if (
      auth &&
      typeof auth.getCurrentRole ===
        "function"
    ) {
      try {
        return normalizeRole(
          auth.getCurrentRole()
        );
      } catch (error) {
        console.error(
          `[${MODULE_NAME}] Current role could not be read.`,
          error
        );
      }
    }

    return normalizeRole(
      getSession()?.role
    );
  }

  function isAuthenticated() {
    const auth =
      getAuthenticationModule();

    if (
      auth &&
      typeof auth.isAuthenticated ===
        "function"
    ) {
      try {
        return Boolean(
          auth.isAuthenticated()
        );
      } catch (error) {
        console.error(
          `[${MODULE_NAME}] Authentication state could not be read.`,
          error
        );
      }
    }

    return Boolean(
      getSession()
    );
  }

  function normalizePageName(page) {
    const normalized =
      normalizeLower(page);

    return ALLOWED_PAGES.includes(
      normalized
    )
      ? normalized
      : DEFAULT_PAGE;
  }

  function getPageUrl(page) {
    return (
      `${PAGE_DIRECTORY}/` +
      `${encodeURIComponent(page)}` +
      `${PAGE_EXTENSION}`
    );
  }

  function saveLastPage(page) {
    try {
      localStorage.setItem(
        STORAGE_KEYS.LAST_PAGE,
        normalizePageName(page)
      );

      return true;
    } catch (error) {
      console.warn(
        `[${MODULE_NAME}] Last page could not be saved.`,
        error
      );

      return false;
    }
  }

  function readLastPage() {
    try {
      return normalizePageName(
        localStorage.getItem(
          STORAGE_KEYS.LAST_PAGE
        ) ||
        DEFAULT_PAGE
      );
    } catch (error) {
      return DEFAULT_PAGE;
    }
  }

  /* =====================================================
     ROUTE ACCESS
  ===================================================== */

  function getRequiredRoles(page) {
    const cleanPage =
      normalizePageName(page);

    return (
      PROTECTED_ROUTES[cleanPage] ||
      null
    );
  }

  function hasRouteAccess(page) {
    const requiredRoles =
      getRequiredRoles(page);

    if (!requiredRoles) {
      return true;
    }

    if (!isAuthenticated()) {
      return false;
    }

    return requiredRoles.includes(
      getCurrentRole()
    );
  }

  /* =====================================================
     MARKUP
  ===================================================== */

  function createLoadingMarkup(page) {
    const pageLabel =
      escapeHtml(
        normalizeText(page)
          .replaceAll("-", " ")
      );

    return `
      <div class="loading-box">
        <i class="fa-solid fa-spinner fa-spin"></i>

        <span>
          Loading ${pageLabel}...
        </span>
      </div>
    `;
  }

  function createPageErrorMarkup(
    page,
    message
  ) {
    return `
      <section class="home-page">
        <div class="dashboard-panel">
          <h3>
            <i class="fa-solid fa-triangle-exclamation purple-small"></i>
            Page Error
          </h3>

          <p>
            The page
            <strong>
              ${escapeHtml(page)}
            </strong>
            could not be loaded.
          </p>

          <p class="small text-secondary">
            ${escapeHtml(
              message ||
              "Unknown page loading error."
            )}
          </p>

          <button
            type="button"
            class="admin-btn"
            data-router-retry-page="${escapeHtml(page)}"
          >
            <i class="fa-solid fa-rotate"></i>
            Retry
          </button>
        </div>
      </section>
    `;
  }

  function createAuthenticationUnavailableMarkup() {
    return `
      <section class="home-page">
        <div class="dashboard-panel">
          <h3>
            <i class="fa-solid fa-shield-halved purple-small"></i>
            Authentication Unavailable
          </h3>

          <p>
            The secure authentication module is not loaded.
          </p>

          <p class="small text-secondary">
            Check that
            <strong>assets/js/auth/auth.js</strong>
            is loaded before
            <strong>assets/js/app.js</strong>.
          </p>
        </div>
      </section>
    `;
  }

  /* =====================================================
     NAVIGATION
  ===================================================== */

  function setActiveNavigation(page) {
    document.querySelectorAll(
      ".sidebar nav li[data-page]"
    ).forEach(item => {
      const active =
        item.dataset.page ===
        page;

      item.classList.toggle(
        "active",
        active
      );

      if (active) {
        item.setAttribute(
          "aria-current",
          "page"
        );
      } else {
        item.removeAttribute(
          "aria-current"
        );
      }
    });
  }

  function getCurrentPage() {
    if (currentPage) {
      return currentPage;
    }

    const activeItem =
      document.querySelector(
        ".sidebar nav li.active[data-page]"
      );

    if (
      activeItem?.dataset?.page
    ) {
      return normalizePageName(
        activeItem.dataset.page
      );
    }

    return readLastPage();
  }

  function bindNavigation() {
    if (navigationBound) {
      return;
    }

    navigationBound =
      true;

    document.addEventListener(
      "click",
      event => {
        const navigationItem =
          event.target.closest(
            ".sidebar nav li[data-page]"
          );

        if (navigationItem) {
          const page =
            navigationItem.dataset.page;

          if (page) {
            loadPage(page);
          }

          return;
        }

        const retryButton =
          event.target.closest(
            "[data-router-retry-page]"
          );

        if (retryButton) {
          loadPage(
            retryButton.dataset
              .routerRetryPage
          );
        }
      }
    );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key !== "Enter" &&
          event.key !== " "
        ) {
          return;
        }

        const navigationItem =
          event.target.closest(
            ".sidebar nav li[data-page]"
          );

        if (!navigationItem) {
          return;
        }

        event.preventDefault();

        loadPage(
          navigationItem.dataset.page
        );
      }
    );
  }

    /* =====================================================
     PAGE LOADING
  ===================================================== */

  async function loadPage(
    page,
    options = {}
  ) {
    const cleanPage =
      normalizePageName(
        page ||
        DEFAULT_PAGE
      );

    const content =
      getContentElement();

    if (!content) {
      console.error(
        `[${MODULE_NAME}] #${CONTENT_ELEMENT_ID} was not found.`
      );

      return false;
    }

    requestedPage =
      cleanPage;

    if (
      !hasRouteAccess(
        cleanPage
      )
    ) {
      requestedPage =
        "";

      if (
        !authenticationAvailable()
      ) {
        content.innerHTML =
          createAuthenticationUnavailableMarkup();

        return false;
      }

      showAdminLoginPopup(
        cleanPage
      );

      return false;
    }

    dispatchApplicationEvent(
      EVENT_NAMES.PAGE_LOADING,
      {
        page:
          cleanPage
      }
    );

    content.innerHTML =
      createLoadingMarkup(
        cleanPage
      );

    try {
      const response =
        await fetch(
          getPageUrl(
            cleanPage
          ),
          {
            cache:
              "no-store"
          }
        );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const html =
        await response.text();

      if (
        !normalizeText(
          html
        )
      ) {
        throw new Error(
          "The page template is empty."
        );
      }

      /*
       * Place the fetched HTML immediately.
       * Page-module initialization may never keep the
       * loading screen visible.
       */

      content.innerHTML =
        html;

      currentPage =
        cleanPage;

      requestedPage =
        "";

      setActiveNavigation(
        cleanPage
      );

      saveLastPage(
        cleanPage
      );

      /*
       * Initialize the page after its HTML is visible.
       * Do not await this operation from the router.
       */

      Promise.resolve()
        .then(() => {
          return initializeLoadedPage(
            cleanPage
          );
        })
        .catch(error => {
          console.error(
            `[${MODULE_NAME}] Page initialization failed for "${cleanPage}".`,
            error
          );
        });

      dispatchApplicationEvent(
        EVENT_NAMES.PAGE_LOADED,
        {
          page:
            cleanPage,

          role:
            getCurrentRole(),

          session:
            getSession()
        }
      );

      return true;
    } catch (error) {
      requestedPage =
        "";

      console.error(
        `[${MODULE_NAME}] Page "${cleanPage}" could not be loaded.`,
        error
      );

      content.innerHTML =
        createPageErrorMarkup(
          cleanPage,
          error?.message ||
          "Unknown loading error."
        );

      dispatchApplicationEvent(
        EVENT_NAMES.PAGE_FAILED,
        {
          page:
            cleanPage,

          message:
            error?.message ||
            "Unknown loading error."
        }
      );

      return false;
    }
  }

  /* =====================================================
     PAGE MODULE INITIALIZATION
  ===================================================== */

  async function callModuleMethod(
    module,
    methodName
  ) {
    if (
      !module ||
      typeof module[
        methodName
      ] !==
        "function"
    ) {
      return false;
    }

    await module[
      methodName
    ]();

    return true;
  }

  async function initializeLoadedPage(page) {
    updateTopbar();
    renderAuthenticationInterface();

    try {
      switch (page) {
        case "admin-center":
          if (
            global.K630AdminCore &&
            typeof global
              .K630AdminCore
              .init ===
              "function"
          ) {
            /*
             * Do not allow Admin Core initialization to keep the
             * router unresolved forever. The HTML is already on
             * screen and Admin Core may continue independently.
             */

            const adminInitialization =
              global
                .K630AdminCore
                .init();

            await Promise.race([
              Promise.resolve(
                adminInitialization
              ),

              new Promise(resolve => {
                global.setTimeout(
                  resolve,
                  10000
                );
              })
            ]);
          } else if (
            typeof global
              .initAdminCenter ===
              "function"
          ) {
            const legacyInitialization =
              global
                .initAdminCenter();

            await Promise.race([
              Promise.resolve(
                legacyInitialization
              ),

              new Promise(resolve => {
                global.setTimeout(
                  resolve,
                  10000
                );
              })
            ]);
          }
          break;

        case "home":
          if (
            global.K630HomePage
          ) {
            await callModuleMethod(
              global.K630HomePage,
              "init"
            );

            await callModuleMethod(
              global.K630HomePage,
              "render"
            );
          } else if (
            typeof global
              .initHomeCharts ===
              "function"
          ) {
            await global
              .initHomeCharts();
          }
          break;

        case "season-info":
          if (
            global.K630SeasonInfoPage
          ) {
            await callModuleMethod(
              global.K630SeasonInfoPage,
              "init"
            );

            await callModuleMethod(
              global.K630SeasonInfoPage,
              "render"
            );
          } else if (
            typeof global
              .renderSeasonInfoPage ===
              "function"
          ) {
            await global
              .renderSeasonInfoPage();
          }
          break;

        case "active-average":
          if (
            global.K630ActiveAveragePage
          ) {
            await callModuleMethod(
              global.K630ActiveAveragePage,
              "init"
            );

            await callModuleMethod(
              global.K630ActiveAveragePage,
              "render"
            );
          } else if (
            typeof global
              .renderActiveAveragePage ===
              "function"
          ) {
            await global
              .renderActiveAveragePage();
          }
          break;

        case "old-players":
          if (
            global.K630OldPlayersPage
          ) {
            await callModuleMethod(
              global.K630OldPlayersPage,
              "init"
            );

            await callModuleMethod(
              global.K630OldPlayersPage,
              "render"
            );
          } else if (
            typeof global
              .renderOldPlayersPage ===
              "function"
          ) {
            await global
              .renderOldPlayersPage();
          }
          break;

        case "old-seasons":
          if (
            global.K630OldSeasonsPage
          ) {
            await callModuleMethod(
              global.K630OldSeasonsPage,
              "init"
            );

            await callModuleMethod(
              global.K630OldSeasonsPage,
              "render"
            );
          } else if (
            typeof global
              .renderOldSeasonsPage ===
              "function"
          ) {
            await global
              .renderOldSeasonsPage();
          }
          break;

        case "afk-service":
          if (
            global.K630AfkServicePage
          ) {
            await callModuleMethod(
              global.K630AfkServicePage,
              "init"
            );

            await callModuleMethod(
              global.K630AfkServicePage,
              "render"
            );
          }
          break;

        case "server-vs-server":
          await initializeServerVsServerPage();
          break;

        default:
          break;
      }

      if (
        typeof global
          .initHeroBorder ===
          "function"
      ) {
        global.initHeroBorder();
      }
    } catch (error) {
      console.error(
        `[${MODULE_NAME}] Page module initialization failed for "${page}".`,
        error
      );
    }
  }

  async function initializeServerVsServerPage() {
    const pageContainer =
      document.getElementById(
        "serverVsServerPage"
      );

    if (!pageContainer) {
      throw new Error(
        "#serverVsServerPage was not found."
      );
    }

    const pageModule =
      global
        .K630ServerVsServerPage;

    if (!pageModule) {
      pageContainer.innerHTML = `
        <div class="dashboard-panel">
          <h3>
            <i class="fa-solid fa-triangle-exclamation"></i>
            Server vs Server Error
          </h3>

          <p>
            The Server vs Server page module is unavailable.
          </p>
        </div>
      `;

      return false;
    }

    await callModuleMethod(
      pageModule,
      "init"
    );

    await callModuleMethod(
      pageModule,
      "render"
    );

    return true;
  }

  /* =====================================================
     LOGIN POPUP
  ===================================================== */

  function removeAdminLoginPopup() {
    document.getElementById(
      "k630AdminLoginOverlay"
    )?.remove();
  }

  function showAdminLoginPopup(
    targetPage = "admin-center"
  ) {
    removeAdminLoginPopup();

    const auth =
      getAuthenticationModule();

    const cleanTargetPage =
      normalizePageName(
        targetPage
      );

    const overlay =
      document.createElement(
        "div"
      );

    overlay.id =
      "k630AdminLoginOverlay";

    overlay.className =
      "k630-login-overlay";

    overlay.innerHTML = `
      <div
        class="k630-login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="k630LoginTitle"
      >
        <div class="k630-login-icon">
          <i class="fa-solid fa-lock"></i>
        </div>

        <h2 id="k630LoginTitle">
          Admin Center Login
        </h2>

        <p>
          Login with an authorized Owner, Admin or Officer account.
        </p>

        <form id="k630LoginForm">
          <div class="k630-login-field">
            <label for="k630LoginEmail">
              Email
            </label>

            <input
              id="k630LoginEmail"
              type="email"
              autocomplete="username"
              placeholder="email@example.com"
              required
            >
          </div>

          <div class="k630-login-field">
            <label for="k630LoginPassword">
              Password
            </label>

            <input
              id="k630LoginPassword"
              type="password"
              autocomplete="current-password"
              placeholder="Password"
              required
            >
          </div>

          <button
            class="k630-login-btn"
            id="k630LoginButton"
            type="submit"
          >
            <i class="fa-solid fa-right-to-bracket"></i>
            Login
          </button>

          <button
            class="k630-login-cancel"
            id="k630LoginCancelButton"
            type="button"
          >
            Cancel
          </button>

          <div
            id="k630LoginMessage"
            class="k630-login-message"
            aria-live="polite"
          ></div>
        </form>
      </div>
    `;

    document.body.appendChild(
      overlay
    );

    const form =
      overlay.querySelector(
        "#k630LoginForm"
      );

    const emailInput =
      overlay.querySelector(
        "#k630LoginEmail"
      );

    const passwordInput =
      overlay.querySelector(
        "#k630LoginPassword"
      );

    const loginButton =
      overlay.querySelector(
        "#k630LoginButton"
      );

    const cancelButton =
      overlay.querySelector(
        "#k630LoginCancelButton"
      );

    const message =
      overlay.querySelector(
        "#k630LoginMessage"
      );

    async function attemptLogin() {
      if (
        !auth ||
        typeof auth.login !==
          "function"
      ) {
        message.textContent =
          "The authentication service is unavailable.";

        return;
      }

      const email =
        normalizeText(
          emailInput?.value
        );

      const password =
        String(
          passwordInput?.value ??
          ""
        );

      if (
        !email ||
        !password
      ) {
        message.textContent =
          "Enter your email address and password.";

        return;
      }

      loginButton.disabled =
        true;

      message.textContent =
        "Checking account...";

      try {
        const result =
          await auth.login({
            email,
            password
          });

        const successful =
          result === true ||
          result?.success ===
            true ||
          Boolean(
            result?.session
          );

        if (!successful) {
          throw new Error(
            result?.message ||
            "Wrong email or password."
          );
        }

        removeAdminLoginPopup();
        renderAuthenticationInterface();

        const session =
          getSession();

        dispatchApplicationEvent(
          EVENT_NAMES.AUTH_CHANGED,
          {
            session,

            role:
              getCurrentRole(),

            authenticated:
              Boolean(
                session
              )
          }
        );

        await loadPage(
          cleanTargetPage
        );
      } catch (error) {
        message.textContent =
          error?.message ||
          "Login failed.";

        if (passwordInput) {
          passwordInput.value =
            "";

          passwordInput.focus();
        }
      } finally {
        if (loginButton) {
          loginButton.disabled =
            false;
        }
      }
    }

    form?.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        attemptLogin();
      }
    );

    cancelButton?.addEventListener(
      "click",
      removeAdminLoginPopup
    );

    overlay.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          overlay
        ) {
          removeAdminLoginPopup();
        }
      }
    );

    overlay.addEventListener(
      "keydown",
      event => {
        if (
          event.key ===
          "Escape"
        ) {
          removeAdminLoginPopup();
        }
      }
    );

    global.setTimeout(
      () => {
        emailInput?.focus();
      },
      30
    );
  }

 /* =====================================================
     AUTHENTICATION INTERFACE
  ===================================================== */

  function getRoleLabel(role) {
    switch (
      normalizeRole(
        role
      )
    ) {
      case "owner":
        return "Owner";

      case "admin":
        return "Admin";

      case "officer":
        return "Officer";

      default:
        return "Guest";
    }
  }

  function getRoleIcon(role) {
    switch (
      normalizeRole(
        role
      )
    ) {
      case "owner":
        return "fa-solid fa-crown";

      case "admin":
        return "fa-solid fa-user-shield";

      case "officer":
        return "fa-solid fa-eye";

      default:
        return "fa-solid fa-right-to-bracket";
    }
  }

  function openLoginFromInterface() {
    showAdminLoginPopup(
      "admin-center"
    );
  }

  function handleLoginKeyboard(event) {
    if (
      event.key !==
        "Enter" &&
      event.key !==
        " "
    ) {
      return;
    }

    event.preventDefault();

    openLoginFromInterface();
  }

  function renderAuthenticationInterface() {
    const session =
      getSession();

    const role =
      getCurrentRole();

    const authenticated =
      Boolean(
        session
      );

    const roleLabel =
      getRoleLabel(
        role
      );

    const sidebarPanel =
      document.getElementById(
        "sidebarAuthPanel"
      );

    const topbarStatus =
      document.getElementById(
        "topbarUserStatus"
      );

    const topbarText =
      document.getElementById(
        "topbarUserText"
      );

    if (sidebarPanel) {
      const userBox =
        sidebarPanel.querySelector(
          "#sidebarAuthUser"
        );

      const roleBox =
        sidebarPanel.querySelector(
          "#sidebarAuthRole"
        );

      const iconBox =
        sidebarPanel.querySelector(
          ".sidebar-auth-icon i"
        );

      const logoutButton =
        sidebarPanel.querySelector(
          "#sidebarLogoutButton"
        );

      sidebarPanel.onclick =
        null;

      sidebarPanel.onkeydown =
        null;

      sidebarPanel.classList.toggle(
        "is-guest",
        !authenticated
      );

      sidebarPanel.classList.toggle(
        "is-authenticated",
        authenticated
      );

      if (userBox) {
        userBox.textContent =
          authenticated
            ? roleLabel
            : "Guest";
      }

      if (roleBox) {
        roleBox.textContent =
          authenticated
            ? (
                session?.email ||
                session?.name ||
                roleLabel
              )
            : "Click to log in";
      }

      if (iconBox) {
        iconBox.className =
          getRoleIcon(
            role
          );
      }

      if (authenticated) {
        sidebarPanel.removeAttribute(
          "role"
        );

        sidebarPanel.removeAttribute(
          "tabindex"
        );

        sidebarPanel.title =
          `${roleLabel}: ${
            session?.email ||
            session?.name ||
            ""
          }`;

        if (logoutButton) {
          logoutButton.hidden =
            false;

          logoutButton.onclick =
            event => {
              event.stopPropagation();

              logout();
            };
        }
      } else {
        sidebarPanel.setAttribute(
          "role",
          "button"
        );

        sidebarPanel.setAttribute(
          "tabindex",
          "0"
        );

        sidebarPanel.title =
          "Click to log in";

        sidebarPanel.onclick =
          openLoginFromInterface;

        sidebarPanel.onkeydown =
          handleLoginKeyboard;

        if (logoutButton) {
          logoutButton.hidden =
            true;

          logoutButton.onclick =
            null;
        }
      }
    }

    if (topbarStatus) {
      topbarStatus.onclick =
        null;

      topbarStatus.onkeydown =
        null;

      topbarStatus.classList.toggle(
        "is-guest",
        !authenticated
      );

      topbarStatus.classList.toggle(
        "is-authenticated",
        authenticated
      );

      if (authenticated) {
        topbarStatus.removeAttribute(
          "role"
        );

        topbarStatus.removeAttribute(
          "tabindex"
        );

        topbarStatus.title =
          `${roleLabel}: ${
            session?.email ||
            session?.name ||
            ""
          }`;
      } else {
        topbarStatus.setAttribute(
          "role",
          "button"
        );

        topbarStatus.setAttribute(
          "tabindex",
          "0"
        );

        topbarStatus.title =
          "Click to log in";

        topbarStatus.onclick =
          openLoginFromInterface;

        topbarStatus.onkeydown =
          handleLoginKeyboard;
      }
    }

    if (topbarText) {
      topbarText.textContent =
        authenticated
          ? roleLabel
          : "Guest - Login";
    }
  }

  async function logout() {
    const auth =
      getAuthenticationModule();

    try {
      if (
        auth &&
        typeof auth.logout ===
          "function"
      ) {
        await auth.logout();
      }
    } catch (error) {
      console.error(
        `[${MODULE_NAME}] Logout failed.`,
        error
      );
    }

    removeAdminLoginPopup();
    renderAuthenticationInterface();

    dispatchApplicationEvent(
      EVENT_NAMES.AUTH_CHANGED,
      {
        session:
          null,

        role:
          "guest",

        authenticated:
          false
      }
    );

    await loadPage(
      DEFAULT_PAGE
    );
  }

    /* =====================================================
     TOPBAR
  ===================================================== */

  function getSeasonConfig() {
    try {
      const raw =
        localStorage.getItem(
          "k630_current_season_config"
        );

      if (!raw) {
        return null;
      }

      return JSON.parse(
        raw
      );
    } catch (error) {
      return null;
    }
  }

  function getTopbarStatusValue() {
    try {
      const seasonConfig =
        getSeasonConfig();

      return (
        normalizeText(
          seasonConfig
            ?.topbarStatus ??
          seasonConfig
            ?.status
        ) ||
        "Home Kingdom - Farming - Open for Migration"
      );
    } catch (error) {
      return (
        "Home Kingdom - Farming - Open for Migration"
      );
    }
  }

  function updateTopbar() {
    const onlineBox =
      document.getElementById(
        "topbarStatus"
      );

    const kingdomBox =
      document.getElementById(
        "topbarKingdom"
      );

    const seasonBox =
      document.getElementById(
        "topbarSeason"
      );

    const versionBox =
      document.getElementById(
        "topbarVersion"
      );

    if (onlineBox) {
      onlineBox.innerHTML = `
        <span
          class="online"
          aria-hidden="true"
        ></span>

        <span class="topbar-status-text">
          Online
        </span>
      `;
    }

    if (kingdomBox) {
      kingdomBox.textContent =
        "Kingdom 630 - Started on the 27th of March 2026";
    }

    if (versionBox) {
      versionBox.textContent =
        `Version ${MODULE_VERSION} ${RELEASE_NAME}`;
    }

    if (!seasonBox) {
      return;
    }

    const season =
      getSeasonConfig();

    const status =
      getTopbarStatusValue();

    if (
      !season ||
      !season.currentSeasonId
    ) {
      seasonBox.textContent =
        `Current Mode: ${status}`;

      return;
    }

    seasonBox.textContent =
      (
        `Current Season: ` +
        `${season.currentSeasonLabel || season.currentSeasonId}` +
        ` | ${status}`
      );
  }

  /* =====================================================
     AUTHENTICATION EVENTS
  ===================================================== */

  function bindAuthenticationEvents() {
    if (
      authenticationEventsBound
    ) {
      return;
    }

    authenticationEventsBound =
      true;

    document.addEventListener(
      EVENT_NAMES.AUTH_CHANGED,
      () => {
        renderAuthenticationInterface();

        if (
          currentPage &&
          !hasRouteAccess(
            currentPage
          )
        ) {
          loadPage(
            DEFAULT_PAGE
          );
        }
      }
    );

    document.addEventListener(
      "k630:season-updated",
      () => {
        updateTopbar();

        if (
          currentPage ===
            "home" &&
          global.K630HomePage &&
          typeof global
            .K630HomePage
            .reload ===
            "function"
        ) {
          global
            .K630HomePage
            .reload();
        }
      }
    );

    document.addEventListener(
      EVENT_NAMES.ROLE_CHANGED,
      () => {
        renderAuthenticationInterface();

        if (
          currentPage &&
          !hasRouteAccess(
            currentPage
          )
        ) {
          loadPage(
            DEFAULT_PAGE
          );
        }
      }
    );
  }

  /* =====================================================
     PUBLIC API
  ===================================================== */

  const publicApi =
    Object.freeze({
      name:
        MODULE_NAME,

      version:
        MODULE_VERSION,

      releaseName:
        RELEASE_NAME,

      allowedPages:
        ALLOWED_PAGES,

      protectedRoutes:
        PROTECTED_ROUTES,

      init,

      loadPage,

      reloadCurrentPage() {
        return loadPage(
          getCurrentPage(),
          {
            force:
              true
          }
        );
      },

      getCurrentPage,

      getRequestedPage() {
        return requestedPage;
      },

      hasRouteAccess,

      showLogin:
        showAdminLoginPopup,

      closeLogin:
        removeAdminLoginPopup,

      logout,

      updateTopbar,

      renderAuthenticationInterface
    });

  global.K630Router =
    publicApi;

  /* =====================================================
     INITIALIZATION
  ===================================================== */

  async function init() {
    if (initialized) {
      return publicApi;
    }

    initialized =
      true;

    bindNavigation();
    bindAuthenticationEvents();

    updateTopbar();
    renderAuthenticationInterface();

    const initialPage =
      readLastPage();

    if (
      getRequiredRoles(
        initialPage
      ) &&
      !hasRouteAccess(
        initialPage
      )
    ) {
      await loadPage(
        DEFAULT_PAGE
      );
    } else {
      await loadPage(
        initialPage
      );
    }

    return publicApi;
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        init().catch(
          error => {
            console.error(
              `[${MODULE_NAME}] Initialization failed.`,
              error
            );
          }
        );
      },
      {
        once:
          true
      }
    );
  } else {
    init().catch(
      error => {
        console.error(
          `[${MODULE_NAME}] Initialization failed.`,
          error
        );
      }
    );
  }
})(window);