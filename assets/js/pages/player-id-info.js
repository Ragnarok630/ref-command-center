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
      normalizeText(
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
    const map =
      new Map();

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

    if (container) {
      container.dataset.status =
        status;
    }

    setText(
      "playerIdEngineStatusText",
      text,
      "Ready"
    );
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

  function buildNote(player) {
    const notes =
      [];

    if (player.note) {
      notes.push(
        player.note
      );
    }

    if (player.isNew) {
      notes.push(
        "New player"
      );
    }

    if (player.isLeft) {
      notes.push(
        "Left Kingdom 630"
      );
    }

    if (player.afkApproved) {
      notes.push(
        "AFK approved"
      );
    }

    return notes.join(
      " · "
    ) ||
    "-";
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

      if (seasonNumber <= 0) {
        continue;
      }

      const candidatePaths =
        [
          normalizeText(
            entry?.seasonInfoPath
          ),

          normalizeText(
            entry?.playerHistoryPath
          ),

          (
            `archives/season-${seasonNumber}/` +
            `season-info.json`
          ),

          (
            `archives/season-${seasonNumber}/` +
            `generated/season-info/current.json`
          )
        ].filter(Boolean);

      let archiveData =
        null;

      for (
        const path of
        candidatePaths
      ) {
        archiveData =
          await fetchOptionalJson(
            path,
            null
          );

        if (archiveData) {
          break;
        }
      }

      if (!archiveData) {
        continue;
      }

      const playerRecord =
        extractRecords(
          archiveData,
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
        });

      if (!playerRecord) {
        continue;
      }

      results.push(
        normalizeArchiveSeason(
          seasonNumber,
          entry,
          playerRecord
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
    playerRecord
  ) {
    const currentPower =
      integerValue(
        getRecordValue(
          playerRecord,
          [
            "seasonPower",
            "currentPower",
            "Current Power",
            "power",
            "Power"
          ]
        )
      );

    const merits =
      integerValue(
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
          archiveEntry?.name
        ) ||
        `Season ${seasonNumber}`,

      power:
        currentPower,

      merits,

      meritPercent,

      rank
    };
  }

  /* =====================================================
     TIMELINE
  ===================================================== */

  function getPlayerTimeline(
  player
) {
  const events =
    [];

  const playerId =
    normalizeText(
      player?.id
    );

  const historyRecords =
    extractRecords(
      playerHistoryData,
      [
        "events",
        "timeline",
        "players",
        "rows"
      ]
    );

  historyRecords
    .filter(record => {
      return (
        normalizeText(
          getRecordValue(
            record,
            FIELDS.id
          )
        ) ===
        playerId
      );
    })
    .forEach(record => {
      events.push({
        date:
          normalizeText(
            record.date ??
            record.eventDate ??
            record.createdAt
          ),

        type:
          normalizeText(
            record.type ??
            record.eventType
          ) ||
          "history",

        title:
          normalizeText(
            record.title ??
            record.label ??
            record.event
          ) ||
          "Player history",

        description:
          normalizeText(
            record.description ??
            record.note ??
            record.details
          )
      });
    });

  if (
    normalizeText(
      player?.joinDate
    )
  ) {
    events.push({
      date:
        player.joinDate,

      type:
        "join",

      title:
        "Joined Kingdom 630",

      description:
        "Player became part of Kingdom 630."
    });
  }

  const seasonPlayers =
    extractRecords(
      seasonInfoData,
      [
        "players",
        "participants",
        "rows"
      ]
    );

  const currentSeasonPlayer =
    seasonPlayers.find(record => {
      return (
        normalizeText(
          getRecordValue(
            record,
            FIELDS.id
          )
        ) ===
        playerId
      );
    }) ||
    null;

  const seasonNumber =
    integerValue(
      seasonInfoData
        ?.season
        ?.number ??
      seasonInfoData
        ?.seasonNumber ??
      1
    );

  const seasonName =
    normalizeText(
      seasonInfoData
        ?.season
        ?.name ??
      seasonInfoData
        ?.seasonName
    ) ||
    `Season ${seasonNumber}`;

  const weeks =
    isPlainObject(
      currentSeasonPlayer?.weeks
    )
      ? currentSeasonPlayer.weeks
      : {};

  const weekZero =
    weeks.W0;

  if (
    isPlainObject(
      weekZero
    ) &&
    weekZero.available ===
      true
  ) {
    const startDate =
      normalizeText(
        weekZero.officialDate
      ) ||
      normalizeText(
        seasonInfoData
          ?.season
          ?.latestWeekDate
      );

    if (startDate) {
      events.push({
        date:
          startDate,

        type:
          "season-start",

        title:
          `${seasonName} Started (W0)`,

        description:
          (
            `Historical Power: ` +
            `${formatNumber(
              weekZero.historicalPower ??
              currentSeasonPlayer
                ?.historicalPower
            )} · ` +
            `Current Power: ` +
            `${formatNumber(
              weekZero.currentPower
            )} · ` +
            `Merits: ` +
            `${formatNumber(
              weekZero.merits
            )}`
          )
      });
    }
  }

  const weekSix =
    weeks.W6;

  if (
    isPlainObject(
      weekSix
    ) &&
    weekSix.available ===
      true &&
    normalizeText(
      weekSix.officialDate
    )
  ) {
    events.push({
      date:
        weekSix.officialDate,

      type:
        "season-finish",

      title:
        `${seasonName} Finished (W6)`,

      description:
        (
          `Historical Power: ` +
          `${formatNumber(
            weekSix.historicalPower ??
            currentSeasonPlayer
              ?.historicalPower
          )} · ` +
          `Final Power: ` +
          `${formatNumber(
            weekSix.currentPower
          )} · ` +
          `Final Merits: ` +
          `${formatNumber(
            weekSix.merits
          )}`
        )
    });
  }

  if (
    normalizeText(
      player?.rejoinDate
    )
  ) {
    events.push({
      date:
        player.rejoinDate,

      type:
        "rejoin",

      title:
        "Rejoined Kingdom 630",

      description:
        "Player returned to Kingdom 630."
    });
  }

  if (
    normalizeText(
      player?.leaveDate
    )
  ) {
    events.push({
      date:
        player.leaveDate,

      type:
        "leave",

      title:
        "Left Kingdom 630",

      description:
        "Player left Kingdom 630."
    });
  }

  const uniqueEvents =
    new Map();

  events.forEach(event => {
    if (
      !normalizeText(
        event.date
      )
    ) {
      return;
    }

    const key =
      [
        normalizeText(
          event.date
        ),
        normalizeText(
          event.type
        ),
        normalizeText(
          event.title
        )
      ].join("|");

    uniqueEvents.set(
      key,
      event
    );
  });

  return [
    ...uniqueEvents.values()
  ].sort(
    (
      first,
      second
    ) => {
      const firstDate =
        Date.parse(
          first.date
        ) ||
        0;

      const secondDate =
        Date.parse(
          second.date
        ) ||
        0;

      return (
        firstDate -
        secondDate
      );
    }
  );
}

  /* =====================================================
     RENDER PLAYER
  ===================================================== */

  async function renderPlayer(player) {
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

    const merged =
      seasonRecord
        ? mergePlayer(
            player,
            normalizePlayer(
              seasonRecord,
              "season"
            )
          )
        : player;

    renderPlayerSummary(
      merged
    );

    renderPerformance(
      merged
    );

    renderResources(
      merged
    );

    renderPowerInfo(
      merged
    );

    renderMembership(
      merged
    );

    renderSeasonArchives(
      archiveSeasons,
      seasonRecord
    );

    renderTimeline(
      getPlayerTimeline(
        merged
      )
    );

    showResultState();

    document.dispatchEvent(
      new CustomEvent(
        "k630:player-id-rendered",
        {
          detail: {
            playerId:
              merged.id,

            name:
              merged.name,

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

    const membership =
      player.isFormer
        ? "Former Player"
        : "Active Player";

    const membershipBadge =
      getElement(
        "playerIdMembershipStatus"
      );

    if (membershipBadge) {
      membershipBadge.textContent =
        membership;

      membershipBadge.dataset.membership =
        player.isFormer
          ? "former"
          : "active";
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
    setText(
      "playerIdMembershipPanelStatus",
      player.isFormer
        ? "Former Player"
        : "Active Player"
    );

    setText(
      "playerIdServerJoin",
      formatDate(
        player.joinDate
      )
    );

    setText(
      "playerIdServerLeave",
      formatDate(
        player.leaveDate
      )
    );

    setText(
      "playerIdServerRejoin",
      formatDate(
        player.rejoinDate
      )
    );

    setText(
      "playerIdStatusNote",
      buildNote(player)
    );
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

  function renderTimeline(events) {
  const timeline =
    getElement(
      "playerIdTimeline"
    );

  const empty =
    getElement(
      "playerIdTimelineEmpty"
    );

  if (!timeline) {
    return;
  }

  if (
    !Array.isArray(events) ||
    events.length ===
      0
  ) {
    timeline.innerHTML =
      "";

    if (empty) {
      empty.hidden =
        false;
    }

    return;
  }

  if (empty) {
    empty.hidden =
      true;
  }

  timeline.innerHTML =
    events.map(event => {
      let icon =
        "fa-clock-rotate-left";

      if (
        event.type ===
        "leave"
      ) {
        icon =
          "fa-right-from-bracket";
      } else if (
        event.type ===
          "join" ||
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

      return `
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
              event.description
                ? `
                  <p
                    title="${escapeHtml(
                      event.description
                    )}"
                  >
                    ${escapeHtml(
                      event.description
                    )}
                  </p>
                `
                : ""
            }
          </div>
        </article>
      `;
    }).join("");
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

    const clearButton =
      getElement(
        "playerIdSearchClearButton"
      );

    if (form) {
      form.onsubmit =
        event => {
          event.preventDefault();

          submitSearch();
        };
    }

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
          if (
            event.key ===
            "Escape"
          ) {
            closeSuggestions();

            return;
          }

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

    if (clearButton) {
      clearButton.onclick =
        clearSearch;
    }

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
    =================================================== */

    #playerIdInfoPage .player-id-hero,
    #playerIdInfoPage .player-id-banner,
    #playerIdInfoPage .player-id-hero-banner {
      flex: 0 0 auto;
      width: min(820px, 62vw);
      height: 132px;
      min-height: 132px;
      max-height: 132px;
      margin: 0 auto 2px;
      overflow: hidden;
    }

    #playerIdInfoPage .player-id-hero img,
    #playerIdInfoPage .player-id-banner img,
    #playerIdInfoPage .player-id-hero-banner img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
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
      min-height: 108px;
      max-height: 132px;
      margin: 0;
      padding: 5px 8px;
      overflow: hidden;
    }

    #playerIdInfoPage .player-id-timeline-panel__header {
      min-height: 25px;
      margin-bottom: 2px;
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
      flex: 0 0 205px;
      width: 205px;
      min-width: 205px;
      min-height: 60px;
      max-height: 60px;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 6px 8px;
      overflow: hidden;
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
        height: 112px;
        min-height: 112px;
        max-height: 112px;
      }

      #playerIdInfoPage .player-id-season-panel {
        max-height: 138px;
      }

      #playerIdInfoPage .player-id-timeline-panel {
        min-height: 96px;
        max-height: 110px;
      }

      #playerIdInfoPage .player-id-timeline-scroll {
        height: 70px;
      }

      #playerIdInfoPage .player-id-timeline {
        height: 61px;
      }

      #playerIdInfoPage .player-id-timeline-item {
        min-height: 52px;
        max-height: 52px;
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

  if (existingStyle) {
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

      margin: 2px 0 6px !important;
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

    /* Oude bannercontainers uitschakelen */

    #playerIdInfoPage .player-id-hero,
    #playerIdInfoPage .player-id-banner,
    #playerIdInfoPage .player-id-hero-banner {
      display: none !important;
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

      margin: 0 !important;
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

      height: auto !important;
      min-height: 104px !important;
      max-height: 118px !important;

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
      height: 72px !important;

      padding: 2px 0 4px !important;

      overflow-x: auto !important;
      overflow-y: hidden !important;
    }

    #playerIdInfoPage .player-id-timeline {
      width: max-content !important;
      min-width: 100% !important;
      height: 64px !important;

      display: flex !important;
      align-items: center !important;
      gap: 8px !important;

      margin: 0 !important;
      padding: 2px !important;

      border: 0 !important;
      background: transparent !important;
    }

    #playerIdInfoPage .player-id-timeline-item {
      flex: 0 0 205px !important;

      width: 205px !important;
      min-width: 205px !important;

      height: 56px !important;
      min-height: 56px !important;
      max-height: 56px !important;

      padding: 5px 7px !important;
    }

    #playerIdInfoPage .player-id-timeline::before,
    #playerIdInfoPage .player-id-timeline::after,
    #playerIdInfoPage .player-id-timeline-item::before,
    #playerIdInfoPage .player-id-timeline-item::after {
      display: none !important;
      content: none !important;
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

  const oldShell =
    getElement(
      "playerIdInfoBannerShell"
    );

  if (oldShell) {
    oldShell.remove();
  }

  const bannerShell =
    document.createElement(
      "div"
    );

  bannerShell.id =
    "playerIdInfoBannerShell";

  bannerShell.className =
    "player-id-info-banner-shell";

  const bannerImage =
    document.createElement(
      "img"
    );

  bannerImage.id =
    "playerIdInfoBannerImage";

  bannerImage.className =
    "player-id-info-banner-image";

  bannerImage.src =
    "assets/images/player-id-banner.png";

  bannerImage.alt =
    "Rebels of Fury - Kingdom 630";

  bannerImage.draggable =
    false;

  bannerShell.appendChild(
    bannerImage
  );

  const searchPanel =
    page.querySelector(
      ".player-id-search-panel, .player-id-search"
    );

  if (searchPanel) {
    searchPanel.before(
      bannerShell
    );
  } else {
    page.prepend(
      bannerShell
    );
  }
}

  async function init() {
  if (!isPagePresent()) {
    return;
  }

  injectStyles();
  injectPlayerIdLayoutFixes();
  injectPlayerIdFinalFixes();
  initializePlayerIdBanner();

  bindEvents();
  showInitialState();
  updateClearButton();

  initialized =
    true;

  try {
    await loadBaseData();

    initializePlayerIdBanner();

    const urlSearch =
      getUrlPlayerSearch();

    if (urlSearch) {
      const input =
        getElement(
          "playerIdSearchInput"
        );

      if (input) {
        input.value =
          urlSearch;
      }

      updateClearButton();
      submitSearch();
    }
  } catch (error) {
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