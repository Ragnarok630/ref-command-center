/* =========================================================
   K630-REF SUPABASE AUTHENTICATION
   File: assets/js/auth/auth.js
   Version: 630.1.0

   Responsibilities:
   - Authenticate users through Supabase Auth
   - Restore and refresh secure Supabase sessions
   - Load the authenticated user's profile and role
   - Enforce active Owner/Admin/Officer accounts
   - Expose the K630Auth API used by app.js
   - Dispatch authentication and role events

   Security:
   - Contains no passwords
   - Contains no secret/service-role key
   - Uses only the public Supabase publishable key
   - Roles are loaded from public.profiles under RLS
========================================================= */

(function initializeK630SupabaseAuth(global) {
  "use strict";

  /* =====================================================
     CONFIGURATION
  ===================================================== */

  const MODULE_NAME =
    "K630 Supabase Authentication";

  const MODULE_VERSION =
    "630.1.1";

  const SUPABASE_URL =
    "https://umkdgzawpgoltgpmcumh.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_c6GGaEMgThz-tbE28x_gRw_XC3AXOr7";

  const PROFILE_TABLE =
    "profiles";

  const ALLOWED_ROLES =
    Object.freeze([
      "owner",
      "admin",
      "officer"
    ]);

  const EVENT_NAMES =
    Object.freeze({
      READY:
        "k630:auth-ready",

      CHANGED:
        "k630:auth-changed",

      ROLE_CHANGED:
        "k630:user-role-changed",

      LOGIN_STARTED:
        "k630:auth-login-started",

      LOGIN_SUCCESS:
        "k630:auth-login-success",

      LOGIN_FAILED:
        "k630:auth-login-failed",

      LOGOUT:
        "k630:auth-logout",

      SESSION_EXPIRED:
        "k630:auth-session-expired",

      PASSWORD_CHANGED:
        "k630:auth-password-changed",

      ERROR:
        "k630:auth-error"
    });

  /* =====================================================
     PRIVATE STATE
  ===================================================== */

  let client =
    null;

  let initialized =
    false;

  let initializationPromise =
    null;

  let authSubscription =
    null;

  let currentSupabaseSession =
    null;

  let currentProfile =
    null;

  let currentSession =
    null;

  let lastRole =
    "guest";

  /* =====================================================
     HELPERS
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

  function normalizeEmail(value) {
    return normalizeLower(value);
  }

  function normalizeRole(value) {
    const role =
      normalizeLower(value);

    return ALLOWED_ROLES.includes(
      role
    )
      ? role
      : "";
  }

  function nowIso() {
    return new Date()
      .toISOString();
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
        return structuredClone(
          value
        );
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

  function createAuthError(
    message,
    sourceError = null
  ) {
    const error =
      new Error(
        normalizeText(message) ||
        "Authentication failed."
      );

    error.name =
      "K630AuthError";

    if (sourceError) {
      error.cause =
        sourceError;
    }

    return error;
  }

  function dispatchAuthEvent(
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
              nowIso(),

            ...cloneData(detail)
          }
        }
      )
    );
  }

  function getSupabaseLibrary() {
    return global.supabase || null;
  }

  function validateConfiguration() {
    if (
      !SUPABASE_URL.startsWith(
        "https://"
      )
    ) {
      throw createAuthError(
        "The Supabase project URL is invalid."
      );
    }

    if (
      !SUPABASE_PUBLISHABLE_KEY
        .startsWith(
          "sb_publishable_"
        )
    ) {
      throw createAuthError(
        "The Supabase publishable key is invalid."
      );
    }
  }

  function createClient() {
    if (client) {
      return client;
    }

    validateConfiguration();

    const library =
      getSupabaseLibrary();

    if (
      !library ||
      typeof library.createClient !==
        "function"
    ) {
      throw createAuthError(
        "The Supabase JavaScript library is not loaded."
      );
    }

    client =
      library.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            autoRefreshToken:
              true,

            persistSession:
              true,

            detectSessionInUrl:
              true
          },

          db: {
            schema:
              "public"
          },

          global: {
            headers: {
              "X-Client-Info":
                `k630-command-center/${MODULE_VERSION}`
            }
          }
        }
      );

    return client;
  }

  function getClient() {
    return createClient();
  }

  function createPublicSession(
    supabaseSession,
    profile
  ) {
    const user =
      supabaseSession?.user;

    const role =
      normalizeRole(
        profile?.role
      );

    if (
      !user ||
      !role ||
      profile?.active !==
        true
    ) {
      return null;
    }

    return {
      id:
        normalizeText(
          user.id
        ),

      email:
        normalizeEmail(
          profile?.email ||
          user.email
        ),

      role,

      active:
        true,

      authenticated:
  true,

  mustChangePassword:
  user.user_metadata
    ?.must_change_password ===
      true,

  loginAt:
        (
          user.last_sign_in_at ||
          nowIso()
        ),

      expiresAt:
        supabaseSession
          ?.expires_at
          ? new Date(
              supabaseSession
                .expires_at *
              1000
            ).toISOString()
          : null
    };
  }

  function clearLocalState() {
    currentSupabaseSession =
      null;

    currentProfile =
      null;

    currentSession =
      null;
  }

  function publishState(
    eventName = EVENT_NAMES.CHANGED,
    extra = {}
  ) {
    const role =
      currentSession?.role ||
      "guest";

    dispatchAuthEvent(
      eventName,
      {
        session:
          cloneData(
            currentSession
          ),

        role,

        email:
          currentSession?.email ||
          "",

        authenticated:
          Boolean(
            currentSession
          ),

        ...cloneData(extra)
      }
    );

    if (
      role !==
      lastRole
    ) {
      lastRole =
        role;

      dispatchAuthEvent(
        EVENT_NAMES.ROLE_CHANGED,
        {
          role,

          session:
            cloneData(
              currentSession
            )
        }
      );
    }
  }

  /* =====================================================
     PROFILE
  ===================================================== */

  async function loadProfile(
    userId
  ) {
    const id =
      normalizeText(userId);

    if (!id) {
      return null;
    }

    const supabaseClient =
      getClient();

    const {
      data,
      error
    } =
      await supabaseClient
        .from(PROFILE_TABLE)
        .select(
          [
            "id",
            "email",
            "role",
            "active",
            "created_at",
            "updated_at"
          ].join(",")
        )
        .eq(
          "id",
          id
        )
        .maybeSingle();

    if (error) {
      throw createAuthError(
        "The account profile could not be loaded.",
        error
      );
    }

    if (!data) {
      throw createAuthError(
        "No Command Center profile is linked to this account."
      );
    }

    const role =
      normalizeRole(
        data.role
      );

    if (!role) {
      throw createAuthError(
        "This account has no valid Command Center role."
      );
    }

    if (
      data.active !==
      true
    ) {
      throw createAuthError(
        "This Command Center account is inactive."
      );
    }

    return {
      id:
        normalizeText(
          data.id
        ),

      email:
        normalizeEmail(
          data.email
        ),

      role,

      active:
        true,

      createdAt:
        data.created_at ||
        null,

      updatedAt:
        data.updated_at ||
        null
    };
  }

  async function applySupabaseSession(
    supabaseSession,
    {
      eventName =
        EVENT_NAMES.CHANGED,

      signOutOnFailure =
        true
    } = {}
  ) {
    if (
      !supabaseSession?.user?.id
    ) {
      clearLocalState();
      publishState(eventName);

      return null;
    }

    try {
      const profile =
        await loadProfile(
          supabaseSession.user.id
        );

      currentSupabaseSession =
        supabaseSession;

      currentProfile =
        profile;

      currentSession =
        createPublicSession(
          supabaseSession,
          profile
        );

      if (!currentSession) {
        throw createAuthError(
          "This account is not authorized for the Command Center."
        );
      }

      publishState(
        eventName
      );

      return cloneData(
        currentSession
      );
    } catch (error) {
      clearLocalState();

      if (signOutOnFailure) {
        try {
          await getClient()
            .auth
            .signOut({
              scope:
                "local"
            });
        } catch (signOutError) {
          console.warn(
            `[${MODULE_NAME}] Failed to clear the rejected session.`,
            signOutError
          );
        }
      }

      publishState(
        EVENT_NAMES.ERROR,
        {
          message:
            error?.message ||
            "The account could not be authorized."
        }
      );

      throw error;
    }
  }

  /* =====================================================
     LOGIN
  ===================================================== */

  async function login(credentials = {}) {
    await init();

    const email =
      normalizeEmail(
        credentials?.email
      );

    const password =
      String(
        credentials?.password ??
        ""
      );

    if (!email) {
      return {
        success:
          false,

        message:
          "Enter your email address."
      };
    }

    if (!password) {
      return {
        success:
          false,

        message:
          "Enter your password."
      };
    }

    dispatchAuthEvent(
      EVENT_NAMES.LOGIN_STARTED,
      {
        email
      }
    );

    try {
      const {
        data,
        error
      } =
        await getClient()
          .auth
          .signInWithPassword({
            email,
            password
          });

      if (error) {
        throw createAuthError(
          error.message ||
          "Wrong email or password.",
          error
        );
      }

      if (
        !data?.session ||
        !data?.user
      ) {
        throw createAuthError(
          "Supabase did not return an authenticated session."
        );
      }

      const session =
        await applySupabaseSession(
          data.session,
          {
            eventName:
              EVENT_NAMES.LOGIN_SUCCESS,

            signOutOnFailure:
              true
          }
        );

      return {
        success:
          true,

        session:
          cloneData(session)
      };
    } catch (error) {
      clearLocalState();

      dispatchAuthEvent(
        EVENT_NAMES.LOGIN_FAILED,
        {
          email,

          message:
            error?.message ||
            "Login failed."
        }
      );

      return {
        success:
          false,

        message:
          error?.message ||
          "Wrong email or password."
      };
    }
  }

/* =====================================================
   PASSWORD MANAGEMENT
===================================================== */

function validateNewPassword(
  password
) {
  const value =
    String(
      password ?? ""
    );

  if (
    value.length <
    10
  ) {
    return (
      "Your new password must contain " +
      "at least 10 characters."
    );
  }

  if (
    !/[a-z]/.test(value) ||
    !/[A-Z]/.test(value) ||
    !/[0-9]/.test(value)
  ) {
    return (
      "Your new password must contain " +
      "uppercase, lowercase and a number."
    );
  }

  return "";
}

async function changePassword(
  newPassword
) {
  await init();

  if (
    !currentSupabaseSession ||
    !currentSession
  ) {
    return {
      success:
        false,

      message:
        "You must be signed in."
    };
  }

  const password =
    String(
      newPassword ?? ""
    );

  const validationError =
    validateNewPassword(
      password
    );

  if (validationError) {
    return {
      success:
        false,

      message:
        validationError
    };
  }

  try {
    const currentMetadata = {
      ...(
        currentSupabaseSession
          ?.user
          ?.user_metadata ||
        {}
      )
    };

    delete currentMetadata
      .must_change_password;

    const {
      data,
      error
    } =
      await getClient()
        .auth
        .updateUser({
          password,

          data: {
            ...currentMetadata,

            must_change_password:
              false
          }
        });

    if (error) {
      throw createAuthError(
        error.message ||
        "Your password could not be changed.",
        error
      );
    }

    const {
      data: sessionData,
      error: sessionError
    } =
      await getClient()
        .auth
        .getSession();

    if (sessionError) {
      throw createAuthError(
        sessionError.message ||
        "The updated session could not be loaded.",
        sessionError
      );
    }

    if (
      sessionData?.session
    ) {
      await applySupabaseSession(
        sessionData.session,
        {
          eventName:
            EVENT_NAMES
              .PASSWORD_CHANGED,

          signOutOnFailure:
            false
        }
      );
    } else if (
      data?.user &&
      currentSupabaseSession
    ) {
      currentSupabaseSession = {
        ...currentSupabaseSession,

        user:
          data.user
      };

      currentSession =
        createPublicSession(
          currentSupabaseSession,
          currentProfile
        );

      publishState(
        EVENT_NAMES
          .PASSWORD_CHANGED
      );
    }

    return {
      success:
        true,

      message:
        "Your password was changed successfully."
    };
  } catch (error) {
    console.error(
      `[${MODULE_NAME}] Password change failed.`,
      error
    );

    return {
      success:
        false,

      message:
        error?.message ||
        "Your password could not be changed."
    };
  }
}

  /* =====================================================
     LOGOUT
  ===================================================== */

  async function logout() {
    await init();

    try {
      const {
        error
      } =
        await getClient()
          .auth
          .signOut();

      if (error) {
        throw createAuthError(
          error.message ||
          "Logout failed.",
          error
        );
      }
    } finally {
      clearLocalState();

      publishState(
        EVENT_NAMES.LOGOUT
      );
    }

    return true;
  }

  /* =====================================================
     SESSION
  ===================================================== */

  function getSession() {
    return cloneData(
      currentSession
    );
  }

  function getCurrentUser() {
    return getSession();
  }

  function getCurrentRole() {
    return (
      currentSession?.role ||
      "guest"
    );
  }

  function isAuthenticated() {
    return Boolean(
      currentSession &&
      currentSession.active ===
        true
    );
  }

  function hasRole(role) {
    return (
      getCurrentRole() ===
      normalizeRole(role)
    );
  }

  function hasAnyRole(roles) {
    if (!Array.isArray(roles)) {
      return false;
    }

    return roles
      .map(normalizeRole)
      .filter(Boolean)
      .includes(
        getCurrentRole()
      );
  }

  function canWriteAdminData() {
    return hasAnyRole([
      "owner",
      "admin"
    ]);
  }

  function canViewAdminCenter() {
    return hasAnyRole([
      "owner",
      "admin",
      "officer"
    ]);
  }

  async function refreshSession() {
    await init();

    const {
      data,
      error
    } =
      await getClient()
        .auth
        .refreshSession();

    if (error) {
      clearLocalState();

      publishState(
        EVENT_NAMES.SESSION_EXPIRED,
        {
          message:
            error.message ||
            "The session could not be refreshed."
        }
      );

      return null;
    }

    return applySupabaseSession(
      data?.session,
      {
        eventName:
          EVENT_NAMES.CHANGED,

        signOutOnFailure:
          true
      }
    );
  }

  async function reloadProfile() {
    if (
      !currentSupabaseSession
        ?.user?.id
    ) {
      return null;
    }

    return applySupabaseSession(
      currentSupabaseSession,
      {
        eventName:
          EVENT_NAMES.CHANGED,

        signOutOnFailure:
          true
      }
    );
  }

  /* =====================================================
     AUTH STATE LISTENER
  ===================================================== */

  function bindAuthStateListener() {
    if (authSubscription) {
      return;
    }

    const {
      data
    } =
      getClient()
        .auth
        .onAuthStateChange(
          (
            event,
            supabaseSession
          ) => {
            window.setTimeout(
              async () => {
                try {
                  if (
                    event ===
                      "SIGNED_OUT" ||
                    !supabaseSession
                  ) {
                    clearLocalState();

                    publishState(
                      event ===
                        "SIGNED_OUT"
                        ? EVENT_NAMES.LOGOUT
                        : EVENT_NAMES.CHANGED,
                      {
                        supabaseEvent:
                          event
                      }
                    );

                    return;
                  }

                  await applySupabaseSession(
                    supabaseSession,
                    {
                      eventName:
                        EVENT_NAMES.CHANGED,

                      signOutOnFailure:
                        true
                    }
                  );
                } catch (error) {
                  console.error(
                    `[${MODULE_NAME}] Authentication state update failed.`,
                    error
                  );
                }
              },
              0
            );
          }
        );

    authSubscription =
      data?.subscription ||
      null;
  }

  /* =====================================================
     INITIALIZATION
  ===================================================== */

  async function init() {
    if (initialized) {
      return publicApi;
    }

    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise =
      (async () => {
        createClient();
        bindAuthStateListener();

        const {
          data,
          error
        } =
          await getClient()
            .auth
            .getSession();

        if (error) {
          throw createAuthError(
            error.message ||
            "The stored session could not be read.",
            error
          );
        }

        if (data?.session) {
          try {
            await applySupabaseSession(
              data.session,
              {
                eventName:
                  EVENT_NAMES.CHANGED,

                signOutOnFailure:
                  true
              }
            );
          } catch (error) {
            console.warn(
              `[${MODULE_NAME}] Stored session was rejected.`,
              error
            );
          }
        } else {
          clearLocalState();
        }

        initialized =
          true;

        dispatchAuthEvent(
          EVENT_NAMES.READY,
          {
            session:
              getSession(),

            role:
              getCurrentRole(),

            authenticated:
              isAuthenticated()
          }
        );

        console.info(
          `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
        );

        return publicApi;
      })()
        .catch(error => {
          initialized =
            false;

          clearLocalState();

          dispatchAuthEvent(
            EVENT_NAMES.ERROR,
            {
              message:
                error?.message ||
                "Authentication initialization failed."
            }
          );

          console.error(
            `[${MODULE_NAME}] Initialization failed.`,
            error
          );

          throw error;
        })
        .finally(() => {
          initializationPromise =
            null;
        });

    return initializationPromise;
  }

  function isReady() {
    return initialized;
  }

  /* =====================================================
     COMPATIBILITY METHODS

     User management is deliberately not performed directly
     from the browser. Accounts are created in Supabase.
  ===================================================== */

  function getUsers() {
    return currentSession
      ? [
          cloneData(
            currentSession
          )
        ]
      : [];
  }

  function saveUsers() {
    throw createAuthError(
      "User accounts must be managed securely through Supabase."
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

      EVENTS:
        EVENT_NAMES,

      allowedRoles:
        ALLOWED_ROLES,

      init,
      isReady,

      login,
      logout,
      changePassword,

      getSession,
      getCurrentUser,
      getCurrentRole,

      isAuthenticated,
      hasRole,
      hasAnyRole,

      canWriteAdminData,
      canViewAdminCenter,

      refreshSession,
      reloadProfile,

      getClient,

      getUsers,
      saveUsers,

      ownerEmail:
        ""
    });

  global.K630Auth =
    publicApi;

  /* =====================================================
     AUTO START
  ===================================================== */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        init().catch(() => {
          /*
           * The router displays an authentication-unavailable
           * message if initialization cannot be completed.
           */
        });
      },
      {
        once:
          true
      }
    );
  } else {
    init().catch(() => {
      /*
       * Error was already dispatched and logged by init().
       */
    });
  }
})(window);