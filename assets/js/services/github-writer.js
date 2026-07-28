/* =========================================================
   K630-REF SECURE GITHUB WRITER
   File: assets/js/services/github-writer.js
   Version: 630.3.0

   Responsibilities:
   - Send authenticated write requests to Supabase Edge Function
   - Never expose the GitHub token in the browser
   - Check GitHub write access
   - Create or update JSON files in k630-public-data
   - Use the active Supabase access token
========================================================= */

(function initializeK630GitHubWriter(global) {
  "use strict";

  /* =====================================================
     CONFIGURATION
  ===================================================== */

  const MODULE_NAME =
    "K630 Secure GitHub Writer";

  const MODULE_VERSION =
    "630.3.0";

  const SUPABASE_URL =
    "https://umkdgzawpgoltgpmcumh.supabase.co";

  const EDGE_FUNCTION_NAME =
    "github-write";

  const EDGE_FUNCTION_URL =
    (
      `${SUPABASE_URL}/functions/v1/` +
      EDGE_FUNCTION_NAME
    );

  const DEFAULT_REPOSITORY =
    Object.freeze({
      owner:
        "Ragnarok630",

      repository:
        "k630-public-data",

      branch:
        "main"
    });

  /* =====================================================
     HELPERS
  ===================================================== */

  function normalizeText(value) {
    return String(
      value ?? ""
    ).trim();
  }

  function normalizePath(value) {
    return normalizeText(value)
      .replaceAll("\\", "/")
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/");
  }

  function createWriterError(
    message,
    details = null
  ) {
    const error =
      new Error(
        normalizeText(message) ||
        "GitHub write operation failed."
      );

    error.name =
      "K630GitHubWriterError";

    if (details) {
      error.details =
        details;
    }

    return error;
  }

  function getAuth() {
    return global.K630Auth || null;
  }

  function getSupabaseClient() {
    const auth =
      getAuth();

    if (
      !auth ||
      typeof auth.getClient !==
        "function"
    ) {
      throw createWriterError(
        "K630Auth is unavailable."
      );
    }

    const client =
      auth.getClient();

    if (!client) {
      throw createWriterError(
        "The Supabase client is unavailable."
      );
    }

    return client;
  }

  async function getAccessToken() {
    const client =
      getSupabaseClient();

    const {
      data,
      error
    } =
      await client
        .auth
        .getSession();

    if (error) {
      throw createWriterError(
        error.message ||
        "The Supabase session could not be loaded.",
        error
      );
    }

    const token =
      normalizeText(
        data?.session
          ?.access_token
      );

    if (!token) {
      throw createWriterError(
        "You must be signed in before writing to GitHub."
      );
    }

    return token;
  }

  function ensureWriteRole() {
    const auth =
      getAuth();

    if (
      !auth ||
      typeof auth
        .canWriteAdminData !==
        "function"
    ) {
      throw createWriterError(
        "Admin permissions could not be verified."
      );
    }

    if (
      auth.canWriteAdminData() !==
      true
    ) {
      throw createWriterError(
        "Only the Owner or an Admin may write official data."
      );
    }
  }

  async function callEdgeFunction(
    action,
    payload = {}
  ) {
    ensureWriteRole();

    const accessToken =
      await getAccessToken();

    const response =
      await fetch(
        EDGE_FUNCTION_URL,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${accessToken}`
          },

          body:
            JSON.stringify({
              action:
                normalizeText(action),

              ...payload
            })
        }
      );

    let result =
      null;

    try {
      result =
        await response.json();
    } catch (_error) {
      result =
        null;
    }

    if (!response.ok) {
      throw createWriterError(
        result?.message ||
        result?.error ||
        `GitHub writer returned HTTP ${response.status}.`,
        result
      );
    }

    if (
      result?.success !==
        true
    ) {
      throw createWriterError(
        result?.message ||
        "The GitHub operation was not completed.",
        result
      );
    }

    return result;
  }

  function normalizeRepository(
    repository
  ) {
    const source =
      repository &&
      typeof repository ===
        "object"
        ? repository
        : DEFAULT_REPOSITORY;

    const owner =
      normalizeText(
        source.owner ||
        DEFAULT_REPOSITORY.owner
      );

    const repositoryName =
      normalizeText(
        source.repository ||
        source.repo ||
        DEFAULT_REPOSITORY.repository
      );

    const branch =
      normalizeText(
        source.branch ||
        DEFAULT_REPOSITORY.branch
      );

    if (
      !owner ||
      !repositoryName ||
      !branch
    ) {
      throw createWriterError(
        "The GitHub repository configuration is incomplete."
      );
    }

    return {
      owner,
      repository:
        repositoryName,
      branch
    };
  }

  /* =====================================================
     WRITE ACCESS
  ===================================================== */

  async function checkWriteAccess() {
    try {
      const result =
        await callEdgeFunction(
          "check-write-access",
          {
            repository:
              normalizeRepository(
                DEFAULT_REPOSITORY
              )
          }
        );

      return {
        success:
          true,

        repository:
          result.repository ||
          DEFAULT_REPOSITORY,

        permission:
          result.permission ||
          "write",

        message:
          result.message ||
          "GitHub write access is available."
      };
    } catch (error) {
      console.error(
        `[${MODULE_NAME}] Write access check failed.`,
        error
      );

      return {
        success:
          false,

        message:
          error?.message ||
          "GitHub write access is unavailable."
      };
    }
  }

  /* =====================================================
     JSON WRITE
  ===================================================== */

  async function writeJson(
    path,
    data,
    options = {}
  ) {
    const cleanPath =
      normalizePath(path);

    if (!cleanPath) {
      throw createWriterError(
        "A destination path is required."
      );
    }

    if (
      !cleanPath
        .toLowerCase()
        .endsWith(".json")
    ) {
      throw createWriterError(
        "The destination must be a JSON file."
      );
    }

    if (
      data === undefined
    ) {
      throw createWriterError(
        "No JSON data was provided."
      );
    }

    const repository =
      normalizeRepository(
        options.repository
      );

    const message =
      normalizeText(
        options.message
      ) ||
      `Update ${cleanPath}`;

    const result =
      await callEdgeFunction(
        "write-json",
        {
          repository,

          path:
            cleanPath,

          data,

          message
        }
      );

    return {
      success:
        true,

      path:
        result.path ||
        cleanPath,

      sha:
        result.sha ||
        "",

      commitSha:
        result.commitSha ||
        result.commit_sha ||
        "",

      created:
        result.created ===
        true,

      updated:
        result.updated ===
        true,

      message:
        result.message ||
        "JSON file saved successfully."
    };
  }

  /* =====================================================
     JSON READ THROUGH EDGE FUNCTION
  ===================================================== */

  async function readJson(
    path,
    options = {}
  ) {
    const cleanPath =
      normalizePath(path);

    if (!cleanPath) {
      throw createWriterError(
        "A source path is required."
      );
    }

    const repository =
      normalizeRepository(
        options.repository
      );

    const result =
      await callEdgeFunction(
        "read-json",
        {
          repository,

          path:
            cleanPath
        }
      );

    return {
      success:
        true,

      path:
        result.path ||
        cleanPath,

      sha:
        result.sha ||
        "",

      data:
        result.data
    };
  }

  /* =====================================================
     DELETE FILE
  ===================================================== */

  async function deleteFile(
    path,
    options = {}
  ) {
    const cleanPath =
      normalizePath(path);

    if (!cleanPath) {
      throw createWriterError(
        "A destination path is required."
      );
    }

    const repository =
      normalizeRepository(
        options.repository
      );

    const message =
      normalizeText(
        options.message
      ) ||
      `Delete ${cleanPath}`;

    const result =
      await callEdgeFunction(
        "delete-file",
        {
          repository,

          path:
            cleanPath,

          message
        }
      );

    return {
      success:
        true,

      path:
        result.path ||
        cleanPath,

      commitSha:
        result.commitSha ||
        result.commit_sha ||
        "",

      message:
        result.message ||
        "File deleted successfully."
    };
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

      edgeFunction:
        EDGE_FUNCTION_NAME,

      defaultRepository:
        DEFAULT_REPOSITORY,

      checkWriteAccess,
      writeJson,
      readJson,
      deleteFile
    });

  global.K630GitHubWriter =
    publicApi;

  console.info(
    `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
  );
})(window);