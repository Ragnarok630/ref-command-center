/* =========================================================
   K630-REF PLAYER ID INFO PAGE CONTROLLER

   File:
   assets/js/pages/player-id-info.js

   Version:
   630.1.0 Gold Master

   Responsibilities:
   - Live player search after 2 characters
   - Search by Player ID or Player Name
   - Load current and former Kingdom 630 players
   - Render current player profile
   - Render current Season information
   - Render available archived Season information
   - Render player timeline information
   - No polling
   - No localStorage player database
========================================================= */

(function initializeK630PlayerIdInfoPage(global) {
  "use strict";

  const MODULE_NAME =
    "K630 Player ID Info Page";

  const MODULE_VERSION =
    "630.1.0";

  const HOME_KINGDOM =
    630;

  const MINIMUM_SEARCH_LENGTH =
    2;

  const MAXIMUM_SUGGESTIONS =
    12;

  const DATA_ROOT =
    (
      "https://raw.githubusercontent.com/" +
      "Ragnarok630/k630-public-data/main/assets/data"
    );

  const DATA_PATHS =
    Object.freeze({
      activeAverage:
        "generated/active-average/current.json",

      seasonInfo:
        "generated/season-info/current.json",

      oldPlayers:
        "generated/old-players/current.json",

      playerHistory:
        "generated/player-history/current.json",

      archiveIndex:
        "archives/index.json"
    });

  let initialized =
    false;

  let activeRequestId =
    0;

  let searchTimer =
    null;

  let playerIndex =
    [];

  let activeAverageData =
    null;

  let seasonInfoData =
    null;

  let oldPlayersData =
    null;

  let playerHistoryData =
    null;

  let archiveIndexData =
    null;

  let selectedPlayer =
    null;

  /* =====================================================
     BASIC HELPERS
  ===================================================== */

  function normalizeText(value) {
    return String(
      value ?? ""
    ).trim();
  }

  function normalizeDateValue(value) {

  if (
    value === null ||
    value === undefined ||
    value === false ||
    value === true
  ) {
    return "";
  }

  const text =
    String(value).trim();

  if (
    !text ||
    text.toLowerCase() === "false" ||
    text.toLowerCase() === "true" ||
    text === "-"
  ) {
    return "";
  }

  return text;
}

  function normalizeSearch(value) {
    return normalizeText(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );
  }

  function normalizeKey(value) {
    return normalizeText(value)
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ""
      );
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

    const parsed =
      Number(
        normalizeText(value)
          .replace(
            /\s/g,
            ""
          )
          .replace(
            /,/g,
            ""
          )
      );

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function integerValue(value) {
    return Math.trunc(
      numberValue(value)
    );
  }

  function booleanValue(value) {
    if (
      value === true ||
      value === false
    ) {
      return value;
    }

    const text =
      normalizeSearch(value);

    return (
      text === "true" ||
      text === "yes" ||
      text === "1"
    );
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function isPagePresent() {
    return Boolean(
      getElement(
        "playerIdInfoPage"
      )
    );
  }

  function setText(
    id,
    value,
    fallback = "-"
  ) {
    const element =
      getElement(id);

    if (!element) {
      return;
    }

    const text =
      normalizeText(value);

    element.textContent =
      text || fallback;
  }

  function setHidden(
    id,
    hidden
  ) {
    const element =
      getElement(id);

    if (element) {
      element.hidden =
        Boolean(hidden);
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

  function formatNumber(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    return integerValue(value)
      .toLocaleString(
        "en-US"
      );
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
          minimumFractionDigits:
            0,

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

    const isoMatch =
      text.match(
        /^(\d{4})-(\d{2})-(\d{2})/
      );

    if (isoMatch) {
      return (
        `${isoMatch[3]}-` +
        `${isoMatch[2]}-` +
        `${isoMatch[1]}`
      );
    }

    return text;
  }

  function createCacheBustedUrl(
    relativePath
  ) {
    return (
      `${DATA_ROOT}/${relativePath}` +
      `?cacheBust=${Date.now()}-${Math.random()}`
    );
  }

  function isPlainObject(value) {
    return Boolean(
      value &&
      typeof value ===
        "object" &&
      !Array.isArray(value)
    );
  }

  function getRecordValue(
    record,
    fieldNames
  ) {
    if (!isPlainObject(record)) {
      return undefined;
    }

    for (
      const fieldName of
      fieldNames
    ) {
      if (
        Object.prototype
          .hasOwnProperty
          .call(
            record,
            fieldName
          )
      ) {
        return record[fieldName];
      }
    }

    const normalized =
      new Map();

    Object.keys(record)
      .forEach(key => {
        normalized.set(
          normalizeKey(key),
          key
        );
      });

    for (
      const fieldName of
      fieldNames
    ) {
      const realKey =
        normalized.get(
          normalizeKey(fieldName)
        );

      if (realKey) {
        return record[realKey];
      }
    }

    return undefined;
  }

  function extractRecords(
    source,
    preferredKeys = []
  ) {
    if (Array.isArray(source)) {
      return source;
    }

    for (
      const key of
      preferredKeys
    ) {
      if (
        Array.isArray(
          source?.[key]
        )
      ) {
        return source[key];
      }

      if (
        isPlainObject(
          source?.[key]
        )
      ) {
        return Object.values(
          source[key]
        );
      }
    }

    if (
      Array.isArray(
        source?.data
      )
    ) {
      return source.data;
    }

    if (
      isPlainObject(
        source?.data
      )
    ) {
      return Object.values(
        source.data
      );
    }

    return [];
  }

  /* =====================================================
     FIELD DEFINITIONS
  ===================================================== */

  const FIELDS =
    Object.freeze({
      id: [
        "id",
        "playerId",
        "playerID",
        "Player ID",
        "Lord ID",
        "LordID"
      ],

      name: [
        "name",
        "playerName",
        "Player Name",
        "Lord Name",
        "LordName"
      ],

      alliance: [
        "alliance",
        "Alliance",
        "allianceName",
        "Alliance Name"
      ],

      currentPower: [
        "currentPower",
        "Current Power",
        "power",
        "Power"
      ],

      historicalPower: [
        "historicalPower",
        "Historical Power",
        "topPower",
        "Top Power"
      ],

      topMerits: [
        "topMerits",
        "Top Merits",
        "merits",
        "Merits"
      ],

      serverStatus: [
        "serverStatus",
        "Server Status",
        "level",
        "statusLevel"
      ],

      troopTier: [
        "troopTier",
        "T4/T5",
        "t4t5",
        "tier"
      ],

      playerType: [
        "playerType",
        "Player Type",
        "type"
      ],

      unitsDead: [
        "unitsDead",
        "Units Dead",
        "dead",
        "Dead"
      ],

      unitsKilled: [
        "unitsKilled",
        "Units Killed",
        "kills",
        "Kills"
      ],

      unitsHealed: [
        "unitsHealed",
        "Units Healed",
        "healed",
        "Healing"
      ],

      resourcesTotal: [
        "resourcesGathered",
        "Resources Gathered",
        "totalResources",
        "Total Resources"
      ],

      gold: [
        "goldGathered",
        "Gold Gathered",
        "gold"
      ],

      wood: [
        "woodGathered",
        "Wood Gathered",
        "wood"
      ],

      ore: [
        "oreGathered",
        "Ore Gathered",
        "ore"
      ],

      mana: [
        "manaGathered",
        "Mana Gathered",
        "mana"
      ],

      gems: [
        "gemsGathered",
        "Gems Gathered",
        "gems"
      ],

      troopPower: [
        "troopPower",
        "Troop Power"
      ],

      buildingPower: [
        "buildingPower",
        "Building Power"
      ],

      techPower: [
        "techPower",
        "Tech Power"
      ],

      heroPower: [
        "heroPower",
        "Hero Power"
      ],

      castleLevel: [
        "castleLevel",
        "Castle Level",
        "castle"
      ],

      faction: [
        "faction",
        "Faction"
      ],

      joinDate: [
        "joinDate",
        "Join 630",
        "dateJoinKingdom",
        "Date Join Kingdom",
        "startDate"
      ],

      leaveDate: [
        "leaveDate",
        "Leave 630",
        "dateLeaveKingdom",
        "Date Leave Kingdom",
        "leftDate"
      ],

      rejoinDate: [
        "rejoinDate",
        "Rejoin 630",
        "dateRejoinKingdom"
      ],

      note: [
        "note",
        "Note",
        "notes",
        "Notes"
      ],

      newPlayer: [
        "newPlayer",
        "isNew",
        "newDuringSeason"
      ],

      leftPlayer: [
        "leftPlayer",
        "isLeft",
        "leftDuringSeason"
      ],

      afkApproved: [
        "afkApproved",
        "AFK Approved",
        "afk"
      ]
    });

  /* =====================================================
     FETCHING
  ===================================================== */

  async function fetchRequiredJson(
    relativePath
  ) {
    const response =
      await fetch(
        createCacheBustedUrl(
          relativePath
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
          `${relativePath} could not be loaded. ` +
          `HTTP ${response.status}.`
        )
      );
    }

    return response.json();
  }

  async function fetchOptionalJson(
    relativePath,
    fallback = null
  ) {
    try {
      const response =
        await fetch(
          createCacheBustedUrl(
            relativePath
          ),
          {
            method:
              "GET",

            cache:
              "no-store"
          }
        );

      if (!response.ok) {
        return fallback;
      }

      return await response.json();
    } catch (error) {
      console.warn(
        `[${MODULE_NAME}] Optional JSON unavailable: ${relativePath}`,
        error
      );

      return fallback;
    }
  }

  async function loadBaseData() {
    setEngineStatus(
      "loading",
      "Loading players"
    );

    const [
      activeAverage,
      seasonInfo,
      oldPlayers,
      playerHistory,
      archiveIndex
    ] =
      await Promise.all([
        fetchRequiredJson(
          DATA_PATHS.activeAverage
        ),

        fetchOptionalJson(
          DATA_PATHS.seasonInfo,
          {}
        ),

        fetchOptionalJson(
          DATA_PATHS.oldPlayers,
          {}
        ),

        fetchOptionalJson(
          DATA_PATHS.playerHistory,
          {}
        ),

        fetchOptionalJson(
          DATA_PATHS.archiveIndex,
          {}
        )
      ]);

    activeAverageData =
      activeAverage;

    seasonInfoData =
      seasonInfo;

    oldPlayersData =
      oldPlayers;

    playerHistoryData =
      playerHistory;

    archiveIndexData =
      archiveIndex;

    buildPlayerIndex();

    setEngineStatus(
      "ready",
      "Ready"
    );
  }

  /* =====================================================
     PLAYER NORMALIZATION
  ===================================================== */

  function normalizePlayer(
    record,
    sourceType
  ) {
    const id =
      normalizeText(
        getRecordValue(
          record,
          FIELDS.id
        )
      );

    if (!id) {
      return null;
    }

    const historicalPower =
      integerValue(
        getRecordValue(
          record,
          FIELDS.historicalPower
        )
      );

    const currentPower =
      integerValue(
        getRecordValue(
          record,
          FIELDS.currentPower
        )
      ) ||
      historicalPower;

    const techPower =
      integerValue(
        getRecordValue(
          record,
          FIELDS.techPower
        )
      );

    const troopTier =
      normalizeText(
        getRecordValue(
          record,
          FIELDS.troopTier
        )
      ) ||
      (
        techPower > 28_931_214
          ? "T5"
          : "T4"
      );

    const playerType =
      normalizeText(
        getRecordValue(
          record,
          FIELDS.playerType
        )
      ) ||
      (
        historicalPower >
          20_000_000
          ? "Warrior"
          : "Farmer"
      );

    const leaveDate =
  normalizeDateValue(
    getRecordValue(
      record,
      FIELDS.leaveDate
    )
  );

    const leftDuringSeason =
      booleanValue(
        getRecordValue(
          record,
          FIELDS.leftPlayer
        )
      );

    const isFormer =
      sourceType ===
        "old-player" ||
      Boolean(leaveDate);

    return {
      raw:
        record,

      sourceType,

      id,

      name:
        normalizeText(
          getRecordValue(
            record,
            FIELDS.name
          )
        ) ||
        `Player ${id}`,

      alliance:
        normalizeText(
          getRecordValue(
            record,
            FIELDS.alliance
          )
        ) ||
        "-",

      currentPower,

      historicalPower:
        historicalPower ||
        currentPower,

      topMerits:
        integerValue(
          getRecordValue(
            record,
            FIELDS.topMerits
          )
        ),

      serverStatus:
        normalizeText(
          getRecordValue(
            record,
            FIELDS.serverStatus
          )
        ) ||
        "LV2",

      troopTier,

      playerType,

      unitsDead:
        integerValue(
          getRecordValue(
            record,
            FIELDS.unitsDead
          )
        ),

      unitsKilled:
        integerValue(
          getRecordValue(
            record,
            FIELDS.unitsKilled
          )
        ),

      unitsHealed:
        integerValue(
          getRecordValue(
            record,
            FIELDS.unitsHealed
          )
        ),

      resourcesTotal:
        integerValue(
          getRecordValue(
            record,
            FIELDS.resourcesTotal
          )
        ),

      gold:
        integerValue(
          getRecordValue(
            record,
            FIELDS.gold
          )
        ),

      wood:
        integerValue(
          getRecordValue(
            record,
            FIELDS.wood
          )
        ),

      ore:
        integerValue(
          getRecordValue(
            record,
            FIELDS.ore
          )
        ),

      mana:
        integerValue(
          getRecordValue(
            record,
            FIELDS.mana
          )
        ),

      gems:
        integerValue(
          getRecordValue(
            record,
            FIELDS.gems
          )
        ),

      troopPower:
        integerValue(
          getRecordValue(
            record,
            FIELDS.troopPower
          )
        ),

      buildingPower:
        integerValue(
          getRecordValue(
            record,
            FIELDS.buildingPower
          )
        ),

      techPower,

      heroPower:
        integerValue(
          getRecordValue(
            record,
            FIELDS.heroPower
          )
        ),

      castleLevel:
        normalizeText(
          getRecordValue(
            record,
            FIELDS.castleLevel
          )
        ),

      faction:
        normalizeText(
          getRecordValue(
            record,
            FIELDS.faction
          )
        ),

      joinDate:
        normalizeText(
          getRecordValue(
            record,
            FIELDS.joinDate
          )
        ),

      leaveDate,

      rejoinDate:
        normalizeText(
          getRecordValue(
            record,
            FIELDS.rejoinDate
          )
        ),

      note:
        normalizeText(
          getRecordValue(
            record,
            FIELDS.note
          )
        ),

      isNew:
        booleanValue(
          getRecordValue(
            record,
            FIELDS.newPlayer
          )
        ),

      isLeft:
        leftDuringSeason ||
        isFormer,

      afkApproved:
        booleanValue(
          getRecordValue(
            record,
            FIELDS.afkApproved
          )
        ),

      isFormer
    };
  }

  function mergePlayer(
    base,
    addition
  ) {
    if (!base) {
      return {
        ...addition
      };
    }

    const result = {
      ...base
    };

    Object.entries(
      addition
    ).forEach(
      (
        [
          key,
          value
        ]
      ) => {
        if (
          value === null ||
          value === undefined ||
          value === ""
        ) {
          return;
        }

        if (
          typeof value ===
            "number" &&
          value === 0 &&
          numberValue(
            result[key]
          ) > 0
        ) {
          return;
        }

        result[key] =
          value;
      }
    );

    result.rawSources =
      [
        ...(base.rawSources || [
          base.raw
        ]),
        addition.raw
      ].filter(Boolean);

    return result;
  }

  function buildPlayerIndex() {
  const map = new Map();

  const activePlayers =
    extractRecords(
      activeAverageData,
      [
        "players",
        "activePlayers",
        "rows"
      ]
    );

  const seasonPlayers =
    extractRecords(
      seasonInfoData,
      [
        "players",
        "participants",
        "rows"
      ]
    );

  const oldPlayers =
    extractRecords(
      oldPlayersData,
      [
        "players",
        "oldPlayers",
        "rows"
      ]
    );

  const historyPlayers =
    extractRecords(
      playerHistoryData,
      [
        "players",
        "playerHistory",
        "history",
        "records",
        "rows"
      ]
    );

  activePlayers
    .map(record =>
      normalizePlayer(
        record,
        "active"
      )
    )
    .filter(Boolean)
    .forEach(player => {
      map.set(
        player.id,
        player
      );
    });

  seasonPlayers
    .map(record =>
      normalizePlayer(
        record,
        "season"
      )
    )
    .filter(Boolean)
    .forEach(player => {
      map.set(
        player.id,
        mergePlayer(
          map.get(player.id),
          player
        )
      );
    });

  oldPlayers
    .map(record =>
      normalizePlayer(
        record,
        "old-player"
      )
    )
    .filter(Boolean)
    .forEach(player => {
      map.set(
        player.id,
        mergePlayer(
          map.get(player.id),
          player
        )
      );
    });

  historyPlayers
    .map(record =>
      normalizePlayer(
        record,
        "history"
      )
    )
    .filter(Boolean)
    .forEach(player => {
      map.set(
        player.id,
        mergePlayer(
          map.get(player.id),
          player
        )
      );
    });

  playerIndex =
    [
      ...map.values()
    ].sort(
      (
        first,
        second
      ) => {
        return (
          normalizeSearch(
            first.name
          ).localeCompare(
            normalizeSearch(
              second.name
            )
          )
        );
      }
    );

  console.info(
    (
      `[${MODULE_NAME}] ` +
      `${playerIndex.length} players indexed.`
    )
  );
}

  /* =====================================================
     SEARCH
  ===================================================== */

  function findSuggestions(query) {
    const normalizedQuery =
      normalizeSearch(query);

    if (
      normalizedQuery.length <
      MINIMUM_SEARCH_LENGTH
    ) {
      return [];
    }

    return playerIndex
      .map(player => {
        const normalizedId =
          normalizeSearch(
            player.id
          );

        const normalizedName =
          normalizeSearch(
            player.name
          );

        let score =
          100;

        if (
          normalizedId ===
          normalizedQuery
        ) {
          score =
            0;
        } else if (
          normalizedName ===
          normalizedQuery
        ) {
          score =
            1;
        } else if (
          normalizedId.startsWith(
            normalizedQuery
          )
        ) {
          score =
            2;
        } else if (
          normalizedName.startsWith(
            normalizedQuery
          )
        ) {
          score =
            3;
        } else if (
          normalizedId.includes(
            normalizedQuery
          )
        ) {
          score =
            4;
        } else if (
          normalizedName.includes(
            normalizedQuery
          )
        ) {
          score =
            5;
        } else {
          return null;
        }

        return {
          player,
          score
        };
      })
      .filter(Boolean)
      .sort(
        (
          first,
          second
        ) => {
          if (
            first.score !==
            second.score
          ) {
            return (
              first.score -
              second.score
            );
          }

          return (
            integerValue(
              second.player
                .historicalPower
            ) -
            integerValue(
              first.player
                .historicalPower
            )
          );
        }
      )
      .slice(
        0,
        MAXIMUM_SUGGESTIONS
      )
      .map(
        entry =>
          entry.player
      );
  }

  function renderSuggestions(
    query
  ) {
    const container =
      getElement(
        "playerIdSearchSuggestions"
      );

    const input =
      getElement(
        "playerIdSearchInput"
      );

    if (
      !container ||
      !input
    ) {
      return;
    }

    const results =
      findSuggestions(query);

    if (
      normalizeText(query).length <
        MINIMUM_SEARCH_LENGTH ||
      results.length ===
        0
    ) {
      container.innerHTML =
        "";

      container.hidden =
        true;

      input.setAttribute(
        "aria-expanded",
        "false"
      );

      return;
    }

    container.innerHTML =
      results.map(player => {
        const symbols =
          buildSymbolText(
            player
          );

        return `
          <button
            type="button"
            class="player-id-search-suggestion"
            role="option"
            data-player-id="${escapeHtml(player.id)}"
          >
            <span class="player-id-search-suggestion__identity">
              <strong>
                ${escapeHtml(player.name)}
              </strong>

              <span>
                ID ${escapeHtml(player.id)}
              </span>
            </span>

            <span class="player-id-search-suggestion__meta">
              <span>
                ${escapeHtml(player.alliance)}
              </span>

              <span>
                ${escapeHtml(
                  formatNumber(
                    player.historicalPower
                  )
                )}
              </span>

              ${
                symbols
                  ? `
                    <span>
                      ${escapeHtml(symbols)}
                    </span>
                  `
                  : ""
              }
            </span>
          </button>
        `;
      }).join("");

    container.hidden =
      false;

    input.setAttribute(
      "aria-expanded",
      "true"
    );

    container
      .querySelectorAll(
        "[data-player-id]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            openPlayerById(
              button.dataset.playerId
            );
          }
        );
      });
  }

  function findExactPlayer(query) {
    const normalized =
      normalizeSearch(query);

    if (!normalized) {
      return null;
    }

    return (
      playerIndex.find(player => {
        return (
          normalizeSearch(
            player.id
          ) ===
            normalized ||
          normalizeSearch(
            player.name
          ) ===
            normalized
        );
      }) ||
      findSuggestions(query)[0] ||
      null
    );
  }

  function openPlayerById(id) {
    const player =
      playerIndex.find(item => {
        return (
          normalizeText(item.id) ===
          normalizeText(id)
        );
      });

    if (!player) {
      showNotFound(
        id
      );

      return;
    }

    selectedPlayer =
      player;

    const input =
      getElement(
        "playerIdSearchInput"
      );

    if (input) {
      input.value =
        player.id;
    }

    closeSuggestions();
    updateClearButton();
    renderPlayer(player);
    updateUrl(player.id);
  }

  function submitSearch() {
    const input =
      getElement(
        "playerIdSearchInput"
      );

    const query =
      normalizeText(
        input?.value
      );

    if (!query) {
      showSearchMessage(
        "Enter at least 2 characters.",
        "warning"
      );

      return;
    }

    const player =
      findExactPlayer(query);

    if (!player) {
      showNotFound(query);

      return;
    }

    openPlayerById(
      player.id
    );
  }

  function closeSuggestions() {
    const container =
      getElement(
        "playerIdSearchSuggestions"
      );

    const input =
      getElement(
        "playerIdSearchInput"
      );

    if (container) {
      container.hidden =
        true;

      container.innerHTML =
        "";
    }

    input?.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  function clearSearch() {
    const input =
      getElement(
        "playerIdSearchInput"
      );

    if (input) {
      input.value =
        "";

      input.focus();
    }

    selectedPlayer =
      null;

    closeSuggestions();
    updateClearButton();
    showInitialState();
    clearSearchMessage();
    updateUrl("");
  }

  function updateClearButton() {
    const input =
      getElement(
        "playerIdSearchInput"
      );

    const button =
      getElement(
        "playerIdSearchClearButton"
      );

    if (button) {
      button.hidden =
        !normalizeText(
          input?.value
        );
    }
  }

  /* =====================================================
     STATES
  ===================================================== */

  function setEngineStatus(
  status,
  text
) {
  const container =
    getElement(
      "playerIdEngineStatus"
    );

  if (!container) {
    return;
  }

  container.dataset.status =
    status;

  const statusText =
    getElement(
      "playerIdEngineStatusText"
    );

  if (statusText) {
    statusText.textContent =
      text;
  }
}

  function showSearchMessage(
    message,
    type = "info"
  ) {
    const element =
      getElement(
        "playerIdSearchMessage"
      );

    if (!element) {
      return;
    }

    element.hidden =
      false;

    element.dataset.type =
      type;

    element.textContent =
      message;
  }

  function clearSearchMessage() {
    const element =
      getElement(
        "playerIdSearchMessage"
      );

    if (element) {
      element.hidden =
        true;

      element.textContent =
        "";
    }
  }

  function showInitialState() {
    setHidden(
      "playerIdEmptyState",
      false
    );

    setHidden(
      "playerIdLoadingState",
      true
    );

    setHidden(
      "playerIdNotFoundState",
      true
    );

    setHidden(
      "playerIdResult",
      true
    );
  }

  function showLoadingState() {
    setHidden(
      "playerIdEmptyState",
      true
    );

    setHidden(
      "playerIdLoadingState",
      false
    );

    setHidden(
      "playerIdNotFoundState",
      true
    );

    setHidden(
      "playerIdResult",
      true
    );
  }

  function showNotFound(query) {
    setHidden(
      "playerIdEmptyState",
      true
    );

    setHidden(
      "playerIdLoadingState",
      true
    );

    setHidden(
      "playerIdNotFoundState",
      false
    );

    setHidden(
      "playerIdResult",
      true
    );

    setText(
      "playerIdNotFoundText",
      (
        `No current or former Server 630 player ` +
        `matches “${normalizeText(query)}”.`
      )
    );

    showSearchMessage(
      "Player not found.",
      "error"
    );
  }

  function showResultState() {
    setHidden(
      "playerIdEmptyState",
      true
    );

    setHidden(
      "playerIdLoadingState",
      true
    );

    setHidden(
      "playerIdNotFoundState",
      true
    );

    setHidden(
      "playerIdResult",
      false
    );

    clearSearchMessage();
  }

  /* =====================================================
     SYMBOLS AND STATUS
  ===================================================== */

  function buildSymbolText(player) {
    const symbols =
      [];

    if (player.isNew) {
      symbols.push(
        "NEW"
      );
    }

    if (player.isLeft) {
      symbols.push(
        "LEFT"
      );
    }

    if (player.afkApproved) {
      symbols.push(
        "AFK"
      );
    }

    return symbols.join(
      " · "
    );
  }

  function buildNote(
  player,
  departureInfo = null
) {
  const notes =
    [];

  if (
    normalizeText(
      player?.note
    )
  ) {
    notes.push(
      normalizeText(
        player.note
      )
    );
  }

  if (
    departureInfo?.date
  ) {
    notes.push(
      (
        `Player disappeared from Kingdom 630 ` +
        `weekly data during ` +
        `${departureInfo.seasonNumber
          ? `Season ${departureInfo.seasonNumber}`
          : "a completed season"}`
      )
    );
  }

  if (
    player?.isNew
  ) {
    notes.push(
      "New player"
    );
  }

  if (
    player?.isLeft
  ) {
    notes.push(
      "Left Kingdom 630"
    );
  }

  if (
    player?.afkApproved
  ) {
    notes.push(
      "AFK approved"
    );
  }

  return notes;
}

  function renderBadge(
    id,
    value,
    dataValue
  ) {
    const badge =
      getElement(id);

    if (!badge) {
      return;
    }

    const strong =
      badge.querySelector(
        "strong"
      );

    if (strong) {
      strong.textContent =
        normalizeText(value) ||
        "-";
    }

    if (dataValue) {
      badge.dataset.value =
        normalizeKey(
          dataValue
        );
    }
  }

  /* =====================================================
     CURRENT SEASON LOOKUP
  ===================================================== */

  function findCurrentSeasonPlayer(
    playerId
  ) {
    return extractRecords(
      seasonInfoData,
      [
        "players",
        "participants",
        "rows"
      ]
    ).find(record => {
      return (
        normalizeText(
          getRecordValue(
            record,
            FIELDS.id
          )
        ) ===
        normalizeText(
          playerId
        )
      );
    }) ||
    null;
  }

  function extractCurrentWeeks(
    seasonRecord
  ) {
    if (!seasonRecord) {
      return [];
    }

    if (
      Array.isArray(
        seasonRecord.weeks
      )
    ) {
      return seasonRecord.weeks;
    }

    if (
      isPlainObject(
        seasonRecord.weeks
      )
    ) {
      return Object.entries(
        seasonRecord.weeks
      ).map(
        (
          [
            week,
            values
          ]
        ) => ({
          week,
          ...(
            isPlainObject(values)
              ? values
              : {}
          )
        })
      );
    }

    return [];
  }

  /* =====================================================
     ARCHIVE LOOKUP
  ===================================================== */

  function extractArchiveEntries() {
    if (
      Array.isArray(
        archiveIndexData
      )
    ) {
      return archiveIndexData;
    }

    if (
      Array.isArray(
        archiveIndexData
          ?.seasons
      )
    ) {
      return archiveIndexData
        .seasons;
    }

    if (
      Array.isArray(
        archiveIndexData
          ?.archives
      )
    ) {
      return archiveIndexData
        .archives;
    }

    return [];
  }

async function loadPlayerArchives(
  playerId
) {

  const entries =
    extractArchiveEntries();


  const results =
    [];


  function collectJsonPaths(
    source,
    output = []
  ) {

    if (
      source === null ||
      source === undefined
    ) {

      return output;

    }


    if (
      typeof source ===
        "string"
    ) {

      const value =
        normalizeText(
          source
        );


      if (
        /\.json(?:\?|$)/i.test(
          value
        )
      ) {

        let path =
          value
            .replace(
              /^https?:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\//i,
              ""
            )
            .replace(
              /^\/+/,
              ""
            )
            .replace(
              /^assets\/data\//i,
              ""
            );


        if (
          path &&
          !output.includes(
            path
          )
        ) {

          output.push(
            path
          );

        }

      }


      return output;

    }


    if (
      Array.isArray(
        source
      )
    ) {

      source.forEach(
        item =>
          collectJsonPaths(
            item,
            output
          )
      );


      return output;

    }


    if (
      typeof source ===
        "object"
    ) {

      Object.values(
        source
      ).forEach(
        value =>
          collectJsonPaths(
            value,
            output
          )
      );

    }


    return output;

  }


  function findPlayerRecordDeep(
    source
  ) {

    const visited =
      new Set();


    function walk(
      node
    ) {

      if (
        node === null ||
        node === undefined ||
        typeof node !==
          "object"
      ) {

        return null;

      }


      if (
        visited.has(
          node
        )
      ) {

        return null;

      }


      visited.add(
        node
      );


      if (
        Array.isArray(
          node
        )
      ) {

        for (
          const item of
          node
        ) {

          const result =
            walk(
              item
            );


          if (
            result
          ) {

            return result;

          }

        }


        return null;

      }


      const id =
        normalizeText(
          getRecordValue(
            node,
            FIELDS.id
          )
        );


      if (
        id &&
        id ===
          normalizeText(
            playerId
          )
      ) {

        return node;

      }


      for (
        const value of
        Object.values(
          node
        )
      ) {

        const result =
          walk(
            value
          );


        if (
          result
        ) {

          return result;

        }

      }


      return null;

    }


    return walk(
      source
    );

  }


  for (
    const entry of
    entries
  ) {

    const seasonNumber =
      integerValue(
        entry?.seasonNumber ??
        entry?.season ??
        entry?.number
      );


    if (
      seasonNumber <=
      0
    ) {

      continue;

    }


    /*
      Every JSON path stored in the archive entry.
    */

    const candidatePaths =
      collectJsonPaths(
        entry,
        []
      );


    /*
      Known fallback locations.
      These do NOT replace the paths above.
    */

    [
      `archives/season-${seasonNumber}.json`,

      `archives/season-${seasonNumber}/current.json`,

      `archives/season-${seasonNumber}/season-info.json`,

      `archives/season-${seasonNumber}/generated/season-info/current.json`,

      `archive/season-${seasonNumber}.json`,

      `archive/season-${seasonNumber}/current.json`,

      `archive/season-${seasonNumber}/season-info.json`,

      `archive/season-${seasonNumber}/generated/season-info/current.json`

    ].forEach(
      path => {

        if (
          !candidatePaths.includes(
            path
          )
        ) {

          candidatePaths.push(
            path
          );

        }

      }
    );


    let archiveData =
      null;


    let archivePath =
      null;


    for (
      const path of
      candidatePaths
    ) {

      const data =
        await fetchOptionalJson(
          path,
          null
        );


      if (
        data
      ) {

        const playerRecord =
          findPlayerRecordDeep(
            data
          );


        if (
          playerRecord
        ) {

          archiveData =
            data;

          archivePath =
            path;

          break;

        }

      }

    }


    if (
      !archiveData
    ) {

      console.warn(
        `[${MODULE_NAME}] No archive player record found for Season ${seasonNumber}.`,
        candidatePaths
      );


      continue;

    }


    results.push(
      normalizeArchiveSeason(
        seasonNumber,
        entry,
        archiveData,
        playerId
      )
    );

  }


  return results.sort(
    (
      first,
      second
    ) =>
      first.seasonNumber -
      second.seasonNumber
  );

}

function normalizeArchiveSeason(
  seasonNumber,
  archiveEntry,
  archiveData,
  playerId
) {

  function findPlayerRecordDeep(
    source
  ) {

    const visited =
      new Set();


    function walk(
      node
    ) {

      if (
        node === null ||
        node === undefined ||
        typeof node !==
          "object"
      ) {

        return null;

      }


      if (
        visited.has(
          node
        )
      ) {

        return null;

      }


      visited.add(
        node
      );


      if (
        Array.isArray(
          node
        )
      ) {

        for (
          const item of
          node
        ) {

          const result =
            walk(
              item
            );


          if (
            result
          ) {

            return result;

          }

        }


        return null;

      }


      const id =
        normalizeText(
          getRecordValue(
            node,
            FIELDS.id
          )
        );


      if (
        id &&
        id ===
          normalizeText(
            playerId
          )
      ) {

        return node;

      }


      for (
        const value of
        Object.values(
          node
        )
      ) {

        const result =
          walk(
            value
          );


        if (
          result
        ) {

          return result;

        }

      }


      return null;

    }


    return walk(
      source
    );

  }


  function findWeeksDeep(
    source
  ) {

    const result =
      {};


    const visited =
      new Set();


    function walk(
      node
    ) {

      if (
        node === null ||
        node === undefined ||
        typeof node !==
          "object"
      ) {

        return;

      }


      if (
        visited.has(
          node
        )
      ) {

        return;

      }


      visited.add(
        node
      );


      if (
        Array.isArray(
          node
        )
      ) {

        node.forEach(
          walk
        );

        return;

      }


      for (
        const [
          key,
          value
        ] of
        Object.entries(
          node
        )
      ) {

        const normalizedKey =
          normalizeKey(
            key
          );


        if (
          /^w[0-6]$/.test(
            normalizedKey
          ) &&
          isPlainObject(
            value
          )
        ) {

          result[
            normalizedKey
              .toUpperCase()
          ] =
            value;

        }


        walk(
          value
        );

      }

    }


    walk(
      source
    );


    return result;

  }


  const playerRecord =
    findPlayerRecordDeep(
      archiveData
    ) ||
    {};


  const weeks =
    findWeeksDeep(
      playerRecord
    );


  /*
    Last available week:
    W6 -> W5 -> W4 -> W3 -> W2 -> W1 -> W0
  */

  let finalWeek =
    null;


  for (
    let weekNumber = 6;
    weekNumber >= 0;
    weekNumber -= 1
  ) {

    const week =
      weeks[
        `W${weekNumber}`
      ];


    if (
      !isPlainObject(
        week
      )
    ) {

      continue;

    }


    if (
      week.available ===
        false
    ) {

      continue;

    }


    /*
      A week without "available" is still valid
      when it actually contains player data.
    */

    const hasUsefulData =
      week.currentPower !==
        undefined ||
      week.power !==
        undefined ||
      week.merits !==
        undefined ||
      week.meritPercent !==
        undefined ||
      week.meritsPercent !==
        undefined;


    if (
      week.available ===
        true ||
      hasUsefulData
    ) {

      finalWeek = {

        week:
          `W${weekNumber}`,

        data:
          week

      };

      break;

    }

  }


  const finalData =
    finalWeek?.data ||
    {};


  const power =
    integerValue(
      finalData.currentPower ??
      finalData.power ??
      getRecordValue(
        playerRecord,
        FIELDS.currentPower
      )
    );


  const merits =
    integerValue(
      finalData.merits ??
      finalData.meritValue ??
      getRecordValue(
        playerRecord,
        [
          "seasonMerits",
          "merits",
          "Merits"
        ]
      )
    );


  const meritPercent =
    numberValue(
      finalData.meritPercent ??
      finalData.meritsPercent ??
      finalData.meritPowerPercentage ??
      finalData.mp ??
      getRecordValue(
        playerRecord,
        [
          "meritPercent",
          "meritsPercent",
          "M-P",
          "Merits %"
        ]
      )
    );


  const rank =
    integerValue(
      finalData.rank ??
      getRecordValue(
        playerRecord,
        [
          "rank",
          "Rank",
          "seasonRank"
        ]
      )
    );


  return {

    seasonNumber,

    seasonName:
      normalizeText(
        archiveEntry?.seasonName ??
        archiveEntry?.name ??
        archiveEntry?.title
      ) ||
      `Season ${seasonNumber}`,

    power,

    merits,

    meritPercent,

    rank,

    weeks,

    lastAvailableWeek:
      finalWeek?.week ||
      null,

    lastAvailableData:
      finalData

  };

}

function getArchiveDepartureInfo(
  archives,
  player
) {
  if (
    !Array.isArray(archives)
  ) {
    return null;
  }

  const sortedArchives =
    [
      ...archives
    ].sort(
      (
        first,
        second
      ) =>
        first.seasonNumber -
        second.seasonNumber
    );

  for (
    const season of
    sortedArchives
  ) {

    if (
      !season.firstMissingWeek
    ) {
      continue;
    }

    const previousWeekNumber =
      Number(
        season.firstMissingWeek
          .replace(
            "W",
            ""
          )
      ) - 1;

    let departureDate =
      normalizeText(
        season
          .firstMissingData
          ?.officialDate
      );

    /*
      If the missing week itself has no
      date, try to find its official date
      from another participant in Season Info.
    */

    if (
      !departureDate &&
      isPlainObject(
        seasonInfoData
      )
    ) {

      const weekKey =
        season.firstMissingWeek;

      const allPlayers =
        extractRecords(
          seasonInfoData,
          [
            "players",
            "participants",
            "rows"
          ]
        );

      for (
        const record of
        allPlayers
      ) {

        const weekData =
          record?.weeks?.[weekKey];

        if (
          isPlainObject(
            weekData
          ) &&
          normalizeText(
            weekData.officialDate
          )
        ) {
          departureDate =
            normalizeText(
              weekData.officialDate
            );

          break;
        }
      }
    }

    /*
      Final fallback:
      use the last known week date.
    */

    if (
      !departureDate &&
      season.lastAvailableData
    ) {
      departureDate =
        normalizeText(
          season.lastAvailableData
            .officialDate
        );
    }

    return {
      seasonNumber:
        season.seasonNumber,

      week:
        season.firstMissingWeek,

      previousWeek:
        previousWeekNumber >= 0
          ? `W${previousWeekNumber}`
          : null,

      date:
        departureDate ||
        null
    };
  }

  /*
    Also use an explicitly stored leave date
    when available.
  */

  if (
    normalizeText(
      player?.leaveDate
    )
  ) {
    return {
      seasonNumber:
        null,

      week:
        null,

      previousWeek:
        null,

      date:
        normalizeText(
          player.leaveDate
        )
    };
  }

  return null;
}

  /* =====================================================
     TIMELINE
  ===================================================== */

function getPlayerTimeline(
  player,
  archiveSeasons = []
) {

  const events = [];

  /*
    =========================================================
    LOCAL HELPERS
    =========================================================
  */

  function findDeepValue(
    source,
    fieldNames
  ) {

    const wanted =
      new Set(
        [
          ...fieldNames,
          "leaveDate",
          "Leave 630",
          "Date Leave Kingdom",
          "dateLeaveKingdom",
          "leftDate",
          "dateLeft",
          "leave",
          "left",
          "leftKingdom",
          "leftKingdomDate",
          "leaveKingdomDate",
          "leave630",
          "left630"
        ].map(
          field =>
            normalizeKey(
              field
            )
        )
      );

    const visited =
      new Set();

    function walk(
      node
    ) {

      if (
        node === null ||
        node === undefined ||
        typeof node !==
          "object"
      ) {
        return undefined;
      }

      if (
        visited.has(
          node
        )
      ) {
        return undefined;
      }

      visited.add(
        node
      );

      if (
        Array.isArray(
          node
        )
      ) {

        for (
          const item of
            node
        ) {

          const result =
            walk(
              item
            );

          if (
            result !==
              undefined &&
            result !== ""
          ) {
            return result;
          }

        }

        return undefined;
      }

      for (
        const [
          key,
          value
        ] of
          Object.entries(
            node
          )
      ) {

        if (
          wanted.has(
            normalizeKey(
              key
            )
          ) &&
          value !==
            null &&
          value !==
            undefined &&
          value !== ""
        ) {
          return value;
        }

      }

      for (
        const value of
          Object.values(
            node
          )
      ) {

        const result =
          walk(
            value
          );

        if (
          result !==
            undefined &&
          result !== ""
        ) {
          return result;
        }

      }

      return undefined;
    }

    return walk(
      source
    );
  }

  function getWeekPower(
    week
  ) {

    if (
      !isPlainObject(
        week
      )
    ) {
      return 0;
    }

    return integerValue(
      week.currentPower ??
      week.power ??
      week.historicalPower
    );
  }

  function getWeekMerits(
    week
  ) {

    if (
      !isPlainObject(
        week
      )
    ) {
      return 0;
    }

    return integerValue(
      week.merits ??
      week.meritValue
    );
  }

  function hasWeekData(
    week
  ) {

    if (
      !isPlainObject(
        week
      )
    ) {
      return false;
    }

    if (
      week.available ===
        false
    ) {
      return false;
    }

    return (
      week.available ===
        true ||
      week.currentPower !==
        undefined ||
      week.power !==
        undefined ||
      week.historicalPower !==
        undefined ||
      week.merits !==
        undefined ||
      week.meritValue !==
        undefined ||
      week.meritPercent !==
        undefined ||
      week.meritsPercent !==
        undefined
    );
  }

  function findLastAvailableWeek(
    season
  ) {

    const weeks =
      isPlainObject(
        season?.weeks
      )
        ? season.weeks
        : {};

    for (
      let weekNumber = 6;
      weekNumber >= 0;
      weekNumber -= 1
    ) {

      const week =
        weeks[
          `W${weekNumber}`
        ];

      if (
        hasWeekData(
          week
        )
      ) {

        return {
          week:
            `W${weekNumber}`,

          data:
            week
        };

      }

    }

    return null;
  }

  function findFirstAvailableWeek(
    season
  ) {

    const weeks =
      isPlainObject(
        season?.weeks
      )
        ? season.weeks
        : {};

    for (
      let weekNumber = 0;
      weekNumber <= 6;
      weekNumber += 1
    ) {

      const week =
        weeks[
          `W${weekNumber}`
        ];

      if (
        hasWeekData(
          week
        )
      ) {

        return {
          week:
            `W${weekNumber}`,

          data:
            week
        };

      }

    }

    return null;
  }

  /*
    =========================================================
    RESOLVE LEAVE DATE
    =========================================================
  */

  let leaveDate =
    normalizeText(
      player?.leaveDate
    );

  /*
    1. merged raw sources
  */

  if (
    !leaveDate &&
    Array.isArray(
      player?.rawSources
    )
  ) {

    for (
      const source of
        player.rawSources
    ) {

      const candidate =
        findDeepValue(
          source,
          FIELDS.leaveDate
        );

      if (
        normalizeText(
          candidate
        )
      ) {

        leaveDate =
          normalizeText(
            candidate
          );

        break;
      }

    }

  }

  /*
    2. Old Players current dataset
  */

  if (
    !leaveDate
  ) {

    const records =
      extractRecords(
        oldPlayersData,
        [
          "players",
          "oldPlayers",
          "rows"
        ]
      );

    const oldRecord =
      records.find(
        record =>
          normalizeText(
            getRecordValue(
              record,
              FIELDS.id
            )
          ) ===
          normalizeText(
            player?.id
          )
      );

    if (
      oldRecord
    ) {

      leaveDate =
        normalizeText(
          findDeepValue(
            oldRecord,
            FIELDS.leaveDate
          )
        );

    }

  }

  /*
    3. Archive departure information.

    When a player has W5 but no W6, the first missing week is
    W6. The actual departure date is the official date of W6.
    Therefore the departure date is resolved from the missing
    week first, then from the last known week only as fallback.
  */

  if (
    !leaveDate &&
    Array.isArray(
      archiveSeasons
    )
  ) {

    for (
      const season of
        archiveSeasons
    ) {

      const weeks =
        isPlainObject(
          season?.weeks
        )
          ? season.weeks
          : {};

      let lastKnown =
        null;

      let firstMissing =
        null;

      for (
        let weekNumber = 0;
        weekNumber <= 6;
        weekNumber += 1
      ) {

        const week =
          weeks[
            `W${weekNumber}`
          ];

        if (
          hasWeekData(
            week
          )
        ) {

          lastKnown = {
            week:
              weekNumber,

            data:
              week
          };

        } else if (
          lastKnown
        ) {

          firstMissing = {
            week:
              weekNumber
          };

          break;
        }

      }

      if (
        firstMissing
      ) {

        /*
          Prefer an official date stored directly on the
          missing week, when available.
        */

        const missingWeek =
          weeks[
            `W${firstMissing.week}`
          ];

        leaveDate =
          normalizeText(
            missingWeek?.officialDate
          );

        /*
          Otherwise use the official date of that week's
          data from Season Info.
        */

        if (
          !leaveDate &&
          isPlainObject(
            seasonInfoData
          )
        ) {

          const records =
            extractRecords(
              seasonInfoData,
              [
                "players",
                "participants",
                "rows"
              ]
            );

          for (
            const record of
              records
          ) {

            const candidateWeek =
              record?.weeks?.[
                `W${firstMissing.week}`
              ];

            const candidateDate =
              normalizeText(
                candidateWeek?.officialDate
              );

            if (
              candidateDate
            ) {

              leaveDate =
                candidateDate;

              break;
            }

          }

        }

        /*
          Last fallback: last known week date.
        */

        if (
          !leaveDate &&
          lastKnown
        ) {

          leaveDate =
            normalizeText(
              lastKnown.data?.officialDate
            );

        }

      }

      if (
        leaveDate
      ) {
        break;
      }

    }

  }

  /*
    =========================================================
    JOINED KINGDOM 630
    =========================================================
  */

  const joinDate =
    normalizeText(
      player?.joinDate
    );

  if (
    joinDate
  ) {

    /*
      Historical Power here is the Historical Power that
      existed when the player joined, not the current value.
    */

    let joinHistoricalPower =
      integerValue(
        player?.historicalPower
      );

    if (
      Array.isArray(
        player?.rawSources
      )
    ) {

      for (
        const source of
          player.rawSources
      ) {

        const sourceHistorical =
          integerValue(
            findDeepValue(
              source,
              [
                "historicalPower",
                "Historical Power",
                "topPower",
                "Top Power"
              ]
            )
          );

        if (
          sourceHistorical > 0
        ) {

          joinHistoricalPower =
            sourceHistorical;

          break;
        }

      }

    }

    events.push({
      date:
        joinDate,

      type:
        "join",

      title:
        "Joined Kingdom 630",

      lines:
        [
          (
            `Historical Power: ` +
            `${formatNumber(
              joinHistoricalPower
            )}`
          )
        ]
    });

  }

  /*
    =========================================================
    ARCHIVED SEASONS
    =========================================================
  */

  for (
    const season of
      archiveSeasons
  ) {

    const seasonNumber =
      integerValue(
        season?.seasonNumber
      );

    if (
      seasonNumber <= 0
    ) {
      continue;
    }

    const seasonName =
      normalizeText(
        season?.seasonName
      ) ||
      `Season ${seasonNumber}`;

    const firstWeek =
      findFirstAvailableWeek(
        season
      );

    const lastWeek =
      findLastAvailableWeek(
        season
      );

    /*
      Season start
    */

    if (
      firstWeek &&
      normalizeText(
        firstWeek.data?.officialDate
      )
    ) {

      events.push({
        date:
          firstWeek.data.officialDate,

        type:
          "season-start",

        title:
          `${seasonName} Start`,

        lines:
          [
            (
              `Current Power: ` +
              `${formatNumber(
                getWeekPower(
                  firstWeek.data
                )
              )}`
            ),

            (
              `Merits Value: ` +
              `${formatNumber(
                getWeekMerits(
                  firstWeek.data
                )
              )}`
            )
          ]

      });

    }

    /*
      Season end
    */

    if (
      lastWeek &&
      normalizeText(
        lastWeek.data?.officialDate
      )
    ) {

      events.push({
        date:
          lastWeek.data.officialDate,

        type:
          "season-finish",

        title:
          `${seasonName} End`,

        lines:
          [
            (
              `Current Power: ` +
              `${formatNumber(
                getWeekPower(
                  lastWeek.data
                )
              )}`
            ),

            (
              `Merits Value: ` +
              `${formatNumber(
                getWeekMerits(
                  lastWeek.data
                )
              )}`
            )
          ]

      });

    }

  }

  /*
    =========================================================
    LEAVE KINGDOM 630
    =========================================================
  */

  if (
    leaveDate
  ) {

    /*
      Last known Historical Power before departure.
    */

    let historicalPower =
      0;

    let lastKnownWeek =
      null;

    for (
      let seasonIndex =
        archiveSeasons.length - 1;
      seasonIndex >= 0;
      seasonIndex -= 1
    ) {

      const season =
        archiveSeasons[
          seasonIndex
        ];

      const candidate =
        findLastAvailableWeek(
          season
        );

      if (
        candidate
      ) {

        lastKnownWeek =
          candidate;

        const candidatePower =
          integerValue(
            candidate.data?.historicalPower ??
            candidate.data?.currentPower ??
            candidate.data?.power
          );

        if (
          candidatePower > 0
        ) {

          historicalPower =
            candidatePower;

          break;
        }

      }

    }

    if (
      historicalPower <= 0
    ) {

      historicalPower =
        integerValue(
          player?.historicalPower
        );

    }

    events.push({
      date:
        leaveDate,

      type:
        "leave",

      title:
        "Left Kingdom 630",

      lines:
        [
          (
            `Historical Power: ` +
            `${formatNumber(
              historicalPower
            )}`
          )
        ]

    });

  }

  /*
    =========================================================
    REJOIN
    =========================================================
  */

  const rejoinDate =
    normalizeText(
      player?.rejoinDate
    );

  if (
    rejoinDate
  ) {

    events.push({
      date:
        rejoinDate,

      type:
        "rejoin",

      title:
        "Rejoined Kingdom 630",

      lines:
        []
    });

  }

  /*
    =========================================================
    REMOVE EXACT DUPLICATES
    =========================================================
  */

  const uniqueEvents =
    new Map();

  events.forEach(
    event => {

      const date =
        normalizeText(
          event?.date
        );

      if (
        !date
      ) {
        return;
      }

      const key =
        [
          date,

          normalizeText(
            event?.type
          ),

          normalizeText(
            event?.title
          )
        ].join("|");

      uniqueEvents.set(
        key,
        event
      );

    }
  );

  return [
    ...uniqueEvents.values()
  ].sort(
    (
      first,
      second
    ) => {

      return (
        (
          Date.parse(
            first.date
          ) || 0
        ) -
        (
          Date.parse(
            second.date
          ) || 0
        )
      );

    }
  );

}

  /* =====================================================
     RENDER PLAYER
  ===================================================== */

async function renderPlayer(
  player
) {

  showLoadingState();

  const requestId =
    ++activeRequestId;

  const seasonRecord =
    findCurrentSeasonPlayer(
      player.id
    );

  const archiveSeasons =
    await loadPlayerArchives(
      player.id
    );

  if (
    requestId !==
      activeRequestId ||
    !isPagePresent()
  ) {

    return;

  }

  /*
    ---------------------------------------------------------
    MERGE CURRENT PLAYER DATA
    ---------------------------------------------------------
  */

  const merged =
    seasonRecord
      ? mergePlayer(
          player,
          normalizePlayer(
            seasonRecord,
            "season"
          )
        )
      : {
          ...player
        };

  /*
    ---------------------------------------------------------
    BUILD TIMELINE FIRST
    ---------------------------------------------------------

    The timeline is now the single source of truth for
    Leave 630. This prevents Membership and Timeline from
    disagreeing about the departure date.
  */

  const timelineEvents =
    getPlayerTimeline(
      merged,
      archiveSeasons
    );

  const leaveEvent =
    timelineEvents.find(
      event =>
        event?.type ===
        "leave"
    );

  /*
    ---------------------------------------------------------
    CREATE DISPLAY PLAYER
    ---------------------------------------------------------

    Do not mutate the original player object.

    When a Leave 630 event exists, make the display copy
    explicitly inactive and give it the exact same leave date
    used by the Timeline.
  */

  const displayPlayer =
    leaveEvent?.date
      ? {
          ...merged,

          leaveDate:
            leaveEvent.date,

          isLeft:
            true,

          isFormer:
            true
        }
      : merged;

  /*
    ---------------------------------------------------------
    EXISTING PAGE RENDERING
    ---------------------------------------------------------
  */

  renderPlayerSummary(
    displayPlayer
  );

  renderPerformance(
    displayPlayer
  );

  renderResources(
    displayPlayer
  );

  renderPowerInfo(
    displayPlayer
  );

  renderMembership(
    displayPlayer
  );

  renderSeasonArchives(
    archiveSeasons,
    seasonRecord
  );

  renderTimeline(
    timelineEvents
  );

  showResultState();

  document.dispatchEvent(
    new CustomEvent(
      "k630:player-id-rendered",
      {
        detail: {

          playerId:
            displayPlayer.id,

          name:
            displayPlayer.name,

          archiveSeasons:
            archiveSeasons.length

        }
      }
    )
  );

}

function renderPlayerSummary(
  player
) {

  setText(
    "playerIdSummaryId",
    player.id
  );


  setText(
    "playerIdResultName",
    player.name
  );


  setText(
    "playerIdSummaryAlliance",
    player.alliance
  );


  const inactive =
    Boolean(
      player.leaveDate
    ) ||
    Boolean(
      player.isLeft
    ) ||
    Boolean(
      player.isFormer
    );


  const membership =
    inactive
      ? "Inactive Player"
      : "Active Player";


  const membershipBadge =
    getElement(
      "playerIdMembershipStatus"
    );


  if (
    membershipBadge
  ) {

    membershipBadge.textContent =
      membership;


    membershipBadge.dataset.membership =
      inactive
        ? "inactive"
        : "active";


    membershipBadge.style.color =
      inactive
        ? "#ff3147"
        : "#67e84d";


    membershipBadge.style.fontWeight =
      "800";

  }


  renderBadge(
    "playerIdSummaryServerStatus",
    player.serverStatus,
    player.serverStatus
  );


  renderBadge(
    "playerIdSummaryTroopTier",
    player.troopTier,
    player.troopTier
  );


  renderBadge(
    "playerIdSummaryPlayerType",
    player.playerType,
    player.playerType
  );

}

  function renderPerformance(
    player
  ) {
    setText(
      "playerIdPlayerCurrentPower",
      formatNumber(
        player.currentPower
      )
    );

    setText(
      "playerIdPlayerTopPower",
      formatNumber(
        player.historicalPower
      )
    );

    setText(
      "playerIdPlayerTopMerits",
      formatNumber(
        player.topMerits
      )
    );

    setText(
      "playerIdPlayerUnitsDead",
      formatNumber(
        player.unitsDead
      )
    );

    setText(
      "playerIdPlayerUnitsKilled",
      formatNumber(
        player.unitsKilled
      )
    );

    setText(
      "playerIdPlayerUnitsHealed",
      formatNumber(
        player.unitsHealed
      )
    );
  }

  function renderResources(
    player
  ) {
    setText(
      "playerIdResourcesTotal",
      formatNumber(
        player.resourcesTotal
      )
    );

    setText(
      "playerIdResourcesGold",
      formatNumber(
        player.gold
      )
    );

    setText(
      "playerIdResourcesWood",
      formatNumber(
        player.wood
      )
    );

    setText(
      "playerIdResourcesOre",
      formatNumber(
        player.ore
      )
    );

    setText(
      "playerIdResourcesMana",
      formatNumber(
        player.mana
      )
    );

    setText(
      "playerIdResourcesGems",
      formatNumber(
        player.gems
      )
    );
  }

  function renderPowerInfo(
    player
  ) {
    setText(
      "playerIdPowerTroop",
      formatNumber(
        player.troopPower
      )
    );

    setText(
      "playerIdPowerBuilding",
      formatNumber(
        player.buildingPower
      )
    );

    setText(
      "playerIdPowerTech",
      formatNumber(
        player.techPower
      )
    );

    setText(
      "playerIdPowerHero",
      formatNumber(
        player.heroPower
      )
    );

    setText(
      "playerIdPowerCastle",
      player.castleLevel
    );

    setText(
      "playerIdPowerFaction",
      player.faction
    );
  }

function renderMembership(
  player
) {

  /*
    =========================================================
    MEMBERSHIP STATUS
    =========================================================
  */

  const inactive =
    Boolean(
      player?.leaveDate
    ) ||
    Boolean(
      player?.isLeft
    ) ||
    Boolean(
      player?.isFormer
    );

  const statusElement =
    getElement(
      "playerIdMembershipPanelStatus"
    );

  if (
    statusElement
  ) {

    statusElement.textContent =
      inactive
        ? "Inactive Player"
        : "Active Player";

    statusElement.dataset.membership =
      inactive
        ? "inactive"
        : "active";

    statusElement.style.setProperty(
      "color",
      inactive
        ? "#ff3147"
        : "#45ff78",
      "important"
    );

    statusElement.style.setProperty(
      "font-weight",
      "800",
      "important"
    );

  }

  /*
    =========================================================
    JOIN 630
    =========================================================
  */

  setText(
    "playerIdServerJoin",
    formatDate(
      player?.joinDate
    )
  );

  /*
    =========================================================
    LEAVE 630
    =========================================================
  */

  const leaveElement =
    getElement(
      "playerIdServerLeave"
    );

  if (
    leaveElement
  ) {

    const leaveDate =
      normalizeText(
        player?.leaveDate
      );

    leaveElement.textContent =
      leaveDate
        ? formatDate(
            leaveDate
          )
        : "-";

    if (
      leaveDate
    ) {

      leaveElement.classList.add(
        "player-id-leave-date"
      );

      leaveElement.style.setProperty(
        "display",
        "inline-block",
        "important"
      );

      leaveElement.style.setProperty(
        "color",
        "#ff3147",
        "important"
      );

      leaveElement.style.setProperty(
        "font-weight",
        "800",
        "important"
      );

      leaveElement.title =
        "Date the player left Kingdom 630.";

    } else {

      leaveElement.classList.remove(
        "player-id-leave-date"
      );

      leaveElement.style.removeProperty(
        "display"
      );

      leaveElement.style.removeProperty(
        "color"
      );

      leaveElement.style.removeProperty(
        "font-weight"
      );

      leaveElement.removeAttribute(
        "title"
      );

    }

  }

  /*
    =========================================================
    REJOIN
    =========================================================
  */

  setText(
    "playerIdServerRejoin",
    formatDate(
      player?.rejoinDate
    )
  );

  /*
    =========================================================
    NOTE

    Never show the note text itself.
    Always show the warning symbol with the note as tooltip.
    =========================================================
  */

  const noteElement =
    getElement(
      "playerIdStatusNote"
    );

  if (
    !noteElement
  ) {

    return;

  }

  noteElement.innerHTML =
    "";

  const noteText =
    normalizeText(
      player?.note
    );

  if (
    noteText ||
    inactive
  ) {

    const warning =
      document.createElement(
        "span"
      );

    warning.className =
      "player-id-note-warning";

    warning.setAttribute(
      "aria-label",
      "Player status note"
    );

    warning.innerHTML =
      `
        <i
          class="fa-solid fa-triangle-exclamation"
          aria-hidden="true"
        ></i>
      `;

    warning.style.setProperty(
      "display",
      "inline-flex",
      "important"
    );

    warning.style.setProperty(
      "align-items",
      "center",
      "important"
    );

    warning.style.setProperty(
      "justify-content",
      "center",
      "important"
    );

    warning.style.setProperty(
      "width",
      "18px",
      "important"
    );

    warning.style.setProperty(
      "height",
      "18px",
      "important"
    );

    warning.style.setProperty(
      "color",
      "#ff3147",
      "important"
    );

    warning.style.setProperty(
      "cursor",
      "help",
      "important"
    );

    warning.title =
      noteText ||
      (
        inactive
          ? "Player has left Kingdom 630."
          : "Player note."
      );

    noteElement.appendChild(
      warning
    );

  } else {

    noteElement.textContent =
      "-";

  }

}


function renderSeasonArchives(
    archives,
    currentSeasonRecord
  ) {
    const head =
      getElement(
        "playerIdSeasonTableHead"
      );

    const body =
      getElement(
        "playerIdSeasonTableBody"
      );

    const empty =
      getElement(
        "playerIdSeasonEmpty"
      );

    const currentSeason =
      normalizeCurrentSeason(
        currentSeasonRecord
      );

    const seasons =
      [
        ...archives
      ];

    if (currentSeason) {
      seasons.push(
        currentSeason
      );
    }

    seasons.sort(
      (
        first,
        second
      ) =>
        first.seasonNumber -
        second.seasonNumber
    );

    if (
      !head ||
      !body
    ) {
      return;
    }

    if (
      seasons.length ===
      0
    ) {
      if (empty) {
        empty.hidden =
          false;
      }

      head.innerHTML = `
        <tr>
          <th
            class="player-id-season-table__metric"
            scope="col"
          >
            Metric
          </th>
        </tr>
      `;

      body.innerHTML = `
        <tr data-season-metric="power">
          <th scope="row">Power</th>
        </tr>

        <tr data-season-metric="merits">
          <th scope="row">Merits Value</th>
        </tr>

        <tr data-season-metric="meritPercent">
          <th scope="row">Merits %</th>
        </tr>

        <tr data-season-metric="rank">
          <th scope="row">Rank</th>
        </tr>
      `;

      return;
    }

    if (empty) {
      empty.hidden =
        true;
    }

    head.innerHTML = `
      <tr>
        <th
          class="player-id-season-table__metric"
          scope="col"
        >
          Metric
        </th>

        ${seasons.map(season => {
          return `
            <th scope="col">
              ${escapeHtml(
                season.seasonName
              )}
            </th>
          `;
        }).join("")}
      </tr>
    `;

    body.innerHTML = `
      <tr data-season-metric="power">
        <th scope="row">
          <i class="fa-solid fa-bolt"></i>
          Power
        </th>

        ${seasons.map(season => `
          <td>
            ${formatNumber(
              season.power
            )}
          </td>
        `).join("")}
      </tr>

      <tr data-season-metric="merits">
        <th scope="row">
          <i class="fa-solid fa-medal"></i>
          Merits Value
        </th>

        ${seasons.map(season => `
          <td>
            ${formatNumber(
              season.merits
            )}
          </td>
        `).join("")}
      </tr>

      <tr data-season-metric="meritPercent">
        <th scope="row">
          <i class="fa-solid fa-percent"></i>
          Merits %
        </th>

        ${seasons.map(season => `
          <td>
            ${formatPercent(
              season.meritPercent
            )}
          </td>
        `).join("")}
      </tr>

      <tr data-season-metric="rank">
        <th scope="row">
          <i class="fa-solid fa-ranking-star"></i>
          Rank
        </th>

        ${seasons.map(season => `
          <td>
            ${
              season.rank > 0
                ? formatNumber(
                    season.rank
                  )
                : "-"
            }
          </td>
        `).join("")}
      </tr>
    `;
  }

  function normalizeCurrentSeason(
    record
  ) {
    if (!record) {
      return null;
    }

    const seasonNumber =
      integerValue(
        seasonInfoData
          ?.season
          ?.number ??
        seasonInfoData
          ?.seasonNumber ??
        1
      );

    const weeks =
      extractCurrentWeeks(
        record
      );

    const latestWeek =
      weeks[
        weeks.length - 1
      ] ||
      {};

    return {
      seasonNumber,

      seasonName:
        normalizeText(
          seasonInfoData
            ?.season
            ?.name ??
          seasonInfoData
            ?.seasonName
        ) ||
        `Season ${seasonNumber}`,

      power:
        integerValue(
          latestWeek.currentPower ??
          latestWeek.power ??
          getRecordValue(
            record,
            FIELDS.currentPower
          )
        ),

      merits:
        integerValue(
          latestWeek.merits ??
          getRecordValue(
            record,
            FIELDS.topMerits
          )
        ),

      meritPercent:
        numberValue(
          latestWeek.meritPercent ??
          latestWeek.meritsPercent
        ),

      rank:
        integerValue(
          latestWeek.rank ??
          record.rank
        )
    };
  }

function renderTimeline(
  events
) {

  const timeline =
    getElement(
      "playerIdTimeline"
    );


  const empty =
    getElement(
      "playerIdTimelineEmpty"
    );


  if (
    !timeline
  ) {

    return;

  }


  /*
    -----------------------------------------------------
    TIMELINE ONLY
    -----------------------------------------------------
  */

  const panel =
    timeline.closest(
      ".player-id-timeline-panel"
    );


  const scroll =
    timeline.closest(
      ".player-id-timeline-scroll"
    );


  /*
    Small, compact layout.
    Enough room for 3 lines of information,
    without the huge empty area from before.
  */

  if (
    panel
  ) {

    panel.style.setProperty(
      "height",
      "158px",
      "important"
    );


    panel.style.setProperty(
      "min-height",
      "158px",
      "important"
    );


    panel.style.setProperty(
      "max-height",
      "158px",
      "important"
    );


    panel.style.setProperty(
      "overflow",
      "visible",
      "important"
    );

  }


  if (
    scroll
  ) {

    scroll.style.setProperty(
      "height",
      "130px",
      "important"
    );


    scroll.style.setProperty(
      "max-height",
      "130px",
      "important"
    );


    scroll.style.setProperty(
      "overflow-x",
      "auto",
      "important"
    );


    scroll.style.setProperty(
      "overflow-y",
      "hidden",
      "important"
    );

  }


  timeline.style.setProperty(
    "height",
    "120px",
    "important"
  );


  timeline.style.setProperty(
    "min-height",
    "120px",
    "important"
  );


  timeline.style.setProperty(
    "width",
    "max-content",
    "important"
  );


  timeline.style.setProperty(
    "min-width",
    "100%",
    "important"
  );


  timeline.style.setProperty(
    "display",
    "flex",
    "important"
  );


  timeline.style.setProperty(
    "align-items",
    "flex-start",
    "important"
  );


  timeline.style.setProperty(
    "gap",
    "6px",
    "important"
  );


  if (
    !Array.isArray(
      events
    ) ||
    events.length ===
      0
  ) {

    timeline.innerHTML =
      "";


    if (
      empty
    ) {

      empty.hidden =
        false;

    }


    return;

  }


  if (
    empty
  ) {

    empty.hidden =
      true;

  }


  timeline.innerHTML =
    events.map(
      event => {

        let icon =
          "fa-clock-rotate-left";


        if (
          event.type ===
          "join"
        ) {

          icon =
            "fa-right-to-bracket";

        } else if (
          event.type ===
          "leave"
        ) {

          icon =
            "fa-right-from-bracket";

        } else if (
          event.type ===
          "rejoin"
        ) {

          icon =
            "fa-right-to-bracket";

        } else if (
          event.type ===
          "season-start"
        ) {

          icon =
            "fa-flag";

        } else if (
          event.type ===
          "season-finish"
        ) {

          icon =
            "fa-trophy";

        }


        const lines =
          Array.isArray(
            event.lines
          )
            ? event.lines
            : [];


        const details =
          lines
            .map(
              line =>
                `
                  <span
                    class="player-id-timeline-item__line"
                  >
                    ${escapeHtml(
                      line
                    )}
                  </span>
                `
            )
            .join("");


        const article =
          `
            <article
              class="player-id-timeline-item"
              role="listitem"
              data-event-type="${escapeHtml(
                event.type
              )}"
            >

              <span
                class="player-id-timeline-item__icon"
              >
                <i
                  class="fa-solid ${icon}"
                  aria-hidden="true"
                ></i>
              </span>


              <div
                class="player-id-timeline-item__content"
              >

                <time>
                  ${escapeHtml(
                    formatDate(
                      event.date
                    )
                  )}
                </time>


                <strong>
                  ${escapeHtml(
                    event.title
                  )}
                </strong>


                ${
                  details
                    ? `
                      <div
                        class="player-id-timeline-item__details"
                      >
                        ${details}
                      </div>
                    `
                    : ""
                }

              </div>

            </article>
          `;


        return article;

      }
    ).join("");


  /*
    Apply compact dimensions after rendering.
    This is intentionally limited to Timeline cards.
  */

  timeline
    .querySelectorAll(
      ".player-id-timeline-item"
    )
    .forEach(
      item => {

        item.style.setProperty(
          "flex",
          "0 0 175px",
          "important"
        );


        item.style.setProperty(
          "width",
          "175px",
          "important"
        );


        item.style.setProperty(
          "min-width",
          "175px",
          "important"
        );


       item.style.setProperty(
          "height",
          "116px",
          "important"
        );

        item.style.setProperty(
          "min-height",
          "116px",
          "important"
        );

        item.style.setProperty(
          "max-height",
          "116px",
          "important"
        );

        item.style.setProperty(
          "padding",
          "6px 8px",
          "important"
        );

        item.style.setProperty(
          "margin-top",
          "6px",
          "important"
        );

        item.style.setProperty(
          "margin-bottom",
          "6px",
          "important"
        );

        item.style.setProperty(
          "box-sizing",
          "border-box",
          "important"
        );

       item.style.setProperty(
          "overflow",
          "visible",
          "important"
        );


        const date =
          item.querySelector(
            "time"
          );


        if (
          date
        ) {

          date.style.setProperty(
            "font-size",
            "8px",
            "important"
          );


          date.style.setProperty(
            "line-height",
            "1.1",
            "important"
          );


          if (
            item.dataset.eventType ===
            "leave"
          ) {

            date.style.setProperty(
              "color",
              "#ff3147",
              "important"
            );


            date.style.setProperty(
              "font-weight",
              "800",
              "important"
            );

          }

        }


        const title =
          item.querySelector(
            "strong"
          );


        if (
          title
        ) {

          title.style.setProperty(
            "font-size",
            "9px",
            "important"
          );


          title.style.setProperty(
            "line-height",
            "1.1",
            "important"
          );

        }

        const content =
          item.querySelector(
            ".player-id-timeline-item__content"
          );

        if (
          content
        ) {
          content.style.setProperty(
            "display",
            "grid",
            "important"
          );

          content.style.setProperty(
            "grid-template-rows",
            "12px 14px 36px",
            "important"
          );

          content.style.setProperty(
            "height",
            "62px",
            "important"
          );

          content.style.setProperty(
            "overflow",
            "visible",
            "important"
          );

          content.style.setProperty(
            "align-content",
            "start",
            "important"
          );

          content.style.setProperty(
            "gap",
            "2px",
            "important"
          );

          content.style.setProperty(
            "min-width",
            "0",
            "important"
          );
        }

        item
  .querySelectorAll(
    ".player-id-timeline-item__details"
  )
  .forEach(
    details => {
      details.style.setProperty(
        "display",
        "grid",
        "important"
      );

      details.style.setProperty(
        "gap",
        "2px",
        "important"
      );

      details.style.setProperty(
        "overflow",
        "visible",
        "important"
      );

      details
        .querySelectorAll(
          ".player-id-timeline-item__line"
        )
        .forEach(
          line => {
            line.style.setProperty(
              "display",
              "block",
              "important"
            );

            line.style.setProperty(
              "height",
              "10px",
              "important"
            );

            line.style.setProperty(
              "line-height",
              "10px",
              "important"
            );

            line.style.setProperty(
              "white-space",
              "nowrap",
              "important"
            );
          }
        );
    }
  );


        item
          .querySelectorAll(
            ".player-id-timeline-item__line"
          )
          .forEach(
            line => {

              line.style.setProperty(
                "font-size",
                "8px",
                "important"
              );


              line.style.setProperty(
                "line-height",
                "1.1",
                "important"
              );


              line.style.setProperty(
                "white-space",
                "nowrap",
                "important"
              );

            }
          );

      }
    );

}

  /* =====================================================
     URL
  ===================================================== */

  function getUrlPlayerSearch() {
    const parameters =
      new URLSearchParams(
        global.location.search
      );

    return normalizeText(
      parameters.get(
        "playerSearch"
      )
    );
  }

  function updateUrl(playerId) {
    const url =
      new URL(
        global.location.href
      );

    if (playerId) {
      url.searchParams.set(
        "playerSearch",
        playerId
      );
    } else {
      url.searchParams.delete(
        "playerSearch"
      );
    }

    global.history.replaceState(
      global.history.state,
      "",
      url
    );
  }

  /* =====================================================
     EVENTS
  ===================================================== */

  function bindEvents() {
  const form =
    getElement(
      "playerIdSearchForm"
    );

  const input =
    getElement(
      "playerIdSearchInput"
    );

  const searchButton =
    getElement(
      "playerIdSearchButton"
    );

  const clearButton =
    getElement(
      "playerIdSearchClearButton"
    );

  /*
    SEARCH FORM
  */
  if (form) {
    form.onsubmit =
      event => {
        event.preventDefault();

        submitSearch();
      };
  }

  /*
    SEARCH BUTTON
    Expliciet koppelen zodat zoeken niet afhankelijk is
    van alleen de submit-functionaliteit van het formulier.
  */
  if (searchButton) {
    searchButton.onclick =
      event => {
        event.preventDefault();

        submitSearch();
      };
  }

  /*
    SEARCH INPUT
  */
  if (input) {
    input.oninput =
      () => {
        updateClearButton();
        clearSearchMessage();

        global.clearTimeout(
          searchTimer
        );

        const query =
          input.value;

        searchTimer =
          global.setTimeout(
            () => {
              renderSuggestions(
                query
              );
            },
            80
          );
      };

    input.onkeydown =
      event => {
        /*
          ENTER = SEARCH
        */
        if (
          event.key ===
          "Enter"
        ) {
          event.preventDefault();

          closeSuggestions();

          submitSearch();

          return;
        }

        /*
          ESCAPE = CLOSE SUGGESTIONS
        */
        if (
          event.key ===
          "Escape"
        ) {
          event.preventDefault();

          closeSuggestions();

          return;
        }

        /*
          ARROWDOWN = FIRST SUGGESTION
        */
        if (
          event.key ===
          "ArrowDown"
        ) {
          const first =
            getElement(
              "playerIdSearchSuggestions"
            )?.querySelector(
              "[data-player-id]"
            );

          if (first) {
            event.preventDefault();

            first.focus();
          }
        }
      };
  }

  /*
    CLEAR BUTTON
  */
  if (clearButton) {
    clearButton.onclick =
      event => {
        event.preventDefault();

        clearSearch();
      };
  }

  /*
    CLOSE SUGGESTIONS WHEN CLICKING OUTSIDE
  */
  if (
    document.body &&
    !document.body.dataset
      .k630PlayerIdOutsideClickBound
  ) {
    document.body.dataset
      .k630PlayerIdOutsideClickBound =
      "true";

    document.addEventListener(
      "click",
      event => {
        const searchPanel =
          event.target.closest(
            ".player-id-search-field"
          );

        if (!searchPanel) {
          closeSuggestions();
        }
      }
    );
  }
}

  /* =====================================================
     STYLES
  ===================================================== */

  function injectStyles() {
    if (
      getElement(
        "k630PlayerIdInfoControllerStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "k630PlayerIdInfoControllerStyles";

    style.textContent = `
      .player-id-search-field {
        position: relative;
      }

      .player-id-search-suggestions {
        position: absolute;
        top: calc(100% + 5px);
        left: 0;
        right: 0;
        z-index: 200;
        max-height: 360px;
        overflow-y: auto;
        padding: 5px;
        border: 1px solid rgba(181, 92, 255, 0.65);
        border-radius: 7px;
        background: #0d0a14;
        box-shadow:
          0 12px 30px rgba(0, 0, 0, 0.75),
          0 0 15px rgba(181, 92, 255, 0.2);
      }

      .player-id-search-suggestion {
        width: 100%;
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 7px 10px;
        border: 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        background: transparent;
        color: #fff;
        text-align: left;
        cursor: pointer;
      }

      .player-id-search-suggestion:last-child {
        border-bottom: 0;
      }

      .player-id-search-suggestion:hover,
      .player-id-search-suggestion:focus {
        outline: none;
        background: rgba(181, 92, 255, 0.17);
      }

      .player-id-search-suggestion__identity,
      .player-id-search-suggestion__meta {
        display: flex;
        align-items: center;
        gap: 9px;
      }

      .player-id-search-suggestion__identity {
        min-width: 0;
      }

      .player-id-search-suggestion__identity strong {
        overflow: hidden;
        color: #fff;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .player-id-search-suggestion__identity span,
      .player-id-search-suggestion__meta {
        color: #aaa5b4;
        font-size: 11px;
      }

      .player-id-summary__membership[data-membership="active"] {
        color: #45ff78;
      }

      .player-id-summary__membership[data-membership="former"] {
        color: #ff667d;
      }

      .player-id-summary__name {
        max-width: 420px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .player-id-timeline {
        display: flex;
        gap: 12px;
        min-width: max-content;
        padding: 5px;
      }

      .player-id-timeline-item {
        width: 245px;
        min-height: 120px;
        display: flex;
        gap: 10px;
        padding: 12px;
        border: 1px solid rgba(181, 92, 255, 0.35);
        border-radius: 8px;
        background: rgba(17, 13, 27, 0.85);
      }

      .player-id-timeline-item__icon {
        flex: 0 0 32px;
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: rgba(181, 92, 255, 0.18);
        color: #d59aff;
      }

      .player-id-timeline-item__content {
        display: grid;
        align-content: start;
        gap: 5px;
      }

      .player-id-timeline-item__content time {
        color: #ffc928;
        font-size: 10px;
        font-weight: 800;
      }

      .player-id-timeline-item__content strong {
        color: #fff;
        font-size: 12px;
      }

      .player-id-timeline-item__content p {
        margin: 0;
        color: #aaa5b4;
        font-size: 10px;
        line-height: 1.45;
      }
    `;

    document.head.appendChild(
      style
    );
  }

function injectPlayerIdLayoutFixes() {
  if (
    getElement(
      "k630PlayerIdLayoutFixes"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "k630PlayerIdLayoutFixes";

  style.textContent = `
    /* ===================================================
       PLAYER ID INFO — COMPACT FULL-SCREEN LAYOUT
    =================================================== */

    #playerIdInfoPage {
      height: calc(100vh - 108px);
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow: hidden;
      padding-bottom: 4px;
    }

    #playerIdInfoPage,
    #playerIdInfoPage * {
      box-sizing: border-box;
    }

    #playerIdInfoPage .player-id-page-header {
      flex: 0 0 auto;
      margin: 0;
      padding: 0;
    }

    #playerIdInfoPage .player-id-page-title {
      margin: 0 0 2px;
      line-height: 1;
    }

    /* ===================================================
   HERO / BANNER
   VOLLEDIGE BANNER ZICHTBAAR
=================================================== */

#playerIdInfoPage .player-id-hero,
#playerIdInfoPage .player-id-banner,
#playerIdInfoPage .player-id-hero-banner {
  flex: 0 0 auto;

  width: min(820px, 62vw);

  height: auto;
  min-height: 0;
  max-height: none;

  margin: 0 auto 2px;

  overflow: visible;
}

#playerIdInfoPage .player-id-hero img,
#playerIdInfoPage .player-id-banner img,
#playerIdInfoPage .player-id-hero-banner img {
  width: 100%;
  height: auto;

  display: block;

  object-fit: contain;
  object-position: center;
}

    /* ===================================================
       SEARCH
    =================================================== */

    #playerIdInfoPage .player-id-search-panel,
    #playerIdInfoPage .player-id-search {
      flex: 0 0 auto;
      min-height: 40px;
      margin: 0;
      padding: 4px 8px;
    }

    #playerIdInfoPage .player-id-search-form {
      min-height: 30px;
      gap: 6px;
    }

    #playerIdInfoPage .player-id-search-field {
      position: relative;
      min-height: 28px;
    }

    #playerIdInfoPage #playerIdSearchInput {
      height: 28px;
      min-height: 28px;
      padding-top: 2px;
      padding-bottom: 2px;
    }

    #playerIdInfoPage .player-id-search-button,
    #playerIdInfoPage #playerIdSearchButton {
      height: 28px;
      min-height: 28px;
      padding: 3px 12px;
    }

    /* ===================================================
       PLAYER SUMMARY
    =================================================== */

    #playerIdInfoPage .player-id-summary {
      flex: 0 0 auto;
      min-height: 42px;
      margin: 0;
      padding: 4px 8px;
    }

    #playerIdInfoPage .player-id-summary__identity,
    #playerIdInfoPage .player-id-summary__statuses {
      min-height: 32px;
    }

    #playerIdInfoPage .player-id-summary__name {
      max-width: 330px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #playerIdInfoPage .player-id-summary__status,
    #playerIdInfoPage .player-id-summary-card {
      min-height: 32px;
      padding: 4px 9px;
    }

    /* ===================================================
       MAIN RESULT
    =================================================== */

    #playerIdInfoPage #playerIdResult {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow: hidden;
    }

    /* ===================================================
       INFORMATION PANELS
    =================================================== */

    #playerIdInfoPage .player-id-information-grid,
    #playerIdInfoPage .player-id-profile-grid,
    #playerIdInfoPage .player-id-data-grid {
      flex: 0 0 auto;
      min-height: 0;
      display: grid;
      grid-template-columns:
        minmax(0, 1fr)
        minmax(0, 1fr)
        minmax(0, 1fr)
        minmax(0, 1fr);
      gap: 6px;
    }

    #playerIdInfoPage .player-id-panel,
    #playerIdInfoPage .player-id-info-panel {
      min-height: 0;
      margin: 0;
      padding: 5px 8px;
      overflow: hidden;
    }

    #playerIdInfoPage .player-id-panel__header,
    #playerIdInfoPage .player-id-info-panel__header {
      min-height: 26px;
      margin-bottom: 2px;
      padding-bottom: 2px;
    }

    #playerIdInfoPage .player-id-panel__header h2,
    #playerIdInfoPage .player-id-panel__header h3,
    #playerIdInfoPage .player-id-info-panel__header h2,
    #playerIdInfoPage .player-id-info-panel__header h3 {
      margin: 0;
      font-size: 12px;
      line-height: 1.1;
    }

    #playerIdInfoPage .player-id-data-list {
      margin: 0;
      padding: 0;
    }

    #playerIdInfoPage .player-id-data-row {
      min-height: 20px;
      padding: 2px 0;
      line-height: 1.1;
    }

    #playerIdInfoPage .player-id-data-row dt,
    #playerIdInfoPage .player-id-data-row dd {
      margin: 0;
      font-size: 10px;
      line-height: 1.1;
    }

    #playerIdInfoPage .player-id-data-row dd {
      max-width: 58%;
      overflow: hidden;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ===================================================
       SEASON INFO
    =================================================== */

    #playerIdInfoPage .player-id-season-panel {
      flex: 0 0 auto;
      min-height: 0;
      max-height: 150px;
      margin: 0;
      padding: 5px 8px;
      overflow: hidden;
    }

    #playerIdInfoPage .player-id-season-panel__header {
      min-height: 26px;
      margin-bottom: 3px;
    }

    #playerIdInfoPage .player-id-season-scroll {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 4px;
      scrollbar-width: thin;
      scrollbar-color:
        #b35cff
        #100c18;
    }

    #playerIdInfoPage .player-id-season-scroll::-webkit-scrollbar {
      height: 6px;
    }

    #playerIdInfoPage .player-id-season-scroll::-webkit-scrollbar-track {
      background: #100c18;
    }

    #playerIdInfoPage .player-id-season-scroll::-webkit-scrollbar-thumb {
      border-radius: 10px;
      background: #b35cff;
    }

    #playerIdInfoPage .player-id-season-table {
      width: max-content;
      min-width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
    }

    #playerIdInfoPage .player-id-season-table th,
    #playerIdInfoPage .player-id-season-table td {
      width: 145px;
      min-width: 145px;
      max-width: 145px;
      height: 22px;
      padding: 3px 8px;
      font-size: 10px;
      line-height: 1;
      text-align: center;
      white-space: nowrap;
    }

    #playerIdInfoPage
    .player-id-season-table
    .player-id-season-table__metric,
    #playerIdInfoPage
    .player-id-season-table
    tbody th {
      position: sticky;
      left: 0;
      z-index: 3;
      width: 150px;
      min-width: 150px;
      max-width: 150px;
      text-align: left;
      background: #171020;
      box-shadow:
        2px 0 0
        rgba(181, 92, 255, 0.28);
    }

    #playerIdInfoPage
    .player-id-season-table
    thead
    .player-id-season-table__metric {
      z-index: 4;
    }

    /* ===================================================
       TIMELINE
    =================================================== */

    #playerIdInfoPage .player-id-timeline-panel {
      flex: 1 1 auto;
      min-height: 18px;
      max-height: 132px;
      margin: 0;
      padding: 5px 8px;
      overflow: hidden;
    }

    #playerIdInfoPage .player-id-timeline-panel .player-id-wide-panel-header {
  position: relative !important;
  min-height: 10px !important;
  margin-bottom: 4px !important;
  border-bottom: 0 !important;
}

    #playerIdInfoPage .player-id-timeline-scroll {
      width: 100%;
      max-width: 100%;
      height: 82px;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 2px 0 5px;
      scrollbar-width: thin;
      scrollbar-color:
        #b35cff
        #100c18;
    }

    #playerIdInfoPage .player-id-timeline-scroll::-webkit-scrollbar {
      height: 6px;
    }

    #playerIdInfoPage .player-id-timeline-scroll::-webkit-scrollbar-track {
      background: #100c18;
    }

    #playerIdInfoPage .player-id-timeline-scroll::-webkit-scrollbar-thumb {
      border-radius: 10px;
      background: #b35cff;
    }

    #playerIdInfoPage .player-id-timeline {
      width: max-content;
      min-width: 100%;
      height: 70px;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 3px;
    }

    #playerIdInfoPage .player-id-timeline-item {
  flex: 0 0 205px !important;
  width: 205px !important;
  min-width: 205px !important;
  height: 100px !important;
  min-height: 100px !important;
  max-height: 100px !important;
  padding: 5px 7px !important;
  border: 1px solid rgba(181, 92, 255, 0.35) !important;
  border-radius: 8px !important;
  box-sizing: border-box !important;
}

    #playerIdInfoPage .player-id-timeline-item__icon {
      flex: 0 0 27px;
      width: 27px;
      height: 27px;
    }

    #playerIdInfoPage .player-id-timeline-item__content {
      min-width: 0;
      display: grid;
      align-content: center;
      gap: 2px;
    }

    #playerIdInfoPage .player-id-timeline-item__content time {
      font-size: 9px;
      line-height: 1;
    }

    #playerIdInfoPage .player-id-timeline-item__content strong {
      overflow: hidden;
      font-size: 10px;
      line-height: 1.1;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #playerIdInfoPage .player-id-timeline-item__content p {
      max-height: 22px;
      margin: 0;
      overflow: hidden;
      font-size: 9px;
      line-height: 1.15;
    }

    /* ===================================================
       REMOVE PAGE VERTICAL SCROLL
    =================================================== */

    body:has(#playerIdInfoPage) {
      overflow-y: hidden;
    }

    body:has(#playerIdInfoPage) .page-content,
    body:has(#playerIdInfoPage) .main-content,
    body:has(#playerIdInfoPage) main {
      min-height: 0;
      overflow-y: hidden;
    }

    /* ===================================================
       SMALLER SCREENS
    =================================================== */

    @media (max-height: 900px) {
      #playerIdInfoPage {
        height: calc(100vh - 102px);
        gap: 4px;
      }

      #playerIdInfoPage .player-id-hero,
#playerIdInfoPage .player-id-banner,
#playerIdInfoPage .player-id-hero-banner {
  height: auto;
  min-height: 0;
  max-height: none;
}
      }

      #playerIdInfoPage .player-id-season-panel {
        max-height: 138px;
      }

      #playerIdInfoPage .player-id-timeline-panel {
        min-height: 120px;
        max-height: 120px;
      }

      #playerIdInfoPage .player-id-timeline-scroll {
        height: 96px;
        max-height: 96px;
      }

      #playerIdInfoPage .player-id-timeline {
        height: 82px;
        min-height: 82px;
      }

      #playerIdInfoPage .player-id-timeline-item {
        min-height: 84px;
        max-height: 84px;
      }
    }

    @media (max-width: 1250px) {
      #playerIdInfoPage .player-id-information-grid,
      #playerIdInfoPage .player-id-profile-grid,
      #playerIdInfoPage .player-id-data-grid {
        grid-template-columns:
          repeat(
            4,
            minmax(230px, 1fr)
          );
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

  /* =====================================================
     INIT / DESTROY
  ===================================================== */

function injectPlayerIdFinalFixes() {

  const existingStyle =
    getElement(
      "k630PlayerIdFinalFixes"
    );


  if (
    existingStyle
  ) {
    existingStyle.remove();
  }


  const style =
    document.createElement(
      "style"
    );


  style.id =
    "k630PlayerIdFinalFixes";


  style.textContent = `
    /* ===================================================
       BANNER
       Alleen de banner wordt compact gehouden.
       Search, summary en infopanelen blijven ongemoeid.
    =================================================== */

    #playerIdInfoBannerShell {
      flex: 0 0 auto !important;

      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;

      display: flex !important;
      align-items: center !important;
      justify-content: center !important;

      margin: 2px 0 26px !important
      padding: 0 !important;

      overflow: visible !important;
    }


    #playerIdInfoBannerImage {
      display: block !important;

      width: 590px !important;
      max-width: min(590px, 68vw) !important;

      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;

      margin: 0 auto !important;
      padding: 0 !important;

      object-fit: contain !important;
      object-position: center !important;

      border-radius: 16px;

      box-shadow:
        0 0 18px
        rgba(170, 70, 255, 0.45);
    }


    /* ===================================================
       SEARCH
       Volledige oorspronkelijke hoogte herstellen
    =================================================== */

    #playerIdInfoPage .player-id-search-panel,
    #playerIdInfoPage .player-id-search {
      position: relative !important;
      z-index: 100 !important;

      flex: 0 0 auto !important;

      height: auto !important;
      min-height: 46px !important;
      max-height: none !important;

      margin: 35px 0 0 !important;
      padding: 5px 8px !important;

      overflow: visible !important;
    }


    #playerIdInfoPage .player-id-search-form {
      height: auto !important;
      min-height: 34px !important;
      max-height: none !important;
    }


    #playerIdInfoPage .player-id-search-field {
      position: relative !important;
      z-index: 101 !important;

      min-height: 30px !important;

      overflow: visible !important;
    }


    #playerIdInfoPage #playerIdSearchInput,
    #playerIdInfoPage #playerIdSearchButton,
    #playerIdInfoPage .player-id-search-button {
      height: 30px !important;
      min-height: 30px !important;
    }


    #playerIdInfoPage .player-id-search-suggestions {
      z-index: 500 !important;

      max-height: 260px !important;

      overflow-x: hidden !important;
      overflow-y: auto !important;
    }


    /* ===================================================
       PLAYER IDENTITY / STATUS
       Oorspronkelijke hoogte herstellen
    =================================================== */

    #playerIdInfoPage .player-id-summary {
      flex: 0 0 auto !important;

      height: auto !important;
      min-height: 44px !important;
      max-height: none !important;

      margin: 0 !important;
      padding: 5px 8px !important;

      overflow: visible !important;
    }


    #playerIdInfoPage .player-id-summary__identity,
    #playerIdInfoPage .player-id-summary__statuses {
      min-height: 34px !important;
    }


    #playerIdInfoPage .player-id-summary__status,
    #playerIdInfoPage .player-id-summary-card {
      min-height: 34px !important;
      padding: 5px 9px !important;
    }


    /* ===================================================
       PLAYER INFORMATION PANELS
    =================================================== */

    #playerIdInfoPage .player-id-panel,
    #playerIdInfoPage .player-id-info-panel {
      padding: 5px 8px !important;
    }


    #playerIdInfoPage .player-id-data-row {
      min-height: 20px !important;
      padding: 2px 0 !important;
    }


    /* ===================================================
       SEASON INFO
       Alle vier rijen volledig zichtbaar
    =================================================== */

    #playerIdInfoPage .player-id-season-panel {
      flex: 0 0 132px !important;

      height: 132px !important;
      min-height: 132px !important;
      max-height: 132px !important;

      margin: 0 !important;
      padding: 5px 8px !important;

      overflow: hidden !important;
    }


    #playerIdInfoPage .player-id-season-panel__header {
      min-height: 26px !important;
      margin-bottom: 3px !important;
    }


    #playerIdInfoPage .player-id-season-scroll {
      width: 100% !important;
      height: 94px !important;
      min-height: 94px !important;
      max-height: 94px !important;

      padding-bottom: 4px !important;

      overflow-x: auto !important;
      overflow-y: hidden !important;
    }


    #playerIdInfoPage .player-id-season-table th,
    #playerIdInfoPage .player-id-season-table td {
      height: 20px !important;

      padding-top: 2px !important;
      padding-bottom: 2px !important;
    }


    /* ===================================================
       TIMELINE
    =================================================== */
  
    #playerIdInfoPage .player-id-timeline-panel {
      flex: 1 1 auto !important;

     height: 166px !important;
      min-height: 166px !important;
      max-height: 166px !important;

      margin: 0 !important;
      padding: 5px 8px !important;

      overflow: hidden !important;
    }


#playerIdInfoPage .player-id-timeline-panel__header {
  min-height: 25px !important;
  margin-bottom: 2px !important;
}


#playerIdInfoPage .player-id-timeline-scroll {
  width: 100% !important;
  height: 122px !important;
  max-height: 122px !important;

  padding: 3px 0 5px !important;

  overflow-x: auto !important;
  overflow-y: hidden !important;
}


#playerIdInfoPage .player-id-timeline {
  width: max-content !important;
  min-width: 100% !important;

  height: 128px !important;
  min-height: 128px !important;

  display: flex !important;
  align-items: flex-end !important;
  gap: 8px !important;

  margin: 0 !important;
  padding: 3px !important;

  border: 0 !important;
  background: transparent !important;
}


#playerIdInfoPage .player-id-timeline-item {
  flex: 0 0 205px !important;

  width: 205px !important;
  min-width: 205px !important;

  height: 116px !important;
  min-height: 116px !important;
  max-height: 116px !important;

  padding: 5px 7px !important;
  border: 1px solid rgba(181, 92, 255, 0.35) !important;
  border-radius: 8px !important;
}

#playerIdInfoPage .player-id-timeline {
  position: relative !important;
}

#playerIdInfoPage .player-id-timeline::before {
  display: none !important;
  content: none !important;
  background: none !important;
  width: 0 !important;
  height: 0 !important;
  position: static !important;
}

#playerIdInfoPage .player-id-timeline::after {
  display: none !important;
  content: none !important;
}


    /* ===================================================
       NOTE WARNING SYMBOL
       
       Red triangle.
       Browser tooltip appears on mouse hover because
       the element receives the explanatory title.
    =================================================== */

    #playerIdInfoPage
    .player-id-note-warning {
      display: inline-flex !important;

      align-items: center !important;
      justify-content: center !important;

      width: 18px !important;
      height: 18px !important;

      color: #ff3147 !important;

      cursor: help !important;

      font-size: 14px !important;

      vertical-align: middle !important;
    }


    /* ===================================================
       LEAVE DATE
       
       Departure date is red and receives a tooltip
       explaining why this date was determined.
    =================================================== */

    #playerIdInfoPage
    .player-id-leave-date {
      color: #ff3147 !important;

      font-weight: 700 !important;

      cursor: help !important;
    }


    /* ===================================================
       RED TIMELINE DEPARTURE DATE
    =================================================== */

    #playerIdInfoPage
    .player-id-timeline-item__date--danger {
      color: #ff3147 !important;
    }
  `;


  document.head.appendChild(
    style
  );

}

function injectPlayerIdStatusFixes() {

  if (
    document.getElementById(
      "playerIdStatusFixes"
    )
  ) {
    return;
  }


  const style =
    document.createElement(
      "style"
    );


  style.id =
    "playerIdStatusFixes";


  style.textContent = `
    #playerIdInfoPage
    .player-id-note-warning {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      color: #ff3147;
      cursor: help;
      font-size: 14px;
      vertical-align: middle;
    }

    #playerIdInfoPage
    .player-id-note-warning:hover {
      color: #ff5b6d;
    }

    #playerIdInfoPage
    .player-id-leave-date {
      color: #ff3147;
      font-weight: 700;
      cursor: help;
    }

    #playerIdInfoPage
    .player-id-leave-date:hover {
      color: #ff5b6d;
    }

    #playerIdInfoPage
    .player-id-timeline-item
    [data-event-type="leave"]
    time {
      color: #ff3147;
    }

    #playerIdInfoPage
    .player-id-timeline-item
    [data-event-type="season-leave"]
    time {
      color: #ff3147;
    }
  `;


  document.head.appendChild(
    style
  );

}

function initializePlayerIdBanner() {
  const page =
    getElement(
      "playerIdInfoPage"
    );

  if (!page) {
    return;
  }

  /*
    Zoek ALLE mogelijke banner-elementen.

    Er mag uiteindelijk maar één banner
    op de Player ID Info pagina staan.
  */
  const bannerCandidates =
    Array.from(
      page.querySelectorAll(
        [
          ".player-id-banner",
          ".player-id-hero",
          ".player-id-hero-banner",
          "#playerIdInfoBannerShell"
        ].join(",")
      )
    );

  let banner =
    bannerCandidates[0] ||
    null;

  /*
    Wanneer er meerdere banners aanwezig zijn,
    verwijderen we alle duplicaten.
  */
  if (
    bannerCandidates.length >
    1
  ) {
    bannerCandidates
      .slice(1)
      .forEach(
        duplicate => {
          duplicate.remove();
        }
      );
  }

  /*
    Als er helemaal geen banner bestaat,
    maken we er één aan.
  */
  if (!banner) {
    const searchPanel =
      page.querySelector(
        ".player-id-search-panel"
      );

    if (!searchPanel) {
      return;
    }

    banner =
      document.createElement(
        "section"
      );

    banner.className =
      "player-id-hero";

    banner.setAttribute(
      "aria-label",
      "Rebels of Fury Kingdom 630 banner"
    );

    searchPanel.before(
      banner
    );
  }

  /*
    Zorg dat de banner de juiste class heeft.
  */
  banner.classList.add(
    "player-id-hero"
  );

  /*
    Zoek bestaande image.
  */
  let image =
    banner.querySelector(
      "img"
    );

  /*
    Als er nog geen image bestaat,
    maken we deze aan.
  */
  if (!image) {
    const imageWrap =
      document.createElement(
        "div"
      );

    imageWrap.className =
      "player-id-hero__image-wrap";

    image =
      document.createElement(
        "img"
      );

    image.className =
      "player-id-hero__image";

    imageWrap.appendChild(
      image
    );

    banner.appendChild(
      imageWrap
    );
  }

  /*
    Juiste banner-afbeelding.
  */
  image.src =
    "assets/images/player-id-banner.png";

  image.alt =
    "Rebels of Fury - Kingdom 630";

  image.draggable =
    false;

  /*
    Zorg dat de image-wrap bestaat.
  */
  let imageWrap =
    banner.querySelector(
      ".player-id-hero__image-wrap"
    );

  if (!imageWrap) {
    imageWrap =
      document.createElement(
        "div"
      );

    imageWrap.className =
      "player-id-hero__image-wrap";

    image.before(
      imageWrap
    );

    imageWrap.appendChild(
      image
    );
  }

  /*
    Zorg dat de glow bestaat.
  */
  let glow =
    banner.querySelector(
      ".player-id-hero__glow"
    );

  if (!glow) {
    glow =
      document.createElement(
        "span"
      );

    glow.className =
      "player-id-hero__glow";

    glow.setAttribute(
      "aria-hidden",
      "true"
    );

    imageWrap.appendChild(
      glow
    );
  }

  /*
    Forceer zichtbaarheid.
  */
  banner.style.display =
    "flex";

  banner.style.visibility =
    "visible";

  banner.style.opacity =
    "1";

  image.style.display =
    "block";

  image.style.visibility =
    "visible";

  image.style.opacity =
    "1";
}



async function init() {

  if (
    !isPagePresent()
  ) {

    return;

  }


  /* =====================================================
     INITIAL UI
  ===================================================== */

  injectStyles();

  injectPlayerIdLayoutFixes();

  injectPlayerIdFinalFixes();

  initializePlayerIdBanner();


  bindEvents();

  showInitialState();

  updateClearButton();


  initialized =
    true;


  /* =====================================================
     LOAD DATA
  ===================================================== */

  try {

    await loadBaseData();


    initializePlayerIdBanner();


    const urlSearch =
      getUrlPlayerSearch();


    if (
      urlSearch
    ) {

      const input =
        getElement(
          "playerIdSearchInput"
        );


      if (
        input
      ) {

        input.value =
          urlSearch;

      }


      updateClearButton();

      submitSearch();

    }


  } catch (
    error
  ) {

    console.error(
      `[${MODULE_NAME}]`,
      error
    );


    setEngineStatus(
      "error",
      "Data unavailable"
    );


    showSearchMessage(
      error?.message ||
      "Player data could not be loaded.",
      "error"
    );

  }

}

  function destroy() {
    activeRequestId +=
      1;

    global.clearTimeout(
      searchTimer
    );

    selectedPlayer =
      null;

    initialized =
      false;
  }

  const publicApi =
    Object.freeze({
      name:
        MODULE_NAME,

      version:
        MODULE_VERSION,

      init,

      initialize:
        init,

      refresh:
        init,

      destroy,

      search:
        findSuggestions,

      openPlayer:
        openPlayerById,

      isInitialized() {
        return initialized;
      }
    });

  global.K630PlayerIdInfoPage =
    publicApi;

  global.initializeK630PlayerIdInfoPage =
  init;

console.info(
  `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
);
})(window);