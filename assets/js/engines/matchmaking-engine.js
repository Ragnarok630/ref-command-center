/* =========================================================
   K630-REF MATCHMAKING ENGINE
   File: assets/js/engines/matchmaking-engine.js
   Version: 630.1.0

   Responsibilities:
   - Process an official Matchmaking upload
   - Apply the permanent 250,000 Top Power filter
   - Update existing active players
   - Add newly arrived players
   - Move missing players to Old Players
   - Rebuild Active & Average
   - Rebuild the player index
   - Rebuild the Home dashboard
   - Create a Matchmaking manifest
   - Never use localStorage or IndexedDB

   Public API:
   - window.K630MatchmakingEngine.validate(sourceData)
   - window.K630MatchmakingEngine.build(
       sourceData,
       currentActiveAverage,
       currentOldPlayers,
       options
     )

   Important:
   - This engine does not write to GitHub.
   - admin-center.js writes the returned files.
========================================================= */

(function initializeK630MatchmakingEngine(global) {
  "use strict";

  /* =====================================================
     MODULE INFORMATION
  ===================================================== */

  const MODULE_NAME =
    "K630 Matchmaking Engine";

  const MODULE_VERSION =
    "630.1.0";

  const SCHEMA_VERSION =
    1;

  /* =====================================================
     BUSINESS RULES
  ===================================================== */

  const RULES =
    Object.freeze({
      homeKingdom:
        630,

      minimumHistoricalPower:
        250_000,

      warriorMinimumPower:
        20_000_000,

      t5MinimumTechPower:
        28_931_215,

      initialServerStatus:
        "LV2",

      initialServerStatusColor:
        "green"
    });

  /* =====================================================
     DEFAULT PATHS
  ===================================================== */

  const PATHS =
    Object.freeze({
      matchmaking:
        "assets/data/matchmaking/season-1.json",

      manifest:
        "assets/data/matchmaking/season-1-manifest.json",

      playerIndex:
        "assets/data/generated/foundation/player-index.json",

      activeAverage:
        "assets/data/generated/active-average/current.json",

      oldPlayers:
        "assets/data/generated/old-players/current.json",

      home:
        "assets/data/generated/home/current.json"
    });

  /* =====================================================
     SOURCE FIELD NAMES
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

      faction: [
        "Faction",
        "faction"
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
        "historicalPower"
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

      troopPower: [
        "Troop Power",
        "TroopPower",
        "troopPower"
      ],

      buildingPower: [
        "Building Power",
        "BuildingPower",
        "buildingPower"
      ],

      heroPower: [
        "Hero Power",
        "HeroPower",
        "heroPower"
      ],

      policyPower: [
        "Policy Power",
        "PolicyPower",
        "policyPower"
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

      unitsDead: [
        "Units Dead",
        "UnitsDead",
        "unitsDead"
      ],

      maxUnitsHealed: [
        "Max Units Healed",
        "MaxUnitsHealed",
        "maxUnitsHealed"
      ],

      serverRank: [
        "Server Rank",
        "ServerRank",
        "serverRank"
      ],

      castleLevel: [
        "Castle Level",
        "CastleLevel",
        "castleLevel"
      ],

      resourcesGathered: [
        "Resources Gathered",
        "ResourcesGathered",
        "resourcesGathered"
      ],

      manaUsed: [
        "Mana Used",
        "ManaUsed",
        "manaUsed"
      ],

      honourKills: [
        "Honour Kills",
        "Honor Kills",
        "honourKills",
        "honorKills"
      ],

      meritPowerRatio: [
        "M/P Ratio",
        "M-P Ratio",
        "meritPowerRatio"
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
      value === null ||
      value === undefined
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
      "K630MatchmakingEngineError";

    error.details =
      details;

    return error;
  }

  function normalizeDate(
    value,
    fallback = ""
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

  function calculatePowerGrowth(
    startPower,
    historicalPower
  ) {
    return (
      historicalPower -
      startPower
    );
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
      "The Matchmaking file must contain a player array."
    );
  }

  function extractActivePlayers(
    activeAverage
  ) {
    if (
      Array.isArray(
        activeAverage
      )
    ) {
      return activeAverage;
    }

    if (
      Array.isArray(
        activeAverage?.players
      )
    ) {
      return activeAverage.players;
    }

    throw createError(
      "The current Active & Average dataset could not be loaded."
    );
  }

  function extractOldPlayers(
    oldPlayersData
  ) {
    if (
      oldPlayersData ===
        null ||
      oldPlayersData ===
        undefined
    ) {
      return [];
    }

    if (
      Array.isArray(
        oldPlayersData
      )
    ) {
      return oldPlayersData;
    }

    if (
      Array.isArray(
        oldPlayersData?.players
      )
    ) {
      return oldPlayersData.players;
    }

    return [];
  }

  /* =====================================================
     SOURCE PLAYER VALUES
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

  function normalizeSourcePlayer(
    record
  ) {
    const id =
      getPlayerId(record);

    const currentPower =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.currentPower
        )
      );

    const historicalPower =
      getHistoricalPower(record);

    const techPower =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.techPower
        )
      );

    return {
      id,

      name:
        normalizeText(
          getRecordValue(
            record,
            FIELD_NAMES.name
          )
        ),

      alliance:
        normalizeText(
          getRecordValue(
            record,
            FIELD_NAMES.alliance
          )
        ),

      faction:
        normalizeText(
          getRecordValue(
            record,
            FIELD_NAMES.faction
          )
        ),

      currentPower,

      historicalPower,

      merits:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.merits
          )
        ),

      topMerits:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.topMerits
          )
        ),

      techPower,

      troopPower:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.troopPower
          )
        ),

      buildingPower:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.buildingPower
          )
        ),

      heroPower:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.heroPower
          )
        ),

      policyPower:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.policyPower
          )
        ),

      unitsKilled:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.unitsKilled
          )
        ),

      unitsHealed:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.unitsHealed
          )
        ),

      unitsDead:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.unitsDead
          )
        ),

      maxUnitsHealed:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.maxUnitsHealed
          )
        ),

      serverRank:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.serverRank
          )
        ),

      castleLevel:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.castleLevel
          )
        ),

      resourcesGathered:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.resourcesGathered
          )
        ),

      manaUsed:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.manaUsed
          )
        ),

      honourKills:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.honourKills
          )
        ),

      meritPowerRatio:
        numberValue(
          getRecordValue(
            record,
            FIELD_NAMES.meritPowerRatio
          )
        ),

      troopTier:
        calculateTroopTier(
          techPower
        ),

      playerType:
        calculatePlayerType(
          historicalPower
        )
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
        "The Matchmaking file contains no players."
      );
    }

    const seenIds =
      new Set();

    const duplicateIds =
      [];

    let validIdCount =
      0;

    let eligibleCount =
      0;

    let excludedLowPowerCount =
      0;

    let invalidRecordCount =
      0;

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
          "The Matchmaking file contains duplicate Lord IDs: " +
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
     EXISTING PLAYER UPDATE
  ===================================================== */

  function updateExistingPlayer(
    currentPlayer,
    sourcePlayer,
    matchmakingDate,
    seasonNumber
  ) {
    const startPower =
      integerValue(
        currentPlayer.startPower
      );

    const historicalPower =
      sourcePlayer.historicalPower;

    const seasons =
      (
        currentPlayer.seasons &&
        typeof currentPlayer.seasons ===
          "object"
      )
        ? cloneData(
            currentPlayer.seasons
          )
        : {};

    return {
      ...cloneData(
        currentPlayer
      ),

      id:
        sourcePlayer.id,

      name:
        sourcePlayer.name,

      alliance:
        sourcePlayer.alliance,

      faction:
        sourcePlayer.faction,

      serverStatus:
        normalizeText(
          currentPlayer.serverStatus
        ) ||
        RULES.initialServerStatus,

      serverStatusColor:
        normalizeText(
          currentPlayer.serverStatusColor
        ) ||
        RULES.initialServerStatusColor,

      troopTier:
        sourcePlayer.troopTier,

      currentPower:
        sourcePlayer.currentPower,

      historicalPower,

      powerGrowth:
        calculatePowerGrowth(
          startPower,
          historicalPower
        ),

      merits:
        sourcePlayer.merits,

      topMerits:
        sourcePlayer.topMerits,

      techPower:
        sourcePlayer.techPower,

      troopPower:
        sourcePlayer.troopPower,

      buildingPower:
        sourcePlayer.buildingPower,

      heroPower:
        sourcePlayer.heroPower,

      policyPower:
        sourcePlayer.policyPower,

      unitsKilled:
        sourcePlayer.unitsKilled,

      unitsHealed:
        sourcePlayer.unitsHealed,

      unitsDead:
        sourcePlayer.unitsDead,

      maxUnitsHealed:
        sourcePlayer.maxUnitsHealed,

      resourcesGathered:
        sourcePlayer.resourcesGathered,

      manaUsed:
        sourcePlayer.manaUsed,

      honourKills:
        sourcePlayer.honourKills,

      meritPowerRatio:
        sourcePlayer.meritPowerRatio,

      serverRank:
        sourcePlayer.serverRank,

      castleLevel:
        sourcePlayer.castleLevel,

      playerType:
        sourcePlayer.playerType,

      active:
        true,

      source:
        "matchmaking",

      sourceDate:
        matchmakingDate,

      currentSeason:
        seasonNumber,

      seasons
    };
  }

  /* =====================================================
     NEW PLAYER CREATION
  ===================================================== */

  function createNewPlayer(
    sourcePlayer,
    matchmakingDate,
    seasonNumber
  ) {
    const historicalPower =
      sourcePlayer.historicalPower;

    return {
      id:
        sourcePlayer.id,

      name:
        sourcePlayer.name,

      alliance:
        sourcePlayer.alliance,

      faction:
        sourcePlayer.faction,

      dateJoinKingdom:
        matchmakingDate,

      serverStatus:
        RULES.initialServerStatus,

      serverStatusColor:
        RULES.initialServerStatusColor,

      troopTier:
        sourcePlayer.troopTier,

      startPower:
        historicalPower,

      currentPower:
        sourcePlayer.currentPower,

      historicalPower,

      powerGrowth:
        0,

      merits:
        sourcePlayer.merits,

      topMerits:
        sourcePlayer.topMerits,

      techPower:
        sourcePlayer.techPower,

      troopPower:
        sourcePlayer.troopPower,

      buildingPower:
        sourcePlayer.buildingPower,

      heroPower:
        sourcePlayer.heroPower,

      policyPower:
        sourcePlayer.policyPower,

      unitsKilled:
        sourcePlayer.unitsKilled,

      unitsHealed:
        sourcePlayer.unitsHealed,

      unitsDead:
        sourcePlayer.unitsDead,

      maxUnitsHealed:
        sourcePlayer.maxUnitsHealed,

      resourcesGathered:
        sourcePlayer.resourcesGathered,

      manaUsed:
        sourcePlayer.manaUsed,

      honourKills:
        sourcePlayer.honourKills,

      meritPowerRatio:
        sourcePlayer.meritPowerRatio,

      serverRank:
        sourcePlayer.serverRank,

      castleLevel:
        sourcePlayer.castleLevel,

      playerType:
        sourcePlayer.playerType,

      averageMeritsValue:
        null,

      averageMeritsPercentage:
        null,

      seasonsPlayed:
        0,

      seasons: {},

      active:
        true,

      source:
        "matchmaking",

      sourceDate:
        matchmakingDate,

      currentSeason:
        seasonNumber,

      matchmakingNewPlayer:
        true
    };
  }

  /* =====================================================
     OLD PLAYER CREATION
  ===================================================== */

  function createOldPlayer(
    currentPlayer,
    matchmakingDate,
    seasonNumber
  ) {
    const player =
      cloneData(
        currentPlayer
      );

    delete player.rank;

    return {
      ...player,

      active:
        false,

      dateLeaveKingdom:
        matchmakingDate,

      leaveReason:
        `Missing from Matchmaking Season ${seasonNumber}`,

      leftBeforeSeason:
        seasonNumber,

      source:
        "matchmaking",

      sourceDate:
        matchmakingDate
    };
  }

  /* =====================================================
     ACTIVE & AVERAGE
  ===================================================== */

  function buildActiveAverage(
    players,
    matchmakingDate,
    seasonNumber,
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

            ...cloneData(
              player
            )
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
        "matchmaking",

      matchmakingDate,

      generatedAt,

      activePlayerCount:
        sortedPlayers.length,

      currentSeason:
        seasonNumber,

      seasonColumns: [
        {
          season:
            seasonNumber,

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
     OLD PLAYERS DATASET
  ===================================================== */

  function buildOldPlayers(
    oldPlayers,
    matchmakingDate,
    seasonNumber,
    generatedAt
  ) {
    const uniquePlayers =
      new Map();

    oldPlayers.forEach(player => {
      const id =
        normalizeText(
          player.id
        );

      if (!id) {
        return;
      }

      uniquePlayers.set(
        id,
        cloneData(player)
      );
    });

    const players =
      [...uniquePlayers.values()]
        .sort(
          (
            first,
            second
          ) => {
            const firstDate =
              normalizeText(
                first.dateLeaveKingdom
              );

            const secondDate =
              normalizeText(
                second.dateLeaveKingdom
              );

            if (
              firstDate !==
              secondDate
            ) {
              return secondDate
                .localeCompare(
                  firstDate
                );
            }

            return normalizeText(
              first.id
            ).localeCompare(
              normalizeText(
                second.id
              ),
              undefined,
              {
                numeric:
                  true
              }
            );
          }
        );

    return {
      schemaVersion:
        SCHEMA_VERSION,

      kingdom:
        RULES.homeKingdom,

      dataset:
        "old-players",

      generatedFrom:
        "matchmaking",

      matchmakingDate,

      currentSeason:
        seasonNumber,

      generatedAt,

      playerCount:
        players.length,

      players
    };
  }

  /* =====================================================
     PLAYER INDEX
  ===================================================== */

  function buildPlayerIndex(
    activePlayers,
    oldPlayers,
    matchmakingDate,
    seasonNumber,
    generatedAt
  ) {
    const index =
      {};

    activePlayers.forEach(player => {
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
          "matchmaking"
      };
    });

    oldPlayers.forEach(player => {
      index[player.id] = {
        id:
          player.id,

        name:
          player.name,

        alliance:
          player.alliance,

        dateJoinKingdom:
          player.dateJoinKingdom,

        dateLeaveKingdom:
          player.dateLeaveKingdom,

        serverStatus:
          player.serverStatus,

        serverStatusColor:
          player.serverStatusColor,

        troopTier:
          player.troopTier,

        active:
          false,

        source:
          "old-players"
      };
    });

    return {
      schemaVersion:
        SCHEMA_VERSION,

      kingdom:
        RULES.homeKingdom,

      dataset:
        "player-index",

      generatedFrom:
        "matchmaking",

      matchmakingDate,

      currentSeason:
        seasonNumber,

      generatedAt,

      activePlayerCount:
        activePlayers.length,

      oldPlayerCount:
        oldPlayers.length,

      playerCount:
        Object.keys(index)
          .length,

      players:
        index
    };
  }

  /* =====================================================
     HOME DATASET
  ===================================================== */

  function buildTopPlayerMerits(
    players
  ) {
    return [...players]
      .sort(
        (
          first,
          second
        ) => {
          if (
            second.merits !==
            first.merits
          ) {
            return (
              second.merits -
              first.merits
            );
          }

          return (
            second.historicalPower -
            first.historicalPower
          );
        }
      )
      .slice(0, 5)
      .map(
        (
          player,
          index
        ) => ({
          rank:
            index + 1,

          id:
            player.id,

          name:
            player.name,

          kingdom:
            RULES.homeKingdom,

          merits:
            player.merits
        })
      );
  }

  function buildHome(
    players,
    matchmakingDate,
    seasonNumber,
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
          integerValue(
            player.historicalPower
          ),
        0
      );

    const totalServerMerits =
      players.reduce(
        (
          total,
          player
        ) =>
          total +
          integerValue(
            player.merits
          ),
        0
      );

    const totalServerKills =
      players.reduce(
        (
          total,
          player
        ) =>
          total +
          integerValue(
            player.unitsKilled
          ),
        0
      );

    const totalServerHealing =
      players.reduce(
        (
          total,
          player
        ) =>
          total +
          integerValue(
            player.unitsHealed
          ),
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
        "matchmaking",

      matchmakingDate,

      generatedAt,

      currentSeason:
        seasonNumber,

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
          totalServerMerits,

        serverKills:
          totalServerKills,

        serverHealing:
          totalServerHealing
      },

      playerRanking: {
        topIdMerits:
          buildTopPlayerMerits(
            players
          )
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
     MATCHMAKING MANIFEST
  ===================================================== */

  function buildManifest(
    validationResult,
    summary,
    matchmakingDate,
    seasonNumber,
    generatedAt,
    options
  ) {
    return {
      schemaVersion:
        SCHEMA_VERSION,

      kingdom:
        RULES.homeKingdom,

      dataset:
        "matchmaking",

      status:
        "official",

      season:
        seasonNumber,

      matchmakingDate,

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
        `matchmaking-season-${seasonNumber}.json`,

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

        eligiblePlayers:
          validationResult.eligibleCount,

        excludedLowPower:
          validationResult.excludedLowPowerCount,

        invalidRecords:
          validationResult.invalidRecordCount,

        previousActivePlayers:
          summary.previousActivePlayers,

        activePlayers:
          summary.activePlayers,

        existingPlayers:
          summary.existingPlayers,

        newPlayers:
          summary.newPlayers,

        leftPlayers:
          summary.leftPlayers,

        totalOldPlayers:
          summary.totalOldPlayers
      },

      generatedFiles: [
        PATHS.playerIndex,
        PATHS.activeAverage,
        PATHS.oldPlayers,
        PATHS.home
      ]
    };
  }

  /* =====================================================
     MAIN BUILD
  ===================================================== */

  function build(
    sourceData,
    currentActiveAverage,
    currentOldPlayers = null,
    options = {}
  ) {
    const validationResult =
      validate(sourceData);

    const matchmakingDate =
      normalizeDate(
        options.matchmakingDate
      );

    if (!matchmakingDate) {
      throw createError(
        "A valid Matchmaking date in YYYY-MM-DD format is required."
      );
    }

    const seasonNumber =
      Math.max(
        1,
        integerValue(
          options.seasonNumber
        ) || 1
      );

    const generatedAt =
      normalizeText(
        options.generatedAt
      ) ||
      nowIso();

    const sourceRecords =
      extractRecords(sourceData);

    const currentPlayers =
      extractActivePlayers(
        currentActiveAverage
      );

    const previousOldPlayers =
      extractOldPlayers(
        currentOldPlayers
      );

    const currentPlayerIndex =
      new Map();

    currentPlayers.forEach(player => {
      const id =
        normalizeText(
          player.id
        );

      if (!id) {
        return;
      }

      currentPlayerIndex.set(
        id,
        cloneData(player)
      );
    });

    const eligibleSourcePlayers =
      sourceRecords
        .filter(isPlainObject)
        .map(
          normalizeSourcePlayer
        )
        .filter(
          player =>
            player.id &&
            player.historicalPower >=
              RULES.minimumHistoricalPower
        );

    const matchmakingPlayerIndex =
      new Map();

    eligibleSourcePlayers
      .forEach(player => {
        matchmakingPlayerIndex.set(
          player.id,
          player
        );
      });

    const activePlayers =
      [];

    const newlyAddedPlayers =
      [];

    const existingPlayers =
      [];

    eligibleSourcePlayers.forEach(
      sourcePlayer => {
        const currentPlayer =
          currentPlayerIndex.get(
            sourcePlayer.id
          );

        if (currentPlayer) {
          const updatedPlayer =
            updateExistingPlayer(
              currentPlayer,
              sourcePlayer,
              matchmakingDate,
              seasonNumber
            );

          activePlayers.push(
            updatedPlayer
          );

          existingPlayers.push(
            updatedPlayer
          );

          return;
        }

        const newPlayer =
          createNewPlayer(
            sourcePlayer,
            matchmakingDate,
            seasonNumber
          );

        activePlayers.push(
          newPlayer
        );

        newlyAddedPlayers.push(
          newPlayer
        );
      }
    );

    const leftPlayers =
      [];

    currentPlayers.forEach(
      currentPlayer => {
        const id =
          normalizeText(
            currentPlayer.id
          );

        if (
          !id ||
          matchmakingPlayerIndex.has(
            id
          )
        ) {
          return;
        }

        leftPlayers.push(
          createOldPlayer(
            currentPlayer,
            matchmakingDate,
            seasonNumber
          )
        );
      }
    );

    const allOldPlayers =
      [
        ...previousOldPlayers,
        ...leftPlayers
      ];

    const activeAverage =
      buildActiveAverage(
        activePlayers,
        matchmakingDate,
        seasonNumber,
        generatedAt
      );

    const oldPlayers =
      buildOldPlayers(
        allOldPlayers,
        matchmakingDate,
        seasonNumber,
        generatedAt
      );

    const playerIndex =
      buildPlayerIndex(
        activePlayers,
        oldPlayers.players,
        matchmakingDate,
        seasonNumber,
        generatedAt
      );

    const home =
      buildHome(
        activePlayers,
        matchmakingDate,
        seasonNumber,
        generatedAt
      );

    const summary = {
      sourceRecords:
        validationResult.totalRecords,

      eligiblePlayers:
        validationResult.eligibleCount,

      excludedLowPower:
        validationResult.excludedLowPowerCount,

      invalidRecords:
        validationResult.invalidRecordCount,

      previousActivePlayers:
        currentPlayers.length,

      activePlayers:
        activePlayers.length,

      existingPlayers:
        existingPlayers.length,

      newPlayers:
        newlyAddedPlayers.length,

      leftPlayers:
        leftPlayers.length,

      totalOldPlayers:
        oldPlayers.players.length,

      warriors:
        home.totals.warriors,

      farmers:
        home.totals.farmers,

      totalServerPower:
        home.totals.serverPower,

      totalServerMerits:
        home.totals.serverMerits,

      totalServerKills:
        home.totals.serverKills,

      totalServerHealing:
        home.totals.serverHealing
    };

    const manifest =
      buildManifest(
        validationResult,
        summary,
        matchmakingDate,
        seasonNumber,
        generatedAt,
        options
      );

    const matchmakingPath =
      normalizeText(
        options.matchmakingPath
      ) ||
      (
        `assets/data/matchmaking/` +
        `season-${seasonNumber}.json`
      );

    const manifestPath =
      normalizeText(
        options.manifestPath
      ) ||
      (
        `assets/data/matchmaking/` +
        `season-${seasonNumber}-manifest.json`
      );

    const files = {
      [matchmakingPath]:
        cloneData(sourceData),

      [manifestPath]:
        manifest,

      [PATHS.playerIndex]:
        playerIndex,

      [PATHS.activeAverage]:
        activeAverage,

      [PATHS.oldPlayers]:
        oldPlayers,

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

      seasonNumber,

      matchmakingDate,

      generatedAt,

      summary,

      changes: {
        existingPlayerIds:
          existingPlayers.map(
            player => player.id
          ),

        newPlayerIds:
          newlyAddedPlayers.map(
            player => player.id
          ),

        leftPlayerIds:
          leftPlayers.map(
            player => player.id
          )
      },

      data: {
        manifest,
        playerIndex,
        activeAverage,
        oldPlayers,
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

      validate,

      build,

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

  global.K630MatchmakingEngine =
    publicApi;

  console.info(
    `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
  );
})(window);