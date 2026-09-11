/* =========================================================
   KINGDOM 630 – DRAGON COMMAND CENTER

   File:
   assets/js/pages/afk-service.js

   Version:
   630.2.3

   Purpose:
   - AFK Service player lookup
   - Use ONLY current Season Info players
   - Never use the general Player ID Engine
   - Never use old players, foundation or historical data
========================================================= */

(function initializeK630AfkService(global) {
  "use strict";

  const MODULE_NAME =
    "K630 AFK Service";

  const MODULE_VERSION =
    "630.2.3";

  const SEASON_INFO_URL =
    "https://raw.githubusercontent.com/" +
    "Ragnarok630/k630-public-data/main/assets/data/" +
    "generated/season-info/current.json";

  const EDGE_FUNCTION_URL =
    "https://umkdgzawpgoltgpmcumh.supabase.co/functions/v1/afk-request"; 

  const ELEMENT_IDS =
    Object.freeze({
      page:
        "afkServicePage",

      searchInput:
        "afkPlayerSearchInput",

      searchButton:
        "afkPlayerSearchButton",

      clearButton:
        "afkPlayerSearchClearButton",

      results:
        "afkPlayerSearchResults",

      message:
        "afkPlayerSearchMessage",

      selected:
        "afkSelectedPlayer",

      selectedName:
        "afkSelectedPlayerName",

      selectedMeta:
        "afkSelectedPlayerMeta",

      selectedRemove:
        "afkSelectedPlayerRemoveButton"
    });

  let initializedPage = null;
  let players = [];
  let selectedPlayer = null;

  let searchInput = null;
  let searchButton = null;
  let clearButton = null;
  let results = null;
  let message = null;
  let selected = null;
  let selectedName = null;
  let selectedMeta = null;
  let selectedRemove = null;

  let listenersBound = false;
  let loading = false;
  let searchTimer = null;
  let submitting = false;

  function normalizeText(value) {
    return String(
      value ?? ""
    ).trim();
  }

  function normalizeLower(value) {
    return normalizeText(value)
      .toLowerCase();
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

  function getElement(id) {
    return document.getElementById(id);
  }

  function getPlayerId(player) {
    return normalizeText(
      player?.id ??
      player?.playerId ??
      player?.player_id
    );
  }

  function getPlayerName(player) {
    return normalizeText(
      player?.name ??
      player?.playerName ??
      player?.player_name
    ) || "-";
  }

  function getPlayerServer(player) {
    return normalizeText(
      player?.server ??
      player?.serverId ??
      player?.server_id
    );
  }

  function getPlayerAlliance(player) {
    return normalizeText(
      player?.alliance ??
      player?.allianceName ??
      player?.alliance_name
    );
  }

  function normalizeSeasonPlayer(player) {
    if (
      !player ||
      typeof player !== "object"
    ) {
      return null;
    }

    const id =
      getPlayerId(player);

    if (!id) {
      return null;
    }

    return {
      source:
        player,

      id,

      name:
        getPlayerName(player),

      server:
        getPlayerServer(player),

      alliance:
        getPlayerAlliance(player)
    };
  }

  function normalizeSeasonInfo(payload) {
    if (
      !payload ||
      typeof payload !== "object"
    ) {
      throw new Error(
        "Current Season Info data is invalid."
      );
    }

    if (
      !Array.isArray(
        payload.players
      )
    ) {
      throw new Error(
        "Current Season Info contains no player list."
      );
    }

    return payload.players
      .map(
        normalizeSeasonPlayer
      )
      .filter(Boolean);
  }

  async function loadCurrentSeasonPlayers() {
    const response =
      await fetch(
        `${SEASON_INFO_URL}?t=${Date.now()}`,
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

    if (!response.ok) {
      throw new Error(
        `Current Season Info could not be loaded (HTTP ${response.status}).`
      );
    }

    const payload =
      await response.json();

    return normalizeSeasonInfo(
      payload
    );
  }

  function setMessage(
    text,
    type = ""
  ) {
    if (!message) {
      return;
    }

    const cleanText =
      normalizeText(text);

    message.textContent =
      cleanText;

    message.hidden =
      !cleanText;

    message.dataset.state =
      type || "";
  }

  function hideResults() {
    if (!results) {
      return;
    }

    results.innerHTML =
      "";

    results.hidden =
      true;

    if (searchInput) {
      searchInput.setAttribute(
        "aria-expanded",
        "false"
      );
    }
  }

  function showResults() {
    if (!results) {
      return;
    }

    results.hidden =
      false;

    if (searchInput) {
      searchInput.setAttribute(
        "aria-expanded",
        "true"
      );
    }
  }

  function buildPlayerMeta(player) {
    const parts = [
      `ID: ${player.id}`
    ];

    if (player.server) {
      parts.push(
        `Server: ${player.server}`
      );
    }

    if (player.alliance) {
      parts.push(
        `Alliance: ${player.alliance}`
      );
    }

    return parts.join(
      " • "
    );
  }

  function renderResults(matches) {
    if (!results) {
      return;
    }

    if (!matches.length) {
      results.innerHTML =
        "";

      showResults();

      setMessage(
        "No participating player was found in the current Season Info.",
        "error"
      );

      return;
    }

    results.innerHTML =
      matches
        .map(
          (player, index) => {
            return `
              <button
                type="button"
                class="afk-service-search-result"
                role="option"
                aria-selected="false"
                data-afk-player-index="${index}"
              >
                <span
                  class="afk-service-search-result__main"
                >
                  <span
                    class="afk-service-search-result__name"
                  >
                    ${escapeHtml(player.name)}
                  </span>

                  <span
                    class="afk-service-search-result__meta"
                  >
                    ${escapeHtml(
                      buildPlayerMeta(player)
                    )}
                  </span>
                </span>

                <span
                  class="afk-service-search-result__select"
                >
                  Select
                </span>
              </button>
            `;
          }
        )
        .join("");

    results._k630Matches =
      matches;

    showResults();

    setMessage("");
  }

function renderSuggestions(query) {
  if (
    !searchInput ||
    !players.length
  ) {
    return;
  }

  const normalizedQuery =
    normalizeLower(query);

  if (
    normalizedQuery.length < 2
  ) {
    hideResults();
    return;
  }

  const matches =
    players
      .filter(
        player => {
          return (
            normalizeLower(
              player.id
            ).includes(
              normalizedQuery
            ) ||
            normalizeLower(
              player.name
            ).includes(
              normalizedQuery
            )
          );
        }
      )
      .slice(
        0,
        20
      );

  renderResults(
    matches
  );
}

function handleSearchInput() {
  if (!searchInput) {
    return;
  }

  if (searchTimer) {
    clearTimeout(
      searchTimer
    );
  }

  const query =
    searchInput.value;

  if (
    normalizeLower(query).length < 2
  ) {
    hideResults();
    setMessage("");
    return;
  }

  setMessage("");

  searchTimer =
    setTimeout(
      () => {
        renderSuggestions(
          query
        );
      },
      80
    );
}

function renderSuggestions(query) {
  if (
    !searchInput ||
    !players.length
  ) {
    return;
  }

  const normalizedQuery =
    normalizeLower(query);

  if (
    normalizedQuery.length < 2
  ) {
    hideResults();
    return;
  }

  const matches =
    players
      .filter(
        player => {
          return (
            normalizeLower(
              player.id
            ).includes(
              normalizedQuery
            ) ||
            normalizeLower(
              player.name
            ).includes(
              normalizedQuery
            )
          );
        }
      )
      .slice(
        0,
        20
      );

  renderResults(
    matches
  );
}

function handleSearchInput() {
  if (!searchInput) {
    return;
  }

  if (searchTimer) {
    clearTimeout(
      searchTimer
    );
  }

  const query =
    searchInput.value;

  if (
    normalizeLower(query).length < 2
  ) {
    hideResults();
    setMessage("");
    return;
  }

  setMessage("");

  searchTimer =
    setTimeout(
      () => {
        renderSuggestions(
          query
        );
      },
      80
    );
}

  function searchPlayers() {
    if (
      !searchInput ||
      !players.length
    ) {
      return;
    }

    const query =
      normalizeLower(
        searchInput.value
      );

    hideResults();

    if (!query) {
      setMessage(
        "Enter a Player ID or Player Name.",
        "error"
      );

      return;
    }

    const matches =
      players
        .filter(
          player => {
            return (
              normalizeLower(
                player.id
              ).includes(query) ||
              normalizeLower(
                player.name
              ).includes(query)
            );
          }
        )
        .slice(
          0,
          20
        );

    renderResults(
      matches
    );
  }

  function selectPlayer(player) {
    if (!player) {
      return;
    }

    selectedPlayer =
      player;

    if (searchInput) {
      searchInput.value =
        player.name;

      searchInput.setAttribute(
        "aria-expanded",
        "false"
      );

      searchInput.dataset.playerId =
        player.id;
    }

    if (selectedName) {
      selectedName.textContent =
        player.name;
    }

    if (selectedMeta) {
      selectedMeta.textContent =
        buildPlayerMeta(
          player
        );
    }

    if (selected) {
      selected.hidden =
        false;

      selected.dataset.playerId =
        player.id;
    }

    if (clearButton) {
      clearButton.hidden =
        false;
    }

    if (searchInput) {
      searchInput.removeAttribute(
        "aria-invalid"
      );
    }

    hideResults();

    setMessage("");

    const form =
      getElement(
        "afkServiceForm"
      );

    if (form) {
      form.dataset.playerId =
        player.id;

      form.dataset.playerName =
        player.name;
    }
  }

  function clearPlayerSelection() {
    selectedPlayer =
      null;

    if (searchInput) {
      searchInput.value =
        "";

      delete searchInput.dataset
        .playerId;

      searchInput.setAttribute(
        "aria-expanded",
        "false"
      );
    }

    if (selected) {
      selected.hidden =
        true;

      delete selected.dataset
        .playerId;
    }

    if (selectedName) {
      selectedName.textContent =
        "-";
    }

    if (selectedMeta) {
      selectedMeta.textContent =
        "-";
    }

    if (clearButton) {
      clearButton.hidden =
        true;
    }

    const form =
      getElement(
        "afkServiceForm"
      );

    if (form) {
      delete form.dataset
        .playerId;

      delete form.dataset
        .playerName;
    }

    hideResults();

    setMessage("");
  }

async function submitAfkRequest(event) {
  event.preventDefault();

  if (submitting) {
    return;
  }

  const form =
    getElement(
      "afkServiceForm"
    );

  if (!form) {
    return;
  }

  if (!selectedPlayer) {
    setMessage(
      "Select a participating player first.",
      "error"
    );

    return;
  }

  const reasonInput =
    document.querySelector(
      'input[name="afkReason"]:checked'
    );

  const weekInputs =
    Array.from(
      document.querySelectorAll(
        'input[name="afkWeeks"]:checked'
      )
    );

  const reason =
    normalizeText(
      reasonInput?.value
    );

  const weeks =
    weekInputs
      .map(
        input =>
          Number(
            input.value
          )
      )
      .filter(
        week =>
          Number.isInteger(
            week
          ) &&
          week >= 0 &&
          week <= 6
      );

  const note =
    normalizeText(
      getElement(
        "afkNoteInput"
      )?.value
    );

  const website =
    normalizeText(
      getElement(
        "afkWebsiteInput"
      )?.value
    );

  if (!reason) {
    setMessage(
      "Select your reason for being AFK.",
      "error"
    );

    return;
  }

  if (!weeks.length) {
    setMessage(
      "Select at least one AFK week.",
      "error"
    );

    return;
  }

  submitting =
    true;

  const submitButton =
    getElement(
      "afkSubmitButton"
    );

  const submitNormal =
    getElement(
      "afkSubmitButtonNormal"
    );

  const submitLoading =
    getElement(
      "afkSubmitButtonLoading"
    );

  const submitMessage =
    getElement(
      "afkSubmitMessage"
    );

  if (submitButton) {
    submitButton.disabled =
      true;
  }

  if (submitNormal) {
    submitNormal.hidden =
      true;
  }

  if (submitLoading) {
    submitLoading.hidden =
      false;
  }

  if (submitMessage) {
    submitMessage.textContent =
      "Sending your AFK request...";
    submitMessage.hidden =
      false;
  }

  try {
    const response =
      await fetch(
        EDGE_FUNCTION_URL,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json"
          },

          body:
            JSON.stringify({
              action:
                "create",

              playerId:
                selectedPlayer.id,

              playerName:
                selectedPlayer.name,

              reason,

              weeks,

              note,

              seasonNumber:
                null,

              seasonLabel:
                "",

              website
            })
        }
      );

    let result =
      null;

    try {
      result =
        await response.json();
    } catch (error) {
      result =
        null;
    }

    if (
      !response.ok ||
      result?.success ===
        false
    ) {
      throw new Error(
        result?.message ||
        result?.error ||
        `AFK request failed (HTTP ${response.status}).`
      );
    }

    const requestId =
      normalizeText(
        result?.requestId
      );

    const serviceForm =
      getElement(
        "afkServiceForm"
      );

    const successPanel =
      getElement(
        "afkServiceSuccess"
      );

    if (serviceForm) {
      serviceForm.hidden =
        true;
    }

    if (successPanel) {
      successPanel.hidden =
        false;
    }

    const successPlayer =
      getElement(
        "afkSuccessPlayer"
      );

    const successReason =
      getElement(
        "afkSuccessReason"
      );

    const successWeeks =
      getElement(
        "afkSuccessWeeks"
      );

    const successRequestId =
      getElement(
        "afkSuccessRequestId"
      );

    if (successPlayer) {
      successPlayer.textContent =
        selectedPlayer.name;
    }

    if (successReason) {
      successReason.textContent =
        reason;
    }

    if (successWeeks) {
      successWeeks.textContent =
        weeks
          .map(
            week =>
              `W${week}`
          )
          .join(", ");
    }

    if (successRequestId) {
      successRequestId.textContent =
        requestId ||
        "-";
    }
  } catch (error) {
    console.error(
      `[${MODULE_NAME}] AFK request submission failed.`,
      error
    );

    if (submitMessage) {
      submitMessage.textContent =
        error?.message ||
        "The AFK request could not be sent.";
      submitMessage.hidden =
        false;
    }

    setMessage(
      error?.message ||
        "The AFK request could not be sent.",
      "error"
    );
  } finally {
    submitting =
      false;

    if (submitButton) {
      submitButton.disabled =
        false;
    }

    if (submitNormal) {
      submitNormal.hidden =
        false;
    }

    if (submitLoading) {
      submitLoading.hidden =
        true;
    }
  }
}

  function bindEvents() {
    if (listenersBound) {
      return;
    }

        const form =
      getElement(
        "afkServiceForm"
      );

    if (form) {
      form.addEventListener(
        "submit",
        submitAfkRequest
      );
    }

    if (
      !searchInput ||
      !searchButton ||
      !clearButton ||
      !results ||
      !selectedRemove
    ) {
      return;
    }

    listenersBound =
      true;

    searchButton.addEventListener(
      "click",
      searchPlayers
    );

    searchInput.addEventListener(
  "input",
  handleSearchInput
);

searchInput.addEventListener(
  "keydown",
  event => {
    if (
      event.key ===
      "Enter"
    ) {
      event.preventDefault();
      searchPlayers();
    }

    if (
      event.key ===
      "Escape"
    ) {
      hideResults();
    }
  }
);

    clearButton.addEventListener(
      "click",
      clearPlayerSelection
    );

    selectedRemove.addEventListener(
      "click",
      clearPlayerSelection
    );

    results.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-afk-player-index]"
          );

        if (!button) {
          return;
        }

        const index =
          Number(
            button.dataset
              .afkPlayerIndex
          );

        const matches =
          Array.isArray(
            results._k630Matches
          )
            ? results._k630Matches
            : [];

        if (
          !Number.isInteger(index) ||
          !matches[index]
        ) {
          return;
        }

        selectPlayer(
          matches[index]
        );
      }
    );

    document.addEventListener(
      "click",
      event => {
        if (
          !results ||
          results.hidden
        ) {
          return;
        }

        if (
          event.target.closest(
            "#afkPlayerSearchInput"
          ) ||
          event.target.closest(
            "#afkPlayerSearchButton"
          ) ||
          event.target.closest(
            "#afkPlayerSearchResults"
          )
        ) {
          return;
        }

        hideResults();
      }
    );
  }

  function resolveElements(page) {
    searchInput =
      page.querySelector(
        `#${ELEMENT_IDS.searchInput}`
      );

    searchButton =
      page.querySelector(
        `#${ELEMENT_IDS.searchButton}`
      );

    clearButton =
      page.querySelector(
        `#${ELEMENT_IDS.clearButton}`
      );

    results =
      page.querySelector(
        `#${ELEMENT_IDS.results}`
      );

    message =
      page.querySelector(
        `#${ELEMENT_IDS.message}`
      );

    selected =
      page.querySelector(
        `#${ELEMENT_IDS.selected}`
      );

    selectedName =
      page.querySelector(
        `#${ELEMENT_IDS.selectedName}`
      );

    selectedMeta =
      page.querySelector(
        `#${ELEMENT_IDS.selectedMeta}`
      );

    selectedRemove =
      page.querySelector(
        `#${ELEMENT_IDS.selectedRemove}`
      );
  }

  async function initialize() {
    const page =
      getElement(
        ELEMENT_IDS.page
      );

    if (!page) {
      return false;
    }

    if (
      initializedPage ===
      page
    ) {
      return true;
    }

    initializedPage =
      page;

    listenersBound =
      false;

    selectedPlayer =
      null;

    players =
      [];

    resolveElements(
      page
    );

    if (
      !searchInput ||
      !searchButton ||
      !clearButton ||
      !results ||
      !message ||
      !selected ||
      !selectedName ||
      !selectedMeta ||
      !selectedRemove
    ) {
      console.error(
        `[${MODULE_NAME}] Required AFK Service elements are missing.`
      );

      return false;
    }

    bindEvents();

    if (loading) {
      return true;
    }

    loading =
      true;

    setMessage(
      "Loading current Season Info players...",
      "loading"
    );

    try {
      players =
        await loadCurrentSeasonPlayers();

      setMessage("");

      console.info(
        `[${MODULE_NAME}] ${players.length} current-season participants loaded.`
      );

      return true;
    } catch (error) {
      players =
        [];

      setMessage(
        error?.message ||
        "Current Season Info could not be loaded.",
        "error"
      );

      console.error(
        `[${MODULE_NAME}]`,
        error
      );

      return false;
    } finally {
      loading =
        false;
    }
  }

  function destroy() {
  if (searchTimer) {
    clearTimeout(
      searchTimer
    );

    searchTimer =
      null;
  }

    submitting =
    false;

  initializedPage =
    null;

    players =
      [];

    selectedPlayer =
      null;

    searchInput =
      null;

    searchButton =
      null;

    clearButton =
      null;

    results =
      null;

    message =
      null;

    selected =
      null;

    selectedName =
      null;

    selectedMeta =
      null;

    selectedRemove =
      null;

    listenersBound =
      false;

    loading =
      false;
  }

  const publicApi =
    Object.freeze({
      name:
        MODULE_NAME,

      version:
        MODULE_VERSION,

      initialize,

      destroy,

      getSelectedPlayer() {
        return selectedPlayer;
      },

      getPlayers() {
        return players.slice();
      }
    });

  global.K630AfkServicePage =
  Object.freeze({
    init:
      initialize,

    render:
      initialize,

    destroy,

    getSelectedPlayer() {
      return selectedPlayer;
    },

    getPlayers() {
      return players.slice();
    }
  });

  function startPageObserver() {
    const content =
      getElement(
        "app-content"
      );

    if (!content) {
      return;
    }

    const observer =
      new MutationObserver(
        () => {
          const page =
            getElement(
              ELEMENT_IDS.page
            );

          if (page) {
            initialize();
          } else if (
            initializedPage
          ) {
            destroy();
          }
        }
      );

    observer.observe(
      content,
      {
        childList:
          true,

        subtree:
          true
      }
    );

    const page =
      getElement(
        ELEMENT_IDS.page
      );

    if (page) {
      initialize();
    }
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      startPageObserver,
      {
        once:
          true
      }
    );
  } else {
    startPageObserver();
  }

  console.info(
    `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
  );
})(window);