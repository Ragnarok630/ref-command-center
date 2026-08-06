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

  const meritTargets =
    source.meritTargets &&
    typeof source.meritTargets ===
      "object"
      ? {
          rank3:
            numberValue(
              source.meritTargets
                .rank3
            ),

          rank2:
            numberValue(
              source.meritTargets
                .rank2
            ),

          rank1:
            numberValue(
              source.meritTargets
                .rank1
            )
        }
      : null;

  return {
    week:
      weekNumber,

    weekLabel:
      normalizeText(
        source.weekLabel
      ) ||
      weekKey,

    officialDate:
      normalizeText(
        source.officialDate
      ) ||
      null,

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

    meritTargets,

    meritRank:
      source.meritRank ===
        null ||
      source.meritRank ===
        undefined
        ? null
        : integerValue(
            source.meritRank
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

    historicalPower:
      source.historicalPower ===
        null ||
      source.historicalPower ===
        undefined
        ? null
        : integerValue(
            source.historicalPower
          ),

    rank:
      source.rank ===
        null ||
      source.rank ===
        undefined
        ? null
        : integerValue(
            source.rank
          ),

    serverRank:
      source.serverRank ===
        null ||
      source.serverRank ===
        undefined
        ? null
        : integerValue(
            source.serverRank
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

  const normalizedNotes =
    notes.map(
      note =>
        note.toLowerCase()
    );

  const noteFlags = {
    new:
      player.noteFlags?.new ===
        true ||
      normalizedNotes.includes(
        "new"
      ),

    left:
      player.noteFlags?.left ===
        true ||
      player.leftDuringSeason ===
        true ||
      normalizedNotes.includes(
        "left"
      ),

    afk:
      player.noteFlags?.afk ===
        true ||
      normalizedNotes.includes(
        "afk"
      )
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
      ).toUpperCase() ===
        "T5"
        ? "T5"
        : "T4",

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

    dateLeftKingdom:
      normalizeText(
        player.dateLeftKingdom
      ) ||
      null,

    leftDuringSeason:
      noteFlags.left,

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
  const rowNumber =
    visibleIndex + 1;

  const playerId =
    normalizeText(
      player.id
    );

  const playerName =
    normalizeText(
      player.name
    );

  const playerAlliance =
    normalizeText(
      player.alliance
    );

  const troopTier =
    normalizeText(
      player.troopTier
    ).toUpperCase() ===
      "T5"
      ? "T5"
      : "T4";

  const historicalPower =
    integerValue(
      player.historicalPower
    );

  return `
    <tr
      data-player-id="${escapeHtml(
        playerId
      )}"
    >

      <td class="si-base-cell-index">
        ${rowNumber}
      </td>

      <td class="si-player-id">
        ${escapeHtml(
          playerId
        )}
      </td>

      <td class="si-player-name">
        ${escapeHtml(
          playerName
        )}
      </td>

      <td class="si-player-alliance">
        ${escapeHtml(
          playerAlliance
        )}
      </td>

      <td class="si-base-cell-tier">
        <span
          class="
            si-tier-badge
            si-tier-badge--${escapeHtml(
              troopTier.toLowerCase()
            )}
          "
        >
          ${escapeHtml(
            troopTier
          )}
        </span>
      </td>

      <td class="si-note-cell">
        ${buildNoteHtml(
          player
        )}
      </td>

      <td class="si-historical-power">
        ${formatNumber(
          historicalPower
        )}
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
  const weekKey =
    `W${weekNumber}`;

  const week =
    player.weeks?.[
      weekKey
    ] ||
    null;

  const latestWeekLabel =
    normalizeText(
      seasonData?.season
        ?.latestWeek
    ).toUpperCase();

  const latestWeekNumber =
    /^W[0-6]$/.test(
      latestWeekLabel
    )
      ? Number(
          latestWeekLabel.slice(1)
        )
      : 0;

  /*
   * Toekomstige weken blijven volledig leeg.
   * OUT kan pas verschijnen nadat de betreffende
   * week daadwerkelijk is geüpload.
   */
  if (
    weekNumber >
    latestWeekNumber
  ) {
    return `
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td class="si-rank-cell">-</td>
    `;
  }

  const troopTier =
    player.troopTier ===
      "T5"
      ? "T5"
      : "T4";

  const playerLeft =
    player.leftDuringSeason ===
      true ||
    player.noteFlags?.left ===
      true ||
    player.active ===
      false;

  /*
   * Bestaande/geüploade week zonder spelersdata:
   * alleen dan OUT tonen wanneer de speler vertrokken is.
   */
  if (
    !week ||
    week.available !==
      true
  ) {
    return `
      <td>-</td>
      <td>-</td>
      <td>-</td>

      <td class="si-rank-cell">
        ${
          playerLeft
            ? `
              <span
                class="
                  si-rank-badge
                  si-rank-out
                "
                data-season-rank-card="true"
                data-rank-status="out"
                data-rank-week="${weekNumber}"
                data-rank-tier="${troopTier}"
              >
                OUT
              </span>
            `
            : "-"
        }
      </td>
    `;
  }

  const numericRank =
    Number(
      week.rank ??
      week.meritRank ??
      0
    );

  let rankLabel =
    "Move";

  let rankClass =
    "si-rank-move";

  if (numericRank === 3) {
    rankLabel =
      "Rank 3";

    rankClass =
      "si-rank-3";
  } else if (
    numericRank === 2
  ) {
    rankLabel =
      "Rank 2";

    rankClass =
      "si-rank-2";
  } else if (
    numericRank === 1
  ) {
    rankLabel =
      "Rank 1";

    rankClass =
      "si-rank-1";
  }

  const tierClass =
    troopTier === "T5"
      ? "si-rank-t5"
      : "si-rank-t4";

  return `
    <td>
      ${formatNumber(
        week.merits
      )}
    </td>

    <td>
      ${formatPercentage(
        week.meritPowerPercentage
      )}
    </td>

    <td>
      ${formatNumber(
        week.currentPower
      )}
    </td>

    <td class="si-rank-cell">
      <span
        class="
          si-rank-badge
          ${tierClass}
          ${rankClass}
        "
        data-season-rank-card="true"
        data-rank-status="${numericRank}"
        data-rank-week="${weekNumber}"
        data-rank-tier="${troopTier}"
      >
        ${escapeHtml(
          rankLabel
        )}
      </span>
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

function getLatestSeasonWeekNumber() {
  const latestWeek =
    normalizeText(
      seasonData?.season
        ?.latestWeek
    ).toUpperCase();

  return /^W[0-6]$/.test(
    latestWeek
  )
    ? Number(
        latestWeek.slice(1)
      )
    : 0;
}

function getConfiguredRankTargets(
  weekNumber,
  troopTier
) {
  const weekKey =
    `W${weekNumber}`;

  const configuredWeek =
    seasonData
      ?.meritConfiguration
      ?.weeks?.[
        weekKey
      ];

  const configuredTier =
    configuredWeek?.[
      troopTier.toLowerCase()
    ];

  if (configuredTier) {
    return {
      rank3:
        numberValue(
          configuredTier.rank3
        ),

      rank2:
        numberValue(
          configuredTier.rank2
        ),

      rank1:
        numberValue(
          configuredTier.rank1
        )
    };
  }

  const finalTargets =
    troopTier === "T5"
      ? {
          rank3:
            12,

          rank2:
            10,

          rank1:
            8
        }
      : {
          rank3:
            10,

          rank2:
            8,

          rank1:
            6
        };

  const factor =
    Math.max(
      1,
      Math.min(
        6,
        weekNumber
      )
    ) / 6;

  return {
    rank3:
      finalTargets.rank3 *
      factor,

    rank2:
      finalTargets.rank2 *
      factor,

    rank1:
      finalTargets.rank1 *
      factor
  };
}

function formatRankTarget(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? `${number.toFixed(2)}%`
    : "-";
}

function createSeasonRankHoverCard() {
  let card =
    getElement(
      "seasonRankHoverCard"
    );

  if (card) {
    return card;
  }

  card =
    document.createElement(
      "aside"
    );

  card.id =
    "seasonRankHoverCard";

  card.className =
    "season-rank-hover-card";

  card.hidden =
    true;

  card.setAttribute(
    "role",
    "tooltip"
  );

  document.body.appendChild(
    card
  );

  return card;
}

function buildSeasonRankHoverCardHtml(
  badge
) {
  const status =
    normalizeText(
      badge.dataset
        .rankStatus
    ).toLowerCase();

  const weekNumber =
    Math.max(
      1,
      Math.min(
        6,
        integerValue(
          badge.dataset
            .rankWeek
        )
      )
    );

  const currentTier =
    normalizeText(
      badge.dataset
        .rankTier
    ).toUpperCase() ===
      "T5"
      ? "T5"
      : "T4";

  if (status === "out") {
    return `
      <div
        class="
          season-rank-hover-card__header
          season-rank-hover-card__header--out
        "
      >
        <strong>
          <i class="fa-solid fa-person-walking-arrow-right"></i>
          OUT
        </strong>

        <span>
          Week ${weekNumber}
        </span>
      </div>

      <p>
        This player left Kingdom 630 before or during
        Week ${weekNumber}.
      </p>

      <p>
        No weekly Merits, Merits %, Current Power or
        Rank data is available for this week.
      </p>

      <b class="season-rank-hover-card__out-note">
        Player left Kingdom 630.
      </b>
    `;
  }

  const t5 =
    getConfiguredRankTargets(
      weekNumber,
      "T5"
    );

  const t4 =
    getConfiguredRankTargets(
      weekNumber,
      "T4"
    );

  let statusLabel =
    "Move";

  if (status === "3") {
    statusLabel =
      "Rank 3";
  } else if (
    status === "2"
  ) {
    statusLabel =
      "Rank 2";
  } else if (
    status === "1"
  ) {
    statusLabel =
      "Rank 1";
  }

  return `
    <div
      class="
        season-rank-hover-card__header
        ${
          currentTier === "T5"
            ? "season-rank-hover-card__header--t5"
            : "season-rank-hover-card__header--t4"
        }
      "
    >
      <strong>
        <i class="fa-solid fa-ranking-star"></i>
        ${escapeHtml(
          `${currentTier} ${statusLabel}`
        )}
      </strong>

      <span>
        Week ${weekNumber}
      </span>
    </div>

    <p>
      Weekly Rank requirements are based on the player's
      Merits percentage for this specific week.
    </p>

    <section class="season-rank-hover-card__tier season-rank-hover-card__tier--t5">
      <h4>
        <i class="fa-solid fa-crown"></i>
        T5 Merit Targets
      </h4>

      <div class="season-rank-hover-card__target">
        <b>Rank 3</b>
        <span>
          Minimum ${formatRankTarget(
            t5.rank3
          )}
        </span>
      </div>

      <div class="season-rank-hover-card__target">
        <b>Rank 2</b>
        <span>
          Minimum ${formatRankTarget(
            t5.rank2
          )}
        </span>
      </div>

      <div class="season-rank-hover-card__target">
        <b>Rank 1</b>
        <span>
          Minimum ${formatRankTarget(
            t5.rank1
          )}
        </span>
      </div>

      <div class="season-rank-hover-card__target season-rank-hover-card__target--move">
        <b>Move</b>
        <span>
          Below ${formatRankTarget(
            t5.rank1
          )}
        </span>
      </div>
    </section>

    <section class="season-rank-hover-card__tier season-rank-hover-card__tier--t4">
      <h4>
        <i class="fa-solid fa-shield-halved"></i>
        T4 Merit Targets
      </h4>

      <div class="season-rank-hover-card__target">
        <b>Rank 3</b>
        <span>
          Minimum ${formatRankTarget(
            t4.rank3
          )}
        </span>
      </div>

      <div class="season-rank-hover-card__target">
        <b>Rank 2</b>
        <span>
          Minimum ${formatRankTarget(
            t4.rank2
          )}
        </span>
      </div>

      <div class="season-rank-hover-card__target">
        <b>Rank 1</b>
        <span>
          Minimum ${formatRankTarget(
            t4.rank1
          )}
        </span>
      </div>

      <div class="season-rank-hover-card__target season-rank-hover-card__target--move">
        <b>Move</b>
        <span>
          Below ${formatRankTarget(
            t4.rank1
          )}
        </span>
      </div>
    </section>

    <p class="season-rank-hover-card__out-info">
      <strong>OUT</strong>
      appears only in an uploaded week when the player
      has left Kingdom 630.
    </p>
  `;
}

function positionSeasonRankHoverCard(
  card,
  badge
) {
  const badgeRect =
    badge.getBoundingClientRect();

  const spacing =
    12;

  const viewportPadding =
    10;

  card.style.left =
    "0px";

  card.style.top =
    "0px";

  card.hidden =
    false;

  const cardWidth =
    card.offsetWidth;

  const cardHeight =
    card.offsetHeight;

  let left =
    badgeRect.left -
    cardWidth -
    spacing;

  if (
    left <
    viewportPadding
  ) {
    left =
      badgeRect.right +
      spacing;
  }

  if (
    left +
    cardWidth >
    global.innerWidth -
    viewportPadding
  ) {
    left =
      global.innerWidth -
      cardWidth -
      viewportPadding;
  }

  let top =
    badgeRect.top +
    (
      badgeRect.height / 2
    ) -
    (
      cardHeight / 2
    );

  if (
    top <
    viewportPadding
  ) {
    top =
      viewportPadding;
  }

  if (
    top +
    cardHeight >
    global.innerHeight -
    viewportPadding
  ) {
    top =
      global.innerHeight -
      cardHeight -
      viewportPadding;
  }

  card.style.left =
    `${Math.round(left)}px`;

  card.style.top =
    `${Math.round(top)}px`;
}

function hideSeasonRankHoverCard() {
  const card =
    getElement(
      "seasonRankHoverCard"
    );

  if (!card) {
    return;
  }

  card.hidden =
    true;

  card.innerHTML =
    "";
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

          hideSeasonRankHoverCard();
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
    () => {
      synchronizeScrollWidths();
      hideSeasonRankHoverCard();
    },
    {
      passive:
        true
    }
  );

  const page =
    getElement(
      "seasonInfoPage"
    );

  if (!page) {
    return;
  }

  const card =
    createSeasonRankHoverCard();

  addListener(
    page,
    "mouseover",
    event => {
      const badge =
        event.target.closest(
          "[data-season-rank-card='true']"
        );

      if (
        !badge ||
        !page.contains(
          badge
        )
      ) {
        return;
      }

      card.innerHTML =
        buildSeasonRankHoverCardHtml(
          badge
        );

      positionSeasonRankHoverCard(
        card,
        badge
      );
    }
  );

  addListener(
    page,
    "mouseout",
    event => {
      const badge =
        event.target.closest(
          "[data-season-rank-card='true']"
        );

      if (!badge) {
        return;
      }

      if (
        event.relatedTarget &&
        badge.contains(
          event.relatedTarget
        )
      ) {
        return;
      }

      hideSeasonRankHoverCard();
    }
  );

  addListener(
    page,
    "click",
    event => {
      const badge =
        event.target.closest(
          "[data-season-rank-card='true']"
        );

      if (!badge) {
        hideSeasonRankHoverCard();
        return;
      }

      card.innerHTML =
        buildSeasonRankHoverCardHtml(
          badge
        );

      positionSeasonRankHoverCard(
        card,
        badge
      );
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