/* =========================================================
   K630-REF SEASON INFO PAGE
   File: assets/js/pages/season-info.js
   Version: 630.1.0 Gold Master
========================================================= */

(function initializeSeasonInfoModule(global) {
  "use strict";

  const MODULE_NAME =
    "K630 Season Info Page";

  const MODULE_VERSION =
    "630.1.0";

  const DATA_PATH =
    "generated/season-info/current.json";

  const WEEK_NUMBERS =
    Object.freeze([
      0,
      1,
      2,
      3,
      4,
      5,
      6
    ]);

  let seasonData =
    null;

  let allPlayers =
    [];

  let visiblePlayers =
    [];

  let activePlayerFilter =
    "all";

  let activeSort =
    null;

  let initializedPage =
    null;

  let removeListeners =
    [];

  let scrollLock =
    false;

  /* =====================================================
     BASIC HELPERS
  ===================================================== */

  function getElement(id) {
    return document.getElementById(id);
  }

  function normalizeText(value) {
    return String(
      value ?? ""
    ).trim();
  }

  function numberValue(value) {
    const parsed =
      Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function integerValue(value) {
    return Math.trunc(
      numberValue(value)
    );
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
        "\"",
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );
  }

  function formatNumber(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    const number =
      Number(value);

    if (!Number.isFinite(number)) {
      return "-";
    }

    return Math.trunc(number)
      .toLocaleString(
        "en-US"
      );
  }

  function formatPercentage(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    const number =
      Number(value);

    if (!Number.isFinite(number)) {
      return "-";
    }

    return (
      `${number.toFixed(2)}%`
    );
  }

  function createCacheBustUrl(url) {
    const separator =
      url.includes("?")
        ? "&"
        : "?";

    return (
      `${url}${separator}` +
      `cacheBust=${Date.now()}`
    );
  }

  function getDataRoot() {
    const configuredRoot =
      global.K630Paths
        ?.DATA_ROOT ||
      global.K630Paths
        ?.dataRoot ||
      global.K630_DATA_ROOT ||
      global.DATA_ROOT ||
      "";

    if (configuredRoot) {
      return normalizeText(
        configuredRoot
      ).replace(
        /\/+$/,
        ""
      );
    }

    return (
      "https://raw.githubusercontent.com/" +
      "Ragnarok630/k630-public-data/main/assets/data"
    );
  }

  function getDataUrl() {
    return (
      `${getDataRoot()}/${DATA_PATH}`
    );
  }

  function addListener(
    element,
    eventName,
    handler,
    options
  ) {
    if (!element) {
      return;
    }

    element.addEventListener(
      eventName,
      handler,
      options
    );

    removeListeners.push(
      () => {
        element.removeEventListener(
          eventName,
          handler,
          options
        );
      }
    );
  }

  function clearListeners() {
    removeListeners.forEach(
      removeListener => {
        try {
          removeListener();
        } catch (error) {
          console.warn(
            `[${MODULE_NAME}] Listener cleanup failed.`,
            error
          );
        }
      }
    );

    removeListeners =
      [];
  }

  /* =====================================================
     DATA LOADING
  ===================================================== */

  async function loadSeasonData() {
  const response =
    await fetch(
      createCacheBustUrl(
        getDataUrl()
      ),
      {
        method:
          "GET",

        cache:
          "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      (
        `Season Info data returned HTTP ` +
        `${response.status}.`
      )
    );
  }

  const data =
    await response.json();

  if (
    !data ||
    !Array.isArray(
      data.players
    )
  ) {
    throw new Error(
      "Season Info data contains no players array."
    );
  }

  return data;
}

  /* =====================================================
     PLAYER NORMALIZATION
  ===================================================== */

  function normalizeWeek(
    player,
    weekNumber
  ) {
    const weekKey =
      `W${weekNumber}`;

    const source =
      player?.weeks?.[weekKey] ||
      {};

    return {
      week:
        weekNumber,

      available:
        source.available ===
        true,

      merits:
        source.merits ===
          null ||
        source.merits ===
          undefined
          ? null
          : integerValue(
              source.merits
            ),

      meritPowerPercentage:
        source
          .meritPowerPercentage ===
          null ||
        source
          .meritPowerPercentage ===
          undefined
          ? null
          : numberValue(
              source
                .meritPowerPercentage
            ),

      currentPower:
        source.currentPower ===
          null ||
        source.currentPower ===
          undefined
          ? null
          : integerValue(
              source.currentPower
            ),

      rank:
        source.rank ===
          null ||
        source.rank ===
          undefined
          ? null
          : integerValue(
              source.rank
            )
    };
  }

  function normalizePlayer(
    player,
    sourceIndex
  ) {
    const notes =
      Array.isArray(
        player.notes
      )
        ? player.notes
            .map(
              normalizeText
            )
            .filter(Boolean)
        : [];

    const noteFlags = {
      new:
        player.noteFlags?.new ===
          true ||
        notes.includes("new"),

      left:
        player.noteFlags?.left ===
          true ||
        notes.includes("left"),

      afk:
        player.noteFlags?.afk ===
          true ||
        notes.includes("afk")
    };

    const normalizedWeeks =
      {};

    WEEK_NUMBERS.forEach(
      weekNumber => {
        normalizedWeeks[
          `W${weekNumber}`
        ] =
          normalizeWeek(
            player,
            weekNumber
          );
      }
    );

    return {
      sourceIndex,

      index:
        integerValue(
          player.index
        ) ||
        sourceIndex + 1,

      id:
        normalizeText(
          player.id
        ),

      name:
        normalizeText(
          player.name
        ),

      alliance:
        normalizeText(
          player.alliance
        ),

      troopTier:
        normalizeText(
          player.troopTier
        ) ||
        "T4",

      playerType:
        normalizeText(
          player.playerType
        ).toLowerCase() ===
          "warrior"
          ? "warrior"
          : "farmer",

      historicalPower:
        integerValue(
          player.historicalPower
        ),

      serverStatus:
        normalizeText(
          player.serverStatus
        ) ||
        "LV2",

      serverStatusColor:
        normalizeText(
          player.serverStatusColor
        ) ||
        "green",

      dateJoinKingdom:
        normalizeText(
          player.dateJoinKingdom
        ),

      active:
        player.active !==
        false,

      notes,

      noteFlags,

      weeks:
        normalizedWeeks
    };
  }

  /* =====================================================
     NOTE SYMBOLS
  ===================================================== */

  function buildNoteHtml(player) {
    const symbols =
      [];

    if (
      player.noteFlags.new
    ) {
      symbols.push(
        `
          <span
            class="si-note-symbol si-note-symbol--new"
            title="New Kingdom 630 member"
            aria-label="New Kingdom 630 member"
          >
            <i class="fa-solid fa-user-plus"></i>
          </span>
        `
      );
    }

    if (
      player.noteFlags.left
    ) {
      symbols.push(
        `
          <span
            class="si-note-symbol si-note-symbol--left"
            title="Left during the Season"
            aria-label="Left during the Season"
          >
            <i class="fa-solid fa-triangle-exclamation"></i>
          </span>
        `
      );
    }

    if (
      player.noteFlags.afk
    ) {
      symbols.push(
        `
          <span
            class="si-note-symbol si-note-symbol--afk"
            title="Approved AFK status"
            aria-label="Approved AFK status"
          >
            <i class="fa-solid fa-bed"></i>
          </span>
        `
      );
    }

    if (
      symbols.length ===
      0
    ) {
      return "";
    }

    return (
      `<div class="si-note-symbols">` +
      symbols.join("") +
      `</div>`
    );
  }

  /* =====================================================
     FILTERING AND SORTING
  ===================================================== */

  function getFilteredPlayers() {
    if (
      activePlayerFilter ===
      "warriors"
    ) {
      return allPlayers.filter(
        player =>
          player.playerType ===
          "warrior"
      );
    }

    if (
      activePlayerFilter ===
      "farmers"
    ) {
      return allPlayers.filter(
        player =>
          player.playerType ===
          "farmer"
      );
    }

    return [
      ...allPlayers
    ];
  }

  function getSortValue(
    player,
    sort
  ) {
    const week =
      player.weeks[
        `W${sort.week}`
      ];

    if (!week) {
      return null;
    }

    if (
      sort.metric ===
      "merits"
    ) {
      return week.merits;
    }

    if (
      sort.metric ===
      "percent"
    ) {
      return (
        week
          .meritPowerPercentage
      );
    }

    if (
      sort.metric ===
      "power"
    ) {
      return (
        week.currentPower
      );
    }

    if (
      sort.metric ===
      "rank"
    ) {
      return week.rank;
    }

    return null;
  }

  function sortPlayers(players) {
    const result =
      [
        ...players
      ];

    if (
      !activeSort ||
      !activeSort.direction
    ) {
      return result.sort(
        (
          first,
          second
        ) => {
          return (
            first.sourceIndex -
            second.sourceIndex
          );
        }
      );
    }

    const directionMultiplier =
      activeSort.direction ===
      "asc"
        ? 1
        : -1;

    return result.sort(
      (
        first,
        second
      ) => {
        const firstValue =
          getSortValue(
            first,
            activeSort
          );

        const secondValue =
          getSortValue(
            second,
            activeSort
          );

        const firstEmpty =
          firstValue ===
            null ||
          firstValue ===
            undefined ||
          !Number.isFinite(
            Number(firstValue)
          );

        const secondEmpty =
          secondValue ===
            null ||
          secondValue ===
            undefined ||
          !Number.isFinite(
            Number(secondValue)
          );

        if (
          firstEmpty &&
          secondEmpty
        ) {
          return (
            first.sourceIndex -
            second.sourceIndex
          );
        }

        if (firstEmpty) {
          return 1;
        }

        if (secondEmpty) {
          return -1;
        }

        const comparison =
          (
            Number(firstValue) -
            Number(secondValue)
          ) *
          directionMultiplier;

        if (comparison !== 0) {
          return comparison;
        }

        return (
          first.sourceIndex -
          second.sourceIndex
        );
      }
    );
  }

  function updateVisiblePlayers() {
    visiblePlayers =
      sortPlayers(
        getFilteredPlayers()
      );
  }

  /* =====================================================
     TABLE RENDERING
  ===================================================== */

  function buildBaseRow(
    player,
    visibleIndex
  ) {
    return `
      <tr data-player-id="${escapeHtml(player.id)}">

        <td>
          ${visibleIndex + 1}
        </td>

        <td class="si-player-id">
          ${escapeHtml(player.id)}
        </td>

        <td class="si-player-name">
          ${escapeHtml(player.name)}
        </td>

        <td class="si-player-alliance">
          ${escapeHtml(player.alliance)}
        </td>

        <td>
          <span
            class="
              si-tier-badge
              si-tier-badge--${escapeHtml(
                player.troopTier.toLowerCase()
              )}
            "
          >
            ${escapeHtml(player.troopTier)}
          </span>
        </td>

        <td class="si-note-cell">
          ${buildNoteHtml(player)}
        </td>

        <td class="si-historical-power">
          ${formatNumber(player.historicalPower)}
        </td>

      </tr>
    `;
  }

  function buildWeekZeroCells(
    player
  ) {
    const week =
      player.weeks.W0;

    return `
      <td class="si-week-zero-column">
        ${
          week.available
            ? formatNumber(
                week.merits
              )
            : "-"
        }
      </td>

      <td class="si-week-zero-column">
        ${
          week.available
            ? formatNumber(
                week.currentPower
              )
            : "-"
        }
      </td>
    `;
  }

  function buildRegularWeekCells(
    player,
    weekNumber
  ) {
    const week =
      player.weeks[
        `W${weekNumber}`
      ];

    if (
      !week ||
      !week.available
    ) {
      return `
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
      `;
    }

    return `
      <td>
        ${formatNumber(week.merits)}
      </td>

      <td>
        ${
          formatPercentage(
            week
              .meritPowerPercentage
          )
        }
      </td>

      <td>
        ${formatNumber(week.currentPower)}
      </td>

      <td>
        ${
          week.rank ===
            null
            ? "-"
            : formatNumber(
                week.rank
              )
        }
      </td>
    `;
  }

  function buildWeeksRow(
    player
  ) {
    return `
      <tr data-player-id="${escapeHtml(player.id)}">

        ${buildWeekZeroCells(player)}

        ${buildRegularWeekCells(
          player,
          1
        )}

        ${buildRegularWeekCells(
          player,
          2
        )}

        ${buildRegularWeekCells(
          player,
          3
        )}

        ${buildRegularWeekCells(
          player,
          4
        )}

        ${buildRegularWeekCells(
          player,
          5
        )}

        ${buildRegularWeekCells(
          player,
          6
        )}

      </tr>
    `;
  }

  function renderEmptyState(
    message
  ) {
    const baseBody =
      getElement(
        "siBaseBody"
      );

    const weeksBody =
      getElement(
        "siWeeksBody"
      );

    if (baseBody) {
      baseBody.innerHTML = `
        <tr>
          <td
            colspan="7"
            class="si-empty"
          >
            ${escapeHtml(message)}
          </td>
        </tr>
      `;
    }

    if (weeksBody) {
      weeksBody.innerHTML = `
        <tr>
          <td
            colspan="26"
            class="si-empty"
          >
            ${escapeHtml(message)}
          </td>
        </tr>
      `;
    }
  }

  function renderTables() {
    const baseBody =
      getElement(
        "siBaseBody"
      );

    const weeksBody =
      getElement(
        "siWeeksBody"
      );

    if (
      !baseBody ||
      !weeksBody
    ) {
      return;
    }

    if (
      visiblePlayers.length ===
      0
    ) {
      renderEmptyState(
        "No matching Season players."
      );

      return;
    }

    baseBody.innerHTML =
      visiblePlayers
        .map(
          buildBaseRow
        )
        .join("");

    weeksBody.innerHTML =
      visiblePlayers
        .map(
          buildWeeksRow
        )
        .join("");
  }

  /* =====================================================
     HEADER AND SUMMARY
  ===================================================== */

  function updatePlayerCount() {
    const element =
      getElement(
        "siPlayerCount"
      );

    if (!element) {
      return;
    }

    element.textContent =
      (
        `${visiblePlayers.length} ` +
        (
          visiblePlayers.length ===
            1
            ? "player"
            : "players"
        )
      );
  }

  function updateDescription() {
    const element =
      getElement(
        "siSeasonDescription"
      );

    if (!element) {
      return;
    }

    const seasonNumber =
      integerValue(
        seasonData
          ?.season?.number
      );

    const latestWeek =
      normalizeText(
        seasonData
          ?.season
          ?.latestWeek
      ) ||
      "W0";

    element.textContent =
      (
        `Official participants from Server 630 ` +
        `Season ${seasonNumber || 1}, ${latestWeek}.`
      );
  }

  function updateFilterSummary() {
    const element =
      getElement(
        "siFilterSummary"
      );

    if (!element) {
      return;
    }

    if (
      activePlayerFilter ===
      "warriors"
    ) {
      element.textContent =
        (
          `Showing ${visiblePlayers.length} ` +
          `official Warriors`
        );

      return;
    }

    if (
      activePlayerFilter ===
      "farmers"
    ) {
      element.textContent =
        (
          `Showing ${visiblePlayers.length} ` +
          `official Farmers`
        );

      return;
    }

    element.textContent =
      (
        `Showing all ${visiblePlayers.length} ` +
        `official participants`
      );
  }

  function updateFilterButtons() {
    document
      .querySelectorAll(
        "#seasonInfoPage .si-filter-btn"
      )
      .forEach(button => {
        const active =
          button.dataset.filter ===
          activePlayerFilter;

        button.classList.toggle(
          "active",
          active
        );

        button.setAttribute(
          "aria-pressed",
          active
            ? "true"
            : "false"
        );
      });
  }

  function renderPage() {
    updateVisiblePlayers();

    renderTables();

    updatePlayerCount();

    updateDescription();

    updateFilterSummary();

    updateFilterButtons();

    requestAnimationFrame(
      synchronizeScrollWidths
    );
  }

  /* =====================================================
     FILTER EVENTS
  ===================================================== */

  function handlePlayerFilter(
    event
  ) {
    const button =
      event.currentTarget;

    activePlayerFilter =
      normalizeText(
        button.dataset.filter
      ) ||
      "all";

    renderPage();
  }

  function clearOtherSortSelects(
    activeSelect
  ) {
    document
      .querySelectorAll(
        "#seasonInfoPage .si-week-sort-select"
      )
      .forEach(select => {
        if (
          select !==
          activeSelect
        ) {
          select.value =
            "";
        }
      });
  }

  function handleWeekSort(
    event
  ) {
    const select =
      event.currentTarget;

    const direction =
      normalizeText(
        select.value
      );

    if (!direction) {
      activeSort =
        null;

      renderPage();

      return;
    }

    clearOtherSortSelects(
      select
    );

    activeSort = {
      week:
        integerValue(
          select.dataset.week
        ),

      metric:
        normalizeText(
          select.dataset.metric
        ),

      direction
    };

    renderPage();
  }

  /* =====================================================
     SCROLL SYNCHRONIZATION
  ===================================================== */

  function getFilterTrack() {
    return document.querySelector(
      "#siWeekFilterShell .si-week-filter-track"
    );
  }

  function getTopScrollContent() {
    return document.querySelector(
      (
        "#siTopHorizontalScroll " +
        ".si-top-horizontal-scroll-content"
      )
    );
  }

  function synchronizeScrollWidths() {
    const weeksShell =
      getElement(
        "siWeeksShell"
      );

    const filterShell =
      getElement(
        "siWeekFilterShell"
      );

    const filterTrack =
      getFilterTrack();

    const topScroll =
      getElement(
        "siTopHorizontalScroll"
      );

    const topScrollContent =
      getTopScrollContent();

    if (
      !weeksShell ||
      !filterShell ||
      !filterTrack ||
      !topScroll ||
      !topScrollContent
    ) {
      return;
    }

    const weeksWidth =
      Math.max(
        weeksShell.scrollWidth,
        weeksShell
          .querySelector("table")
          ?.scrollWidth ||
        0
      );

    if (weeksWidth > 0) {
      filterTrack.style.width =
        `${weeksWidth}px`;

      topScrollContent.style.width =
        `${weeksWidth}px`;
    }

    filterShell.scrollLeft =
      weeksShell.scrollLeft;

    topScroll.scrollLeft =
      weeksShell.scrollLeft;
  }

  function synchronizeHorizontalScroll(
    source
  ) {
    if (scrollLock) {
      return;
    }

    scrollLock =
      true;

    const scrollLeft =
      source.scrollLeft;

    const weeksShell =
      getElement(
        "siWeeksShell"
      );

    const filterShell =
      getElement(
        "siWeekFilterShell"
      );

    const topScroll =
      getElement(
        "siTopHorizontalScroll"
      );

    [
      weeksShell,
      filterShell,
      topScroll
    ]
      .filter(
        element =>
          element &&
          element !== source
      )
      .forEach(element => {
        element.scrollLeft =
          scrollLeft;
      });

    requestAnimationFrame(
      () => {
        scrollLock =
          false;
      }
    );
  }

  /* =====================================================
     EVENT BINDING
  ===================================================== */

  function bindEvents() {
    document
      .querySelectorAll(
        "#seasonInfoPage .si-filter-btn"
      )
      .forEach(button => {
        addListener(
          button,
          "click",
          handlePlayerFilter
        );
      });

    document
      .querySelectorAll(
        "#seasonInfoPage .si-week-sort-select"
      )
      .forEach(select => {
        addListener(
          select,
          "change",
          handleWeekSort
        );
      });

    const weeksShell =
      getElement(
        "siWeeksShell"
      );

    const filterShell =
      getElement(
        "siWeekFilterShell"
      );

    const topScroll =
      getElement(
        "siTopHorizontalScroll"
      );

    [
      weeksShell,
      filterShell,
      topScroll
    ]
      .filter(Boolean)
      .forEach(element => {
        addListener(
          element,
          "scroll",
          () => {
            synchronizeHorizontalScroll(
              element
            );
          },
          {
            passive:
              true
          }
        );
      });

    addListener(
      global,
      "resize",
      synchronizeScrollWidths,
      {
        passive:
          true
      }
    );
  }

  /* =====================================================
     ERROR RENDERING
  ===================================================== */

  function renderError(error) {
    console.error(
      `[${MODULE_NAME}]`,
      error
    );

    allPlayers =
      [];

    visiblePlayers =
      [];

    updatePlayerCount();

    renderEmptyState(
      error?.message ||
      "Season Info data could not be loaded."
    );

    const description =
      getElement(
        "siSeasonDescription"
      );

    if (description) {
      description.textContent =
        "Season Info data is unavailable.";
    }

    const summary =
      getElement(
        "siFilterSummary"
      );

    if (summary) {
      summary.textContent =
        "No Season data available";
    }
  }

  /* =====================================================
     PUBLIC INITIALIZATION
  ===================================================== */

  async function initialize() {
    const page =
      getElement(
        "seasonInfoPage"
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

    destroy();

    initializedPage =
      page;

    activePlayerFilter =
      "all";

    activeSort =
      null;

    renderEmptyState(
      "Loading season data..."
    );

    bindEvents();

    try {
      seasonData =
        await loadSeasonData();

      allPlayers =
        seasonData.players
          .map(
            normalizePlayer
          )
          .filter(
            player =>
              Boolean(player.id)
          );

      renderPage();

      console.info(
        (
          `[${MODULE_NAME}] ` +
          `${allPlayers.length} players loaded.`
        )
      );

      return true;
    } catch (error) {
      renderError(error);

      return false;
    }
  }

  function destroy() {
    clearListeners();

    initializedPage =
      null;

    seasonData =
      null;

    allPlayers =
      [];

    visiblePlayers =
      [];

    activePlayerFilter =
      "all";

    activeSort =
      null;

    scrollLock =
      false;
  }

  const publicApi =
  Object.freeze({
    name:
      MODULE_NAME,

    version:
      MODULE_VERSION,

    init:
      initialize,

    initialize,

    render:
      renderPage,

    destroy,

    reload() {
      destroy();

      return initialize();
    }
  });

  global.K630SeasonInfoPage =
    publicApi;

  global.initializeK630SeasonInfoPage =
    initialize;

  console.info(
    `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
  );
})(window);