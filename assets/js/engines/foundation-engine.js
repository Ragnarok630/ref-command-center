/* =========================================================
   K630-REF FOUNDATION ENGINE
   File: assets/js/engines/foundation-engine.js
   Version: 630.1.0

   Responsibilities:
   - Process the permanent Kingdom 630 Foundation
   - Preserve the uploaded Foundation source data
   - Exclude players below 250,000 Top Power
   - Create the first Active & Average dataset
   - Create the Foundation player index
   - Create the Foundation manifest
   - Initialize Home dashboard data
   - Prepare empty Season 1 columns
   - Keep all generated data out of localStorage

   Public API:
   - window.K630FoundationEngine.build(sourceData, options)
   - window.K630FoundationEngine.validate(sourceData)
   - window.K630FoundationEngine.getRules()
   - window.K630FoundationEngine.getPaths()

   Important:
   - This engine does not write to GitHub.
   - It returns all files that admin-center.js must write.
========================================================= */

(function initializeK630FoundationEngine(global) {
  "use strict";

  /* =====================================================
     MODULE INFORMATION
  ===================================================== */

  const MODULE_NAME =
    "K630 Foundation Engine";

  const MODULE_VERSION =
    "630.1.0";

  const SCHEMA_VERSION =
    1;

  /* =====================================================
     PATHS
  ===================================================== */

  const PATHS =
    Object.freeze({
      foundation:
        "assets/data/foundation/630-foundation.json",

      manifest:
        "assets/data/foundation/manifest.json",

      playerIndex:
        "assets/data/generated/foundation/player-index.json",

      activeAverage:
        "assets/data/generated/active-average/current.json",

      home:
        "assets/data/generated/home/current.json"
    });

  /* =====================================================
     BUSINESS RULES
  ===================================================== */

  const RULES =
    Object.freeze({
      homeKingdom:
        630,

      foundationDate:
        "2026-03-27",

      minimumHistoricalPower:
        250_000,

      warriorMinimumPower:
        20_000_000,

      t5MinimumTechPower:
        28_931_215,

      initialServerStatus:
        "LV2",

      initialServerStatusColor:
        "green",

      initialSeasonNumber:
        1
    });

  /* =====================================================
     SUPPORTED SOURCE FIELDS
  ===================================================== */

  const FIELD_NAMES =
    Object.freeze({
      id: [
        "Lord ID",
        "LordID",
        "lordId",
        "lordID",
        "Player ID",
        "PlayerID",
        "playerId",
        "ID",
        "id"
      ],

      name: [
        "Name",
        "Player Name",
        "playerName",
        "name"
      ],

      alliance: [
        "Alliance",
        "Alliance Name",
        "alliance",
        "allianceName"
      ],

      currentPower: [
        "Power",
        "Current Power",
        "currentPower",
        "power"
      ],

      historicalPower: [
        "Top Power",
        "TopPower",
        "topPower",
        "Historical Power",
        "historicalPower",
        "Power",
        "power"
      ],

      merits: [
        "Merits",
        "merits"
      ],

      topMerits: [
        "Top Merits",
        "TopMerits",
        "topMerits"
      ],

      techPower: [
        "Tech Power",
        "Technology Power",
        "TechPower",
        "techPower"
      ],

      unitsKilled: [
        "Units Killed",
        "UnitsKilled",
        "unitsKilled"
      ],

      unitsHealed: [
        "Units Healed",
        "UnitsHealed",
        "unitsHealed"
      ],

      serverRank: [
        "Server Rank",
        "ServerRank",
        "serverRank"
      ],

      faction: [
        "Faction",
        "faction"
      ],

      castleLevel: [
        "Castle Level",
        "CastleLevel",
        "castleLevel"
      ]
    });

  /* =====================================================
     BASIC HELPERS
  ===================================================== */

  function normalizeText(value) {
    return String(
      value ?? ""
    ).trim();
  }

  function normalizeKey(value) {
    return normalizeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
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
        .replace(/,/g, "");

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

  function nowIso() {
    return new Date()
      .toISOString();
  }

  function cloneData(value) {
    if (
      value === undefined ||
      value === null
    ) {
      return value;
    }

    if (
      typeof structuredClone ===
      "function"
    ) {
      try {
        return structuredClone(
          value
        );
      } catch (error) {
        console.warn(
          `[${MODULE_NAME}] structuredClone failed.`,
          error
        );
      }
    }

    return JSON.parse(
      JSON.stringify(value)
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

  function createError(
    message,
    details = null
  ) {
    const error =
      new Error(message);

    error.name =
      "K630FoundationEngineError";

    error.details =
      details;

    return error;
  }

  function getRecordValue(
    record,
    allowedNames
  ) {
    if (!isPlainObject(record)) {
      return undefined;
    }

    for (
      const fieldName of
      allowedNames
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

    const normalizedMap =
      new Map();

    Object.keys(record)
      .forEach(key => {
        normalizedMap.set(
          normalizeKey(key),
          key
        );
      });

    for (
      const fieldName of
      allowedNames
    ) {
      const actualKey =
        normalizedMap.get(
          normalizeKey(fieldName)
        );

      if (actualKey) {
        return record[actualKey];
      }
    }

    return undefined;
  }

  function normalizeDate(
    value,
    fallback
  ) {
    const normalized =
      normalizeText(value);

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        normalized
      )
    ) {
      return normalized;
    }

    return fallback;
  }

  /* =====================================================
     SOURCE EXTRACTION
  ===================================================== */

  function extractRecords(sourceData) {
    if (Array.isArray(sourceData)) {
      return sourceData;
    }

    if (
      Array.isArray(
        sourceData?.players
      )
    ) {
      return sourceData.players;
    }

    if (
      Array.isArray(
        sourceData?.data
      )
    ) {
      return sourceData.data;
    }

    if (
      isPlainObject(
        sourceData?.players
      )
    ) {
      return Object.values(
        sourceData.players
      );
    }

    throw createError(
      "The Foundation must contain a player array."
    );
  }

  /* =====================================================
     PLAYER NORMALIZATION
  ===================================================== */

  function getPlayerId(record) {
    return normalizeText(
      getRecordValue(
        record,
        FIELD_NAMES.id
      )
    );
  }

  function getHistoricalPower(record) {
    return integerValue(
      getRecordValue(
        record,
        FIELD_NAMES.historicalPower
      )
    );
  }

  function calculateTroopTier(
    techPower
  ) {
    return (
      techPower >=
      RULES.t5MinimumTechPower
    )
      ? "T5"
      : "T4";
  }

  function calculatePlayerType(
    historicalPower
  ) {
    return (
      historicalPower >=
      RULES.warriorMinimumPower
    )
      ? "warrior"
      : "farmer";
  }

  function createEmptySeasonData(
    seasonNumber
  ) {
    return {
      season:
        seasonNumber,

      currentPower:
        null,

      merits:
        null,

      meritPowerPercentage:
        null
    };
  }

  function normalizePlayer(
    record,
    foundationDate
  ) {
    const id =
      getPlayerId(record);

    const name =
      normalizeText(
        getRecordValue(
          record,
          FIELD_NAMES.name
        )
      );

    const alliance =
      normalizeText(
        getRecordValue(
          record,
          FIELD_NAMES.alliance
        )
      );

    const currentPower =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.currentPower
        )
      );

    const historicalPower =
      getHistoricalPower(record);

    const merits =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.merits
        )
      );

    const topMerits =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.topMerits
        )
      );

    const techPower =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.techPower
        )
      );

    const unitsKilled =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.unitsKilled
        )
      );

    const unitsHealed =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.unitsHealed
        )
      );

    const serverRank =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.serverRank
        )
      );

    const castleLevel =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.castleLevel
        )
      );

    const faction =
      normalizeText(
        getRecordValue(
          record,
          FIELD_NAMES.faction
        )
      );

    const troopTier =
      calculateTroopTier(
        techPower
      );

    const playerType =
      calculatePlayerType(
        historicalPower
      );

    return {
      id,
      name,
      alliance,

      dateJoinKingdom:
        foundationDate,

      serverStatus:
        RULES.initialServerStatus,

      serverStatusColor:
        RULES.initialServerStatusColor,

      troopTier,

      startPower:
        historicalPower,

      currentPower,

      historicalPower,

      powerGrowth:
        null,

      merits,

      topMerits,

      techPower,

      unitsKilled,

      unitsHealed,

      serverRank,

      castleLevel,

      faction,

      playerType,

      averageMeritsValue:
        null,

      averageMeritsPercentage:
        null,

      seasonsPlayed:
        0,

      seasons: {
        [String(
          RULES.initialSeasonNumber
        )]:
          createEmptySeasonData(
            RULES.initialSeasonNumber
          )
      },

      active:
        true,

      source:
        "foundation",

      sourceDate:
        foundationDate
    };
  }

  /* =====================================================
     VALIDATION
  ===================================================== */

  function validate(sourceData) {
    const records =
      extractRecords(sourceData);

    if (
      records.length ===
      0
    ) {
      throw createError(
        "The Foundation contains no player records."
      );
    }

    let validIdCount =
      0;

    let eligibleCount =
      0;

    let excludedLowPowerCount =
      0;

    let invalidRecordCount =
      0;

    const seenIds =
      new Set();

    const duplicateIds =
      [];

    records.forEach(
      (
        record,
        index
      ) => {
        if (!isPlainObject(record)) {
          invalidRecordCount +=
            1;

          return;
        }

        const id =
          getPlayerId(record);

        if (!id) {
          invalidRecordCount +=
            1;

          return;
        }

        validIdCount +=
          1;

        if (seenIds.has(id)) {
          duplicateIds.push({
            id,
            index
          });

          return;
        }

        seenIds.add(id);

        const historicalPower =
          getHistoricalPower(record);

        if (
          historicalPower <
          RULES.minimumHistoricalPower
        ) {
          excludedLowPowerCount +=
            1;

          return;
        }

        eligibleCount +=
          1;
      }
    );

    if (
      duplicateIds.length >
      0
    ) {
      throw createError(
        (
          "The Foundation contains duplicate Lord IDs: " +
          duplicateIds
            .slice(0, 10)
            .map(entry => entry.id)
            .join(", ")
        ),
        {
          duplicateIds
        }
      );
    }

    if (
      eligibleCount ===
      0
    ) {
      throw createError(
        (
          "No eligible players remain after applying the " +
          "250,000 Top Power filter."
        )
      );
    }

    return {
      valid:
        true,

      totalRecords:
        records.length,

      validIdCount,

      eligibleCount,

      excludedLowPowerCount,

      invalidRecordCount,

      duplicateCount:
        0
    };
  }

  /* =====================================================
     ACTIVE & AVERAGE
  ===================================================== */

  function buildActiveAverage(
    players,
    foundationDate,
    generatedAt
  ) {
    const sortedPlayers =
      [...players]
        .sort(
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
        )
        .map(
          (
            player,
            index
          ) => ({
            rank:
              index + 1,

            ...cloneData(player)
          })
        );

    return {
      schemaVersion:
        SCHEMA_VERSION,

      kingdom:
        RULES.homeKingdom,

      dataset:
        "active-average",

      generatedFrom:
        "foundation",

      foundationDate,

      generatedAt,

      activePlayerCount:
        sortedPlayers.length,

      currentSeason:
        RULES.initialSeasonNumber,

      seasonColumns: [
        {
          season:
            RULES.initialSeasonNumber,

          columns: [
            "currentPower",
            "merits",
            "meritPowerPercentage"
          ]
        }
      ],

      columns: {
        fixed: [
          "rank",
          "id",
          "name",
          "alliance",
          "dateJoinKingdom",
          "serverStatus",
          "troopTier",
          "startPower",
          "historicalPower",
          "powerGrowth",
          "topMerits",
          "averageMeritsValue",
          "averageMeritsPercentage",
          "seasonsPlayed"
        ],

        season: [
          "currentPower",
          "merits",
          "meritPowerPercentage"
        ]
      },

      players:
        sortedPlayers
    };
  }

  /* =====================================================
     PLAYER INDEX
  ===================================================== */

  function buildPlayerIndex(
    players,
    foundationDate,
    generatedAt
  ) {
    const index =
      {};

    players.forEach(player => {
      index[player.id] = {
        id:
          player.id,

        name:
          player.name,

        alliance:
          player.alliance,

        dateJoinKingdom:
          player.dateJoinKingdom,

        serverStatus:
          player.serverStatus,

        serverStatusColor:
          player.serverStatusColor,

        troopTier:
          player.troopTier,

        active:
          true,

        source:
          "foundation"
      };
    });

    return {
      schemaVersion:
        SCHEMA_VERSION,

      kingdom:
        RULES.homeKingdom,

      dataset:
        "foundation-player-index",

      foundationDate,

      generatedAt,

      playerCount:
        players.length,

      players:
        index
    };
  }

  /* =====================================================
     HOME DASHBOARD
  ===================================================== */

  function buildHome(
    players,
    foundationDate,
    generatedAt
  ) {
    const warriors =
      players.filter(
        player =>
          player.historicalPower >=
          RULES.warriorMinimumPower
      );

    const farmers =
      players.filter(
        player =>
          player.historicalPower <
          RULES.warriorMinimumPower
      );

    const totalServerPower =
      players.reduce(
        (
          total,
          player
        ) =>
          total +
          player.historicalPower,
        0
      );

    return {
      schemaVersion:
        SCHEMA_VERSION,

      kingdom:
        RULES.homeKingdom,

      dataset:
        "home",

      generatedFrom:
        "foundation",

      foundationDate,

      generatedAt,

      currentSeason:
        null,

      currentWeek:
        null,

      totals: {
        activePlayers:
          players.length,

        warriors:
          warriors.length,

        farmers:
          farmers.length,

        serverPower:
          totalServerPower,

        serverMerits:
          0,

        serverKills:
          0,

        serverHealing:
          0
      },

      playerRanking: {
        topIdMerits: []
      },

      serverRanking: {
        topServerMerits: []
      },

      charts: {
        powerDevelopment: {
          active:
            false,

          labels: [],

          datasets: []
        },

        meritsDevelopment: {
          active:
            false,

          labels: [],

          datasets: []
        }
      }
    };
  }

  /* =====================================================
     FOUNDATION MANIFEST
  ===================================================== */

  function buildManifest(
    validationResult,
    foundationDate,
    generatedAt,
    options
  ) {
    return {
      schemaVersion:
        SCHEMA_VERSION,

      kingdom:
        RULES.homeKingdom,

      dataset:
        "foundation",

      status:
        "official",

      foundationDate,

      uploadedAt:
        generatedAt,

      uploadedBy:
        normalizeText(
          options.uploadedBy
        ) || null,

      sourceFilename:
        normalizeText(
          options.sourceFilename
        ) ||
        "630-foundation.json",

      engine: {
        name:
          MODULE_NAME,

        version:
          MODULE_VERSION
      },

      rules: {
        minimumHistoricalPower:
          RULES.minimumHistoricalPower,

        historicalPowerSource:
          "Top Power",

        warriorMinimumPower:
          RULES.warriorMinimumPower,

        t5MinimumTechPower:
          RULES.t5MinimumTechPower
      },

      counts: {
        sourceRecords:
          validationResult.totalRecords,

        validIds:
          validationResult.validIdCount,

        activePlayers:
          validationResult.eligibleCount,

        excludedLowPower:
          validationResult.excludedLowPowerCount,

        invalidRecords:
          validationResult.invalidRecordCount
      },

      generatedFiles: [
        PATHS.playerIndex,
        PATHS.activeAverage,
        PATHS.home
      ]
    };
  }

  /* =====================================================
     MAIN BUILD
  ===================================================== */

  function build(
    sourceData,
    options = {}
  ) {
    const validationResult =
      validate(sourceData);

    const sourceRecords =
      extractRecords(sourceData);

    const foundationDate =
      normalizeDate(
        options.foundationDate,
        RULES.foundationDate
      );

    const generatedAt =
      normalizeText(
        options.generatedAt
      ) ||
      nowIso();

    const players =
      sourceRecords
        .filter(isPlainObject)
        .filter(record => {
          const id =
            getPlayerId(record);

          const historicalPower =
            getHistoricalPower(record);

          return Boolean(
            id &&
            historicalPower >=
              RULES.minimumHistoricalPower
          );
        })
        .map(record =>
          normalizePlayer(
            record,
            foundationDate
          )
        );

    const activeAverage =
      buildActiveAverage(
        players,
        foundationDate,
        generatedAt
      );

    const playerIndex =
      buildPlayerIndex(
        players,
        foundationDate,
        generatedAt
      );

    const home =
      buildHome(
        players,
        foundationDate,
        generatedAt
      );

    const manifest =
      buildManifest(
        validationResult,
        foundationDate,
        generatedAt,
        options
      );

    /*
     * The permanent source file is preserved exactly as uploaded.
     * The 250,000 Top Power filter is applied to all generated files.
     */
    const files = {
      [PATHS.foundation]:
        cloneData(sourceData),

      [PATHS.manifest]:
        manifest,

      [PATHS.playerIndex]:
        playerIndex,

      [PATHS.activeAverage]:
        activeAverage,

      [PATHS.home]:
        home
    };

    return {
      success:
        true,

      engine: {
        name:
          MODULE_NAME,

        version:
          MODULE_VERSION
      },

      foundationDate,

      generatedAt,

      summary: {
        sourceRecords:
          validationResult.totalRecords,

        activePlayers:
          players.length,

        excludedLowPower:
          validationResult.excludedLowPowerCount,

        invalidRecords:
          validationResult.invalidRecordCount,

        warriors:
          home.totals.warriors,

        farmers:
          home.totals.farmers,

        totalServerPower:
          home.totals.serverPower
      },

      data: {
        manifest,
        playerIndex,
        activeAverage,
        home
      },

      files
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

      build,

      validate,

      getRules() {
        return {
          ...RULES
        };
      },

      getPaths() {
        return {
          ...PATHS
        };
      }
    });

  global.K630FoundationEngine =
    publicApi;

  console.info(
    `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
  );
})(window);