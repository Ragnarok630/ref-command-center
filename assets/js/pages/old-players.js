/* =========================================================
   K630-REF OLD PLAYERS PAGE
   File: assets/js/pages/old-players.js
   Version: 630.1.0

   Responsibilities:
   - Load generated Old Players data from k630-public-data
   - Render the existing Old Players page template
   - Render fixed player columns
   - Render archived Season columns
   - Search by ID, Name and Alliance
   - Filter by Server Status and T4/T5
   - Sort all supported columns
   - Reset all filters
   - Use no gameplay data from localStorage or IndexedDB

   Data source:
   assets/data/generated/old-players/current.json

   Public API:
   - window.K630OldPlayersPage.init()
   - window.K630OldPlayersPage.render()
   - window.K630OldPlayersPage.reload()
   - window.renderOldPlayersPage()
========================================================= */

(function initializeK630OldPlayersPage(global) {
  "use strict";

  /* =====================================================
     MODULE INFORMATION
  ===================================================== */

  const MODULE_NAME =
    "K630 Old Players Page";

  const MODULE_VERSION =
    "630.1.0";

  /* =====================================================
     DATA CONFIGURATION
  ===================================================== */

  const DATA_ROOT =
    (
      "https://raw.githubusercontent.com/" +
      "Ragnarok630/k630-public-data/" +
      "main/assets/data"
    );

  const DATA_URL =
    (
      DATA_ROOT +
      "/generated/old-players/current.json"
    );

  /* =====================================================
     STATE
  ===================================================== */

  const state = {
    initialized:
      false,

    rendering:
      false,

    eventsBound:
      false,

    dataset:
      null,

    allPlayers:
      [],

    visiblePlayers:
      [],

    seasonColumns:
      [],

    filters: {
      search:
        "",

      status:
        "all",

      tier:
        "all"
    },

    sort: {
      key:
        "dateLeaveKingdom",

      direction:
        "desc"
    }
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
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return 0;
    }

    if (
      typeof value ===
      "number"
    ) {
      return Number.isFinite(value)
        ? value
        : 0;
    }

    const normalized =
      normalizeText(value)
        .replace(/\s/g, "")
        .replace(/,/g, "")
        .replace(/%/g, "");

    const parsed =
      Number(normalized);

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
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );
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
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    const number =
      numberValue(value);

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

  function formatDate(value) {
    const text =
      normalizeText(value);

    if (!text) {
      return "-";
    }

    const match =
      text.match(
        /^(\d{4})-(\d{2})-(\d{2})/
      );

    if (!match) {
      return text;
    }

    return (
      `${match[3]}-${match[2]}-${match[1]}`
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
      ? `LV${match[1]}`
      : (
          normalized ||
          "LV2"
        );
  }

  function getPage() {
    return (
      document.getElementById(
        "oldPlayersPage"
      ) ||
      document.querySelector(
        ".old-players-page"
      )
    );
  }

  function queryFirst(
    selectors,
    root = document
  ) {
    for (
      const selector of selectors
    ) {
      const element =
        root.querySelector(
          selector
        );

      if (element) {
        return element;
      }
    }

    return null;
  }

  function queryAll(
    selectors,
    root = document
  ) {
    const elements =
      [];

    selectors.forEach(selector => {
      root.querySelectorAll(
        selector
      ).forEach(element => {
        if (
          !elements.includes(
            element
          )
        ) {
          elements.push(
            element
          );
        }
      });
    });

    return elements;
  }

  /* =====================================================
     PAGE ELEMENTS
  ===================================================== */

  function getElements() {
    const page =
      getPage();

    if (!page) {
      return null;
    }

    const tableBodies =
      Array.from(
        page.querySelectorAll(
          "tbody"
        )
      );

    return {
      page,

      playerCount:
        queryFirst(
          [
            "#oldPlayersCount",
            "#oldPlayerCount",
            "[data-old-players-count]",
            ".old-players-count"
          ],
          page
        ) ||
        queryFirst(
          [
            "#oldPlayersCount",
            "#oldPlayerCount",
            "[data-old-players-count]",
            ".old-players-count"
          ]
        ),

      searchInput:
        queryFirst(
          [
            "#oldPlayersSearchInput",
            "#oldPlayersSearch",
            "#oldPlayerSearch",
            "input[data-old-players-search]",
            ".old-players-search input",
            ".old-players-filter-search input",
            'input[type="search"]'
          ],
          page
        ),

      statusFilter:
        queryFirst(
          [
            "#oldPlayersStatusFilter",
            "#oldPlayerStatusFilter",
            "select[data-old-players-status]",
            ".old-players-status-filter select"
          ],
          page
        ),

      tierFilter:
        queryFirst(
          [
            "#oldPlayersTierFilter",
            "#oldPlayerTierFilter",
            "select[data-old-players-tier]",
            ".old-players-tier-filter select"
          ],
          page
        ),

      resetButton:
        queryFirst(
          [
            "#oldPlayersResetFilters",
            "#resetOldPlayersFilters",
            "[data-old-players-reset]",
            ".old-players-reset-filters",
            ".reset-filters"
          ],
          page
        ) ||
        queryFirst(
          [
            "#oldPlayersResetFilters",
            "#resetOldPlayersFilters",
            "[data-old-players-reset]"
          ]
        ),

      fixedTableBody:
        queryFirst(
          [
            "#oldPlayersTableBody",
            "#oldPlayersLeftTableBody",
            "#oldPlayerTableBody",
            "tbody[data-old-players-fixed]"
          ],
          page
        ) ||
        tableBodies[0] ||
        null,

      seasonTableBody:
        queryFirst(
          [
            "#oldPlayersSeasonTableBody",
            "#oldPlayersRightTableBody",
            "#oldPlayerSeasonTableBody",
            "tbody[data-old-players-seasons]"
          ],
          page
        ) ||
        tableBodies[1] ||
        null,

      seasonTableHead:
        queryFirst(
          [
            "#oldPlayersSeasonTableHead",
            "#oldPlayersRightTableHead",
            "#oldPlayerSeasonTableHead",
            "thead[data-old-players-seasons]"
          ],
          page
        ) ||
        (
          tableBodies[1]
            ? tableBodies[1]
                .closest("table")
                ?.querySelector("thead")
            : null
        ),

      seasonFilterContainer:
        queryFirst(
          [
            "#oldPlayersSeasonFilters",
            "#oldPlayerSeasonFilters",
            "[data-old-players-season-filters]",
            ".old-players-season-filters"
          ],
          page
        ),

      leftScrollContainer:
        queryFirst(
          [
            "#oldPlayersLeftShell",
            "#oldPlayersFixedTableShell",
            "[data-old-players-left-scroll]",
            ".old-players-left-table-shell"
          ],
          page
        ),

      rightScrollContainer:
        queryFirst(
          [
            "#oldPlayersRightShell",
            "#oldPlayersSeasonTableShell",
            "[data-old-players-right-scroll]",
            ".old-players-right-table-shell"
          ],
          page
        )
    };
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

    if (response.status === 404) {
      return createEmptyDataset();
    }

    if (!response.ok) {
      throw new Error(
        (
          "Old Players data could not be loaded. " +
          `HTTP ${response.status}.`
        )
      );
    }

    let dataset;

    try {
      dataset =
        await response.json();
    } catch (_error) {
      throw new Error(
        "Old Players current.json is not valid JSON."
      );
    }

    if (
      !dataset ||
      !Array.isArray(
        dataset.players
      )
    ) {
      throw new Error(
        (
          "Old Players current.json does not contain " +
          "a valid players array."
        )
      );
    }

    return dataset;
  }

  function createEmptyDataset() {
    return {
      schemaVersion:
        1,

      kingdom:
        630,

      dataset:
        "old-players",

      generatedAt:
        null,

      playerCount:
        0,

      seasonColumns:
        [],

      players:
        []
    };
  }

  /* =====================================================
     PLAYER NORMALIZATION
  ===================================================== */

  function normalizeSeasonEntry(
    seasonNumber,
    value
  ) {
    const season =
      integerValue(
        value?.season ??
        seasonNumber
      );

    if (season <= 0) {
      return null;
    }

    return {
      season,

      merits:
        value?.merits ===
          null ||
        value?.merits ===
          undefined
          ? null
          : integerValue(
              value.merits ??
              value.finalMerits
            ),

      currentPower:
        value?.currentPower ===
          null ||
        value?.currentPower ===
          undefined
          ? null
          : integerValue(
              value.currentPower ??
              value.power ??
              value.finalPower
            ),

      meritPowerPercentage:
        value
          ?.meritPowerPercentage ===
          null ||
        value
          ?.meritPowerPercentage ===
          undefined
          ? null
          : numberValue(
              value
                .meritPowerPercentage ??
              value
                .meritPowerRatio ??
              value
                .meritPercent
            )
    };
  }

  function normalizeSeasons(value) {
    const seasons =
      {};

    if (Array.isArray(value)) {
      value.forEach(entry => {
        const normalized =
          normalizeSeasonEntry(
            entry?.season,
            entry
          );

        if (normalized) {
          seasons[
            String(
              normalized.season
            )
          ] =
            normalized;
        }
      });

      return seasons;
    }

    if (
      value &&
      typeof value ===
        "object"
    ) {
      Object.entries(value)
        .forEach(
          (
            [
              seasonNumber,
              seasonData
            ]
          ) => {
            const normalized =
              normalizeSeasonEntry(
                seasonNumber,
                seasonData
              );

            if (normalized) {
              seasons[
                String(
                  normalized.season
                )
              ] =
                normalized;
            }
          }
        );
    }

    return seasons;
  }

  function normalizePlayer(
    player,
    index
  ) {
    const startPower =
      integerValue(
        player?.startPower
      );

    const historicalPower =
      integerValue(
        player?.historicalPower ??
        player?.topPower ??
        player?.currentPower
      );

    const powerGrowth =
      player?.powerGrowth ===
        null ||
      player?.powerGrowth ===
        undefined ||
      player?.powerGrowth ===
        ""
        ? (
            historicalPower -
            startPower
          )
        : integerValue(
            player.powerGrowth
          );

    return {
      rank:
        integerValue(
          player?.rank
        ) ||
        index + 1,

      id:
        normalizeText(
          player?.id ??
          player?.playerId ??
          player?.lordId
        ),

      name:
        normalizeText(
          player?.name
        ) || "-",

      alliance:
        normalizeText(
          player?.alliance
        ) || "-",

      serverStatus:
        normalizeStatus(
          player?.serverStatus
        ),

      serverStatusColor:
        normalizeLower(
          player?.serverStatusColor
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

      averageMeritsValue:
        player?.averageMeritsValue ===
          null ||
        player?.averageMeritsValue ===
          undefined
          ? null
          : integerValue(
              player.averageMeritsValue
            ),

      averageMeritsPercentage:
        player
          ?.averageMeritsPercentage ===
          null ||
        player
          ?.averageMeritsPercentage ===
          undefined
          ? null
          : numberValue(
              player
                .averageMeritsPercentage
            ),

      dateLeaveKingdom:
        normalizeText(
          player?.dateLeaveKingdom
        ),

      seasons:
        normalizeSeasons(
          player?.seasons
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
        .forEach(column => {
          const number =
            integerValue(
              column?.season ??
              column
            );

          if (number > 0) {
            seasons.add(number);
          }
        });
    }

    players.forEach(player => {
      Object.keys(
        player.seasons
      ).forEach(seasonNumber => {
        const number =
          integerValue(
            seasonNumber
          );

        if (number > 0) {
          seasons.add(number);
        }
      });
    });

    return [
      ...seasons
    ].sort(
      (
        first,
        second
      ) =>
        first -
        second
    );
  }

  /* =====================================================
     FILTERING
  ===================================================== */

  function playerMatchesSearch(player) {
    const search =
      normalizeLower(
        state.filters.search
      );

    if (!search) {
      return true;
    }

    return (
      normalizeLower(
        player.id
      ).includes(search) ||
      normalizeLower(
        player.name
      ).includes(search) ||
      normalizeLower(
        player.alliance
      ).includes(search)
    );
  }

  function playerMatchesStatus(player) {
    const filter =
      normalizeText(
        state.filters.status
      ).toUpperCase();

    if (
      !filter ||
      filter === "ALL"
    ) {
      return true;
    }

    return (
      player.serverStatus ===
      filter
    );
  }

  function playerMatchesTier(player) {
    const filter =
      normalizeText(
        state.filters.tier
      ).toUpperCase();

    if (
      !filter ||
      filter === "ALL"
    ) {
      return true;
    }

    return (
      player.troopTier ===
      filter
    );
  }

  /* =====================================================
     SORTING
  ===================================================== */

  function getSeasonValue(
    player,
    seasonNumber,
    metric
  ) {
    const season =
      player.seasons[
        String(seasonNumber)
      ];

    if (!season) {
      return null;
    }

    if (
      metric ===
      "merits"
    ) {
      return season.merits;
    }

    if (
      metric ===
      "power"
    ) {
      return season.currentPower;
    }

    if (
      metric ===
      "percentage"
    ) {
      return season
        .meritPowerPercentage;
    }

    return null;
  }

  function getSortValue(
    player,
    key
  ) {
    if (
      key.startsWith(
        "season:"
      )
    ) {
      const [
        ,
        seasonNumber,
        metric
      ] =
        key.split(":");

      return getSeasonValue(
        player,
        integerValue(
          seasonNumber
        ),
        metric
      );
    }

    switch (key) {
      case "id":
        return player.id;

      case "name":
        return player.name;

      case "alliance":
        return player.alliance;

      case "serverStatus":
        return player.serverStatus;

      case "troopTier":
        return player.troopTier;

      case "startPower":
        return player.startPower;

      case "historicalPower":
        return player.historicalPower;

      case "powerGrowth":
        return player.powerGrowth;

      case "topMerits":
        return player.topMerits;

      case "averageMeritsValue":
        return player
          .averageMeritsValue;

      case "averageMeritsPercentage":
        return player
          .averageMeritsPercentage;

      case "dateLeaveKingdom":
        return player
          .dateLeaveKingdom;

      default:
        return player.rank;
    }
  }

  function compareValues(
    first,
    second
  ) {
    if (
      first === null ||
      first === undefined ||
      first === ""
    ) {
      if (
        second === null ||
        second === undefined ||
        second === ""
      ) {
        return 0;
      }

      return 1;
    }

    if (
      second === null ||
      second === undefined ||
      second === ""
    ) {
      return -1;
    }

    if (
      typeof first ===
        "number" &&
      typeof second ===
        "number"
    ) {
      return first - second;
    }

    return normalizeText(first)
      .localeCompare(
        normalizeText(second),
        undefined,
        {
          numeric:
            true,

          sensitivity:
            "base"
        }
      );
  }

  function sortPlayers(players) {
    const direction =
      state.sort.direction ===
        "asc"
        ? 1
        : -1;

    return [...players]
      .sort(
        (
          first,
          second
        ) => {
          const result =
            compareValues(
              getSortValue(
                first,
                state.sort.key
              ),
              getSortValue(
                second,
                state.sort.key
              )
            );

          if (result !== 0) {
            return result * direction;
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

  function applyFiltersAndSorting() {
    state.visiblePlayers =
      sortPlayers(
        state.allPlayers
          .filter(
            playerMatchesSearch
          )
          .filter(
            playerMatchesStatus
          )
          .filter(
            playerMatchesTier
          )
      );
  }

  /* =====================================================
     RENDER FIXED TABLE
  ===================================================== */

  function createStatusMarkup(player) {
    return `
      <span
        class="
          old-players-status
          old-players-status-${escapeHtml(
            player.serverStatusColor
          )}
        "
      >
        ${escapeHtml(
          player.serverStatus
        )}
      </span>
    `;
  }

  function createTierMarkup(player) {
    return `
      <span
        class="
          old-players-tier
          old-players-tier-${normalizeLower(
            player.troopTier
          )}
        "
      >
        ${escapeHtml(
          player.troopTier
        )}
      </span>
    `;
  }

  function renderFixedTable(
    elements
  ) {
    const body =
      elements.fixedTableBody;

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
            class="old-players-empty"
          >
            No Old Players found.
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

              <td class="old-players-col-rank">
                ${index + 1}
              </td>

              <td class="old-players-col-id">
                <span class="old-players-player-id">
                  ${escapeHtml(
                    player.id
                  )}
                </span>
              </td>

              <td class="old-players-col-name">
                ${escapeHtml(
                  player.name
                )}
              </td>

              <td class="old-players-col-status">
                ${createStatusMarkup(
                  player
                )}
              </td>

              <td class="old-players-col-tier">
                ${createTierMarkup(
                  player
                )}
              </td>

              <td class="old-players-col-power">
                ${formatNumber(
                  player.startPower
                )}
              </td>

              <td class="old-players-col-power">
                <strong>
                  ${formatNumber(
                    player.historicalPower
                  )}
                </strong>
              </td>

              <td class="old-players-col-growth">
                ${formatSignedNumber(
                  player.powerGrowth
                )}
              </td>

              <td class="old-players-col-merits">
                ${formatNumber(
                  player.topMerits
                )}
              </td>

              <td class="old-players-col-average">
                ${
                  player.averageMeritsValue ===
                    null
                    ? "-"
                    : formatNumber(
                        player
                          .averageMeritsValue
                      )
                }
              </td>

              <td class="old-players-col-average">
                ${
                  player
                    .averageMeritsPercentage ===
                    null
                    ? "-"
                    : formatPercent(
                        player
                          .averageMeritsPercentage
                      )
                }
              </td>

              <td class="old-players-col-date">
                ${escapeHtml(
                  formatDate(
                    player
                      .dateLeaveKingdom
                  )
                )}
              </td>

            </tr>
          `
        )
        .join("");
  }

  /* =====================================================
     RENDER SEASON TABLE
  ===================================================== */

  function renderSeasonHeader(
    elements
  ) {
    const head =
      elements.seasonTableHead;

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
            class="old-players-season-empty-header"
          >
            Seasons will appear after archived Season data is loaded.
          </th>
        </tr>

        <tr>
          <th>Merits</th>
          <th>Power</th>
          <th>M-P (%)</th>
        </tr>
      `;

      return;
    }

    head.innerHTML = `
      <tr>
        ${state.seasonColumns
          .map(
            seasonNumber => `
              <th colspan="3">
                Season ${seasonNumber}
              </th>
            `
          )
          .join("")}
      </tr>

      <tr>
        ${state.seasonColumns
          .map(() => `
            <th>Merits</th>
            <th>Power</th>
            <th>M-P (%)</th>
          `)
          .join("")}
      </tr>
    `;
  }

  function renderSeasonTable(
    elements
  ) {
    const body =
      elements.seasonTableBody;

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
            class="old-players-empty"
          >
            No archived Season data found.
          </td>
        </tr>
      `;

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
            colspan="${
              state.seasonColumns
                .length * 3
            }"
            class="old-players-empty"
          >
            No Old Players found.
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
                  const season =
                    player.seasons[
                      String(
                        seasonNumber
                      )
                    ];

                  return `
                    <td>
                      ${
                        season?.merits ===
                          null ||
                        season?.merits ===
                          undefined
                          ? "-"
                          : formatNumber(
                              season.merits
                            )
                      }
                    </td>

                    <td>
                      ${
                        season
                          ?.currentPower ===
                          null ||
                        season
                          ?.currentPower ===
                          undefined
                          ? "-"
                          : formatNumber(
                              season
                                .currentPower
                            )
                      }
                    </td>

                    <td>
                      ${
                        season
                          ?.meritPowerPercentage ===
                          null ||
                        season
                          ?.meritPowerPercentage ===
                          undefined
                          ? "-"
                          : formatPercent(
                              season
                                .meritPowerPercentage
                            )
                      }
                    </td>
                  `;
                }
              )
              .join("")}
          </tr>
        `)
        .join("");
  }

  /* =====================================================
     SEASON FILTERS
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

  function renderSeasonFilters(
    elements
  ) {
    const container =
      elements
        .seasonFilterContainer;

    if (!container) {
      return;
    }

    if (
      state.seasonColumns
        .length ===
      0
    ) {
      container.innerHTML =
        (
          "Season filters appear after " +
          "archived Season data is loaded."
        );

      return;
    }

    container.innerHTML =
      state.seasonColumns
        .map(
          seasonNumber => `
            <div class="old-players-season-filter">

              <strong>
                Season ${seasonNumber}
              </strong>

              <select
                data-old-players-sort="season:${seasonNumber}:merits"
              >
                ${createSortOptions()}
              </select>

              <select
                data-old-players-sort="season:${seasonNumber}:power"
              >
                ${createSortOptions()}
              </select>

              <select
                data-old-players-sort="season:${seasonNumber}:percentage"
              >
                ${createSortOptions()}
              </select>

            </div>
          `
        )
        .join("");
  }

  /* =====================================================
     COUNT AND COMPLETE RENDER
  ===================================================== */

  function renderPlayerCount(
    elements
  ) {
    if (!elements.playerCount) {
      return;
    }

    const count =
      state.visiblePlayers
        .length;

    elements.playerCount
      .textContent =
        (
          `${count} old ` +
          (
            count === 1
              ? "player"
              : "players"
          )
        );
  }

  function renderCurrentState() {
    const elements =
      getElements();

    if (!elements) {
      return false;
    }

    applyFiltersAndSorting();

    renderFixedTable(
      elements
    );

    renderSeasonHeader(
      elements
    );

    renderSeasonTable(
      elements
    );

    renderPlayerCount(
      elements
    );

    return true;
  }

  /* =====================================================
     FILTER EVENTS
  ===================================================== */

  function resetFilters() {
    state.filters.search =
      "";

    state.filters.status =
      "all";

    state.filters.tier =
      "all";

    state.sort.key =
      "dateLeaveKingdom";

    state.sort.direction =
      "desc";

    const elements =
      getElements();

    if (!elements) {
      return;
    }

    if (elements.searchInput) {
      elements.searchInput.value =
        "";
    }

    if (elements.statusFilter) {
      elements.statusFilter.value =
        "all";
    }

    if (elements.tierFilter) {
      elements.tierFilter.value =
        "all";
    }

    queryAll(
      [
        "[data-old-players-sort]",
        ".old-players-sort-select"
      ],
      elements.page
    ).forEach(select => {
      select.value =
        "";
    });

    renderCurrentState();
  }

  function handleSortChange(
    select
  ) {
    const key =
      normalizeText(
        select.dataset
          .oldPlayersSort ??
        select.dataset
          .sortKey
      );

    const direction =
      normalizeText(
        select.value
      );

    queryAll(
      [
        "[data-old-players-sort]",
        ".old-players-sort-select"
      ],
      getPage()
    ).forEach(other => {
      if (other !== select) {
        other.value =
          "";
      }
    });

    if (
      !key ||
      !direction
    ) {
      state.sort.key =
        "dateLeaveKingdom";

      state.sort.direction =
        "desc";
    } else {
      state.sort.key =
        key;

      state.sort.direction =
        direction;
    }

    renderCurrentState();
  }

  function bindPageEvents() {
    const elements =
      getElements();

    if (!elements) {
      return false;
    }

    if (
      elements.page.dataset
        .oldPlayersEventsBound ===
      "true"
    ) {
      return true;
    }

    elements.page.dataset
      .oldPlayersEventsBound =
        "true";

    elements.searchInput
      ?.addEventListener(
        "input",
        event => {
          state.filters.search =
            event.target.value;

          renderCurrentState();
        }
      );

    elements.statusFilter
      ?.addEventListener(
        "change",
        event => {
          state.filters.status =
            event.target.value;

          renderCurrentState();
        }
      );

    elements.tierFilter
      ?.addEventListener(
        "change",
        event => {
          state.filters.tier =
            event.target.value;

          renderCurrentState();
        }
      );

    elements.resetButton
      ?.addEventListener(
        "click",
        resetFilters
      );

    elements.page
      .addEventListener(
        "change",
        event => {
          const select =
            event.target.closest(
              (
                "[data-old-players-sort]," +
                ".old-players-sort-select"
              )
            );

          if (!select) {
            return;
          }

          handleSortChange(
            select
          );
        }
      );

    return true;
  }

  /* =====================================================
     SCROLL SYNCHRONIZATION
  ===================================================== */

  function bindScrollSynchronization() {
    const elements =
      getElements();

    if (!elements) {
      return false;
    }

    const left =
      elements.leftScrollContainer;

    const right =
      elements.rightScrollContainer;

    if (
      !left ||
      !right ||
      left.dataset
        .oldPlayersScrollBound ===
        "true"
    ) {
      return false;
    }

    left.dataset
      .oldPlayersScrollBound =
        "true";

    right.dataset
      .oldPlayersScrollBound =
        "true";

    let syncing =
      false;

    left.addEventListener(
      "scroll",
      () => {
        if (syncing) {
          return;
        }

        syncing =
          true;

        right.scrollTop =
          left.scrollTop;

        syncing =
          false;
      }
    );

    right.addEventListener(
      "scroll",
      () => {
        if (syncing) {
          return;
        }

        syncing =
          true;

        left.scrollTop =
          right.scrollTop;

        syncing =
          false;
      }
    );

    return true;
  }

  /* =====================================================
     ERROR RENDERING
  ===================================================== */

  function renderError(error) {
    const elements =
      getElements();

    if (!elements) {
      return false;
    }

    const message =
      escapeHtml(
        error?.message ||
        "Old Players could not be loaded."
      );

    if (
      elements.fixedTableBody
    ) {
      elements.fixedTableBody
        .innerHTML = `
          <tr>
            <td
              colspan="13"
              class="old-players-empty"
            >
              ${message}
            </td>
          </tr>
        `;
    }

    if (
      elements.seasonTableBody
    ) {
      elements.seasonTableBody
        .innerHTML = `
          <tr>
            <td
              colspan="3"
              class="old-players-empty"
            >
              No archived Season data found.
            </td>
          </tr>
        `;
    }

    if (elements.playerCount) {
      elements.playerCount
        .textContent =
          "0 old players";
    }

    return true;
  }

  /* =====================================================
     INITIALIZATION AND RENDER
  ===================================================== */

  async function init() {
    const page =
      getPage();

    if (!page) {
      return false;
    }

    bindPageEvents();
    bindScrollSynchronization();

    state.initialized =
      true;

    return true;
  }

  async function render() {
    const page =
      getPage();

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

      state.dataset =
        dataset;

      state.allPlayers =
        dataset.players
          .filter(player => {
            return (
              player &&
              player.active !==
                true
            );
          })
          .map(
            normalizePlayer
          )
          .filter(player => {
            return Boolean(
              player.id
            );
          });

      state.seasonColumns =
        extractSeasonColumns(
          dataset,
          state.allPlayers
        );

      renderSeasonFilters(
        getElements()
      );

      bindPageEvents();
      bindScrollSynchronization();

      renderCurrentState();

      return true;
    } catch (error) {
      state.dataset =
        null;

      state.allPlayers =
        [];

      state.visiblePlayers =
        [];

      state.seasonColumns =
        [];

      renderError(error);

      return false;
    } finally {
      state.rendering =
        false;
    }
  }

  async function reload() {
    return render();
  }

  /* =====================================================
     GLOBAL REFRESH EVENTS
  ===================================================== */

  function bindGlobalEvents() {
    if (state.eventsBound) {
      return;
    }

    state.eventsBound =
      true;

    [
      "k630:matchmaking-generated",
      "k630:old-players-generated",
      "k630:season-archive-completed",
      "k630:old-players-refresh"
    ].forEach(eventName => {
      document.addEventListener(
        eventName,
        () => {
          if (getPage()) {
            reload();
          }
        }
      );
    });
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

      render,

      reload,

      resetFilters,

      getState() {
        return {
          initialized:
            state.initialized,

          rendering:
            state.rendering,

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

          filters: {
            ...state.filters
          },

          sort: {
            ...state.sort
          }
        };
      }
    });

  global.K630OldPlayersPage =
    publicApi;

  global.renderOldPlayersPage =
    render;

  bindGlobalEvents();
})(window);