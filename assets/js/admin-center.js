/* =========================================================
   K630-REF ADMIN CENTER CORE
   File: assets/js/admin-center.js
   Version: 630.3.0

   Responsibilities:
   - Initialize the new Admin Center
   - Connect the complete seven-step workflow
   - Apply Owner/Admin/Officer permissions
   - Check public repository read access
   - Validate selected JSON files
   - Control workflow badges and buttons
   - Prepare GitHub write operations through an external writer
   - Keep Kingdom data out of localStorage

   Required globals:
   - window.K630Auth

   Optional write adapter:
   - window.K630GitHubWriter

   The writer must expose:
   - checkWriteAccess()
   - writeJson(path, data, options)
========================================================= */

(function initializeK630AdminCenter(global) {
  "use strict";

  /* =====================================================
     MODULE CONFIGURATION
  ===================================================== */

  const MODULE_NAME =
    "K630 Admin Center";

  const MODULE_VERSION =
    "630.3.0";

  const HOME_KINGDOM =
    630;

  const REPOSITORIES =
    Object.freeze({
      application: {
        owner:
          "Ragnarok630",

        repository:
          "ref-command-center",

        branch:
          "main"
      },

      data: {
        owner:
          "Ragnarok630",

        repository:
          "k630-public-data",

        branch:
          "main"
      }
    });

  const DATA_ROOT =
    (
      "https://raw.githubusercontent.com/" +
      `${REPOSITORIES.data.owner}/` +
      `${REPOSITORIES.data.repository}/` +
      `${REPOSITORIES.data.branch}/assets/data`
    );

  const FOUNDATION_PATH =
    "foundation/630-foundation.json";

  const ADMIN_CONFIG_RELATIVE_PATH =
    "config/admin-config.json";

  const ADMIN_CONFIG_WRITE_PATH =
    "assets/data/config/admin-config.json";

  const MAX_PARTICIPATING_SERVERS =
    20;

  const ALLOWED_ROLES =
    Object.freeze([
      "owner",
      "admin",
      "officer"
    ]);

  const WRITE_ROLES =
    Object.freeze([
      "owner",
      "admin"
    ]);

  const OWNER_ONLY_IDS =
    Object.freeze([
      "foundationOfficialDate",
      "foundationFileInput",
      "validateFoundationBtn",
      "saveFoundationBtn",
      "addAdminUserBtn",
      "newAdminEmail",
      "newAdminPassword",
      "newAdminRole"
    ]);

  const WRITE_ELEMENT_IDS =
  Object.freeze([
    "testGithubWriteBtn",

    "matchmakingSeasonNumber",
    "matchmakingOfficialDate",
    "matchmakingFileInput",
    "validateMatchmakingBtn",
    "uploadMatchmakingBtn",

    "seasonYear",
    "seasonNumber",
    "sosNumber",
    "sosName",
    "addSeasonToLibraryBtn",

    "t5Rank3Merits",
    "t5Rank2Merits",
    "t5Rank1Merits",

    "t4Rank3Merits",
    "t4Rank2Merits",
    "t4Rank1Merits",

    "saveMeritConfigurationBtn",

    "addParticipatingServerBtn",
    "saveParticipatingServersBtn",

    "activateSeasonBtn",
    "deactivateSeasonBtn",

    "uploadSeasonNumber",
    "uploadTypeSelect",
    "uploadOfficialDate",
    "seasonDataFileInput",
    "validateSeasonUploadBtn",
    "uploadSeasonDataBtn",

    "rebuildHomeBtn",
    "rebuildActiveAverageBtn",
    "rebuildSeasonInfoBtn",
    "rebuildServerVsServerBtn",
    "rebuildAllWebsiteDataBtn",

    "archiveSeasonNumber",
    "archiveOfficialDate",
    "validateSeasonArchiveBtn",
    "saveSeasonArchiveBtn",

    "manualStatusPlayerId",
    "manualStatusReason",
    "searchManualStatusPlayerBtn",
    "increaseManualStatusBtn",
    "decreaseManualStatusBtn",

    "playerNotePlayerId",
    "playerNoteType",
    "playerNoteReason",
    "searchPlayerNoteBtn",
    "addPlayerNoteBtn",
    "removePlayerNoteBtn",

    "addBlacklistBtn",
    "blacklistPlayerId",
    "blacklistPlayerName",
    "blacklistReason"
  ]);

  /* =====================================================
     PRIVATE STATE
  ===================================================== */

  let initialized =
    false;

  let activeRoot =
    null;

  let selectedFoundationFile =
    null;

  let validatedFoundationData =
    null;

  let selectedMatchmakingFile =
    null;

  let validatedMatchmakingData =
    null;

  let selectedSeasonFiles =
    [];

  let validatedSeasonFiles =
    [];

  let participatingServers =
    [];

  let selectedSeason =
    null;

  let adminConfig =
    null;

  const workflowState = {
    githubRead:
      false,

    githubWrite:
      false,

    foundation:
      false,

    matchmaking:
      false,

    seasonConfigured:
      false,

    seasonActive:
      false,

    weekData:
      false,

    websiteBuilt:
      false,

    archiveReady:
      false
  };

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

  function numberValue(value) {
    const parsed =
      Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function nowIso() {
    return new Date()
      .toISOString();
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function getAuth() {
    return global.K630Auth || null;
  }

  function getSession() {
    try {
      return getAuth()
        ?.getSession?.() ||
        null;
    } catch (error) {
      return null;
    }
  }

  function getRole() {
    try {
      return normalizeLower(
        getAuth()
          ?.getCurrentRole?.() ||
        getSession()?.role ||
        "guest"
      );
    } catch (error) {
      return "guest";
    }
  }

  function isOwner() {
    return getRole() ===
      "owner";
  }

  function canWrite() {
    return WRITE_ROLES.includes(
      getRole()
    );
  }

  function canView() {
    return ALLOWED_ROLES.includes(
      getRole()
    );
  }

  function getWriter() {
    const writer =
      global.K630GitHubWriter;

    if (
      writer &&
      typeof writer ===
        "object"
    ) {
      return writer;
    }

    return null;
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

  function formatDateTime(value) {
    const date =
      value
        ? new Date(value)
        : new Date();

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return new Intl.DateTimeFormat(
      "nl-NL",
      {
        dateStyle:
          "short",

        timeStyle:
          "short"
      }
    ).format(date);
  }

  function dispatchEvent(
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

            ...detail
          }
        }
      )
    );
  }

/* =====================================================
   ADMIN CONFIG
===================================================== */

function getAdminConfigEngine() {
  return global.K630AdminConfigEngine || null;
}

function createDefaultAdminConfig() {
  const engine =
    getAdminConfigEngine();

  if (
    !engine ||
    typeof engine.createDefaultConfig !==
      "function"
  ) {
    throw new Error(
      "K630AdminConfigEngine is not loaded."
    );
  }

  return engine.createDefaultConfig({
    updatedAt:
      nowIso(),

    updatedBy:
      getSession()?.email ||
      getRole()
  });
}

async function loadAdminConfig() {
  const engine =
    getAdminConfigEngine();

  const writer =
    getWriter();

  if (
    !engine ||
    typeof engine.normalize !==
      "function"
  ) {
    throw new Error(
      "K630AdminConfigEngine is not loaded."
    );
  }

  try {
    if (
      writer &&
      typeof writer.readJson ===
        "function"
    ) {
      const result =
        await writer.readJson(
          ADMIN_CONFIG_WRITE_PATH,
          {
            repository:
              REPOSITORIES.data
          }
        );

      if (
        result?.data &&
        typeof result.data ===
          "object"
      ) {
        adminConfig =
          engine.normalize(
            result.data
          );

        return true;
      }
    }

    const response =
      await fetch(
        (
          `${DATA_ROOT}/${ADMIN_CONFIG_RELATIVE_PATH}` +
          `?cacheBust=${Date.now()}`
        ),
        {
          method:
            "GET",

          cache:
            "no-store",

          headers: {
            Accept:
              "application/json",

            "Cache-Control":
              "no-cache"
          }
        }
      );

    if (response.status === 404) {
      adminConfig =
        createDefaultAdminConfig();

      return false;
    }

    if (!response.ok) {
      throw new Error(
        `admin-config.json returned HTTP ${response.status}.`
      );
    }

    const data =
      await response.json();

    adminConfig =
      engine.normalize(
        data
      );

    return true;
  } catch (error) {
    console.error(
      `[${MODULE_NAME}] Failed to load admin-config.json.`,
      error
    );

    adminConfig =
      createDefaultAdminConfig();

    return false;
  }
}

function applyAdminConfigToState() {
  if (!adminConfig) {
    return;
  }

  workflowState.githubRead =
    Boolean(
      adminConfig.github
        ?.repositoryRead
    );

  workflowState.githubWrite =
    Boolean(
      adminConfig.github
        ?.repositoryWrite
    );

  workflowState.foundation =
    Boolean(
      adminConfig.foundation
        ?.ready
    );

  workflowState.matchmaking =
    Boolean(
      adminConfig.matchmaking
        ?.ready
    );

  workflowState.seasonActive =
    Boolean(
      adminConfig.season
        ?.active
    );

  workflowState.weekData =
    Boolean(
      adminConfig.weeks
        ?.ready
    );

  workflowState.websiteBuilt =
    Boolean(
      adminConfig.websiteBuild
        ?.ready
    );

  workflowState.archiveReady =
    Boolean(
      adminConfig.archive
        ?.ready
    );

  selectedSeason =
    adminConfig.season
      ?.selectedSeason
      ? {
          year:
            numberValue(
              adminConfig.season
                .selectedSeason.year
            ),

          season:
            numberValue(
              adminConfig.season
                .selectedSeason.season
            ),

          sosNumber:
            numberValue(
              adminConfig.season
                .selectedSeason.sosNumber
            ),

          sosName:
            normalizeText(
              adminConfig.season
                .selectedSeason.sosName
            )
        }
      : null;

  participatingServers =
    Array.isArray(
      adminConfig.season
        ?.participatingServers
    )
      ? [
          ...adminConfig.season
            .participatingServers
        ]
          .map(numberValue)
          .filter(
            server =>
              server > 0
          )
          .sort(
            (
              first,
              second
            ) =>
              first -
              second
          )
      : [];

  workflowState.seasonConfigured =
    Boolean(
      selectedSeason &&
      workflowState.matchmaking &&
      participatingServers.length > 0
    );

  const matchmakingSeasonInput =
    getElement(
      "matchmakingSeasonNumber"
    );

  const matchmakingDateInput =
    getElement(
      "matchmakingOfficialDate"
    );

  if (
    matchmakingSeasonInput &&
    adminConfig.matchmaking
      ?.seasonNumber > 0
  ) {
    matchmakingSeasonInput.value =
      String(
        adminConfig.matchmaking
          .seasonNumber
      );
  }

  if (
    matchmakingDateInput &&
    adminConfig.matchmaking
      ?.officialDate
  ) {
    matchmakingDateInput.value =
      adminConfig.matchmaking
        .officialDate;
  }

  if (selectedSeason) {
    const seasonYearInput =
      getElement(
        "seasonYear"
      );

    const seasonNumberInput =
      getElement(
        "seasonNumber"
      );

    const sosNumberInput =
      getElement(
        "sosNumber"
      );

    const sosNameInput =
      getElement(
        "sosName"
      );

    const uploadSeasonInput =
      getElement(
        "uploadSeasonNumber"
      );

    const archiveSeasonInput =
      getElement(
        "archiveSeasonNumber"
      );

    if (seasonYearInput) {
      seasonYearInput.value =
        String(
          selectedSeason.year
        );
    }

    if (seasonNumberInput) {
      seasonNumberInput.value =
        String(
          selectedSeason.season
        );
    }

    if (sosNumberInput) {
      sosNumberInput.value =
        String(
          selectedSeason.sosNumber
        );
    }

    if (sosNameInput) {
      sosNameInput.value =
        selectedSeason.sosName;
    }

    if (uploadSeasonInput) {
      uploadSeasonInput.value =
        String(
          selectedSeason.season
        );
    }

    if (archiveSeasonInput) {
      archiveSeasonInput.value =
        String(
          selectedSeason.season
        );
    }
  }

  const meritConfiguration =
    adminConfig
      ?.meritConfiguration
      ?.w6 ||
    null;

  const meritValues = {
    t5Rank3Merits:
      meritConfiguration
        ?.t5
        ?.rank3,

    t5Rank2Merits:
      meritConfiguration
        ?.t5
        ?.rank2,

    t5Rank1Merits:
      meritConfiguration
        ?.t5
        ?.rank1,

    t4Rank3Merits:
      meritConfiguration
        ?.t4
        ?.rank3,

    t4Rank2Merits:
      meritConfiguration
        ?.t4
        ?.rank2,

    t4Rank1Merits:
      meritConfiguration
        ?.t4
        ?.rank1
  };

  Object.entries(
    meritValues
  ).forEach(
    (
      [
        id,
        value
      ]
    ) => {
      const input =
        getElement(id);

      if (
        input &&
        Number.isFinite(
          Number(value)
        )
      ) {
        input.value =
          String(value);
      }
    }
  );

  setBadge(
    "foundationStatusBadge",
    workflowState.foundation
      ? "ready"
      : "waiting",
    workflowState.foundation
      ? "Ready"
      : "Waiting"
  );

  setBadge(
    "matchmakingStatusBadge",
    workflowState.matchmaking
      ? "ready"
      : "waiting",
    workflowState.matchmaking
      ? "Ready"
      : "Waiting"
  );

  setBadge(
    "seasonActivationBadge",
    workflowState.seasonActive
      ? "ready"
      : "locked",
    workflowState.seasonActive
      ? "W0 Unlocked"
      : "W0 Locked"
  );

  if (
    workflowState.matchmaking
  ) {
    setValidation(
      "matchmakingValidationBox",
      "success",
      (
        `Matchmaking Season ` +
        `${adminConfig.matchmaking.seasonNumber} is ready.`
      ),
      "fa-circle-check"
    );
  }

  if (
    workflowState.seasonActive &&
    selectedSeason
  ) {
    setValidation(
      "seasonActivationValidationBox",
      "success",
      (
        `Season ${selectedSeason.season} is active. ` +
        `Week 0 is unlocked.`
      ),
      "fa-circle-check"
    );
  } else if (
    workflowState.seasonConfigured
  ) {
    setValidation(
      "seasonActivationValidationBox",
      "success",
      (
        `Season ${selectedSeason?.season || ""} is configured. ` +
        `${participatingServers.length} participating servers are saved.`
      ),
      "fa-circle-check"
    );
  } else {
    setValidation(
      "seasonActivationValidationBox",
      "warning",
      "Complete Matchmaking and all Season Configuration sections before activating the Season.",
      "fa-triangle-exclamation"
    );
  }
}

  /* =====================================================
     STATUS HELPERS
  ===================================================== */

  function setBadge(
    id,
    status,
    label
  ) {
    const element =
      getElement(id);

    if (!element) {
      return;
    }

    element.dataset.status =
      normalizeLower(status);

    element.textContent =
      normalizeText(label);
  }

  function setText(
    id,
    value
  ) {
    const element =
      getElement(id);

    if (element) {
      element.textContent =
        normalizeText(value);
    }
  }

  function setButtonEnabled(
    id,
    enabled
  ) {
    const element =
      getElement(id);

    if (
      element instanceof
      HTMLButtonElement
    ) {
      element.disabled =
        !enabled;
    }
  }

  function setValidation(
    boxId,
    type,
    message,
    icon =
      "fa-circle-info"
  ) {
    const box =
      getElement(boxId);

    if (!box) {
      return;
    }

    box.innerHTML = `
      <div class="validation-state ${escapeHtml(type)}">
        <i class="fa-solid ${escapeHtml(icon)}"></i>

        <span>
          ${escapeHtml(message)}
        </span>
      </div>
    `;
  }

  function appendLog(
    action,
    status,
    message
  ) {
    const log =
      getElement(
        "adminActivityLog"
      );

    if (!log) {
      return;
    }

    const emptyState =
      log.querySelector(
        ".admin-empty-state, .admin-log-empty"
      );

    emptyState?.remove();

    const session =
      getSession();

    const item =
      document.createElement(
        "article"
      );

    item.className =
      `admin-log-item is-${normalizeLower(status)}`;

    item.innerHTML = `
      <div class="admin-log-item-header">
        <strong>
          ${escapeHtml(action)}
        </strong>

        <span>
          ${escapeHtml(formatDateTime())}
        </span>
      </div>

      <p>
        ${escapeHtml(message)}
      </p>

      <small>
        ${escapeHtml(
          session?.email ||
          getRole()
        )}
      </small>
    `;

    log.prepend(item);

    if (
      status ===
      "success"
    ) {
      setText(
        "adminLogLastSuccess",
        formatDateTime()
      );
    }

    if (
      status ===
      "error"
    ) {
      setText(
        "adminLogLastError",
        formatDateTime()
      );
    }
  }

  /* =====================================================
     FILE HELPERS
  ===================================================== */

  async function readJsonFile(file) {
    if (!(file instanceof File)) {
      throw new Error(
        "No valid file was selected."
      );
    }

    const text =
      await file.text();

    if (!normalizeText(text)) {
      throw new Error(
        `${file.name} is empty.`
      );
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(
        `${file.name} is not valid JSON.`
      );
    }
  }

  function countRecords(value) {
    if (Array.isArray(value)) {
      return value.length;
    }

    if (
      Array.isArray(
        value?.players
      )
    ) {
      return value.players.length;
    }

    if (
      Array.isArray(
        value?.data
      )
    ) {
      return value.data.length;
    }

    if (
      value?.players &&
      typeof value.players ===
        "object"
    ) {
      return Object.keys(
        value.players
      ).length;
    }

    if (
      value &&
      typeof value ===
        "object"
    ) {
      return Object.keys(value)
        .length;
    }

    return 0;
  }

  function renderSelectedFile(
    containerId,
    file
  ) {
    const container =
      getElement(containerId);

    if (!container) {
      return;
    }

    if (!file) {
      container.innerHTML = `
        <div class="admin-selected-files-empty">
          No file selected.
        </div>
      `;

      return;
    }

    container.innerHTML = `
      <div class="admin-selected-file">
        <i class="fa-solid fa-file-code"></i>

        <div>
          <strong>
            ${escapeHtml(file.name)}
          </strong>

          <span>
            ${escapeHtml(
              `${Math.ceil(file.size / 1024)} KB`
            )}
          </span>
        </div>
      </div>
    `;
  }

  function renderSelectedFiles(
    containerId,
    files
  ) {
    const container =
      getElement(containerId);

    if (!container) {
      return;
    }

    if (
      !Array.isArray(files) ||
      files.length ===
        0
    ) {
      container.innerHTML = `
        <div class="admin-selected-files-empty">
          No source files selected.
        </div>
      `;

      return;
    }

    container.innerHTML =
      files.map(file => `
        <div class="admin-selected-file">
          <i class="fa-solid fa-file-code"></i>

          <div>
            <strong>
              ${escapeHtml(file.name)}
            </strong>

            <span>
              ${escapeHtml(
                `${Math.ceil(file.size / 1024)} KB`
              )}
            </span>
          </div>
        </div>
      `).join("");
  }

  /* =====================================================
     PERMISSIONS
  ===================================================== */

  function applyPermissions() {
    const role =
      getRole();

    if (!canView()) {
      activeRoot?.remove();

      return;
    }

    WRITE_ELEMENT_IDS.forEach(id => {
      const element =
        getElement(id);

      if (!element) {
        return;
      }

      if (
        element instanceof
          HTMLInputElement ||
        element instanceof
          HTMLSelectElement ||
        element instanceof
          HTMLTextAreaElement ||
        element instanceof
          HTMLButtonElement
      ) {
        element.disabled =
          !canWrite();
      }
    });

    OWNER_ONLY_IDS.forEach(id => {
      const element =
        getElement(id);

      if (!element) {
        return;
      }

      if (
        element instanceof
          HTMLInputElement ||
        element instanceof
          HTMLSelectElement ||
        element instanceof
          HTMLTextAreaElement ||
        element instanceof
          HTMLButtonElement
      ) {
        element.disabled =
          !isOwner();
      }
    });

    if (
      role ===
      "officer"
    ) {
      setBadge(
        "adminCenterSystemStatus",
        "read-only",
        "Read Only"
      );
    }
  }

  /* =====================================================
     PUBLIC REPOSITORY CHECK
  ===================================================== */

  async function checkUrl(url) {
    const response =
      await fetch(
        `${url}?t=${Date.now()}`,
        {
          cache:
            "no-store"
        }
      );

    return response.ok;
  }

  async function checkGitHubConnection() {
    setBadge(
      "githubConnectionStatus",
      "checking",
      "Checking"
    );

    setText(
      "appRepositoryReadStatus",
      "Checking"
    );

    setText(
      "dataRepositoryReadStatus",
      "Checking"
    );

    try {
      const applicationUrl =
        (
          "https://raw.githubusercontent.com/" +
          `${REPOSITORIES.application.owner}/` +
          `${REPOSITORIES.application.repository}/` +
          `${REPOSITORIES.application.branch}/index.html`
        );

      const dataUrl =
        `${DATA_ROOT}/${FOUNDATION_PATH}`;

      const [
        applicationRead,
        dataRead
      ] =
        await Promise.all([
          checkUrl(applicationUrl),
          checkUrl(dataUrl)
        ]);

      workflowState.githubRead =
        applicationRead &&
        dataRead;

      setText(
        "appRepositoryReadStatus",
        applicationRead
          ? "Connected"
          : "Unavailable"
      );

      setText(
        "dataRepositoryReadStatus",
        dataRead
          ? "Connected"
          : "Unavailable"
      );

      setText(
        "appRepositoryLastSync",
        applicationRead
          ? formatDateTime()
          : "-"
      );

      setText(
        "dataRepositoryLastSync",
        dataRead
          ? formatDateTime()
          : "-"
      );

      setText(
        "adminLogGithubReadStatus",
        workflowState.githubRead
          ? "Connected"
          : "Failed"
      );

      if (
        workflowState.githubRead
      ) {
        setBadge(
          "githubConnectionStatus",
          "ready",
          "Connected"
        );

        setValidation(
          "githubConnectionValidationBox",
          "success",
          "Both repositories are publicly readable.",
          "fa-circle-check"
        );

        appendLog(
          "GitHub connection",
          "success",
          "Both repositories passed the public read check."
        );
      } else {
        throw new Error(
          "One or both repositories could not be read."
        );
      }
    } catch (error) {
      workflowState.githubRead =
        false;

      setBadge(
        "githubConnectionStatus",
        "error",
        "Failed"
      );

      setValidation(
        "githubConnectionValidationBox",
        "error",
        error?.message ||
        "Repository read access failed.",
        "fa-circle-xmark"
      );

      appendLog(
        "GitHub connection",
        "error",
        error?.message ||
        "Repository read access failed."
      );
    }

    updateWorkflow();
  }

  async function testGitHubWrite() {
    const writer =
      getWriter();

    if (
      !writer ||
      typeof writer
        .checkWriteAccess !==
        "function"
    ) {
      workflowState.githubWrite =
        false;

      setText(
        "appRepositoryWriteStatus",
        "Not configured"
      );

      setText(
        "dataRepositoryWriteStatus",
        "Not configured"
      );

      setText(
        "adminLogGithubWriteStatus",
        "Not configured"
      );

      setValidation(
        "githubConnectionValidationBox",
        "warning",
        "GitHub write access is not configured. Add the secure K630GitHubWriter service before uploads can be enabled.",
        "fa-triangle-exclamation"
      );

      appendLog(
        "GitHub write access",
        "error",
        "No secure GitHub writer is loaded."
      );

      updateWorkflow();

      return;
    }

    try {
      const result =
        await writer
          .checkWriteAccess();

      workflowState.githubWrite =
        result === true ||
        result?.success ===
          true;

      if (
        !workflowState
          .githubWrite
      ) {
        throw new Error(
          result?.message ||
          "Write access was rejected."
        );
      }

      setText(
        "appRepositoryWriteStatus",
        "Connected"
      );

      setText(
        "dataRepositoryWriteStatus",
        "Connected"
      );

      setText(
        "adminLogGithubWriteStatus",
        "Connected"
      );

      setValidation(
        "githubConnectionValidationBox",
        "success",
        "GitHub read and write access are available.",
        "fa-circle-check"
      );

      appendLog(
        "GitHub write access",
        "success",
        "Secure write access is available."
      );
    } catch (error) {
      workflowState.githubWrite =
        false;

      setText(
        "appRepositoryWriteStatus",
        "Failed"
      );

      setText(
        "dataRepositoryWriteStatus",
        "Failed"
      );

      setText(
        "adminLogGithubWriteStatus",
        "Failed"
      );

      setValidation(
        "githubConnectionValidationBox",
        "error",
        error?.message ||
        "GitHub write access failed.",
        "fa-circle-xmark"
      );

      appendLog(
        "GitHub write access",
        "error",
        error?.message ||
        "GitHub write access failed."
      );
    }

    updateWorkflow();
  }

  /* =====================================================
     FOUNDATION
  ===================================================== */

  async function recheckFoundation() {
    setBadge(
      "foundationStatusBadge",
      "checking",
      "Checking"
    );

    try {
      const response =
        await fetch(
          `${DATA_ROOT}/${FOUNDATION_PATH}?t=${Date.now()}`,
          {
            cache:
              "no-store"
          }
        );

      if (!response.ok) {
        throw new Error(
          `Foundation returned HTTP ${response.status}.`
        );
      }

      const data =
        await response.json();

      const count =
        countRecords(data);

      workflowState.foundation =
        count >
        0;

      setText(
        "foundationFilename",
        `assets/data/${FOUNDATION_PATH}`
      );

      setText(
        "foundationPlayerCount",
        String(count)
      );

      setText(
        "foundationValidationStatus",
        workflowState.foundation
          ? "Valid"
          : "Empty"
      );

      setBadge(
        "foundationStatusBadge",
        workflowState.foundation
          ? "ready"
          : "error",
        workflowState.foundation
          ? "Ready"
          : "Invalid"
      );

      setValidation(
        "foundationValidationBox",
        workflowState.foundation
          ? "success"
          : "error",
        workflowState.foundation
          ? `Current Foundation contains ${count} records.`
          : "The current Foundation contains no records.",
        workflowState.foundation
          ? "fa-circle-check"
          : "fa-circle-xmark"
      );

      appendLog(
        "Foundation check",
        workflowState.foundation
          ? "success"
          : "error",
        workflowState.foundation
          ? `Foundation loaded with ${count} records.`
          : "Foundation is empty."
      );
    } catch (error) {
      workflowState.foundation =
        false;

      setText(
        "foundationValidationStatus",
        "Failed"
      );

      setBadge(
        "foundationStatusBadge",
        "error",
        "Failed"
      );

      setValidation(
        "foundationValidationBox",
        "error",
        error?.message ||
        "The Foundation could not be loaded.",
        "fa-circle-xmark"
      );

      appendLog(
        "Foundation check",
        "error",
        error?.message ||
        "The Foundation could not be loaded."
      );
    }

    updateWorkflow();
  }

  async function validateFoundation() {
  if (!selectedFoundationFile) {
    setValidation(
      "foundationValidationBox",
      "warning",
      "Select a Foundation JSON file first.",
      "fa-triangle-exclamation"
    );

    return;
  }

  const engine =
    global.K630FoundationEngine;

  if (
    !engine ||
    typeof engine.validate !==
      "function"
  ) {
    validatedFoundationData =
      null;

    setButtonEnabled(
      "saveFoundationBtn",
      false
    );

    setValidation(
      "foundationValidationBox",
      "error",
      "K630FoundationEngine is not loaded. Load foundation-engine.js before admin-center.js.",
      "fa-circle-xmark"
    );

    return;
  }

  try {
    const data =
      await readJsonFile(
        selectedFoundationFile
      );

    const validationResult =
      engine.validate(data);

    validatedFoundationData =
      data;

    setText(
      "foundationValidationStatus",
      "Validated"
    );

    setText(
      "foundationPlayerCount",
      String(
        validationResult.eligibleCount
      )
    );

    setButtonEnabled(
      "saveFoundationBtn",
      isOwner() &&
      workflowState.githubWrite
    );

    setValidation(
      "foundationValidationBox",
      "success",
      (
        `Foundation validated: ` +
        `${validationResult.eligibleCount} eligible players, ` +
        `${validationResult.excludedLowPowerCount} excluded below 250,000 Top Power` +
        (
          validationResult.invalidRecordCount >
          0
            ? `, ${validationResult.invalidRecordCount} invalid records ignored.`
            : "."
        )
      ),
      "fa-circle-check"
    );

    appendLog(
      "Foundation validation",
      "success",
      (
        `${validationResult.eligibleCount} eligible players. ` +
        `${validationResult.excludedLowPowerCount} low-power records excluded.`
      )
    );
  } catch (error) {
    validatedFoundationData =
      null;

    setText(
      "foundationValidationStatus",
      "Failed"
    );

    setButtonEnabled(
      "saveFoundationBtn",
      false
    );

    setValidation(
      "foundationValidationBox",
      "error",
      error?.message ||
      "Foundation validation failed.",
      "fa-circle-xmark"
    );

    appendLog(
      "Foundation validation",
      "error",
      error?.message ||
      "Foundation validation failed."
    );
  }
}

  async function saveFoundation() {
  const writer =
    getWriter();

  const engine =
    global.K630FoundationEngine;

  if (!isOwner()) {
    setValidation(
      "foundationValidationBox",
      "error",
      "Only the Owner can save the permanent Foundation.",
      "fa-circle-xmark"
    );

    return;
  }

  if (
    !writer ||
    typeof writer.writeJson !==
      "function"
  ) {
    setValidation(
      "foundationValidationBox",
      "error",
      "GitHub writer is not available.",
      "fa-circle-xmark"
    );

    return;
  }

  if (
    !engine ||
    typeof engine.build !==
      "function"
  ) {
    setValidation(
      "foundationValidationBox",
      "error",
      "K630FoundationEngine is not loaded. Load foundation-engine.js before admin-center.js.",
      "fa-circle-xmark"
    );

    return;
  }

  if (!validatedFoundationData) {
    setValidation(
      "foundationValidationBox",
      "warning",
      "Validate the Foundation before saving.",
      "fa-triangle-exclamation"
    );

    return;
  }

  setButtonEnabled(
    "saveFoundationBtn",
    false
  );

  setBadge(
    "foundationStatusBadge",
    "checking",
    "Building"
  );

  setValidation(
    "foundationValidationBox",
    "warning",
    "Foundation Engine is generating and saving all official datasets.",
    "fa-gears"
  );

  try {
    const session =
      getSession();

    const result =
  engine.build(
    validatedFoundationData,
    {
      foundationDate:
        "2026-03-27",

      sourceFilename:
        selectedFoundationFile?.name ||
        "630-foundation.json",

      uploadedBy:
        session?.email ||
        getRole(),

      adminConfig:
        adminConfig
    }
  );

    const fileEntries =
  Object.entries(
    result.files
  );

if (
  result.files[
    ADMIN_CONFIG_WRITE_PATH
  ]
) {
  adminConfig =
    result.files[
      ADMIN_CONFIG_WRITE_PATH
    ];
}

if (
  fileEntries.length ===
  0
) {
  throw new Error(
    "Foundation Engine generated no files."
  );
}

    let savedCount =
      0;

    for (
      const [
        path,
        data
      ] of fileEntries
    ) {
      setValidation(
        "foundationValidationBox",
        "warning",
        (
          `Saving Foundation file ` +
          `${savedCount + 1} of ${fileEntries.length}: ${path}`
        ),
        "fa-cloud-arrow-up"
      );

      await writer.writeJson(
        path,
        data,
        {
          repository:
            REPOSITORIES.data,

          message:
            (
              path ===
              "assets/data/foundation/630-foundation.json"
                ? "Update permanent Kingdom 630 Foundation"
                : `Generate Foundation dataset: ${path}`
            )
        }
      );

      savedCount +=
        1;
    }

    workflowState.foundation =
      true;

    setText(
      "foundationPlayerCount",
      String(
        result.summary.activePlayers
      )
    );

    setText(
      "foundationValidationStatus",
      "Generated"
    );

    setBadge(
      "foundationStatusBadge",
      "ready",
      "Ready"
    );

    setValidation(
      "foundationValidationBox",
      "success",
      (
        `Foundation Engine completed successfully. ` +
        `${savedCount} files saved, ` +
        `${result.summary.activePlayers} active players, ` +
        `${result.summary.excludedLowPower} excluded below 250,000 Top Power, ` +
        `${result.summary.warriors} Warriors and ` +
        `${result.summary.farmers} Farmers.`
      ),
      "fa-circle-check"
    );

    appendLog(
      "Foundation Engine",
      "success",
      (
        `${savedCount} files generated and saved. ` +
        `${result.summary.activePlayers} eligible players. ` +
        `Total Server Power: ${result.summary.totalServerPower}.`
      )
    );

    dispatchEvent(
      "k630:foundation-generated",
      {
        foundationDate:
          result.foundationDate,

        summary:
          result.summary,

        files:
          fileEntries.map(
            ([path]) =>
              path
          )
      }
    );

    updateWorkflow();
  } catch (error) {
    workflowState.foundation =
      false;

    setBadge(
      "foundationStatusBadge",
      "error",
      "Failed"
    );

    setValidation(
      "foundationValidationBox",
      "error",
      error?.message ||
      "The Foundation Engine failed.",
      "fa-circle-xmark"
    );

    appendLog(
      "Foundation Engine",
      "error",
      error?.message ||
      "The Foundation Engine failed."
    );
  } finally {
    setButtonEnabled(
      "saveFoundationBtn",
      Boolean(
        isOwner() &&
        workflowState.githubWrite &&
        validatedFoundationData
      )
    );
  }
}

   /* =====================================================
     MATCHMAKING
  ===================================================== */

  const ACTIVE_AVERAGE_PATH =
    "generated/active-average/current.json";

  const OLD_PLAYERS_PATH =
    "generated/old-players/current.json";

  const SEASON_INFO_OUTPUT_PATH =
    "assets/data/generated/season-info/current.json";

  function getMatchmakingPath() {
    const season =
      Math.trunc(
        numberValue(
          getElement(
            "matchmakingSeasonNumber"
          )?.value
        )
      );

    return season > 0
      ? (
          `matchmaking/season-${season}/` +
          "matchmaking.json"
        )
      : "";
  }

  function getMatchmakingManifestPath() {
    const season =
      Math.trunc(
        numberValue(
          getElement(
            "matchmakingSeasonNumber"
          )?.value
        )
      );

    return season > 0
      ? (
          `matchmaking/season-${season}/` +
          "manifest.json"
        )
      : "";
  }

  function updateMatchmakingDestination() {
    const path =
      getMatchmakingPath();

    setText(
      "matchmakingDestinationPreview",
      path
        ? `assets/data/${path}`
        : "Select a valid Season number."
    );
  }

  async function readMatchmakingDependency(
    relativePath,
    optional = false
  ) {
    const normalizedPath =
      normalizeText(relativePath)
        .replace(/^\/+/, "");

    if (!normalizedPath) {
      throw new Error(
        "A Matchmaking dependency path is required."
      );
    }

    const response =
      await fetch(
        (
          `${DATA_ROOT}/${normalizedPath}` +
          `?t=${Date.now()}`
        ),
        {
          method:
            "GET",

          cache:
            "no-store",

          headers: {
            Accept:
              "application/json"
          }
        }
      );

    if (
      optional &&
      response.status === 404
    ) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        (
          `${normalizedPath} could not be loaded. ` +
          `HTTP ${response.status}.`
        )
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new Error(
        `${normalizedPath} does not contain valid JSON.`
      );
    }
  }

  async function validateMatchmaking() {
  const engine =
    global.K630MatchmakingEngine;

  const fileInput =
    getElement(
      "matchmakingFileInput"
    );

  const matchmakingFile =
    fileInput?.files?.[0] ||
    selectedMatchmakingFile ||
    null;

  if (!matchmakingFile) {
    selectedMatchmakingFile =
      null;

    validatedMatchmakingData =
      null;

    setButtonEnabled(
      "uploadMatchmakingBtn",
      false
    );

    setBadge(
      "matchmakingStatusBadge",
      "waiting",
      "Waiting"
    );

    setValidation(
      "matchmakingValidationBox",
      "warning",
      "Select a Matchmaking JSON file first.",
      "fa-triangle-exclamation"
    );

    return;
  }

  selectedMatchmakingFile =
    matchmakingFile;

  if (
    !engine ||
    typeof engine.validate !==
      "function"
  ) {
    validatedMatchmakingData =
      null;

    setButtonEnabled(
      "uploadMatchmakingBtn",
      false
    );

    setBadge(
      "matchmakingStatusBadge",
      "error",
      "Failed"
    );

    setValidation(
      "matchmakingValidationBox",
      "error",
      "K630MatchmakingEngine is not loaded. Load matchmaking-engine.js before admin-center.js.",
      "fa-circle-xmark"
    );

    return;
  }

  const seasonNumber =
    Math.trunc(
      numberValue(
        getElement(
          "matchmakingSeasonNumber"
        )?.value
      )
    );

  const matchmakingDate =
    normalizeText(
      getElement(
        "matchmakingOfficialDate"
      )?.value
    );

  if (seasonNumber <= 0) {
    validatedMatchmakingData =
      null;

    setButtonEnabled(
      "uploadMatchmakingBtn",
      false
    );

    setValidation(
      "matchmakingValidationBox",
      "warning",
      "Enter a valid Season number.",
      "fa-triangle-exclamation"
    );

    return;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      matchmakingDate
    )
  ) {
    validatedMatchmakingData =
      null;

    setButtonEnabled(
      "uploadMatchmakingBtn",
      false
    );

    setValidation(
      "matchmakingValidationBox",
      "warning",
      "Enter a valid Matchmaking official date.",
      "fa-triangle-exclamation"
    );

    return;
  }

  setButtonEnabled(
    "validateMatchmakingBtn",
    false
  );

  setButtonEnabled(
    "uploadMatchmakingBtn",
    false
  );

  setBadge(
    "matchmakingStatusBadge",
    "checking",
    "Validating"
  );

  setValidation(
    "matchmakingValidationBox",
    "warning",
    `Validating ${matchmakingFile.name}...`,
    "fa-spinner"
  );

  try {
    const data =
      await readJsonFile(
        matchmakingFile
      );

    const validationResult =
      engine.validate(data);

    validatedMatchmakingData =
      data;

    setBadge(
      "matchmakingStatusBadge",
      "validated",
      "Validated"
    );

    setButtonEnabled(
      "uploadMatchmakingBtn",
      Boolean(
        canWrite() &&
        workflowState.githubWrite
      )
    );

    setValidation(
      "matchmakingValidationBox",
      "success",
      (
        `Matchmaking validated: ` +
        `${validationResult.eligibleCount} eligible players, ` +
        `${validationResult.excludedLowPowerCount} excluded below 250,000 Top Power` +
        (
          validationResult.invalidRecordCount > 0
            ? (
                `, ${validationResult.invalidRecordCount} ` +
                "invalid records ignored."
              )
            : "."
        )
      ),
      "fa-circle-check"
    );

    appendLog(
      "Matchmaking validation",
      "success",
      (
        `Season ${seasonNumber}: ` +
        `${validationResult.eligibleCount} eligible players, ` +
        `${validationResult.excludedLowPowerCount} excluded.`
      )
    );
  } catch (error) {
    validatedMatchmakingData =
      null;

    setButtonEnabled(
      "uploadMatchmakingBtn",
      false
    );

    setBadge(
      "matchmakingStatusBadge",
      "error",
      "Failed"
    );

    setValidation(
      "matchmakingValidationBox",
      "error",
      error?.message ||
      "Matchmaking validation failed.",
      "fa-circle-xmark"
    );

    appendLog(
      "Matchmaking validation",
      "error",
      error?.message ||
      "Matchmaking validation failed."
    );
  } finally {
    setButtonEnabled(
      "validateMatchmakingBtn",
      canWrite()
    );
  }
}

  async function uploadMatchmaking() {
    const writer =
      getWriter();

    const engine =
      global.K630MatchmakingEngine;

    const seasonNumber =
      Math.trunc(
        numberValue(
          getElement(
            "matchmakingSeasonNumber"
          )?.value
        )
      );

    const matchmakingDate =
      normalizeText(
        getElement(
          "matchmakingOfficialDate"
        )?.value
      );

    const matchmakingPath =
      getMatchmakingPath();

    const manifestPath =
      getMatchmakingManifestPath();

    if (!canWrite()) {
      setValidation(
        "matchmakingValidationBox",
        "error",
        "Only an active Owner or Admin may process Matchmaking.",
        "fa-circle-xmark"
      );

      return;
    }

    if (
      !writer ||
      typeof writer.writeJson !==
        "function"
    ) {
      setValidation(
        "matchmakingValidationBox",
        "error",
        "GitHub writer is not available.",
        "fa-circle-xmark"
      );

      return;
    }

    if (
      !engine ||
      typeof engine.build !==
        "function"
    ) {
      setValidation(
        "matchmakingValidationBox",
        "error",
        "K630MatchmakingEngine is not loaded. Load matchmaking-engine.js before admin-center.js.",
        "fa-circle-xmark"
      );

      return;
    }

    if (!validatedMatchmakingData) {
      setValidation(
        "matchmakingValidationBox",
        "warning",
        "Validate the Matchmaking file before processing it.",
        "fa-triangle-exclamation"
      );

      return;
    }

    if (
      seasonNumber <= 0 ||
      !matchmakingPath ||
      !manifestPath
    ) {
      setValidation(
        "matchmakingValidationBox",
        "warning",
        "Enter a valid Matchmaking Season number.",
        "fa-triangle-exclamation"
      );

      return;
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        matchmakingDate
      )
    ) {
      setValidation(
        "matchmakingValidationBox",
        "warning",
        "Enter a valid Matchmaking official date.",
        "fa-triangle-exclamation"
      );

      return;
    }

    setButtonEnabled(
      "uploadMatchmakingBtn",
      false
    );

    setBadge(
      "matchmakingStatusBadge",
      "checking",
      "Building"
    );

    setValidation(
      "matchmakingValidationBox",
      "warning",
      "Loading the current Kingdom datasets.",
      "fa-spinner"
    );

    try {
      const [
        currentActiveAverage,
        currentOldPlayers
      ] =
        await Promise.all([
          readMatchmakingDependency(
            ACTIVE_AVERAGE_PATH
          ),

          readMatchmakingDependency(
            OLD_PLAYERS_PATH,
            true
          )
        ]);

      const session =
        getSession();

      setValidation(
        "matchmakingValidationBox",
        "warning",
        "Matchmaking Engine is comparing active, new and departed players.",
        "fa-gears"
      );

      const result =
  engine.build(
    validatedMatchmakingData,
    currentActiveAverage,
    currentOldPlayers,
    {
      seasonNumber,

      matchmakingDate,

      matchmakingPath:
        `assets/data/${matchmakingPath}`,

      manifestPath:
        `assets/data/${manifestPath}`,

      sourceFilename:
        selectedMatchmakingFile?.name ||
        `630-matchmaking-season-${seasonNumber}.json`,

      uploadedBy:
        session?.email ||
        getRole(),

      adminConfig:
        adminConfig
    }
  );

      const fileEntries =
  Object.entries(
    result.files
  );

if (
  result.files[
    ADMIN_CONFIG_WRITE_PATH
  ]
) {
  adminConfig =
    result.files[
      ADMIN_CONFIG_WRITE_PATH
    ];
}

if (
  fileEntries.length ===
  0
) {
  throw new Error(
    "Matchmaking Engine generated no files."
  );
}

      let savedCount =
        0;

      for (
        const [
          path,
          data
        ] of fileEntries
      ) {
        setValidation(
          "matchmakingValidationBox",
          "warning",
          (
            `Saving Matchmaking file ` +
            `${savedCount + 1} of ${fileEntries.length}: ${path}`
          ),
          "fa-cloud-arrow-up"
        );

        let message;

        if (
          path ===
          `assets/data/${matchmakingPath}`
        ) {
          message =
            `Upload official Matchmaking for Season ${seasonNumber}`;
        } else if (
          path ===
          `assets/data/${manifestPath}`
        ) {
          message =
            `Generate Matchmaking manifest for Season ${seasonNumber}`;
        } else {
          message =
            `Generate Matchmaking dataset: ${path}`;
        }

        await writer.writeJson(
          path,
          data,
          {
            repository:
              REPOSITORIES.data,

            message
          }
        );

        savedCount +=
          1;
      }

      workflowState.matchmaking =
        true;

      setBadge(
        "matchmakingStatusBadge",
        "ready",
        "Ready"
      );

      setValidation(
        "matchmakingValidationBox",
        "success",
        (
          `Matchmaking Engine completed successfully. ` +
          `${savedCount} files saved, ` +
          `${result.summary.activePlayers} active players, ` +
          `${result.summary.existingPlayers} existing players updated, ` +
          `${result.summary.newPlayers} new players added and ` +
          `${result.summary.leftPlayers} players moved to Old Players.`
        ),
        "fa-circle-check"
      );

      appendLog(
        "Matchmaking Engine",
        "success",
        (
          `Season ${seasonNumber}: ` +
          `${savedCount} files saved. ` +
          `${result.summary.activePlayers} active, ` +
          `${result.summary.newPlayers} new and ` +
          `${result.summary.leftPlayers} departed players.`
        )
      );

      dispatchEvent(
        "k630:matchmaking-generated",
        {
          seasonNumber:
            result.seasonNumber,

          matchmakingDate:
            result.matchmakingDate,

          summary:
            result.summary,

          changes:
            result.changes,

          files:
            fileEntries.map(
              ([path]) =>
                path
            )
        }
      );

      updateWorkflow();
    } catch (error) {
      workflowState.matchmaking =
        false;

      setBadge(
        "matchmakingStatusBadge",
        "error",
        "Failed"
      );

      setValidation(
        "matchmakingValidationBox",
        "error",
        error?.message ||
        "The Matchmaking Engine failed.",
        "fa-circle-xmark"
      );

      appendLog(
        "Matchmaking Engine",
        "error",
        error?.message ||
        "The Matchmaking Engine failed."
      );

      updateWorkflow();
    } finally {
      setButtonEnabled(
        "uploadMatchmakingBtn",
        Boolean(
          canWrite() &&
          workflowState.githubWrite &&
          validatedMatchmakingData
        )
      );
    }
  }

  async function recheckMatchmaking() {
    const path =
      getMatchmakingPath();

    if (!path) {
      workflowState.matchmaking =
        false;

      setBadge(
        "matchmakingStatusBadge",
        "waiting",
        "Waiting"
      );

      setValidation(
        "matchmakingValidationBox",
        "warning",
        "Enter a valid Season number first.",
        "fa-triangle-exclamation"
      );

      updateWorkflow();

      return;
    }

    setBadge(
      "matchmakingStatusBadge",
      "checking",
      "Checking"
    );

    try {
      const data =
        await readMatchmakingDependency(
          path
        );

      const count =
        countRecords(data);

      if (count <= 0) {
        throw new Error(
          "The current Matchmaking file contains no records."
        );
      }

      workflowState.matchmaking =
        true;

      setBadge(
        "matchmakingStatusBadge",
        "ready",
        "Ready"
      );

      setValidation(
        "matchmakingValidationBox",
        "success",
        `Current Matchmaking contains ${count} records.`,
        "fa-circle-check"
      );

      appendLog(
        "Matchmaking check",
        "success",
        (
          `Season ${
            getElement(
              "matchmakingSeasonNumber"
            )?.value
          } Matchmaking loaded with ${count} records.`
        )
      );
    } catch (error) {
      workflowState.matchmaking =
        false;

      setBadge(
        "matchmakingStatusBadge",
        "waiting",
        "Waiting"
      );

      setValidation(
        "matchmakingValidationBox",
        "warning",
        error?.message ||
        "No current Matchmaking file was found.",
        "fa-triangle-exclamation"
      );
    }

    updateWorkflow();
  }

  /* =====================================================
     SEASON CONFIGURATION
  ===================================================== */

  function renderSeasonLibrary() {
    const table =
      getElement(
        "seasonLibraryTable"
      );

    if (!table) {
      return;
    }

    if (!selectedSeason) {
      table.innerHTML = `
        <tr>
          <td colspan="6">
            No Seasons loaded.
          </td>
        </tr>
      `;

      return;
    }

    table.innerHTML = `
      <tr>
        <td>
          Season ${escapeHtml(selectedSeason.season)}
        </td>

        <td>
          ${escapeHtml(selectedSeason.year)}
        </td>

        <td>
          SoS ${escapeHtml(selectedSeason.sosNumber)}
          - ${escapeHtml(selectedSeason.sosName)}
        </td>

        <td>
          ${workflowState.seasonActive
            ? "Active"
            : "Configured"}
        </td>

        <td>
          Selected
        </td>

        <td>
          Current
        </td>
      </tr>
    `;
  }

  async function addSeason() {
  const year =
    numberValue(
      getElement(
        "seasonYear"
      )?.value
    );

  const season =
    numberValue(
      getElement(
        "seasonNumber"
      )?.value
    );

  const sosNumber =
    numberValue(
      getElement(
        "sosNumber"
      )?.value
    );

  const sosName =
    normalizeText(
      getElement(
        "sosName"
      )?.value
    );

  const engine =
    global.K630AdminConfigEngine;

  const writer =
    getWriter();

  if (
    year < 2026 ||
    season <= 0 ||
    sosNumber <= 0 ||
    !sosName
  ) {
    return;
  }

  if (
    !engine ||
    typeof engine.updateSeason !==
      "function" ||
    typeof engine.buildFile !==
      "function"
  ) {
    throw new Error(
      "K630AdminConfigEngine is not loaded."
    );
  }

  if (
    !writer ||
    typeof writer.writeJson !==
      "function"
  ) {
    throw new Error(
      "GitHub writer is not available."
    );
  }

  setButtonEnabled(
    "addSeasonToLibraryBtn",
    false
  );

  try {
    const nextSelectedSeason = {
      year,
      season,
      sosNumber,
      sosName
    };

    const nextConfig =
      engine.updateSeason(
        adminConfig ||
        createDefaultAdminConfig(),
        {
          selectedSeason:
            nextSelectedSeason
        },
        {
          updatedAt:
            nowIso(),

          updatedBy:
            getSession()?.email ||
            getRole()
        }
      );

    const output =
      engine.buildFile(
        nextConfig,
        {
          updatedAt:
            nowIso(),

          updatedBy:
            getSession()?.email ||
            getRole()
        }
      );

    await writer.writeJson(
      ADMIN_CONFIG_WRITE_PATH,
      output.data,
      {
        repository:
          REPOSITORIES.data,

        message:
          `Configure Season ${season}`
      }
    );

    adminConfig =
      output.data;

    applyAdminConfigToState();

    const uploadSeason =
      getElement(
        "uploadSeasonNumber"
      );

    const matchmakingSeason =
      getElement(
        "matchmakingSeasonNumber"
      );

    const archiveSeason =
      getElement(
        "archiveSeasonNumber"
      );

    if (uploadSeason) {
      uploadSeason.value =
        String(season);
    }

    if (matchmakingSeason) {
      matchmakingSeason.value =
        String(season);
    }

    if (archiveSeason) {
      archiveSeason.value =
        String(season);
    }

    renderSeasonLibrary();
    updateMatchmakingDestination();
    updateUploadDestination();
    updateWorkflow();

    appendLog(
      "Season configuration",
      "success",
      `Season ${season} was configured and saved.`
    );
  } catch (error) {
    appendLog(
      "Season configuration",
      "error",
      error?.message ||
      "Season configuration could not be saved."
    );
  } finally {
    setButtonEnabled(
      "addSeasonToLibraryBtn",
      canWrite()
    );
  }
}

async function saveMeritConfiguration() {
  const engine =
    global.K630AdminConfigEngine;

  const writer =
    getWriter();

  if (!canWrite()) {
    setValidation(
      "meritConfigurationValidationBox",
      "error",
      "Only an Owner or Admin can save Merit Configuration.",
      "fa-circle-xmark"
    );

    return;
  }

  if (
    !engine ||
    typeof engine
      .updateMeritConfiguration !==
      "function" ||
    typeof engine
      .buildFile !==
      "function"
  ) {
    setValidation(
      "meritConfigurationValidationBox",
      "error",
      "K630AdminConfigEngine Merit Configuration functions are unavailable.",
      "fa-circle-xmark"
    );

    return;
  }

  if (
    !writer ||
    typeof writer.writeJson !==
      "function"
  ) {
    setValidation(
      "meritConfigurationValidationBox",
      "error",
      "GitHub writer is not available.",
      "fa-circle-xmark"
    );

    return;
  }

  const readValue =
    id => {
      const value =
        Number(
          getElement(id)?.value
        );

      return Number.isFinite(value)
        ? Math.round(
            value * 100
          ) / 100
        : 0;
    };

  const w6 = {
    t5: {
      rank3:
        readValue(
          "t5Rank3Merits"
        ),

      rank2:
        readValue(
          "t5Rank2Merits"
        ),

      rank1:
        readValue(
          "t5Rank1Merits"
        )
    },

    t4: {
      rank3:
        readValue(
          "t4Rank3Merits"
        ),

      rank2:
        readValue(
          "t4Rank2Merits"
        ),

      rank1:
        readValue(
          "t4Rank1Merits"
        )
    }
  };

  if (
    w6.t5.rank3 <
      w6.t5.rank2 ||
    w6.t5.rank2 <
      w6.t5.rank1
  ) {
    setValidation(
      "meritConfigurationValidationBox",
      "error",
      "T5 Rank 3 must be equal to or higher than Rank 2, and Rank 2 must be equal to or higher than Rank 1.",
      "fa-circle-xmark"
    );

    return;
  }

  if (
    w6.t4.rank3 <
      w6.t4.rank2 ||
    w6.t4.rank2 <
      w6.t4.rank1
  ) {
    setValidation(
      "meritConfigurationValidationBox",
      "error",
      "T4 Rank 3 must be equal to or higher than Rank 2, and Rank 2 must be equal to or higher than Rank 1.",
      "fa-circle-xmark"
    );

    return;
  }

  setButtonEnabled(
    "saveMeritConfigurationBtn",
    false
  );

  setValidation(
    "meritConfigurationValidationBox",
    "warning",
    "Saving Merit Configuration to admin-config.json.",
    "fa-spinner"
  );

  try {
    const savedAt =
      nowIso();

    const savedBy =
      getSession()?.email ||
      getRole();

    const nextConfig =
      engine.updateMeritConfiguration(
        adminConfig ||
        createDefaultAdminConfig(),
        {
          w6,

          savedAt,

          savedBy,

          updatePending:
            true
        },
        {
          updatedAt:
            savedAt,

          updatedBy:
            savedBy
        }
      );

    const output =
      engine.buildFile(
        nextConfig,
        {
          updatedAt:
            savedAt,

          updatedBy:
            savedBy
        }
      );

    await writer.writeJson(
      ADMIN_CONFIG_WRITE_PATH,
      output.data,
      {
        repository:
          REPOSITORIES.data,

        message:
          (
            `Update Merit Configuration for ` +
            `Season ${selectedSeason?.season || ""}`
          )
      }
    );

    adminConfig =
      output.data;

    workflowState.websiteBuilt =
      false;

    setBadge(
      "websiteUpdateStatus",
      "ready",
      "Rebuild Required"
    );

    setValidation(
      "meritConfigurationValidationBox",
      "success",
      (
        `Merit Configuration saved. ` +
        `T5: ${w6.t5.rank3}% / ${w6.t5.rank2}% / ${w6.t5.rank1}%. ` +
        `T4: ${w6.t4.rank3}% / ${w6.t4.rank2}% / ${w6.t4.rank1}%. ` +
        `Rebuild Season Info to apply the targets.`
      ),
      "fa-circle-check"
    );

    appendLog(
      "Merit Configuration",
      "success",
      (
        `T5 targets: ` +
        `${w6.t5.rank3}/${w6.t5.rank2}/${w6.t5.rank1}. ` +
        `T4 targets: ` +
        `${w6.t4.rank3}/${w6.t4.rank2}/${w6.t4.rank1}.`
      )
    );

    dispatchEvent(
      "k630:merit-configuration-updated",
      {
        seasonNumber:
          selectedSeason?.season ||
          0,

        meritConfiguration:
          adminConfig
            .meritConfiguration
      }
    );
  } catch (error) {
    setValidation(
      "meritConfigurationValidationBox",
      "error",
      error?.message ||
      "Merit Configuration could not be saved.",
      "fa-circle-xmark"
    );

    appendLog(
      "Merit Configuration",
      "error",
      error?.message ||
      "Merit Configuration could not be saved."
    );
  } finally {
    setButtonEnabled(
      "saveMeritConfigurationBtn",
      canWrite()
    );

    updateWorkflow();
  }
}

  function addParticipatingServer() {
    if (
      participatingServers.length >=
      MAX_PARTICIPATING_SERVERS
    ) {
      return;
    }

    const server =
      global.prompt(
        "Enter the participating server number:"
      );

    const number =
      numberValue(server);

    if (
      number <=
        0 ||
      participatingServers.includes(
        number
      )
    ) {
      return;
    }

    participatingServers.push(
      number
    );

    participatingServers.sort(
      (
        first,
        second
      ) =>
        first -
        second
    );

    renderParticipatingServers();
    updateWorkflow();
  }

  function removeParticipatingServer(
    server
  ) {
    participatingServers =
      participatingServers.filter(
        value =>
          value !==
          server
      );

    renderParticipatingServers();
    updateWorkflow();
  }

  function renderParticipatingServers() {
    const grid =
      getElement(
        "participatingServersGrid"
      );

    if (!grid) {
      return;
    }

    setText(
      "registeredServerCount",
      String(
        participatingServers.length
      )
    );

    setText(
      "completeServerCount",
      String(
        participatingServers.length
      )
    );

    setText(
      "missingServerCount",
      "0"
    );

    if (
      participatingServers.length ===
        0
    ) {
      grid.innerHTML = `
        <div class="admin-selected-files-empty">
          No participating servers registered.
        </div>
      `;

      return;
    }

    grid.innerHTML =
      participatingServers
        .map(server => `
          <article class="server-card">
            <strong>
              Server ${escapeHtml(server)}
            </strong>

            <button
              type="button"
              class="admin-btn delete"
              data-remove-server="${escapeHtml(server)}"
              ${canWrite() ? "" : "disabled"}
            >
              <i class="fa-solid fa-xmark"></i>
              Remove
            </button>
          </article>
        `)
        .join("");
  }

async function saveParticipatingServers() {
  const engine =
    global.K630AdminConfigEngine;

  const writer =
    getWriter();

  if (
    !canWrite() ||
    !selectedSeason ||
    !workflowState.matchmaking ||
    participatingServers.length ===
      0
  ) {
    setValidation(
      "seasonActivationValidationBox",
      "warning",
      "Season, Matchmaking or participating servers are incomplete.",
      "fa-triangle-exclamation"
    );

    return;
  }

  if (
    !engine ||
    typeof engine.updateSeason !==
      "function" ||
    typeof engine.buildFile !==
      "function"
  ) {
    throw new Error(
      "K630AdminConfigEngine is not loaded."
    );
  }

  if (
    !writer ||
    typeof writer.writeJson !==
      "function"
  ) {
    throw new Error(
      "GitHub writer is not available."
    );
  }

  setButtonEnabled(
    "saveParticipatingServersBtn",
    false
  );

  try {
    const nextConfig =
      engine.updateSeason(
        adminConfig ||
        createDefaultAdminConfig(),
        {
          selectedSeason: {
            ...selectedSeason
          },

          participatingServers: [
            ...participatingServers
          ]
        },
        {
          updatedAt:
            nowIso(),

          updatedBy:
            getSession()?.email ||
            getRole()
        }
      );

    const output =
      engine.buildFile(
        nextConfig,
        {
          updatedAt:
            nowIso(),

          updatedBy:
            getSession()?.email ||
            getRole()
        }
      );

    await writer.writeJson(
      ADMIN_CONFIG_WRITE_PATH,
      output.data,
      {
        repository:
          REPOSITORIES.data,

        message:
          (
            `Save ${participatingServers.length} participating servers ` +
            `for Season ${selectedSeason.season}`
          )
      }
    );

    adminConfig =
      output.data;

    applyAdminConfigToState();

    renderSeasonLibrary();
    renderParticipatingServers();
    updateWorkflow();

    setValidation(
      "seasonActivationValidationBox",
      "success",
      (
        `${participatingServers.length} participating servers ` +
        `saved successfully for Season ${selectedSeason.season}.`
      ),
      "fa-circle-check"
    );

    appendLog(
      "Participating servers",
      "success",
      (
        `${participatingServers.length} servers saved ` +
        `for Season ${selectedSeason.season}.`
      )
    );
  } catch (error) {
    setValidation(
      "seasonActivationValidationBox",
      "error",
      error?.message ||
      "Participating servers could not be saved.",
      "fa-circle-xmark"
    );

    appendLog(
      "Participating servers",
      "error",
      error?.message ||
      "Participating servers could not be saved."
    );
  } finally {
    setButtonEnabled(
      "saveParticipatingServersBtn",
      canWrite()
    );
  }
}

async function activateSeason() {
  const engine =
    global.K630AdminConfigEngine;

  const writer =
    getWriter();

  if (
    !canWrite() ||
    !workflowState.seasonConfigured
  ) {
    return;
  }

  if (
    !engine ||
    typeof engine.updateSeason !==
      "function" ||
    typeof engine.buildFile !==
      "function"
  ) {
    throw new Error(
      "K630AdminConfigEngine is not loaded."
    );
  }

  if (
    !writer ||
    typeof writer.writeJson !==
      "function"
  ) {
    throw new Error(
      "GitHub writer is not available."
    );
  }

  setButtonEnabled(
    "activateSeasonBtn",
    false
  );

  try {
    const nextConfig =
      engine.updateSeason(
        adminConfig ||
        createDefaultAdminConfig(),
        {
          selectedSeason: {
            ...selectedSeason
          },

          participatingServers: [
            ...participatingServers
          ],

          active:
            true
        },
        {
          updatedAt:
            nowIso(),

          updatedBy:
            getSession()?.email ||
            getRole()
        }
      );

    const output =
      engine.buildFile(
        nextConfig,
        {
          updatedAt:
            nowIso(),

          updatedBy:
            getSession()?.email ||
            getRole()
        }
      );

    await writer.writeJson(
      ADMIN_CONFIG_WRITE_PATH,
      output.data,
      {
        repository:
          REPOSITORIES.data,

        message:
          `Activate Season ${selectedSeason.season}`
      }
    );

    adminConfig =
      output.data;

    applyAdminConfigToState();

    renderSeasonLibrary();
    renderParticipatingServers();
    updateWorkflow();

    setValidation(
      "seasonActivationValidationBox",
      "success",
      (
        `Season ${selectedSeason.season} activated successfully. ` +
        `Week 0 is unlocked.`
      ),
      "fa-circle-check"
    );

    dispatchEvent(
      "k630:season-updated",
      {
        season: {
          ...selectedSeason
        },

        active:
          true
      }
    );

    appendLog(
      "Season activated",
      "success",
      `Season ${selectedSeason.season} was activated.`
    );
  } catch (error) {
    setValidation(
      "seasonActivationValidationBox",
      "error",
      error?.message ||
      "Season activation failed.",
      "fa-circle-xmark"
    );

    appendLog(
      "Season activated",
      "error",
      error?.message ||
      "Season activation failed."
    );
  } finally {
    updateWorkflow();
  }
}

async function deactivateSeason() {
  const engine =
    global.K630AdminConfigEngine;

  const writer =
    getWriter();

  if (!canWrite()) {
    return;
  }

  if (
    !engine ||
    typeof engine.updateSeason !==
      "function" ||
    typeof engine.buildFile !==
      "function"
  ) {
    throw new Error(
      "K630AdminConfigEngine is not loaded."
    );
  }

  if (
    !writer ||
    typeof writer.writeJson !==
      "function"
  ) {
    throw new Error(
      "GitHub writer is not available."
    );
  }

  setButtonEnabled(
    "deactivateSeasonBtn",
    false
  );

  try {
    const nextConfig =
      engine.updateSeason(
        adminConfig ||
        createDefaultAdminConfig(),
        {
          active:
            false
        },
        {
          updatedAt:
            nowIso(),

          updatedBy:
            getSession()?.email ||
            getRole()
        }
      );

    const output =
      engine.buildFile(
        nextConfig,
        {
          updatedAt:
            nowIso(),

          updatedBy:
            getSession()?.email ||
            getRole()
        }
      );

    await writer.writeJson(
      ADMIN_CONFIG_WRITE_PATH,
      output.data,
      {
        repository:
          REPOSITORIES.data,

        message:
          (
            `Deactivate Season ` +
            `${selectedSeason?.season || ""}`
          )
      }
    );

    adminConfig =
      output.data;

    applyAdminConfigToState();

    renderSeasonLibrary();
    renderParticipatingServers();
    updateWorkflow();

    setValidation(
      "seasonActivationValidationBox",
      "success",
      "Season deactivated successfully. Week 0 is locked.",
      "fa-circle-check"
    );

    dispatchEvent(
      "k630:season-updated",
      {
        season:
          selectedSeason
            ? {
                ...selectedSeason
              }
            : null,

        active:
          false
      }
    );

    appendLog(
      "Season deactivated",
      "success",
      "The active Season was deactivated."
    );
  } catch (error) {
    setValidation(
      "seasonActivationValidationBox",
      "error",
      error?.message ||
      "Season deactivation failed.",
      "fa-circle-xmark"
    );

    appendLog(
      "Season deactivated",
      "error",
      error?.message ||
      "Season deactivation failed."
    );
  } finally {
    updateWorkflow();
  }
}

  /* =====================================================
     WEEK UPLOAD
  ===================================================== */

  function getUploadPath() {
    const season =
      numberValue(
        getElement(
          "uploadSeasonNumber"
        )?.value
      );

    const week =
      normalizeLower(
        getElement(
          "uploadTypeSelect"
        )?.value
      );

    if (
      season <=
        0 ||
      !/^w[0-6]$/.test(
        week
      )
    ) {
      return "";
    }

    return (
      `seasons/season-${season}/` +
      `${week}/`
    );
  }

  function updateUploadDestination() {
    const path =
      getUploadPath();

    setText(
      "uploadDestinationPreview",
      path
        ? `assets/data/${path}[server-file].json`
        : "Select a Season and week."
    );
  }

  async function validateSeasonFiles() {
  const officialDate =
    normalizeText(
      getElement(
        "uploadOfficialDate"
      )?.value
    );

  const writer =
    getWriter();

  if (
    !workflowState
      .seasonActive
  ) {
    validatedSeasonFiles =
      [];

    setButtonEnabled(
      "uploadSeasonDataBtn",
      false
    );

    setValidation(
      "seasonUploadValidationBox",
      "warning",
      "Activate the Season before uploading weekly data.",
      "fa-lock"
    );

    return;
  }

  if (
    !writer ||
    typeof writer.writeJson !==
      "function"
  ) {
    validatedSeasonFiles =
      [];

    setButtonEnabled(
      "uploadSeasonDataBtn",
      false
    );

    setValidation(
      "seasonUploadValidationBox",
      "error",
      "GitHub writer is not available.",
      "fa-circle-xmark"
    );

    return;
  }

  if (
    !getUploadPath() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      officialDate
    ) ||
    selectedSeasonFiles.length ===
      0
  ) {
    validatedSeasonFiles =
      [];

    setButtonEnabled(
      "uploadSeasonDataBtn",
      false
    );

    setValidation(
      "seasonUploadValidationBox",
      "warning",
      "Select a Season, week, valid official date and source files.",
      "fa-triangle-exclamation"
    );

    return;
  }

  setButtonEnabled(
    "validateSeasonUploadBtn",
    false
  );

  setButtonEnabled(
    "uploadSeasonDataBtn",
    false
  );

  setBadge(
    "dataUploadStatus",
    "checking",
    "Validating"
  );

  try {
    const results =
      [];

    for (
      const file of
      selectedSeasonFiles
    ) {
      const data =
        await readJsonFile(
          file
        );

      const count =
        countRecords(
          data
        );

      if (
        count <=
        0
      ) {
        throw new Error(
          `${file.name} contains no records.`
        );
      }

      results.push({
        file,
        data,
        count
      });
    }

    validatedSeasonFiles =
      results;

    setButtonEnabled(
      "uploadSeasonDataBtn",
      Boolean(
        canWrite() &&
        workflowState.seasonActive &&
        validatedSeasonFiles.length >
          0 &&
        writer &&
        typeof writer.writeJson ===
          "function"
      )
    );

    setBadge(
      "dataUploadStatus",
      "ready",
      "Ready"
    );

    setValidation(
      "seasonUploadValidationBox",
      "success",
      `${results.length} source files validated successfully.`,
      "fa-circle-check"
    );
  } catch (error) {
    validatedSeasonFiles =
      [];

    setButtonEnabled(
      "uploadSeasonDataBtn",
      false
    );

    setBadge(
      "dataUploadStatus",
      "error",
      "Failed"
    );

    setValidation(
      "seasonUploadValidationBox",
      "error",
      error?.message ||
      "Weekly file validation failed.",
      "fa-circle-xmark"
    );
  } finally {
    setButtonEnabled(
      "validateSeasonUploadBtn",
      Boolean(
        canWrite() &&
        workflowState.seasonActive
      )
    );
  }
}

  async function uploadSeasonFiles() {
  const writer =
    getWriter();

  const configEngine =
    global.K630AdminConfigEngine;

  const path =
    getUploadPath();

  const week =
    normalizeText(
      getElement(
        "uploadTypeSelect"
      )?.value
    ).toUpperCase();

  const officialDate =
    normalizeText(
      getElement(
        "uploadOfficialDate"
      )?.value
    );

  const seasonNumber =
    Math.trunc(
      numberValue(
        getElement(
          "uploadSeasonNumber"
        )?.value
      )
    );

  if (
    !writer ||
    typeof writer.writeJson !==
      "function"
  ) {
    setValidation(
      "seasonUploadValidationBox",
      "error",
      "GitHub writer is not available.",
      "fa-circle-xmark"
    );

    return;
  }

  if (
    !configEngine ||
    typeof configEngine.updateWeeks !==
      "function" ||
    typeof configEngine.buildFile !==
      "function"
  ) {
    setValidation(
      "seasonUploadValidationBox",
      "error",
      "K630AdminConfigEngine is not loaded.",
      "fa-circle-xmark"
    );

    return;
  }

  if (
    !workflowState.seasonActive ||
    !path ||
    seasonNumber <= 0 ||
    !/^W[0-6]$/.test(week) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      officialDate
    ) ||
    validatedSeasonFiles.length ===
      0
  ) {
    setValidation(
      "seasonUploadValidationBox",
      "warning",
      "Activate the Season and validate the weekly source files and official date first.",
      "fa-triangle-exclamation"
    );

    return;
  }

  setButtonEnabled(
    "uploadSeasonDataBtn",
    false
  );

  setBadge(
    "dataUploadStatus",
    "checking",
    "Uploading"
  );

  try {
    let savedCount =
      0;

    for (
      const entry of
      validatedSeasonFiles
    ) {
      const destination =
        (
          `assets/data/${path}` +
          entry.file.name
        );

      setValidation(
        "seasonUploadValidationBox",
        "warning",
        (
          `Saving ${week} file ` +
          `${savedCount + 1} of ` +
          `${validatedSeasonFiles.length}: ` +
          `${entry.file.name}`
        ),
        "fa-cloud-arrow-up"
      );

      await writer.writeJson(
        destination,
        entry.data,
        {
          repository:
            REPOSITORIES.data,

          message:
            (
              `Upload ${week} data for ` +
              `Season ${seasonNumber}: ` +
              `${entry.file.name}`
            )
        }
      );

      savedCount +=
        1;
    }

    const nextConfig =
      configEngine.updateWeeks(
        adminConfig ||
        createDefaultAdminConfig(),
        {
          addWeek:
            week,

          officialDate,

          updatedAt:
            nowIso()
        },
        {
          updatedAt:
            nowIso(),

          updatedBy:
            getSession()?.email ||
            getRole()
        }
      );

    const configOutput =
      configEngine.buildFile(
        nextConfig,
        {
          updatedAt:
            nowIso(),

          updatedBy:
            getSession()?.email ||
            getRole()
        }
      );

    await writer.writeJson(
      ADMIN_CONFIG_WRITE_PATH,
      configOutput.data,
      {
        repository:
          REPOSITORIES.data,

        message:
          (
            `Register ${week} and official date ` +
            `${officialDate} for Season ${seasonNumber}`
          )
      }
    );

    adminConfig =
      configOutput.data;

    applyAdminConfigToState();

    workflowState.weekData =
      true;

    workflowState.websiteBuilt =
      false;

    workflowState.archiveReady =
      false;

    setBadge(
      "dataUploadStatus",
      "ready",
      "Uploaded"
    );

    setValidation(
      "seasonUploadValidationBox",
      "success",
      (
        `${savedCount} ${week} source files uploaded. ` +
        `Official date ${officialDate} was saved in admin-config.json.`
      ),
      "fa-circle-check"
    );

    appendLog(
      "Weekly upload",
      "success",
      (
        `${savedCount} files uploaded for ${week}, ` +
        `Season ${seasonNumber}, official date ${officialDate}.`
      )
    );

    dispatchEvent(
      "k630:week-uploaded",
      {
        seasonNumber,

        week,

        officialDate,

        files:
          validatedSeasonFiles.map(
            entry =>
              entry.file.name
          )
      }
    );

    updateWorkflow();
  } catch (error) {
    setBadge(
      "dataUploadStatus",
      "error",
      "Failed"
    );

    setValidation(
      "seasonUploadValidationBox",
      "error",
      error?.message ||
      "Weekly data upload failed.",
      "fa-circle-xmark"
    );

    appendLog(
      "Weekly upload",
      "error",
      error?.message ||
      "Weekly data upload failed."
    );
  } finally {
    setButtonEnabled(
      "uploadSeasonDataBtn",
      Boolean(
        canWrite() &&
        workflowState.seasonActive &&
        validatedSeasonFiles.length >
          0
      )
    );
  }
}

async function loadSeasonWeekServerData(
  seasonNumber,
  weekNumber,
  serverNumber
) {
  const week =
    `w${weekNumber}`;

  return readFirstAvailableJson([
    (
      `seasons/season-${seasonNumber}/` +
      `${week}/${serverNumber}-${seasonNumber}-${weekNumber}.json`
    ),

    (
      `seasons/season-${seasonNumber}/` +
      `${week}/${serverNumber}.json`
    ),

    (
      `seasons/season-${seasonNumber}/` +
      `${week}/server-${serverNumber}.json`
    )
  ]);
}

async function readFirstAvailableJson(
  relativePaths
) {
  let lastError =
    null;

  for (
    const relativePath of
    relativePaths
  ) {
    try {
      return await readMatchmakingDependency(
        relativePath
      );
    } catch (error) {
      lastError =
        error;
    }
  }

  throw (
    lastError ||
    new Error(
      "No matching JSON source file could be loaded."
    )
  );
}

async function loadSeasonWeekServerData(
  seasonNumber,
  weekNumber,
  serverNumber
) {
  const week =
    `w${weekNumber}`;

  return readFirstAvailableJson([
    (
      `seasons/season-${seasonNumber}/` +
      `${week}/${serverNumber}-${seasonNumber}-${weekNumber}.json`
    ),

    (
      `seasons/season-${seasonNumber}/` +
      `${week}/${serverNumber}.json`
    ),

    (
      `seasons/season-${seasonNumber}/` +
      `${week}/server-${serverNumber}.json`
    )
  ]);
}

async function rebuildWeeklyPlayerState() {
  const writer =
    getWriter();

  const engine =
    global.K630WeeklyPlayerStateEngine;

  const seasonNumber =
    Math.trunc(
      numberValue(
        selectedSeason?.season ||
        adminConfig?.season
          ?.selectedSeason
          ?.season ||
        adminConfig?.matchmaking
          ?.seasonNumber
      )
    );

  const uploadedWeeks =
    Array.isArray(
      adminConfig?.weeks
        ?.uploaded
    )
      ? adminConfig.weeks
          .uploaded
          .map(value =>
            normalizeText(value)
              .toUpperCase()
          )
          .filter(value =>
            /^W[0-6]$/.test(value)
          )
      : [];

  const latestWeekLabel =
    normalizeText(
      adminConfig?.weeks
        ?.latestWeek
    ).toUpperCase() ||
    uploadedWeeks[
      uploadedWeeks.length - 1
    ] ||
    (
      adminConfig?.weeks
        ?.ready === true
        ? "W0"
        : ""
    );

  const weekNumber =
    /^W[0-6]$/.test(
      latestWeekLabel
    )
      ? Number(
          latestWeekLabel.replace(
            "W",
            ""
          )
        )
      : -1;

  const officialDate =
    normalizeText(
      adminConfig?.weeks
        ?.officialDates
        ?.[latestWeekLabel]
    ) ||
    normalizeText(
      adminConfig?.weeks
        ?.[latestWeekLabel]
        ?.officialDate
    ) ||
    normalizeText(
      adminConfig?.weeks
        ?.officialDate
    ) ||
    (
      weekNumber === 0
        ? normalizeText(
            adminConfig?.matchmaking
              ?.officialDate
          )
        : ""
    );

  if (
    !canWrite() ||
    seasonNumber <= 0 ||
    !/^W[0-6]$/.test(
      latestWeekLabel
    ) ||
    !Number.isInteger(
      weekNumber
    ) ||
    weekNumber < 0 ||
    weekNumber > 6 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      officialDate
    )
  ) {
    throw new Error(
      (
        `Weekly player state configuration is incomplete. ` +
        `Season=${seasonNumber || "missing"}, ` +
        `Week=${latestWeekLabel || "missing"}, ` +
        `Official date=${officialDate || "missing"}.`
      )
    );
  }

  if (
    !writer ||
    typeof writer.writeJson !==
      "function"
  ) {
    throw new Error(
      "GitHub writer is not available."
    );
  }

  if (
    !engine ||
    typeof engine.build !==
      "function"
  ) {
    throw new Error(
      "K630WeeklyPlayerStateEngine is not loaded."
    );
  }

  setValidation(
    "websiteUpdateValidationBox",
    "warning",
    (
      `Loading Active & Average and ` +
      `Season ${seasonNumber} ${latestWeekLabel}.`
    ),
    "fa-spinner"
  );

  const activeAverageData =
    await readMatchmakingDependency(
      ACTIVE_AVERAGE_PATH
    );

  let seasonInfoData = {
    players: []
  };

  if (weekNumber > 0) {
    seasonInfoData =
      await readMatchmakingDependency(
        "generated/season-info/current.json"
      );
  }

  const currentWeekData =
    await loadSeasonWeekServerData(
      seasonNumber,
      weekNumber,
      HOME_KINGDOM
    );

  const generatedAt =
    nowIso();

  const generatedBy =
    getSession()?.email ||
    getRole();

  const result =
    engine.build(
      activeAverageData,
      seasonInfoData,
      currentWeekData,
      {
        seasonNumber,

        weekNumber,

        officialDate,

        generatedAt,

        generatedBy,

        adminConfig,

        meritConfiguration:
          adminConfig
            ?.meritConfiguration ||
          null
      }
    );

  const activeAverageOutput =
    result.files[
      "assets/data/generated/active-average/current.json"
    ] ||
    result.data
      ?.activeAverage;

  const seasonInfoOutput =
    result.files[
      "assets/data/generated/season-info/current.json"
    ] ||
    result.data
      ?.seasonInfo;

  if (
    !activeAverageOutput ||
    !seasonInfoOutput
  ) {
    throw new Error(
      "Weekly Player State Engine generated incomplete output."
    );
  }

  setValidation(
    "websiteUpdateValidationBox",
    "warning",
    "Saving Active & Average current.json.",
    "fa-spinner"
  );

  await writer.writeJson(
    "assets/data/generated/active-average/current.json",
    activeAverageOutput,
    {
      repository:
        REPOSITORIES.data,

      message:
        (
          `Rebuild Active & Average for ` +
          `Season ${seasonNumber} ${latestWeekLabel}`
        )
    }
  );

  setValidation(
    "websiteUpdateValidationBox",
    "warning",
    "Saving Season Info current.json.",
    "fa-spinner"
  );

  await writer.writeJson(
    "assets/data/generated/season-info/current.json",
    seasonInfoOutput,
    {
      repository:
        REPOSITORIES.data,

      message:
        (
          `Rebuild Season Info for ` +
          `Season ${seasonNumber} ${latestWeekLabel}`
        )
    }
  );

  appendLog(
    "Weekly player state rebuild",
    "success",
    (
      `Season ${seasonNumber} ${latestWeekLabel}: ` +
      `${result.summary.activeAverage.updatedPlayers} updated, ` +
      `${result.summary.activeAverage.addedPlayers} added, ` +
      `${result.summary.seasonInfo.leftPlayers} marked LEFT.`
    )
  );

  return result;
}

async function loadOptionalJson(
  relativePath,
  fallbackValue = {}
) {
  try {
    return await readMatchmakingDependency(
      relativePath
    );
  } catch (error) {
    console.warn(
      `[Admin Center] Optional JSON unavailable: ${relativePath}`,
      error
    );

    return fallbackValue;
  }
}

async function loadParticipatingServerWeekData(
  seasonNumber,
  weekNumber
) {
  const servers =
    Array.isArray(
      participatingServers
    ) &&
    participatingServers.length > 0
      ? participatingServers
      : (
          Array.isArray(
            adminConfig?.season
              ?.participatingServers
          )
            ? adminConfig.season
                .participatingServers
            : []
        );

  if (
    servers.length ===
    0
  ) {
    throw new Error(
      "No participating servers are configured."
    );
  }

  const output =
    [];

  for (
    let index = 0;
    index < servers.length;
    index += 1
  ) {
    const serverNumber =
      Math.trunc(
        numberValue(
          servers[index]
        )
      );

    if (
      serverNumber <=
      0
    ) {
      continue;
    }

    setValidation(
      "websiteUpdateValidationBox",
      "warning",
      (
        `Loading Season ${seasonNumber} W${weekNumber} ` +
        `Server ${serverNumber} ` +
        `(${index + 1}/${servers.length}).`
      ),
      "fa-spinner"
    );

    const data =
      await loadSeasonWeekServerData(
        seasonNumber,
        weekNumber,
        serverNumber
      );

    output.push({
      serverNumber,
      data
    });
  }

  return output;
}

async function rebuildHomeWeekly(
  activeAverageOverride = null
) {
  const writer =
    getWriter();

  const engine =
    global.K630HomeWeeklyEngine;

  const seasonNumber =
    Math.trunc(
      numberValue(
        selectedSeason?.season ||
        adminConfig?.season
          ?.selectedSeason
          ?.season ||
        adminConfig?.matchmaking
          ?.seasonNumber
      )
    );

  const uploadedWeeks =
    Array.isArray(
      adminConfig?.weeks
        ?.uploaded
    )
      ? adminConfig.weeks
          .uploaded
          .map(value =>
            normalizeText(value)
              .toUpperCase()
          )
          .filter(value =>
            /^W[0-6]$/.test(value)
          )
      : [];

  const latestWeekLabel =
    normalizeText(
      adminConfig?.weeks
        ?.latestWeek
    ).toUpperCase() ||
    uploadedWeeks[
      uploadedWeeks.length - 1
    ] ||
    (
      adminConfig?.weeks
        ?.ready === true
        ? "W0"
        : ""
    );

  const weekNumber =
    /^W[0-6]$/.test(
      latestWeekLabel
    )
      ? Number(
          latestWeekLabel.replace(
            "W",
            ""
          )
        )
      : -1;

  const officialDate =
    normalizeText(
      adminConfig?.weeks
        ?.officialDates
        ?.[latestWeekLabel]
    ) ||
    normalizeText(
      adminConfig?.weeks
        ?.[latestWeekLabel]
        ?.officialDate
    ) ||
    normalizeText(
      adminConfig?.weeks
        ?.officialDate
    ) ||
    (
      weekNumber === 0
        ? normalizeText(
            adminConfig?.season
              ?.activatedAt
          )
        : ""
    ) ||
    (
      weekNumber === 0
        ? normalizeText(
            adminConfig?.matchmaking
              ?.officialDate
          )
        : ""
    );

  console.info(
    "[K630 Home Rebuild State]",
    {
      seasonNumber,
      uploadedWeeks,
      latestWeekLabel,
      weekNumber,
      officialDate,
      weeks:
        adminConfig?.weeks ||
        null
    }
  );

  if (
    !canWrite() ||
    seasonNumber <= 0 ||
    !/^W[0-6]$/.test(
      latestWeekLabel
    ) ||
    !Number.isInteger(
      weekNumber
    ) ||
    weekNumber < 0 ||
    weekNumber > 6 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      officialDate
    )
  ) {
    throw new Error(
      (
        `Home rebuild configuration is incomplete. ` +
        `Season=${seasonNumber || "missing"}, ` +
        `Week=${latestWeekLabel || "missing"}, ` +
        `Official date=${officialDate || "missing"}.`
      )
    );
  }

  if (
    !writer ||
    typeof writer.writeJson !==
      "function"
  ) {
    throw new Error(
      "GitHub writer is not available."
    );
  }

  if (
    !engine ||
    typeof engine.build !==
      "function"
  ) {
    throw new Error(
      "K630HomeWeeklyEngine is not loaded."
    );
  }

  setValidation(
    "websiteUpdateValidationBox",
    "warning",
    "Loading current Active & Average data.",
    "fa-spinner"
  );

  const activeAverageData =
    activeAverageOverride ||
    await readMatchmakingDependency(
      ACTIVE_AVERAGE_PATH
    );

  setValidation(
    "websiteUpdateValidationBox",
    "warning",
    (
      `Loading Server ${HOME_KINGDOM} ` +
      `${latestWeekLabel} data.`
    ),
    "fa-spinner"
  );

  const homeWeekData =
    await loadSeasonWeekServerData(
      seasonNumber,
      weekNumber,
      HOME_KINGDOM
    );

  const participatingServerWeekData =
    await loadParticipatingServerWeekData(
      seasonNumber,
      weekNumber
    );

  const previousHomeData =
    await loadOptionalJson(
      "generated/home/current.json",
      {}
    );

  const result =
    engine.build(
      activeAverageData,
      homeWeekData,
      participatingServerWeekData,
      previousHomeData,
      {
        seasonNumber,

        weekNumber,

        officialDate,

        participatingServers:
          participatingServerWeekData.map(
            entry =>
              entry.serverNumber
          ),

        seasonName:
          selectedSeason?.sosName ||
          adminConfig?.season
            ?.selectedSeason
            ?.sosName ||
          `Season ${seasonNumber}`,

        generatedAt:
          nowIso(),

        generatedBy:
          getSession()?.email ||
          getRole()
      }
    );

  const output =
    result.files[
      "assets/data/generated/home/current.json"
    ] ||
    result.data;

  if (!output) {
    throw new Error(
      "Home Weekly Engine generated no output."
    );
  }

  setValidation(
    "websiteUpdateValidationBox",
    "warning",
    "Saving Home current.json.",
    "fa-spinner"
  );

  await writer.writeJson(
    "assets/data/generated/home/current.json",
    output,
    {
      repository:
        REPOSITORIES.data,

      message:
        (
          `Rebuild Home for Season ` +
          `${seasonNumber} ${latestWeekLabel}`
        )
    }
  );

  appendLog(
    "Home rebuild",
    "success",
    (
      `Season ${seasonNumber} ${latestWeekLabel}: ` +
      `${result.summary.activePlayers} players, ` +
      `${result.summary.warriors} Warriors, ` +
      `${result.summary.farmers} Farmers, ` +
      `${result.summary.serverPower} total Power.`
    )
  );

  return result;
}

async function rebuildServerVsServerWeekly(
  participatingServerWeekDataOverride = null
) {
  const writer =
    getWriter();

  const engine =
    global.K630ServerVsServerWeeklyEngine;

  const seasonNumber =
    Math.trunc(
      numberValue(
        selectedSeason?.season ||
        adminConfig?.season
          ?.selectedSeason
          ?.season ||
        adminConfig?.matchmaking
          ?.seasonNumber
      )
    );

  const uploadedWeeks =
    Array.isArray(
      adminConfig?.weeks
        ?.uploaded
    )
      ? adminConfig.weeks
          .uploaded
          .map(value =>
            normalizeText(value)
              .toUpperCase()
          )
          .filter(value =>
            /^W[0-6]$/.test(value)
          )
      : [];

  const latestWeekLabel =
    normalizeText(
      adminConfig?.weeks
        ?.latestWeek
    ).toUpperCase() ||
    uploadedWeeks[
      uploadedWeeks.length - 1
    ] ||
    (
      adminConfig?.weeks
        ?.ready === true
        ? "W0"
        : ""
    );

  const weekNumber =
    /^W[0-6]$/.test(
      latestWeekLabel
    )
      ? Number(
          latestWeekLabel.replace(
            "W",
            ""
          )
        )
      : -1;

  const officialDate =
    normalizeText(
      adminConfig?.weeks
        ?.officialDates
        ?.[latestWeekLabel]
    ) ||
    normalizeText(
      adminConfig?.weeks
        ?.[latestWeekLabel]
        ?.officialDate
    ) ||
    normalizeText(
      adminConfig?.weeks
        ?.officialDate
    ) ||
    (
      weekNumber === 0
        ? normalizeText(
            adminConfig?.matchmaking
              ?.officialDate
          )
        : ""
    );

  if (
    !canWrite() ||
    seasonNumber <= 0 ||
    !/^W[0-6]$/.test(
      latestWeekLabel
    ) ||
    !Number.isInteger(
      weekNumber
    ) ||
    weekNumber < 0 ||
    weekNumber > 6 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      officialDate
    )
  ) {
    throw new Error(
      (
        `Server vs Server configuration is incomplete. ` +
        `Season=${seasonNumber || "missing"}, ` +
        `Week=${latestWeekLabel || "missing"}, ` +
        `Official date=${officialDate || "missing"}.`
      )
    );
  }

  if (
    !writer ||
    typeof writer.writeJson !==
      "function"
  ) {
    throw new Error(
      "GitHub writer is not available."
    );
  }

  if (
    !engine ||
    typeof engine.build !==
      "function"
  ) {
    throw new Error(
      "K630ServerVsServerWeeklyEngine is not loaded."
    );
  }

  const participatingServerWeekData =
    participatingServerWeekDataOverride ||
    await loadParticipatingServerWeekData(
      seasonNumber,
      weekNumber
    );

  const previousServerVsServerData =
    await loadOptionalJson(
      "generated/server-vs-server/current.json",
      {}
    );

  setValidation(
    "websiteUpdateValidationBox",
    "warning",
    "Building Server vs Server current data.",
    "fa-spinner"
  );

  const result =
    engine.build(
      participatingServerWeekData,
      previousServerVsServerData,
      {
        seasonNumber,

        weekNumber,

        officialDate,

        generatedAt:
          nowIso(),

        generatedBy:
          getSession()?.email ||
          getRole()
      }
    );

  const output =
    result.files[
      "assets/data/generated/server-vs-server/current.json"
    ] ||
    result.data;

  if (!output) {
    throw new Error(
      "Server vs Server Weekly Engine generated no output."
    );
  }

  setValidation(
    "websiteUpdateValidationBox",
    "warning",
    "Saving Server vs Server current.json.",
    "fa-spinner"
  );

  await writer.writeJson(
    "assets/data/generated/server-vs-server/current.json",
    output,
    {
      repository:
        REPOSITORIES.data,

      message:
        (
          `Rebuild Server vs Server for ` +
          `Season ${seasonNumber} ${latestWeekLabel}`
        )
    }
  );

  appendLog(
    "Server vs Server rebuild",
    "success",
    (
      `Season ${seasonNumber} ${latestWeekLabel}: ` +
      `${result.summary.serverCount} servers rebuilt.`
    )
  );

  return result;
}

async function rebuildSeasonInfo() {
  if (!canWrite()) {
    setValidation(
      "websiteUpdateValidationBox",
      "error",
      "Only an Owner or Admin can rebuild Season Info.",
      "fa-circle-xmark"
    );

    return null;
  }

  setButtonEnabled(
    "rebuildSeasonInfoBtn",
    false
  );

  setBadge(
    "websiteUpdateStatus",
    "checking",
    "Building"
  );

  setValidation(
    "websiteUpdateValidationBox",
    "warning",
    "Rebuilding Season Info through the Weekly Player State Engine.",
    "fa-spinner"
  );

  try {
    const result =
      await rebuildWeeklyPlayerState();

    const seasonInfoData =
      result?.data
        ?.seasonInfo ||
      result?.files?.[
        "assets/data/generated/season-info/current.json"
      ] ||
      null;

    if (!seasonInfoData) {
      throw new Error(
        "Weekly Player State Engine generated no Season Info output."
      );
    }

    const seasonNumber =
      Math.trunc(
        numberValue(
          result?.seasonNumber ||
          selectedSeason?.season ||
          adminConfig?.season
            ?.selectedSeason
            ?.season ||
          adminConfig?.matchmaking
            ?.seasonNumber
        )
      );

    setBadge(
      "websiteUpdateStatus",
      "ready",
      "Updated"
    );

    setValidation(
      "websiteUpdateValidationBox",
      "success",
      (
        `Season Info rebuilt successfully through ` +
        `K630WeeklyPlayerStateEngine. ` +
        `${result.summary?.seasonInfo?.officialParticipants || 0} ` +
        `participants and ` +
        `${result.summary?.seasonInfo?.leftPlayers || 0} LEFT players processed.`
      ),
      "fa-circle-check"
    );

    appendLog(
      "Season Info rebuild",
      "success",
      (
        `Season ${seasonNumber}: ` +
        `${result.summary?.seasonInfo?.officialParticipants || 0} ` +
        `participants rebuilt through the Weekly Player State Engine.`
      )
    );

    dispatchEvent(
      "k630:season-info-rebuilt",
      {
        seasonNumber,

        week:
          result.week ||
          null,

        summary:
          result.summary
            ?.seasonInfo ||
          {},

        outputPath:
          "assets/data/generated/season-info/current.json",

        engine:
          "K630WeeklyPlayerStateEngine"
      }
    );

    updateWorkflow();

    return result;
  } catch (error) {
    setBadge(
      "websiteUpdateStatus",
      "error",
      "Failed"
    );

    setValidation(
      "websiteUpdateValidationBox",
      "error",
      error?.message ||
      "Season Info rebuild failed.",
      "fa-circle-xmark"
    );

    appendLog(
      "Season Info rebuild",
      "error",
      error?.message ||
      "Season Info rebuild failed."
    );

    return null;
  } finally {
    setButtonEnabled(
      "rebuildSeasonInfoBtn",
      Boolean(
        canWrite() &&
        workflowState.weekData
      )
    );
  }
}

  /* =====================================================
     WEBSITE UPDATE AND ARCHIVE PLACEHOLDERS
  ===================================================== */

  function unavailableEngine(
    validationBox,
    action
  ) {
    setValidation(
      validationBox,
      "warning",
      `${action} requires its dedicated data engine. The Admin Center connection is ready, but the engine has not been added yet.`,
      "fa-triangle-exclamation"
    );
  }

  async function rebuildPage(event) {
  const buttonId =
    event?.currentTarget?.id ||
    "";

  const supportedButtons = [
    "rebuildHomeBtn",
    "rebuildActiveAverageBtn",
    "rebuildSeasonInfoBtn",
    "rebuildServerVsServerBtn",
    "rebuildAllWebsiteDataBtn"
  ];

  if (
    !supportedButtons.includes(
      buttonId
    )
  ) {
    unavailableEngine(
      "websiteUpdateValidationBox",
      "Website Update"
    );

    return;
  }

  const writer =
    getWriter();

  const configEngine =
    global.K630AdminConfigEngine;

  [
    "rebuildHomeBtn",
    "rebuildActiveAverageBtn",
    "rebuildSeasonInfoBtn",
    "rebuildServerVsServerBtn",
    "rebuildAllWebsiteDataBtn"
  ].forEach(id => {
    setButtonEnabled(
      id,
      false
    );
  });

  setBadge(
    "websiteUpdateStatus",
    "checking",
    "Building"
  );

  try {
    let weeklyPlayerStateResult =
      null;

    let homeResult =
      null;

    let serverVsServerResult =
      null;

    let participatingServerWeekData =
      null;

    if (
      buttonId ===
        "rebuildActiveAverageBtn" ||
      buttonId ===
        "rebuildSeasonInfoBtn" ||
      buttonId ===
        "rebuildAllWebsiteDataBtn"
    ) {
      weeklyPlayerStateResult =
        await rebuildWeeklyPlayerState();
    }

    if (
      buttonId ===
        "rebuildHomeBtn" ||
      buttonId ===
        "rebuildServerVsServerBtn" ||
      buttonId ===
        "rebuildAllWebsiteDataBtn"
    ) {
      const seasonNumber =
        Math.trunc(
          numberValue(
            selectedSeason?.season ||
            adminConfig?.season
              ?.selectedSeason
              ?.season ||
            adminConfig?.matchmaking
              ?.seasonNumber
          )
        );

      const uploadedWeeks =
        Array.isArray(
          adminConfig?.weeks
            ?.uploaded
        )
          ? adminConfig.weeks
              .uploaded
              .map(value =>
                normalizeText(value)
                  .toUpperCase()
              )
              .filter(value =>
                /^W[0-6]$/.test(value)
              )
          : [];

      const latestWeekLabel =
        normalizeText(
          adminConfig?.weeks
            ?.latestWeek
        ).toUpperCase() ||
        uploadedWeeks[
          uploadedWeeks.length - 1
        ] ||
        (
          adminConfig?.weeks
            ?.ready === true
            ? "W0"
            : ""
        );

      const weekNumber =
        /^W[0-6]$/.test(
          latestWeekLabel
        )
          ? Number(
              latestWeekLabel.replace(
                "W",
                ""
              )
            )
          : -1;

      if (
        seasonNumber <= 0 ||
        weekNumber < 0 ||
        weekNumber > 6
      ) {
        throw new Error(
          "Season or latest uploaded week is missing."
        );
      }

      participatingServerWeekData =
        await loadParticipatingServerWeekData(
          seasonNumber,
          weekNumber
        );
    }

    if (
      buttonId ===
        "rebuildHomeBtn" ||
      buttonId ===
        "rebuildAllWebsiteDataBtn"
    ) {
      homeResult =
        await rebuildHomeWeekly(
          weeklyPlayerStateResult
            ?.data
            ?.activeAverage ||
          null
        );
    }

    if (
      buttonId ===
        "rebuildServerVsServerBtn" ||
      buttonId ===
        "rebuildAllWebsiteDataBtn"
    ) {
      serverVsServerResult =
        await rebuildServerVsServerWeekly(
          participatingServerWeekData
        );
    }

    if (
      buttonId ===
      "rebuildAllWebsiteDataBtn"
    ) {
      if (
        !writer ||
        typeof writer.writeJson !==
          "function"
      ) {
        throw new Error(
          "GitHub writer is not available."
        );
      }

      if (
        !configEngine ||
        typeof configEngine
          .updateWebsiteBuild !==
          "function" ||
        typeof configEngine
          .buildFile !==
          "function"
      ) {
        throw new Error(
          "K630AdminConfigEngine website build functions are unavailable."
        );
      }

      const nextConfig =
        configEngine.updateWebsiteBuild(
          adminConfig ||
          createDefaultAdminConfig(),
          {
            ready:
              true,

            lastBuiltAt:
              nowIso()
          },
          {
            updatedAt:
              nowIso(),

            updatedBy:
              getSession()?.email ||
              getRole()
          }
        );

      const configOutput =
        configEngine.buildFile(
          nextConfig,
          {
            updatedAt:
              nowIso(),

            updatedBy:
              getSession()?.email ||
              getRole()
          }
        );

      await writer.writeJson(
        ADMIN_CONFIG_WRITE_PATH,
        configOutput.data,
        {
          repository:
            REPOSITORIES.data,

          message:
            (
              `Mark website data rebuilt for ` +
              `Season ${homeResult?.seasonNumber || ""} ` +
              `${homeResult?.week || ""}`
            )
        }
      );

      adminConfig =
        configOutput.data;

      applyAdminConfigToState();

      workflowState.websiteBuilt =
        true;
    } else {
      workflowState.websiteBuilt =
        Boolean(
          adminConfig?.websiteBuild
            ?.ready
        );
    }

    setBadge(
      "websiteUpdateStatus",
      "ready",
      "Ready"
    );

    if (
      buttonId ===
      "rebuildServerVsServerBtn"
    ) {
      setValidation(
        "websiteUpdateValidationBox",
        "success",
        (
          `Server vs Server rebuilt for ` +
          `Season ${serverVsServerResult.seasonNumber} ` +
          `${serverVsServerResult.week}. ` +
          `${serverVsServerResult.summary.serverCount} servers generated.`
        ),
        "fa-circle-check"
      );
    } else if (
      buttonId ===
      "rebuildHomeBtn"
    ) {
      setValidation(
        "websiteUpdateValidationBox",
        "success",
        (
          `Home rebuilt for Season ` +
          `${homeResult.seasonNumber} ${homeResult.week}. ` +
          `${homeResult.summary.activePlayers} players, ` +
          `${homeResult.summary.warriors} Warriors, ` +
          `${homeResult.summary.farmers} Farmers.`
        ),
        "fa-circle-check"
      );
    } else if (
      buttonId ===
      "rebuildAllWebsiteDataBtn"
    ) {
      setValidation(
        "websiteUpdateValidationBox",
        "success",
        (
          `Rebuild All completed for ` +
          `Season ${homeResult.seasonNumber} ${homeResult.week}. ` +
          `${weeklyPlayerStateResult.summary.activeAverage.totalPlayers} ` +
          `Active & Average IDs, ` +
          `${weeklyPlayerStateResult.summary.seasonInfo.officialParticipants} ` +
          `Season participants, ` +
          `${weeklyPlayerStateResult.summary.seasonInfo.leftPlayers} LEFT, ` +
          `${serverVsServerResult.summary.serverCount} servers.`
        ),
        "fa-circle-check"
      );
    } else {
      setValidation(
        "websiteUpdateValidationBox",
        "success",
        (
          `Active & Average and Season Info rebuilt for ` +
          `Season ${weeklyPlayerStateResult.seasonNumber} ` +
          `${weeklyPlayerStateResult.week}. ` +
          `${weeklyPlayerStateResult.summary.activeAverage.totalPlayers} ` +
          `Active & Average IDs, ` +
          `${weeklyPlayerStateResult.summary.seasonInfo.officialParticipants} ` +
          `Season participants, ` +
          `${weeklyPlayerStateResult.summary.seasonInfo.leftPlayers} LEFT.`
        ),
        "fa-circle-check"
      );
    }

    appendLog(
      "Website data rebuild",
      "success",
      (
        buttonId ===
          "rebuildAllWebsiteDataBtn"
          ? (
              `Season ${homeResult.seasonNumber} ${homeResult.week} ` +
              `Rebuild All completed and saved.`
            )
          : `${buttonId} completed.`
      )
    );

    dispatchEvent(
      "k630:website-data-rebuilt",
      {
        buttonId,

        weeklyPlayerState:
          weeklyPlayerStateResult
            ?.summary ||
          null,

        home:
          homeResult
            ?.summary ||
          null,

        serverVsServer:
          serverVsServerResult
            ?.summary ||
          null,

        websiteBuilt:
          workflowState.websiteBuilt
      }
    );
  } catch (error) {
    workflowState.websiteBuilt =
      false;

    setBadge(
      "websiteUpdateStatus",
      "error",
      "Failed"
    );

    setValidation(
      "websiteUpdateValidationBox",
      "error",
      error?.message ||
      "Website data rebuild failed.",
      "fa-circle-xmark"
    );

    appendLog(
      "Website data rebuild",
      "error",
      error?.message ||
      "Website data rebuild failed."
    );
  } finally {
    updateWorkflow();
  }
}

  function validateArchive() {
    unavailableEngine(
      "saveArchiveValidationBox",
      "Season Archive"
    );
  }

  /* =====================================================
     WORKFLOW
  ===================================================== */

  function updateWorkflow() {
  workflowState.seasonConfigured =
    Boolean(
      selectedSeason &&
      workflowState.matchmaking &&
      participatingServers.length > 0
    );

  const weekDataReady =
    Boolean(
      adminConfig?.weeks?.ready === true ||
      workflowState.weekData
    );

  const websiteBuiltReady =
    Boolean(
      adminConfig?.websiteBuild?.ready === true ||
      workflowState.websiteBuilt
    );

  const archiveReady =
    Boolean(
      adminConfig?.archive?.ready === true ||
      workflowState.archiveReady
    );

  workflowState.weekData =
    weekDataReady;

  workflowState.websiteBuilt =
    websiteBuiltReady;

  workflowState.archiveReady =
    archiveReady;

  const updateReady =
    Boolean(
      workflowState.githubRead &&
      workflowState.foundation &&
      workflowState.matchmaking &&
      workflowState.seasonActive &&
      weekDataReady
    );

  setBadge(
    "adminCenterSystemStatus",
    canWrite()
      ? (
          workflowState.githubRead
            ? "ready"
            : "initializing"
        )
      : "read-only",
    canWrite()
      ? (
          workflowState.githubRead
            ? "Ready"
            : "Initializing"
        )
      : "Read Only"
  );

  setBadge(
    "seasonConfigurationStatus",
    workflowState.seasonActive
      ? "ready"
      : (
          workflowState.seasonConfigured
            ? "configured"
            : "not-configured"
        ),
    workflowState.seasonActive
      ? "Active"
      : (
          workflowState.seasonConfigured
            ? "Configured"
            : "Not Configured"
        )
  );

  setBadge(
    "dataUploadStatus",
    weekDataReady
      ? "ready"
      : (
          workflowState.seasonActive
            ? "waiting"
            : "locked"
        ),
    weekDataReady
      ? "Ready"
      : (
          workflowState.seasonActive
            ? "Waiting"
            : "Locked"
        )
  );

  setBadge(
    "websiteUpdateStatus",
    updateReady
      ? "ready"
      : "locked",
    updateReady
      ? "Ready"
      : "Locked"
  );

  setBadge(
    "saveArchiveStatus",
    archiveReady
      ? "ready"
      : "locked",
    archiveReady
      ? "Ready"
      : "Locked"
  );

  setButtonEnabled(
    "activateSeasonBtn",
    canWrite() &&
    workflowState.seasonConfigured &&
    !workflowState.seasonActive
  );

  setButtonEnabled(
    "deactivateSeasonBtn",
    canWrite() &&
    workflowState.seasonActive
  );

  setButtonEnabled(
    "validateSeasonUploadBtn",
    canWrite() &&
    workflowState.seasonActive
  );

  [
    "rebuildHomeBtn",
    "rebuildActiveAverageBtn",
    "rebuildSeasonInfoBtn",
    "rebuildServerVsServerBtn",
    "rebuildAllWebsiteDataBtn"
  ].forEach(id => {
    setButtonEnabled(
      id,
      canWrite() &&
      updateReady
    );
  });

  setButtonEnabled(
    "validateSeasonArchiveBtn",
    canWrite() &&
    websiteBuiltReady
  );

  setButtonEnabled(
    "saveSeasonArchiveBtn",
    canWrite() &&
    archiveReady
  );
}

  /* =====================================================
     EVENT BINDING
  ===================================================== */

  function bindClick(
    id,
    handler
  ) {
    getElement(id)
      ?.addEventListener(
        "click",
        handler
      );
  }

  function bindChange(
    id,
    handler
  ) {
    getElement(id)
      ?.addEventListener(
        "change",
        handler
      );
  }

  function bindEvents() {
    bindClick(
      "checkGithubConnectionBtn",
      checkGitHubConnection
    );

    bindClick(
      "testGithubWriteBtn",
      testGitHubWrite
    );

    bindChange(
      "foundationFileInput",
      event => {
        selectedFoundationFile =
          event.target.files?.[0] ||
          null;

        validatedFoundationData =
          null;

        renderSelectedFile(
          "foundationSelectedFiles",
          selectedFoundationFile
        );

        setButtonEnabled(
          "saveFoundationBtn",
          false
        );
      }
    );

    bindClick(
      "validateFoundationBtn",
      validateFoundation
    );

    bindClick(
      "saveFoundationBtn",
      saveFoundation
    );

    bindClick(
      "recheckFoundationBtn",
      recheckFoundation
    );

    bindChange(
      "matchmakingSeasonNumber",
      updateMatchmakingDestination
    );

    bindChange(
      "matchmakingFileInput",
      event => {
        selectedMatchmakingFile =
          event.target.files?.[0] ||
          null;

        validatedMatchmakingData =
          null;

        renderSelectedFile(
          "matchmakingSelectedFiles",
          selectedMatchmakingFile
        );

        setButtonEnabled(
          "uploadMatchmakingBtn",
          false
        );
      }
    );

    bindClick(
      "validateMatchmakingBtn",
      validateMatchmaking
    );

    bindClick(
      "uploadMatchmakingBtn",
      uploadMatchmaking
    );

    bindClick(
      "recheckMatchmakingBtn",
      recheckMatchmaking
    );

    bindClick(
  "addSeasonToLibraryBtn",
  addSeason
);

bindClick(
  "saveMeritConfigurationBtn",
  saveMeritConfiguration
);

bindClick(
  "addParticipatingServerBtn",
  addParticipatingServer
);

    bindClick(
      "saveParticipatingServersBtn",
      saveParticipatingServers
    );

    bindClick(
      "activateSeasonBtn",
      activateSeason
    );

    bindClick(
      "deactivateSeasonBtn",
      deactivateSeason
    );

    activeRoot?.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-remove-server]"
          );

        if (!button) {
          return;
        }

        removeParticipatingServer(
          numberValue(
            button.dataset
              .removeServer
          )
        );
      }
    );

    bindChange(
      "uploadSeasonNumber",
      updateUploadDestination
    );

    bindChange(
      "uploadTypeSelect",
      updateUploadDestination
    );

    bindChange(
      "seasonDataFileInput",
      event => {
        selectedSeasonFiles =
          Array.from(
            event.target.files ||
            []
          );

        validatedSeasonFiles =
          [];

        renderSelectedFiles(
          "seasonUploadSelectedFiles",
          selectedSeasonFiles
        );

        setButtonEnabled(
          "uploadSeasonDataBtn",
          false
        );
      }
    );

    bindClick(
      "validateSeasonUploadBtn",
      validateSeasonFiles
    );

    bindClick(
      "uploadSeasonDataBtn",
      uploadSeasonFiles
    );

    [
      "rebuildHomeBtn",
      "rebuildActiveAverageBtn",
      "rebuildSeasonInfoBtn",
      "rebuildServerVsServerBtn",
      "rebuildAllWebsiteDataBtn"
    ].forEach(id => {
      bindClick(
        id,
        rebuildPage
      );
    });

    bindClick(
      "validateSeasonArchiveBtn",
      validateArchive
    );

    bindClick(
      "refreshAdminLogBtn",
      () => {
        appendLog(
          "Admin log",
          "success",
          "Admin log refreshed."
        );
      }
    );
  }

  /* =====================================================
     INITIALIZATION
  ===================================================== */

  async function init() {
  activeRoot =
    getElement(
      "adminCenter"
    );

  if (!activeRoot) {
    return false;
  }

  if (
    activeRoot.dataset
      .adminInitialized ===
    "true"
  ) {
    return true;
  }

  activeRoot.dataset
    .adminInitialized =
    "true";

  initialized =
    true;

  applyPermissions();
  bindEvents();

  const configLoaded =
    await loadAdminConfig();

  applyAdminConfigToState();

  updateMatchmakingDestination();
  updateUploadDestination();
  renderSeasonLibrary();
  renderParticipatingServers();
  updateWorkflow();

  await Promise.allSettled([
    checkGitHubConnection(),
    recheckFoundation()
  ]);

  if (
    !configLoaded ||
    !workflowState.matchmaking
  ) {
    const season =
      numberValue(
        getElement(
          "matchmakingSeasonNumber"
        )?.value
      );

    if (season > 0) {
      await recheckMatchmaking();
    }
  } else {
    setBadge(
      "matchmakingStatusBadge",
      "ready",
      "Ready"
    );

    setValidation(
      "matchmakingValidationBox",
      "success",
      (
        `Matchmaking Season ` +
        `${adminConfig.matchmaking.seasonNumber} is ready.`
      ),
      "fa-circle-check"
    );
  }

  renderSeasonLibrary();
  renderParticipatingServers();
  updateMatchmakingDestination();
  updateUploadDestination();
  updateWorkflow();

  console.info(
    `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
  );

  return true;
}

  function isReady() {
    return initialized;
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

      init,

      isReady,

      checkGitHubConnection,
      testGitHubWrite,

      recheckFoundation,
      recheckMatchmaking,

      getState() {
        return {
          ...workflowState,

          selectedSeason:
            selectedSeason
              ? {
                  ...selectedSeason
                }
              : null,

          participatingServers:
            [
              ...participatingServers
            ]
        };
      }
    });

  global.K630AdminCore =
    publicApi;
})(window);