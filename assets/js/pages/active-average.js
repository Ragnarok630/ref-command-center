/* =========================================================
   K630-REF ACTIVE & AVERAGE
   File: assets/js/active-average.js
   Version: 630.1.0

   Data source:
   - k630-public-data
   - assets/data/generated/active-average/current.json

   Rules:
   - The generated current.json is the single source of truth.
   - Foundation creates the initial dataset.
   - Matchmaking updates the same dataset.
   - Weekly engines will continue updating the same dataset.
   - No localStorage.
   - No IndexedDB.
========================================================= */

(function initializeK630ActiveAverage(global) {
  "use strict";

  /* =====================================================
     MODULE
  ===================================================== */

  const MODULE_NAME =
    "K630 Active & Average";

  const MODULE_VERSION =
    "630.1.0";

  const DATA_URL =
    (
      "https://raw.githubusercontent.com/" +
      "Ragnarok630/k630-public-data/" +
      "main/assets/data/generated/" +
      "active-average/current.json"
    );

  /* =====================================================
     STATE
  ===================================================== */

  const state = {
    allPlayers: [],
    visiblePlayers: [],

    seasonColumns: [],

    search:
      "",

    status:
      "all",

    tier:
      "all",

    sortKey:
      "",

    sortDirection:
      "",

    rendering:
      false,

    initialized:
      false
  };

  let globalEventsBound =
    false;

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

  function numberValue(
    value,
    fallback = 0
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return fallback;
    }

    const normalized =
      typeof value ===
        "string"
        ? value
            .replaceAll(",", "")
            .replaceAll("%", "")
            .trim()
        : value;

    const parsed =
      Number(normalized);

    return Number.isFinite(parsed)
      ? parsed
      : fallback;
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

  function formatNumber(value) {
    return integerValue(value)
      .toLocaleString(
        "en-US"
      );
  }

  function formatSignedNumber(value) {
    const number =
      integerValue(value);

    if (number > 0) {
      return (
        `+${formatNumber(number)}`
      );
    }

    if (number < 0) {
      return (
        `-${formatNumber(
          Math.abs(number)
        )}`
      );
    }

    return "0";
  }

  function formatPercent(value) {
    const number =
      numberValue(value);

    if (!number) {
      return "-";
    }

    return (
      `${number.toLocaleString(
        "en-US",
        {
          maximumFractionDigits:
            2
        }
      )}%`
    );
  }

  function normalizeTier(value) {
    return (
      normalizeText(value)
        .toUpperCase() ===
      "T5"
    )
      ? "T5"
      : "T4";
  }

  function normalizeStatus(value) {
    const normalized =
      normalizeText(value)
        .toUpperCase();

    const match =
      normalized.match(
        /LV([0-3])/
      );

    return match
      ? match[1]
      : "2";
  }

  function calculateMeritPowerPercentage(
    merits,
    power
  ) {
    const meritsValue =
      numberValue(merits);

    const powerValue =
      numberValue(power);

    if (
      meritsValue <= 0 ||
      powerValue <= 0
    ) {
      return 0;
    }

    return (
      Math.round(
        (
          meritsValue /
          powerValue *
          100
        ) *
        100
      ) /
      100
    );
  }

  /* =====================================================
     DATA LOADING
  ===================================================== */

  async function loadDataset() {
    const response =
      await fetch(
        `${DATA_URL}?t=${Date.now()}`,
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
        (
          "Active & Average data could not be loaded. " +
          `HTTP ${response.status}.`
        )
      );
    }

    let data;

    try {
      data =
        await response.json();
    } catch (error) {
      throw new Error(
        "Active & Average current.json is not valid JSON."
      );
    }

    if (
      !data ||
      !Array.isArray(
        data.players
      )
    ) {
      throw new Error(
        "Active & Average current.json contains no valid players array."
      );
    }

    return data;
  }

  /* =====================================================
     PLAYER NORMALIZATION
  ===================================================== */

  function normalizeSeasonResults(player) {
    const results =
      {};

    if (
      player?.seasons &&
      typeof player.seasons ===
        "object"
    ) {
      Object.entries(
        player.seasons
      ).forEach(
        (
          [
            seasonNumber,
            seasonData
          ]
        ) => {
          const number =
            integerValue(
              seasonNumber
            );

          if (number <= 0) {
            return;
          }

          results[number] = {
            merits:
              integerValue(
                seasonData?.merits ??
                seasonData?.finalMerits ??
                seasonData?.topMerits
              ),

            power:
              integerValue(
                seasonData?.power ??
                seasonData?.finalPower ??
                seasonData?.historicalPower
              ),

            meritPowerPercentage:
              numberValue(
                seasonData
                  ?.meritPowerPercentage ??
                seasonData
                  ?.meritPercent
              )
          };
        }
      );
    }

    return results;
  }

  function normalizePlayer(
    player,
    index
  ) {
    const id =
      normalizeText(
        player?.id ??
        player?.playerId ??
        player?.["Lord ID"]
      );

    const startPower =
      integerValue(
        player?.startPower
      );

    const historicalPower =
      integerValue(
        player?.historicalPower ??
        player?.topPower
      );

    const powerGrowth =
      Number.isFinite(
        Number(
          player?.powerGrowth
        )
      )
        ? integerValue(
            player.powerGrowth
          )
        : (
            historicalPower -
            startPower
          );

    const merits =
      integerValue(
        player?.merits
      );

    const meritPowerPercentage =
      numberValue(
        player
          ?.meritPowerPercentage ??
        player?.meritPowerRatio
      ) ||
      calculateMeritPowerPercentage(
        merits,
        historicalPower
      );

    return {
      raw:
        player,

      rank:
        integerValue(
          player?.rank
        ) ||
        index + 1,

      id,

      name:
        normalizeText(
          player?.name
        ) || "-",

      alliance:
        normalizeText(
          player?.alliance
        ) || "-",

      serverStatus:
        normalizeText(
          player?.serverStatus
        ) || "LV2",

      statusValue:
        normalizeStatus(
          player?.serverStatus
        ),

      serverStatusColor:
        normalizeLower(
          player
            ?.serverStatusColor
        ) || "green",

      troopTier:
        normalizeTier(
          player?.troopTier
        ),

      startPower,

      historicalPower,

      powerGrowth,

      topMerits:
        integerValue(
          player?.topMerits
        ),

      meritsAverageValue:
        integerValue(
          player
            ?.averageMeritsValue ??
          player
            ?.meritsAverageValue
        ),

      meritsAveragePercent:
        numberValue(
          player
            ?.averageMeritsPercentage ??
          player
            ?.meritsAveragePercent
        ),

      merits,

      meritPowerPercentage,

      matchmakingNewPlayer:
        player
          ?.matchmakingNewPlayer ===
        true,

      leftDuringSeason:
        player
          ?.leftDuringSeason ===
        true,

      afkApproved:
        player
          ?.afkApproved ===
        true,

      seasons:
        normalizeSeasonResults(
          player
        )
    };
  }

  function extractSeasonColumns(
    dataset,
    players
  ) {
    const seasons =
      new Set();

    if (
      Array.isArray(
        dataset?.seasonColumns
      )
    ) {
      dataset.seasonColumns
        .forEach(entry => {
          const season =
            integerValue(
              entry?.season
            );

          if (season > 0) {
            seasons.add(
              season
            );
          }
        });
    }

    players.forEach(player => {
      Object.keys(
        player.seasons
      ).forEach(
        seasonNumber => {
          const season =
            integerValue(
              seasonNumber
            );

          if (season > 0) {
            seasons.add(
              season
            );
          }
        }
      );
    });

    return [
      ...seasons
    ].sort(
      (
        first,
        second
      ) =>
        second -
        first
    );
  }

  /* =====================================================
   PLAYER NOTES AND STATUS TOOLTIP
===================================================== */

function renderPlayerNotes(player) {
  const icons =
    [];

  if (
    player.leftDuringSeason
  ) {
    icons.push(`
      <span
        class="
          aa-note-icon
          aa-note-left
        "
        title="Left during Season"
        aria-label="Left during Season"
      >
        <i
          class="fa-solid fa-triangle-exclamation"
          aria-hidden="true"
        ></i>
      </span>
    `);
  }

  if (
    player.afkApproved
  ) {
    icons.push(`
      <span
        class="
          aa-note-icon
          aa-note-afk
        "
        title="AFK approved"
        aria-label="AFK approved"
      >
        <i
          class="fa-solid fa-bed"
          aria-hidden="true"
        ></i>
      </span>
    `);
  }

  if (
    player.matchmakingNewPlayer
  ) {
    icons.push(`
      <span
        class="
          aa-note-icon
          aa-note-new
        "
        title="New Matchmaking player"
        aria-label="New Matchmaking player"
      >
        <i
          class="fa-solid fa-user-plus"
          aria-hidden="true"
        ></i>
      </span>
    `);
  }

  while (
    icons.length <
    4
  ) {
    icons.push(`
      <span
        class="aa-note-empty"
        aria-hidden="true"
      ></span>
    `);
  }

  return icons
    .slice(
      0,
      4
    )
    .join("");
}

function renderStatusBadge(player) {
  const status =
    escapeHtml(
      player.serverStatus
    );

  const color =
    escapeHtml(
      player.serverStatusColor
    );

  return `
    <span
      class="
        aa-status
        aa-status-${color}
        aa-status-tooltip-trigger
      "
      tabindex="0"
      data-aa-status-tooltip="true"
      aria-describedby="aaStatusTooltip"
      aria-label="${status} Alliance Status Level. Hover or focus for explanation."
    >
      ${status}
    </span>
  `;
}

function positionStatusTooltip(
  trigger,
  tooltip
) {
  if (
    !trigger ||
    !tooltip
  ) {
    return;
  }

  const triggerRect =
    trigger.getBoundingClientRect();

  const tooltipRect =
    tooltip.getBoundingClientRect();

  const viewportWidth =
    global.innerWidth;

  const viewportHeight =
    global.innerHeight;

  const safeMargin =
    12;

  const preferredGap =
    10;

  let left =
    triggerRect.right +
    preferredGap;

  let top =
    triggerRect.top +
    (
      triggerRect.height /
      2
    ) -
    (
      tooltipRect.height /
      2
    );

  if (
    left +
    tooltipRect.width >
    viewportWidth -
    safeMargin
  ) {
    left =
      triggerRect.left -
      tooltipRect.width -
      preferredGap;
  }

  if (
    left <
    safeMargin
  ) {
    left =
      Math.max(
        safeMargin,
        (
          viewportWidth -
          tooltipRect.width
        ) /
        2
      );
  }

  if (
    top <
    safeMargin
  ) {
    top =
      safeMargin;
  }

  if (
    top +
    tooltipRect.height >
    viewportHeight -
    safeMargin
  ) {
    top =
      Math.max(
        safeMargin,
        viewportHeight -
        tooltipRect.height -
        safeMargin
      );
  }

  tooltip.style.left =
    `${Math.round(left)}px`;

  tooltip.style.top =
    `${Math.round(top)}px`;
}

function showStatusTooltip(
  trigger
) {
  const tooltip =
    getElement(
      "aaStatusTooltip"
    );

  if (
    !tooltip ||
    !trigger
  ) {
    return;
  }

  tooltip.classList.add(
    "is-visible"
  );

  tooltip.setAttribute(
    "aria-hidden",
    "false"
  );

  global.requestAnimationFrame(
    () => {
      positionStatusTooltip(
        trigger,
        tooltip
      );
    }
  );
}

function hideStatusTooltip() {
  const tooltip =
    getElement(
      "aaStatusTooltip"
    );

  if (!tooltip) {
    return;
  }

  tooltip.classList.remove(
    "is-visible"
  );

  tooltip.setAttribute(
    "aria-hidden",
    "true"
  );
}

function bindStatusTooltip() {
  const page =
    getElement(
      "activeAveragePage"
    );

  if (
    !page ||
    page.dataset
      .statusTooltipBound ===
      "true"
  ) {
    return;
  }

  page.dataset.statusTooltipBound =
    "true";

  page.addEventListener(
    "mouseover",
    event => {
      const trigger =
        event.target.closest(
          ".aa-status-tooltip-trigger"
        );

      if (
        !trigger ||
        !page.contains(
          trigger
        )
      ) {
        return;
      }

      showStatusTooltip(
        trigger
      );
    }
  );

  page.addEventListener(
    "mouseout",
    event => {
      const trigger =
        event.target.closest(
          ".aa-status-tooltip-trigger"
        );

      if (!trigger) {
        return;
      }

      if (
        event.relatedTarget &&
        trigger.contains(
          event.relatedTarget
        )
      ) {
        return;
      }

      hideStatusTooltip();
    }
  );

  page.addEventListener(
    "focusin",
    event => {
      const trigger =
        event.target.closest(
          ".aa-status-tooltip-trigger"
        );

      if (!trigger) {
        return;
      }

      showStatusTooltip(
        trigger
      );
    }
  );

  page.addEventListener(
    "focusout",
    event => {
      const trigger =
        event.target.closest(
          ".aa-status-tooltip-trigger"
        );

      if (!trigger) {
        return;
      }

      hideStatusTooltip();
    }
  );

  global.addEventListener(
    "resize",
    hideStatusTooltip
  );

  global.addEventListener(
    "scroll",
    hideStatusTooltip,
    true
  );
}

  /* =====================================================
     SEASON DATA
  ===================================================== */

  function getSeasonMetric(
    player,
    seasonNumber,
    metric
  ) {
    const season =
      player.seasons[
        seasonNumber
      ];

    if (!season) {
      return 0;
    }

    if (
      metric ===
      "merits"
    ) {
      return numberValue(
        season.merits
      );
    }

    if (
      metric ===
      "power"
    ) {
      return numberValue(
        season.power
      );
    }

    if (
      metric ===
      "mp"
    ) {
      return (
        numberValue(
          season
            .meritPowerPercentage
        ) ||
        calculateMeritPowerPercentage(
          season.merits,
          season.power
        )
      );
    }

    return 0;
  }

  /* =====================================================
     FILTERING AND SORTING
  ===================================================== */

  function matchesSearch(player) {
    const query =
      normalizeLower(
        state.search
      );

    if (!query) {
      return true;
    }

    return (
      normalizeLower(
        player.id
      ).includes(query) ||
      normalizeLower(
        player.name
      ).includes(query) ||
      normalizeLower(
        player.alliance
      ).includes(query)
    );
  }

  function matchesStatus(player) {
    if (
      state.status ===
      "all"
    ) {
      return true;
    }

    return (
      player.statusValue ===
      state.status
    );
  }

  function matchesTier(player) {
    if (
      state.tier ===
      "all"
    ) {
      return true;
    }

    return (
      player.troopTier ===
      state.tier
    );
  }

  function getSortValue(
    player,
    sortKey
  ) {
    if (
      sortKey.startsWith(
        "season:"
      )
    ) {
      const parts =
        sortKey.split(":");

      return getSeasonMetric(
        player,
        integerValue(
          parts[1]
        ),
        parts[2]
      );
    }

    if (
      sortKey ===
      "startPower"
    ) {
      return player.startPower;
    }

    if (
      sortKey ===
      "historicalPower"
    ) {
      return player.historicalPower;
    }

    if (
      sortKey ===
      "powerGrowth"
    ) {
      return player.powerGrowth;
    }

    if (
      sortKey ===
      "topMerits"
    ) {
      return player.topMerits;
    }

    if (
      sortKey ===
      "meritsAverageValue"
    ) {
      return player
        .meritsAverageValue;
    }

    if (
      sortKey ===
      "meritsAveragePercent"
    ) {
      return player
        .meritsAveragePercent;
    }

    return player.rank;
  }

  function sortPlayers(players) {
    const sorted =
      [...players];

    if (
      !state.sortKey ||
      !state.sortDirection
    ) {
      return sorted.sort(
        (
          first,
          second
        ) => {
          if (
            second.historicalPower !==
            first.historicalPower
          ) {
            return (
              second.historicalPower -
              first.historicalPower
            );
          }

          return first.id
            .localeCompare(
              second.id,
              undefined,
              {
                numeric:
                  true
              }
            );
        }
      );
    }

    const direction =
      state.sortDirection ===
        "asc"
        ? 1
        : -1;

    return sorted.sort(
      (
        first,
        second
      ) => {
        const firstValue =
          getSortValue(
            first,
            state.sortKey
          );

        const secondValue =
          getSortValue(
            second,
            state.sortKey
          );

        if (
          firstValue !==
          secondValue
        ) {
          return (
            (
              firstValue -
              secondValue
            ) *
            direction
          );
        }

        return first.id
          .localeCompare(
            second.id,
            undefined,
            {
              numeric:
                true
            }
          );
      }
    );
  }

  function applyFiltersAndSort() {
    const filtered =
      state.allPlayers
        .filter(
          matchesSearch
        )
        .filter(
          matchesStatus
        )
        .filter(
          matchesTier
        );

    state.visiblePlayers =
      sortPlayers(
        filtered
      );

    renderTables();
    updatePlayerCount();
  }

  /* =====================================================
     TABLE RENDERING
  ===================================================== */

  function renderLeftTable() {
    const body =
      getElement(
        "aaLeftTableBody"
      );

    if (!body) {
      return;
    }

    if (
      state.visiblePlayers
        .length ===
      0
    ) {
      body.innerHTML = `
        <tr>
          <td
            colspan="13"
            class="aa-empty"
          >
            No players found.
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML =
      state.visiblePlayers
        .map(
          (
            player,
            index
          ) => `
            <tr>

              <td class="aa-col-index">
                ${index + 1}
              </td>

              <td class="aa-col-id">
                <span class="aa-player-id">
                  ${escapeHtml(
                    player.id
                  )}
                </span>
              </td>

              <td class="aa-col-name">
                ${escapeHtml(
                  player.name
                )}
              </td>

              <td class="aa-col-alliance">
                ${escapeHtml(
                  player.alliance
                )}
              </td>

              <td class="aa-col-note">
                <span class="aa-note-icons">
                  ${renderPlayerNotes(
                    player
                  )}
                </span>
              </td>

              <td class="aa-col-status">
                    ${renderStatusBadge(
                     player
                    )}
                </td>

              <td class="aa-col-tier">
                <span
                  class="
                    aa-tier
                    aa-tier-${normalizeLower(
                      player.troopTier
                    )}
                  "
                >
                  ${escapeHtml(
                    player.troopTier
                  )}
                </span>
              </td>

              <td
                class="
                  aa-col-power
                  aa-power-group-start
                "
              >
                ${formatNumber(
                  player.startPower
                )}
              </td>

              <td class="aa-col-power">
                <strong>
                  ${formatNumber(
                    player.historicalPower
                  )}
                </strong>
              </td>

              <td
                class="
                  aa-col-power
                  aa-power-group-end
                "
              >
                ${formatSignedNumber(
                  player.powerGrowth
                )}
              </td>

              <td class="aa-col-top-merits">
                ${formatNumber(
                  player.topMerits
                )}
              </td>

              <td
                class="
                  aa-col-average
                  aa-average-group-start
                "
              >
                ${
                  player.meritsAverageValue
                    ? formatNumber(
                        player
                          .meritsAverageValue
                      )
                    : "-"
                }
              </td>

              <td
                class="
                  aa-col-average
                  aa-average-group-end
                "
              >
                ${formatPercent(
                  player
                    .meritsAveragePercent
                )}
              </td>

            </tr>
          `
        )
        .join("");
  }

  function renderRightTable() {
    const body =
      getElement(
        "aaRightTableBody"
      );

    if (!body) {
      return;
    }

    if (
      state.seasonColumns
        .length ===
      0
    ) {
      body.innerHTML = `
        <tr>
          <td
            colspan="3"
            class="aa-empty"
          >
            No archived Season data available.
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML =
      state.visiblePlayers
        .map(player => `
          <tr>
            ${state.seasonColumns
              .map(
                seasonNumber => {
                  const merits =
                    getSeasonMetric(
                      player,
                      seasonNumber,
                      "merits"
                    );

                  const power =
                    getSeasonMetric(
                      player,
                      seasonNumber,
                      "power"
                    );

                  const percent =
                    getSeasonMetric(
                      player,
                      seasonNumber,
                      "mp"
                    );

                  return `
                    <td class="aa-season-column">
                      ${
                        merits
                          ? formatNumber(
                              merits
                            )
                          : "-"
                      }
                    </td>

                    <td class="aa-season-column">
                      ${
                        power
                          ? formatNumber(
                              power
                            )
                          : "-"
                      }
                    </td>

                    <td class="aa-season-column">
                      ${formatPercent(
                        percent
                      )}
                    </td>
                  `;
                }
              )
              .join("")}
          </tr>
        `)
        .join("");
  }

  function renderTables() {
    renderLeftTable();
    renderRightTable();
  }

  function updatePlayerCount() {
    const element =
      getElement(
        "aaPlayerCount"
      );

    if (!element) {
      return;
    }

    element.textContent =
      (
        `${state.visiblePlayers.length} ` +
        (
          state.visiblePlayers
            .length ===
          1
            ? "player"
            : "players"
        )
      );
  }

  /* =====================================================
     SEASON HEADERS AND FILTERS
  ===================================================== */

  function createSortOptions() {
    return `
      <option value="">
        Default
      </option>

      <option value="desc">
        High
      </option>

      <option value="asc">
        Low
      </option>
    `;
  }

  function renderSeasonHeaders() {
    const head =
      getElement(
        "aaRightTableHead"
      );

    if (!head) {
      return;
    }

    if (
      state.seasonColumns
        .length ===
      0
    ) {
      head.innerHTML = `
        <tr>
          <th
            colspan="3"
            class="aa-season-placeholder"
          >
            No archived Seasons
          </th>
        </tr>

        <tr>
          <th class="aa-season-column">
            Merits
          </th>

          <th class="aa-season-column">
            Power
          </th>

          <th class="aa-season-column">
            M-P (%)
          </th>
        </tr>
      `;

      return;
    }

    head.innerHTML = `
      <tr>
        ${state.seasonColumns
          .map(
            seasonNumber => `
              <th
                colspan="3"
                class="aa-season-title"
              >
                Season ${seasonNumber}
              </th>
            `
          )
          .join("")}
      </tr>

      <tr>
        ${state.seasonColumns
          .map(() => `
            <th class="aa-season-column">
              Merits
            </th>

            <th class="aa-season-column">
              Power
            </th>

            <th class="aa-season-column">
              M-P (%)
            </th>
          `)
          .join("")}
      </tr>
    `;
  }

  function renderSeasonFilters() {
    const container =
      getElement(
        "aaSeasonFilters"
      );

    if (!container) {
      return;
    }

    if (
      state.seasonColumns
        .length ===
      0
    ) {
      container.innerHTML = `
        <div class="aa-season-filter-empty">
          Season filters appear after Season Archive.
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.seasonColumns
        .map(
          seasonNumber => `
            <div class="aa-season-filter-group">

              <div class="aa-season-filter-title">
                Season ${seasonNumber}
              </div>

              <label>
                <span>
                  Merits
                </span>

                <select
                  class="aa-sort-select"
                  data-sort-key="season:${seasonNumber}:merits"
                >
                  ${createSortOptions()}
                </select>
              </label>

              <label>
                <span>
                  Power
                </span>

                <select
                  class="aa-sort-select"
                  data-sort-key="season:${seasonNumber}:power"
                >
                  ${createSortOptions()}
                </select>
              </label>

              <label>
                <span>
                  M-P (%)
                </span>

                <select
                  class="aa-sort-select"
                  data-sort-key="season:${seasonNumber}:mp"
                >
                  ${createSortOptions()}
                </select>
              </label>

            </div>
          `
        )
        .join("");
  }

  /* =====================================================
     EVENT BINDING
  ===================================================== */

  function bindFilterControls() {
    const searchInput =
      getElement(
        "aaSearchInput"
      );

    const statusFilter =
      getElement(
        "aaStatusFilter"
      );

    const tierFilter =
      getElement(
        "aaTierFilter"
      );

    const resetButton =
      getElement(
        "aaResetFilters"
      );

    searchInput
      ?.addEventListener(
        "input",
        event => {
          state.search =
            event.target.value;

          applyFiltersAndSort();
        }
      );

    statusFilter
      ?.addEventListener(
        "change",
        event => {
          state.status =
            event.target.value;

          applyFiltersAndSort();
        }
      );

    tierFilter
      ?.addEventListener(
        "change",
        event => {
          state.tier =
            event.target.value;

          applyFiltersAndSort();
        }
      );

    resetButton
      ?.addEventListener(
        "click",
        resetFilters
      );

    document
      .querySelectorAll(
        ".aa-sort-select"
      )
      .forEach(select => {
        select.addEventListener(
          "change",
          event => {
            document
              .querySelectorAll(
                ".aa-sort-select"
              )
              .forEach(other => {
                if (
                  other !==
                  event.target
                ) {
                  other.value =
                    "";
                }
              });

            state.sortKey =
              event.target
                .dataset
                .sortKey ||
              "";

            state.sortDirection =
              event.target.value;

            if (
              !state.sortDirection
            ) {
              state.sortKey =
                "";
            }

            applyFiltersAndSort();
          }
        );
      });
  }

  function resetFilters() {
    state.search =
      "";

    state.status =
      "all";

    state.tier =
      "all";

    state.sortKey =
      "";

    state.sortDirection =
      "";

    const searchInput =
      getElement(
        "aaSearchInput"
      );

    const statusFilter =
      getElement(
        "aaStatusFilter"
      );

    const tierFilter =
      getElement(
        "aaTierFilter"
      );

    if (searchInput) {
      searchInput.value =
        "";
    }

    if (statusFilter) {
      statusFilter.value =
        "all";
    }

    if (tierFilter) {
      tierFilter.value =
        "all";
    }

    document
      .querySelectorAll(
        ".aa-sort-select"
      )
      .forEach(select => {
        select.value =
          "";
      });

    applyFiltersAndSort();
  }

  function bindScrollSynchronization() {
    const verticalScroll =
      getElement(
        "aaVerticalScroll"
      );

    const rightFilter =
      getElement(
        "aaRightFilterShell"
      );

    const rightShell =
      getElement(
        "aaRightShell"
      );

    if (
      rightFilter &&
      rightShell
    ) {
      rightShell.addEventListener(
        "scroll",
        () => {
          rightFilter.scrollLeft =
            rightShell.scrollLeft;
        }
      );

      rightFilter.addEventListener(
        "scroll",
        () => {
          rightShell.scrollLeft =
            rightFilter.scrollLeft;
        }
      );
    }

    if (verticalScroll) {
      verticalScroll.scrollTop =
        0;
    }
  }

  function bindGlobalEvents() {
    if (globalEventsBound) {
      return;
    }

    globalEventsBound =
      true;

    [
      "k630:foundation-generated",
      "k630:matchmaking-generated",
      "k630:active-average-refresh",
      "k630:season-archive-completed"
    ].forEach(eventName => {
      document.addEventListener(
        eventName,
        () => {
          if (
            getElement(
              "activeAveragePage"
            )
          ) {
            renderActiveAveragePage();
          }
        }
      );
    });
  }

  /* =====================================================
     ERROR RENDERING
  ===================================================== */

  function renderError(error) {
    const leftBody =
      getElement(
        "aaLeftTableBody"
      );

    const rightBody =
      getElement(
        "aaRightTableBody"
      );

    const message =
      escapeHtml(
        error?.message ||
        "Active & Average could not be loaded."
      );

    if (leftBody) {
      leftBody.innerHTML = `
        <tr>
          <td
            colspan="13"
            class="aa-empty"
          >
            ${message}
          </td>
        </tr>
      `;
    }

    if (rightBody) {
      rightBody.innerHTML = `
        <tr>
          <td
            colspan="3"
            class="aa-empty"
          >
            No Season data available.
          </td>
        </tr>
      `;
    }

    const count =
      getElement(
        "aaPlayerCount"
      );

    if (count) {
      count.textContent =
        "0 players";
    }
  }

  /* =====================================================
     MAIN RENDER
  ===================================================== */

  async function renderActiveAveragePage() {
    const page =
      getElement(
        "activeAveragePage"
      );

    if (!page) {
      return false;
    }

    if (state.rendering) {
      return false;
    }

    state.rendering =
      true;

    try {
      const dataset =
        await loadDataset();

      state.allPlayers =
        dataset.players
          .filter(player => {
            return (
              player &&
              player.active !==
                false
            );
          })
          .map(
            normalizePlayer
          );

      state.seasonColumns =
        extractSeasonColumns(
          dataset,
          state.allPlayers
        );

      state.search =
        "";

      state.status =
        "all";

      state.tier =
        "all";

      state.sortKey =
        "";

      state.sortDirection =
        "";

      renderSeasonHeaders();
      renderSeasonFilters();

      bindFilterControls();
      bindScrollSynchronization();
      bindStatusTooltip();
      bindGlobalEvents();

      applyFiltersAndSort();

      state.initialized =
        true;

      return true;
    } catch (error) {
      state.allPlayers =
        [];

      state.visiblePlayers =
        [];

      renderError(error);

      return false;
    } finally {
      state.rendering =
        false;
    }
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

      render:
        renderActiveAveragePage,

      reload:
        renderActiveAveragePage,

      getState() {
        return {
          initialized:
            state.initialized,

          totalPlayers:
            state.allPlayers
              .length,

          visiblePlayers:
            state.visiblePlayers
              .length,

          seasonColumns:
            [
              ...state.seasonColumns
            ],

          search:
            state.search,

          status:
            state.status,

          tier:
            state.tier,

          sortKey:
            state.sortKey,

          sortDirection:
            state.sortDirection
        };
      }
    });

  global.renderActiveAveragePage =
    renderActiveAveragePage;

  global.K630ActiveAveragePage =
    publicApi;
})(window);