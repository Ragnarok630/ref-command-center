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

      "websiteStatusSelect",
      "saveWebsiteStatusBtn",

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

    try {
      const data =
        await readJsonFile(
          selectedFoundationFile
        );

      const count =
        countRecords(data);

      if (
        count <=
        0
      ) {
        throw new Error(
          "The selected Foundation contains no records."
        );
      }

      validatedFoundationData =
        data;

      setText(
        "foundationValidationStatus",
        "Validated"
      );

      setText(
        "foundationPlayerCount",
        String(count)
      );

      setButtonEnabled(
        "saveFoundationBtn",
        isOwner() &&
        workflowState.githubWrite
      );

      setValidation(
        "foundationValidationBox",
        "success",
        `Foundation validated successfully with ${count} records.`,
        "fa-circle-check"
      );
    } catch (error) {
      validatedFoundationData =
        null;

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
    }
  }

  async function saveFoundation() {
    const writer =
      getWriter();

    if (
      !isOwner() ||
      !writer ||
      typeof writer.writeJson !==
        "function" ||
      !validatedFoundationData
    ) {
      return;
    }

    try {
      await writer.writeJson(
        `assets/data/${FOUNDATION_PATH}`,
        validatedFoundationData,
        {
          repository:
            REPOSITORIES.data,

          message:
            "Update permanent Kingdom 630 Foundation"
        }
      );

      workflowState.foundation =
        true;

      setValidation(
        "foundationValidationBox",
        "success",
        "The Foundation was saved to k630-public-data.",
        "fa-circle-check"
      );

      appendLog(
        "Foundation saved",
        "success",
        "The permanent Foundation was updated."
      );

      await recheckFoundation();
    } catch (error) {
      setValidation(
        "foundationValidationBox",
        "error",
        error?.message ||
        "The Foundation could not be saved.",
        "fa-circle-xmark"
      );

      appendLog(
        "Foundation save",
        "error",
        error?.message ||
        "The Foundation could not be saved."
      );
    }
  }

  /* =====================================================
     MATCHMAKING
  ===================================================== */

  function getMatchmakingPath() {
    const season =
      numberValue(
        getElement(
          "matchmakingSeasonNumber"
        )?.value
      );

    return season >
      0
      ? (
          `matchmaking/season-${season}/` +
          "matchmaking.json"
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

  async function validateMatchmaking() {
    if (!selectedMatchmakingFile) {
      setValidation(
        "matchmakingValidationBox",
        "warning",
        "Select a Matchmaking JSON file first.",
        "fa-triangle-exclamation"
      );

      return;
    }

    const season =
      numberValue(
        getElement(
          "matchmakingSeasonNumber"
        )?.value
      );

    const officialDate =
      normalizeText(
        getElement(
          "matchmakingOfficialDate"
        )?.value
      );

    if (
      season <=
        0 ||
      !officialDate
    ) {
      setValidation(
        "matchmakingValidationBox",
        "warning",
        "Enter a valid Season number and official date.",
        "fa-triangle-exclamation"
      );

      return;
    }

    try {
      const data =
        await readJsonFile(
          selectedMatchmakingFile
        );

      const count =
        countRecords(data);

      if (
        count <=
        0
      ) {
        throw new Error(
          "The Matchmaking file contains no player records."
        );
      }

      validatedMatchmakingData =
        data;

      setButtonEnabled(
        "uploadMatchmakingBtn",
        canWrite() &&
        workflowState.githubWrite
      );

      setValidation(
        "matchmakingValidationBox",
        "success",
        `Matchmaking validated successfully with ${count} records.`,
        "fa-circle-check"
      );
    } catch (error) {
      validatedMatchmakingData =
        null;

      setButtonEnabled(
        "uploadMatchmakingBtn",
        false
      );

      setValidation(
        "matchmakingValidationBox",
        "error",
        error?.message ||
        "Matchmaking validation failed.",
        "fa-circle-xmark"
      );
    }
  }

  async function uploadMatchmaking() {
    const writer =
      getWriter();

    const path =
      getMatchmakingPath();

    if (
      !canWrite() ||
      !writer ||
      typeof writer.writeJson !==
        "function" ||
      !path ||
      !validatedMatchmakingData
    ) {
      return;
    }

    try {
      await writer.writeJson(
        `assets/data/${path}`,
        validatedMatchmakingData,
        {
          repository:
            REPOSITORIES.data,

          message:
            `Upload Matchmaking for Season ${
              getElement(
                "matchmakingSeasonNumber"
              )?.value
            }`
        }
      );

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
        "Matchmaking was uploaded successfully.",
        "fa-circle-check"
      );

      appendLog(
        "Matchmaking upload",
        "success",
        "Official Matchmaking data was uploaded."
      );

      await recheckMatchmaking();
    } catch (error) {
      setValidation(
        "matchmakingValidationBox",
        "error",
        error?.message ||
        "Matchmaking upload failed.",
        "fa-circle-xmark"
      );

      appendLog(
        "Matchmaking upload",
        "error",
        error?.message ||
        "Matchmaking upload failed."
      );
    }
  }

  async function recheckMatchmaking() {
    const path =
      getMatchmakingPath();

    if (!path) {
      setValidation(
        "matchmakingValidationBox",
        "warning",
        "Enter a valid Season number first.",
        "fa-triangle-exclamation"
      );

      return;
    }

    try {
      const response =
        await fetch(
          `${DATA_ROOT}/${path}?t=${Date.now()}`,
          {
            cache:
              "no-store"
          }
        );

      if (!response.ok) {
        throw new Error(
          `Matchmaking returned HTTP ${response.status}.`
        );
      }

      const data =
        await response.json();

      const count =
        countRecords(data);

      if (
        count <=
        0
      ) {
        throw new Error(
          "The Matchmaking file contains no records."
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

  function addSeason() {
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

    if (
      year <
        2026 ||
      season <=
        0 ||
      sosNumber <=
        0 ||
      !sosName
    ) {
      return;
    }

    selectedSeason = {
      year,
      season,
      sosNumber,
      sosName
    };

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

    workflowState.seasonConfigured =
      participatingServers.length >
        0 &&
      workflowState.matchmaking;

    renderSeasonLibrary();
    updateMatchmakingDestination();
    updateUploadDestination();
    updateWorkflow();

    appendLog(
      "Season configuration",
      "success",
      `Season ${season} was selected.`
    );
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

  function saveParticipatingServers() {
    workflowState.seasonConfigured =
      Boolean(
        selectedSeason &&
        workflowState.matchmaking &&
        participatingServers.length >
          0
      );

    updateWorkflow();

    appendLog(
      "Participating servers",
      workflowState.seasonConfigured
        ? "success"
        : "error",
      workflowState.seasonConfigured
        ? `${participatingServers.length} servers registered.`
        : "Season, Matchmaking or participating servers are incomplete."
    );
  }

  function activateSeason() {
    if (
      !workflowState
        .seasonConfigured
    ) {
      return;
    }

    workflowState.seasonActive =
      true;

    setBadge(
      "seasonActivationBadge",
      "ready",
      "W0 Unlocked"
    );

    renderSeasonLibrary();
    updateWorkflow();

    dispatchEvent(
      "k630:season-updated",
      {
        season:
          selectedSeason
      }
    );

    appendLog(
      "Season activated",
      "success",
      `Season ${selectedSeason?.season} was activated.`
    );
  }

  function deactivateSeason() {
    workflowState.seasonActive =
      false;

    setBadge(
      "seasonActivationBadge",
      "locked",
      "W0 Locked"
    );

    renderSeasonLibrary();
    updateWorkflow();

    appendLog(
      "Season deactivated",
      "success",
      "The active Season was deactivated."
    );
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

    if (
      !workflowState
        .seasonActive
    ) {
      setValidation(
        "seasonUploadValidationBox",
        "warning",
        "Activate the Season before uploading weekly data.",
        "fa-lock"
      );

      return;
    }

    if (
      !getUploadPath() ||
      !officialDate ||
      selectedSeasonFiles.length ===
        0
    ) {
      setValidation(
        "seasonUploadValidationBox",
        "warning",
        "Select a Season, week, official date and source files.",
        "fa-triangle-exclamation"
      );

      return;
    }

    try {
      const results =
        [];

      for (
        const file of
        selectedSeasonFiles
      ) {
        const data =
          await readJsonFile(file);

        const count =
          countRecords(data);

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
        canWrite() &&
        workflowState.githubWrite
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

      setValidation(
        "seasonUploadValidationBox",
        "error",
        error?.message ||
        "Weekly file validation failed.",
        "fa-circle-xmark"
      );
    }
  }

  async function uploadSeasonFiles() {
    const writer =
      getWriter();

    const path =
      getUploadPath();

    if (
      !writer ||
      typeof writer.writeJson !==
        "function" ||
      !path ||
      validatedSeasonFiles.length ===
        0
    ) {
      return;
    }

    try {
      for (
        const entry of
        validatedSeasonFiles
      ) {
        await writer.writeJson(
          (
            `assets/data/${path}` +
            entry.file.name
          ),
          entry.data,
          {
            repository:
              REPOSITORIES.data,

            message:
              `Upload ${
                getElement(
                  "uploadTypeSelect"
                )?.value
              } Season data`
          }
        );
      }

      workflowState.weekData =
        true;

      setBadge(
        "dataUploadStatus",
        "ready",
        "Uploaded"
      );

      setValidation(
        "seasonUploadValidationBox",
        "success",
        `${validatedSeasonFiles.length} weekly files were uploaded.`,
        "fa-circle-check"
      );

      appendLog(
        "Weekly upload",
        "success",
        `${validatedSeasonFiles.length} source files were uploaded.`
      );
    } catch (error) {
      appendLog(
        "Weekly upload",
        "error",
        error?.message ||
        "Weekly data upload failed."
      );

      setValidation(
        "seasonUploadValidationBox",
        "error",
        error?.message ||
        "Weekly data upload failed.",
        "fa-circle-xmark"
      );
    }

    updateWorkflow();
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

  function rebuildPage() {
    unavailableEngine(
      "websiteUpdateValidationBox",
      "Website Update"
    );
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
        participatingServers.length >
          0
      );

    const updateReady =
      Boolean(
        workflowState.githubRead &&
        workflowState.githubWrite &&
        workflowState.foundation &&
        workflowState.matchmaking &&
        workflowState.seasonActive &&
        workflowState.weekData
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
            workflowState
              .seasonConfigured
              ? "configured"
              : "not-configured"
          ),
      workflowState.seasonActive
        ? "Active"
        : (
            workflowState
              .seasonConfigured
              ? "Configured"
              : "Not Configured"
          )
    );

    setBadge(
      "dataUploadStatus",
      workflowState.seasonActive
        ? "ready"
        : "waiting",
      workflowState.seasonActive
        ? "Ready"
        : "Waiting"
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
      workflowState.archiveReady
        ? "ready"
        : "locked",
      workflowState.archiveReady
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
      workflowState.websiteBuilt
    );

    setButtonEnabled(
      "saveSeasonArchiveBtn",
      canWrite() &&
      workflowState.archiveReady
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

    updateMatchmakingDestination();
    updateUploadDestination();
    renderSeasonLibrary();
    renderParticipatingServers();
    updateWorkflow();

    await Promise.allSettled([
      checkGitHubConnection(),
      recheckFoundation()
    ]);

    const season =
      numberValue(
        getElement(
          "matchmakingSeasonNumber"
        )?.value
      );

    if (
      season >
      0
    ) {
      await recheckMatchmaking();
    }

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