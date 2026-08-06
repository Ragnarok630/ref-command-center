/* =========================================================
   K630-REF WEEKLY PLAYER STATE ENGINE

   File:
   assets/js/engines/weekly-player-state-engine.js

   Version:
   630.1.2 Gold Master

   Responsibilities:
   - Process Server 630 W0 through W6
   - Update Active & Average
   - Update the fixed Season Info participant set
   - Remove Matchmaking NEW status at W0
   - Add NEW players from W1 through W6 to Active & Average
   - Never add W1 through W6 newcomers to Season Info
   - Detect LEFT Season participants
   - Preserve the first official leave date
   - Clear LEFT when an ID returns later
   - Never backfill a missing week
   - Keep all central data in k630-public-data

   Public API:
   window.K630WeeklyPlayerStateEngine.build(
     activeAverageData,
     seasonInfoData,
     currentWeekData,
     options
   )

   Output:
   assets/data/generated/active-average/current.json
   assets/data/generated/season-info/current.json
========================================================= */

(function initializeK630WeeklyPlayerStateEngine(global) {
  "use strict";

  /* =====================================================
     MODULE INFORMATION
  ===================================================== */

  const MODULE_NAME =
    "K630 Weekly Player State Engine";

  const MODULE_VERSION =
    "630.1.2";

  const SCHEMA_VERSION =
    1;

  const ACTIVE_AVERAGE_OUTPUT_PATH =
    "assets/data/generated/active-average/current.json";

  const SEASON_INFO_OUTPUT_PATH =
    "assets/data/generated/season-info/current.json";

  /* =====================================================
     BUSINESS RULES
  ===================================================== */

  const RULES =
    Object.freeze({
      kingdom:
        630,

      minimumHistoricalPower:
        250_000,

      warriorMinimumPower:
        20_000_000,

      t5MinimumTechPower:
        28_931_215,

      firstWeek:
        0,

      lastWeek:
        6
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

      resourcesGathered: [
        "Resources Gathered",
        "ResourcesGathered",
        "Total Resources Gathered",
        "TotalResourcesGathered",
        "resourcesGathered",
        "totalResourcesGathered"
      ],

      goldGathered: [
        "Gold Gathered",
        "GoldGathered",
        "goldGathered",
        "gatheredGold",
        "Gathered Gold"
      ],

      woodGathered: [
        "Wood Gathered",
        "WoodGathered",
        "woodGathered",
        "gatheredWood",
        "Gathered Wood"
      ],

      oreGathered: [
        "Ore Gathered",
        "OreGathered",
        "oreGathered",
        "gatheredOre",
        "Gathered Ore"
      ],

      manaGathered: [
        "Mana Gathered",
        "ManaGathered",
        "manaGathered",
        "gatheredMana",
        "Gathered Mana"
      ],

      gemsGathered: [
        "Gems Gathered",
        "Gem Gathered",
        "GemsGathered",
        "GemGathered",
        "gemsGathered",
        "gemGathered",
        "gatheredGems",
        "Gathered Gems"
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

      faction: [
        "Faction",
        "faction"
      ],

      meritPowerRatio: [
        "M/P Ratio",
        "M-P Ratio",
        "Merit Power Ratio",
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

    const normalized =
      normalizeText(value)
        .replace(
          /\s/g,
          ""
        )
        .replace(
          /,/g,
          ""
        );

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

  function nullableInteger(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const parsed =
      Number(value);

    return Number.isFinite(parsed)
      ? Math.trunc(parsed)
      : null;
  }

  function maximumCumulativeValue(
    previousValue,
    uploadedValue
  ) {
    return Math.max(
      integerValue(
        previousValue
      ),
      integerValue(
        uploadedValue
      )
    );
  }

  function normalizeCumulativeResources(
    source = {}
  ) {
    const nestedResources =
      isPlainObject(
        source.resources
      )
        ? source.resources
        : {};

    return {
      total:
        maximumCumulativeValue(
          source.resourcesGathered,
          nestedResources.total
        ),

      gold:
        maximumCumulativeValue(
          source.goldGathered,
          nestedResources.gold
        ),

      wood:
        maximumCumulativeValue(
          source.woodGathered,
          nestedResources.wood
        ),

      ore:
        maximumCumulativeValue(
          source.oreGathered,
          nestedResources.ore
        ),

      mana:
        maximumCumulativeValue(
          source.manaGathered,
          nestedResources.mana
        ),

      gems:
        maximumCumulativeValue(
          source.gemsGathered,
          nestedResources.gems
        )
    };
  }

  function applyCumulativeResources(
    target,
    source
  ) {
    const previous =
      normalizeCumulativeResources(
        target
      );

    const uploaded =
      normalizeCumulativeResources(
        source
      );

    const resources = {
      total:
        maximumCumulativeValue(
          previous.total,
          uploaded.total
        ),

      gold:
        maximumCumulativeValue(
          previous.gold,
          uploaded.gold
        ),

      wood:
        maximumCumulativeValue(
          previous.wood,
          uploaded.wood
        ),

      ore:
        maximumCumulativeValue(
          previous.ore,
          uploaded.ore
        ),

      mana:
        maximumCumulativeValue(
          previous.mana,
          uploaded.mana
        ),

      gems:
        maximumCumulativeValue(
          previous.gems,
          uploaded.gems
        )
    };

    target.resources =
      resources;

    target.resourcesGathered =
      resources.total;

    target.goldGathered =
      resources.gold;

    target.woodGathered =
      resources.wood;

    target.oreGathered =
      resources.ore;

    target.manaGathered =
      resources.mana;

    target.gemsGathered =
      resources.gems;

    return target;
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
      "K630WeeklyPlayerStateEngineError";

    error.details =
      details;

    return error;
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

    const normalizedFields =
      new Map();

    Object.keys(record)
      .forEach(key => {
        normalizedFields.set(
          normalizeKey(key),
          key
        );
      });

    for (
      const fieldName of
      fieldNames
    ) {
      const actualKey =
        normalizedFields.get(
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
      numberValue(techPower) >=
      RULES.t5MinimumTechPower
    )
      ? "T5"
      : "T4";
  }

  function calculatePlayerType(
    historicalPower
  ) {
    return (
      numberValue(
        historicalPower
      ) >
      RULES.warriorMinimumPower
    )
      ? "warrior"
      : "farmer";
  }

  function calculateMeritPowerPercentage(
    merits,
    currentPower,
    suppliedRatio
  ) {
    const ratio =
      numberValue(
        suppliedRatio
      );

    if (ratio > 0) {
      return ratio;
    }

    const power =
      numberValue(
        currentPower
      );

    if (power <= 0) {
      return 0;
    }

    return (
      numberValue(merits) /
      power *
      100
    );
  }

  /* =====================================================
     MERIT CONFIGURATION
  ===================================================== */

  const DEFAULT_MERIT_CONFIGURATION =
    Object.freeze({
      w6: {
        t5: {
          rank3:
            12,

          rank2:
            10,

          rank1:
            8
        },

        t4: {
          rank3:
            10,

          rank2:
            8,

          rank1:
            6
        }
      }
    });

  function normalizeMeritTargetValue(
    value,
    fallback
  ) {
    const parsed =
      Number(value);

    if (!Number.isFinite(parsed)) {
      return numberValue(
        fallback
      );
    }

    return Math.min(
      100,
      Math.max(
        0,
        Math.round(
          parsed * 100
        ) / 100
      )
    );
  }

  function normalizeMeritConfiguration(
    value
  ) {
    const source =
      isPlainObject(value)
        ? value
        : {};

    const w6Source =
      isPlainObject(source.w6)
        ? source.w6
        : {};

    const buildGroup =
      (
        group,
        fallback
      ) => ({
        rank3:
          normalizeMeritTargetValue(
            group?.rank3,
            fallback.rank3
          ),

        rank2:
          normalizeMeritTargetValue(
            group?.rank2,
            fallback.rank2
          ),

        rank1:
          normalizeMeritTargetValue(
            group?.rank1,
            fallback.rank1
          )
      });

    const w6 = {
      t5:
        buildGroup(
          w6Source.t5,
          DEFAULT_MERIT_CONFIGURATION
            .w6.t5
        ),

      t4:
        buildGroup(
          w6Source.t4,
          DEFAULT_MERIT_CONFIGURATION
            .w6.t4
        )
    };

    const weeks = {};

    for (
      let weekNumber = 1;
      weekNumber <= 6;
      weekNumber += 1
    ) {
      const factor =
        weekNumber / 6;

      weeks[
        `W${weekNumber}`
      ] = {
        t5: {
          rank3:
            normalizeMeritTargetValue(
              w6.t5.rank3 *
              factor,
              0
            ),

          rank2:
            normalizeMeritTargetValue(
              w6.t5.rank2 *
              factor,
              0
            ),

          rank1:
            normalizeMeritTargetValue(
              w6.t5.rank1 *
              factor,
              0
            )
        },

        t4: {
          rank3:
            normalizeMeritTargetValue(
              w6.t4.rank3 *
              factor,
              0
            ),

          rank2:
            normalizeMeritTargetValue(
              w6.t4.rank2 *
              factor,
              0
            ),

          rank1:
            normalizeMeritTargetValue(
              w6.t4.rank1 *
              factor,
              0
            )
        }
      };
    }

    return {
      version:
        integerValue(
          source.version
        ) ||
        1,

      w6,

      weeks,

      savedAt:
        normalizeText(
          source.savedAt
        ) ||
        null,

      savedBy:
        normalizeText(
          source.savedBy
        ) ||
        null
    };
  }

  function getMeritTargetsForWeek(
    meritConfiguration,
    troopTier,
    weekNumber
  ) {
    if (weekNumber <= 0) {
      return null;
    }

    const weekTargets =
      meritConfiguration
        ?.weeks
        ?.[`W${weekNumber}`];

    if (!weekTargets) {
      return null;
    }

    return normalizeText(
      troopTier
    ).toUpperCase() ===
      "T5"
      ? weekTargets.t5
      : weekTargets.t4;
  }

  function calculateMeritRank(
    meritPowerPercentage,
    targets
  ) {
    if (!targets) {
      return null;
    }

    const percentage =
      numberValue(
        meritPowerPercentage
      );

    if (
      percentage >=
      numberValue(
        targets.rank3
      )
    ) {
      return 3;
    }

    if (
      percentage >=
      numberValue(
        targets.rank2
      )
    ) {
      return 2;
    }

    if (
      percentage >=
      numberValue(
        targets.rank1
      )
    ) {
      return 1;
    }

    return 0;
  }

  function normalizeWeekNumber(value) {
    const normalized =
      normalizeText(value)
        .toUpperCase()
        .replace(
          /^W/,
          ""
        );

    const weekNumber =
      Number(normalized);

    if (
      !Number.isInteger(
        weekNumber
      ) ||
      weekNumber <
        RULES.firstWeek ||
      weekNumber >
        RULES.lastWeek
    ) {
      throw createError(
        "Week number must be W0 through W6."
      );
    }

    return weekNumber;
  }

  /* =====================================================
     SOURCE EXTRACTION
  ===================================================== */

  function extractActivePlayers(
    activeAverageData
  ) {
    if (
      Array.isArray(
        activeAverageData
      )
    ) {
      return activeAverageData;
    }

    if (
      Array.isArray(
        activeAverageData?.players
      )
    ) {
      return activeAverageData.players;
    }

    throw createError(
      "Active & Average contains no players array."
    );
  }

  function extractSeasonPlayers(
    seasonInfoData
  ) {
    if (
      Array.isArray(
        seasonInfoData?.players
      )
    ) {
      return seasonInfoData.players;
    }

    return [];
  }

  function extractWeekRecords(
    currentWeekData
  ) {
    if (
      Array.isArray(
        currentWeekData
      )
    ) {
      return currentWeekData;
    }

    if (
      Array.isArray(
        currentWeekData?.players
      )
    ) {
      return currentWeekData.players;
    }

    if (
      Array.isArray(
        currentWeekData?.data
      )
    ) {
      return currentWeekData.data;
    }

    throw createError(
      "Weekly source contains no player records."
    );
  }

  /* =====================================================
     WEEK RECORD NORMALIZATION
  ===================================================== */

  function normalizeWeekPlayer(
    record
  ) {
    const id =
      normalizeText(
        getRecordValue(
          record,
          FIELD_NAMES.id
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
      Math.max(
        currentPower,
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.historicalPower
          )
        )
      );

    const merits =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.merits
        )
      );

    const techPower =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.techPower
        )
      );

    const resourcesGathered =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.resourcesGathered
        )
      );

    const goldGathered =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.goldGathered
        )
      );

    const woodGathered =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.woodGathered
        )
      );

    const oreGathered =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.oreGathered
        )
      );

    const manaGathered =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.manaGathered
        )
      );

    const gemsGathered =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.gemsGathered
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

      merits,

      topMerits:
        integerValue(
          getRecordValue(
            record,
            FIELD_NAMES.topMerits
          )
        ),

      techPower,

      troopTier:
        calculateTroopTier(
          techPower
        ),

      playerType:
        calculatePlayerType(
          historicalPower
        ),

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

      resources: {
        total:
          resourcesGathered,

        gold:
          goldGathered,

        wood:
          woodGathered,

        ore:
          oreGathered,

        mana:
          manaGathered,

        gems:
          gemsGathered
      },

      resourcesGathered,

      goldGathered,

      woodGathered,

      oreGathered,

      manaGathered,

      gemsGathered,

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

      meritPowerRatio:
        calculateMeritPowerPercentage(
          merits,
          currentPower,
          getRecordValue(
            record,
            FIELD_NAMES.meritPowerRatio
          )
        )
    };
  }

  function buildCurrentWeekIndex(
    currentWeekData
  ) {
    const index =
      new Map();

    extractWeekRecords(
      currentWeekData
    )
      .filter(
        isPlainObject
      )
      .map(
        normalizeWeekPlayer
      )
      .filter(player => {
        return Boolean(
          player.id &&
          player.historicalPower >=
            RULES.minimumHistoricalPower
        );
      })
      .forEach(player => {
        index.set(
          player.id,
          player
        );
      });

    return index;
  }
    /* =====================================================
     ACTIVE & AVERAGE HELPERS
  ===================================================== */

  function normalizeActivePlayer(
    source,
    sourceIndex
  ) {
    const player =
      cloneData(source);

    player.id =
      normalizeText(
        player.id
      );

    player.rank =
      integerValue(
        player.rank
      ) ||
      sourceIndex + 1;

    player.name =
      normalizeText(
        player.name
      );

    player.alliance =
      normalizeText(
        player.alliance
      );

    player.startPower =
      integerValue(
        player.startPower
      );

    player.currentPower =
      integerValue(
        player.currentPower
      );

    player.historicalPower =
      integerValue(
        player.historicalPower
      );

    player.powerGrowth =
      integerValue(
        player.powerGrowth
      );

    player.techPower =
      integerValue(
        player.techPower
      );

    player.topMerits =
      integerValue(
        player.topMerits
      );

    player.merits =
      integerValue(
        player.merits
      );

    player.troopPower =
      integerValue(
        player.troopPower
      );

    player.buildingPower =
      integerValue(
        player.buildingPower
      );

    player.heroPower =
      integerValue(
        player.heroPower
      );

    player.policyPower =
      integerValue(
        player.policyPower
      );

    player.unitsKilled =
      integerValue(
        player.unitsKilled
      );

    player.unitsHealed =
      integerValue(
        player.unitsHealed
      );

    player.unitsDead =
      integerValue(
        player.unitsDead
      );

    player.maxUnitsHealed =
      integerValue(
        player.maxUnitsHealed
      );

    player.manaUsed =
      integerValue(
        player.manaUsed
      );

    player.honourKills =
      integerValue(
        player.honourKills
      );

    player.serverRank =
      integerValue(
        player.serverRank
      );

    player.castleLevel =
      integerValue(
        player.castleLevel
      );

    player.meritPowerRatio =
      numberValue(
        player.meritPowerRatio
      );

    player.serverStatus =
      normalizeText(
        player.serverStatus
      ) ||
      "LV2";

    player.serverStatusColor =
      normalizeText(
        player.serverStatusColor
      ) ||
      "green";

    player.troopTier =
      normalizeText(
        player.troopTier
      ) ||
      calculateTroopTier(
        player.techPower
      );

    player.playerType =
      normalizeText(
        player.playerType
      ) ||
      calculatePlayerType(
        player.historicalPower
      );

    player.active =
      player.active !== false;

    player.notes =
      isPlainObject(
        player.notes
      )
        ? player.notes
        : {};

    applyCumulativeResources(
      player,
      player
    );

    return player;
  }

  function createNewActivePlayer(
    weekPlayer,
    seasonNumber,
    officialDate
  ) {
    const player = {
      rank:
        0,

      id:
        weekPlayer.id,

      name:
        weekPlayer.name,

      alliance:
        weekPlayer.alliance,

      faction:
        weekPlayer.faction,

      dateJoinKingdom:
        officialDate,

      serverStatus:
        "LV2",

      serverStatusColor:
        "green",

      troopTier:
        weekPlayer.troopTier,

      startPower:
        weekPlayer.historicalPower,

      currentPower:
        weekPlayer.currentPower,

      historicalPower:
        weekPlayer.historicalPower,

      powerGrowth:
        0,

      merits:
        weekPlayer.merits,

      topMerits:
        weekPlayer.topMerits,

      techPower:
        weekPlayer.techPower,

      troopPower:
        weekPlayer.troopPower,

      buildingPower:
        weekPlayer.buildingPower,

      heroPower:
        weekPlayer.heroPower,

      policyPower:
        weekPlayer.policyPower,

      unitsKilled:
        weekPlayer.unitsKilled,

      unitsHealed:
        weekPlayer.unitsHealed,

      unitsDead:
        weekPlayer.unitsDead,

      maxUnitsHealed:
        weekPlayer.maxUnitsHealed,

      manaUsed:
        weekPlayer.manaUsed,

      honourKills:
        weekPlayer.honourKills,

      serverRank:
        weekPlayer.serverRank,

      castleLevel:
        weekPlayer.castleLevel,

      meritPowerRatio:
        weekPlayer.meritPowerRatio,

      playerType:
        weekPlayer.playerType,

      averageMeritsValue:
        null,

      averageMeritsPercentage:
        null,

      seasonsPlayed:
        0,

      seasons:
        {},

      active:
        true,

      source:
        "season-week",

      sourceDate:
        officialDate,

      currentSeason:
        seasonNumber,

      matchmakingNewPlayer:
        false,

      seasonNewPlayer:
        true,

      isNew:
        true,

      notes: {
        new:
          true
      }
    };

    applyCumulativeResources(
      player,
      weekPlayer
    );

    return player;
  }

  function applyWeekPlayerToActive(
    activePlayer,
    weekPlayer,
    options
  ) {
    const {
      seasonNumber,
      weekNumber,
      officialDate
    } = options;

    activePlayer.name =
      weekPlayer.name ||
      activePlayer.name;

    activePlayer.alliance =
      weekPlayer.alliance ||
      activePlayer.alliance;

    activePlayer.faction =
      weekPlayer.faction ||
      activePlayer.faction;

    activePlayer.currentPower =
      weekPlayer.currentPower;

    activePlayer.historicalPower =
      Math.max(
        integerValue(
          activePlayer.historicalPower
        ),
        weekPlayer.historicalPower
      );

    activePlayer.powerGrowth =
      activePlayer.historicalPower -
      integerValue(
        activePlayer.startPower
      );

    activePlayer.merits =
      weekPlayer.merits;

    activePlayer.topMerits =
      Math.max(
        integerValue(
          activePlayer.topMerits
        ),
        weekPlayer.topMerits,
        weekPlayer.merits
      );

    activePlayer.techPower =
      weekPlayer.techPower;

    activePlayer.troopTier =
      weekPlayer.troopTier;

    activePlayer.playerType =
      calculatePlayerType(
        activePlayer.historicalPower
      );

    activePlayer.troopPower =
      weekPlayer.troopPower;

    activePlayer.buildingPower =
      weekPlayer.buildingPower;

    activePlayer.heroPower =
      weekPlayer.heroPower;

    activePlayer.policyPower =
      weekPlayer.policyPower;

    activePlayer.unitsKilled =
      maximumCumulativeValue(
        activePlayer.unitsKilled,
        weekPlayer.unitsKilled
      );

    activePlayer.unitsHealed =
      maximumCumulativeValue(
        activePlayer.unitsHealed,
        weekPlayer.unitsHealed
      );

    activePlayer.unitsDead =
      maximumCumulativeValue(
        activePlayer.unitsDead,
        weekPlayer.unitsDead
      );

    activePlayer.maxUnitsHealed =
      maximumCumulativeValue(
        activePlayer.maxUnitsHealed,
        weekPlayer.maxUnitsHealed
      );

    applyCumulativeResources(
      activePlayer,
      weekPlayer
    );

    activePlayer.manaUsed =
      maximumCumulativeValue(
        activePlayer.manaUsed,
        weekPlayer.manaUsed
      );

    activePlayer.honourKills =
      maximumCumulativeValue(
        activePlayer.honourKills,
        weekPlayer.honourKills
      );

    activePlayer.serverRank =
      weekPlayer.serverRank;

    activePlayer.castleLevel =
      weekPlayer.castleLevel;

    activePlayer.meritPowerRatio =
      weekPlayer.meritPowerRatio;

    activePlayer.source =
      "season-week";

    activePlayer.sourceDate =
      officialDate;

    activePlayer.currentSeason =
      seasonNumber;

    activePlayer.active =
      true;

    activePlayer.notes =
      isPlainObject(
        activePlayer.notes
      )
        ? activePlayer.notes
        : {};

    if (weekNumber === 0) {
      activePlayer.matchmakingNewPlayer =
        false;

      activePlayer.seasonNewPlayer =
        false;

      activePlayer.isNew =
        false;

      activePlayer.notes.new =
        false;
    }

    return activePlayer;
  }

  function rebuildActiveRanks(
    players
  ) {
    return players
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

          return first.id.localeCompare(
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
          ...player,

          rank:
            index + 1
        })
      );
  }

  /* =====================================================
     SEASON INFO HELPERS
  ===================================================== */

  function createEmptySeasonWeek(
    weekNumber
  ) {
    return {
      week:
        weekNumber,

      available:
        false,

      merits:
        null,

      meritPowerPercentage:
        null,

      meritTargets:
        null,

      meritRank:
        null,

      currentPower:
        null,

      historicalPower:
        null,

      rank:
        null,

      serverRank:
        null,

      officialDate:
        null,

      resources: {
        total:
          0,

        gold:
          0,

        wood:
          0,

        ore:
          0,

        mana:
          0,

        gems:
          0
      },

      resourcesGathered:
        0,

      goldGathered:
        0,

      woodGathered:
        0,

      oreGathered:
        0,

      manaGathered:
        0,

      gemsGathered:
        0
    };
  }

  function createSeasonWeekData(
    weekPlayer,
    weekNumber,
    officialDate = null,
    meritConfiguration = null
  ) {
    if (!weekPlayer) {
      return createEmptySeasonWeek(
        weekNumber
      );
    }

    const meritPowerPercentage =
      weekNumber === 0
        ? null
        : weekPlayer
            .meritPowerRatio;

    const meritTargets =
      getMeritTargetsForWeek(
        meritConfiguration,
        weekPlayer.troopTier,
        weekNumber
      );

    const meritRank =
      weekNumber === 0
        ? null
        : calculateMeritRank(
            meritPowerPercentage,
            meritTargets
          );

    return {
      week:
        weekNumber,

      weekLabel:
        `W${weekNumber}`,

      officialDate:
        normalizeText(
          officialDate
        ) ||
        null,

      available:
        true,

      merits:
        weekPlayer.merits,

      meritPowerPercentage,

      meritTargets:
        meritTargets
          ? cloneData(
              meritTargets
            )
          : null,

      meritRank,

      currentPower:
        weekPlayer.currentPower,

      historicalPower:
        weekPlayer.historicalPower,

      rank:
        meritRank,

      serverRank:
        weekPlayer.serverRank > 0
          ? weekPlayer.serverRank
          : null,

      resources: {
        total:
          weekPlayer
            .resourcesGathered,

        gold:
          weekPlayer
            .goldGathered,

        wood:
          weekPlayer
            .woodGathered,

        ore:
          weekPlayer
            .oreGathered,

        mana:
          weekPlayer
            .manaGathered,

        gems:
          weekPlayer
            .gemsGathered
      },

      resourcesGathered:
        weekPlayer
          .resourcesGathered,

      goldGathered:
        weekPlayer
          .goldGathered,

      woodGathered:
        weekPlayer
          .woodGathered,

      oreGathered:
        weekPlayer
          .oreGathered,

      manaGathered:
        weekPlayer
          .manaGathered,

      gemsGathered:
        weekPlayer
          .gemsGathered
    };
  }

  function normalizeSeasonPlayer(
    source,
    sourceIndex
  ) {
    const player =
      cloneData(source);

    player.index =
      integerValue(
        player.index
      ) ||
      sourceIndex + 1;

    player.id =
      normalizeText(
        player.id
      );

    player.name =
      normalizeText(
        player.name
      );

    player.alliance =
      normalizeText(
        player.alliance
      );

    player.historicalPower =
      integerValue(
        player.historicalPower
      );

    player.noteFlags =
      isPlainObject(
        player.noteFlags
      )
        ? player.noteFlags
        : {};

    player.noteFlags.new =
      false;

    player.noteFlags.left =
      player.noteFlags.left ===
        true;

    player.noteFlags.afk =
      player.noteFlags.afk ===
        true;

    player.leftDuringSeason =
      player.leftDuringSeason ===
        true;

    player.dateLeftKingdom =
      normalizeText(
        player.dateLeftKingdom
      ) ||
      null;

    player.notes =
      Array.isArray(
        player.notes
      )
        ? player.notes.filter(
            note =>
              normalizeText(note) !==
              "new"
          )
        : [];

    player.weeks =
      isPlainObject(
        player.weeks
      )
        ? player.weeks
        : {};

    for (
      let weekNumber =
        RULES.firstWeek;
      weekNumber <=
        RULES.lastWeek;
      weekNumber +=
        1
    ) {
      const weekKey =
        `W${weekNumber}`;

      if (
        !isPlainObject(
          player.weeks[weekKey]
        )
      ) {
        player.weeks[weekKey] =
          createEmptySeasonWeek(
            weekNumber
          );
      }
    }

    return player;
  }

  function createW0SeasonPlayer(
    activePlayer,
    weekPlayer,
    sourceIndex,
    officialDate
  ) {
    return {
      index:
        sourceIndex + 1,

      id:
        activePlayer.id,

      name:
        weekPlayer.name ||
        activePlayer.name,

      alliance:
        weekPlayer.alliance ||
        activePlayer.alliance,

      troopTier:
        weekPlayer.troopTier ||
        activePlayer.troopTier,

      playerType:
        calculatePlayerType(
          Math.max(
            activePlayer.historicalPower,
            weekPlayer.historicalPower
          )
        ),

      historicalPower:
        Math.max(
          activePlayer.historicalPower,
          weekPlayer.historicalPower
        ),

      serverStatus:
        activePlayer.serverStatus ||
        "LV2",

      serverStatusColor:
        activePlayer
          .serverStatusColor ||
        "green",

      dateJoinKingdom:
        activePlayer
          .dateJoinKingdom ||
        null,

      resources:
        cloneData(
          activePlayer.resources
        ),

      resourcesGathered:
        activePlayer
          .resourcesGathered,

      goldGathered:
        activePlayer
          .goldGathered,

      woodGathered:
        activePlayer
          .woodGathered,

      oreGathered:
        activePlayer
          .oreGathered,

      manaGathered:
        activePlayer
          .manaGathered,

      gemsGathered:
        activePlayer
          .gemsGathered,

      notes:
        [],

      noteFlags: {
        new:
          false,

        left:
          false,

        afk:
          activePlayer
            .afkApproved ===
            true ||
          activePlayer
            .notes?.afk ===
            true
      },

      leftDuringSeason:
        false,

      dateLeftKingdom:
        null,

      active:
        true,

      weeks: {
        W0:
          createSeasonWeekData(
            weekPlayer,
            0,
            officialDate,
            null
          ),

        W1:
          createEmptySeasonWeek(
            1
          ),

        W2:
          createEmptySeasonWeek(
            2
          ),

        W3:
          createEmptySeasonWeek(
            3
          ),

        W4:
          createEmptySeasonWeek(
            4
          ),

        W5:
          createEmptySeasonWeek(
            5
          ),

        W6:
          createEmptySeasonWeek(
            6
          )
      }
    };
  }

  function updateSeasonPlayerState(
    seasonPlayer,
    currentWeekPlayer,
    options
  ) {
    const {
      weekNumber,
      officialDate,
      meritConfiguration
    } = options;

    const weekKey =
      `W${weekNumber}`;

    if (currentWeekPlayer) {
      seasonPlayer.weeks[weekKey] =
        createSeasonWeekData(
          currentWeekPlayer,
          weekNumber,
          officialDate,
          meritConfiguration
        );

      seasonPlayer.name =
        currentWeekPlayer.name ||
        seasonPlayer.name;

      seasonPlayer.alliance =
        currentWeekPlayer.alliance ||
        seasonPlayer.alliance;

      seasonPlayer.troopTier =
        currentWeekPlayer.troopTier ||
        seasonPlayer.troopTier;

      seasonPlayer.historicalPower =
        Math.max(
          seasonPlayer
            .historicalPower,
          currentWeekPlayer
            .historicalPower
        );

      seasonPlayer.playerType =
        calculatePlayerType(
          seasonPlayer
            .historicalPower
        );

      applyCumulativeResources(
        seasonPlayer,
        currentWeekPlayer
      );

      seasonPlayer.leftDuringSeason =
        false;

      seasonPlayer.dateLeftKingdom =
        null;

      seasonPlayer.active =
        true;

      seasonPlayer.noteFlags.left =
        false;

      seasonPlayer.notes =
        seasonPlayer.notes.filter(
          note =>
            normalizeText(note) !==
            "left"
        );

      return seasonPlayer;
    }

    seasonPlayer.weeks[weekKey] =
      createEmptySeasonWeek(
        weekNumber
      );

    if (weekNumber > 0) {
      seasonPlayer.leftDuringSeason =
        true;

      seasonPlayer.active =
        false;

      seasonPlayer.noteFlags.left =
        true;

      if (
        !seasonPlayer
          .dateLeftKingdom
      ) {
        seasonPlayer
          .dateLeftKingdom =
          officialDate;
      }

      if (
        !seasonPlayer.notes
          .includes("left")
      ) {
        seasonPlayer.notes.push(
          "left"
        );
      }
    }

    return seasonPlayer;
  }

  function rebuildSeasonRanks(
    players
  ) {
    return players
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

          return first.id.localeCompare(
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
          ...player,

          index:
            index + 1
        })
      );
  }
    /* =====================================================
     MAIN ACTIVE & AVERAGE BUILD
  ===================================================== */

  function buildActiveAverage(
    activeAverageData,
    currentWeekIndex,
    options
  ) {
    const {
      seasonNumber,
      weekNumber,
      officialDate,
      generatedAt
    } = options;

    const existingPlayers =
      extractActivePlayers(
        activeAverageData
      )
        .filter(
          isPlainObject
        )
        .map(
          normalizeActivePlayer
        )
        .filter(
          player =>
            Boolean(player.id)
        );

    const activeIndex =
      new Map();

    existingPlayers.forEach(player => {
      activeIndex.set(
        player.id,
        player
      );
    });

    let addedPlayers =
      0;

    let updatedPlayers =
      0;

    let clearedMatchmakingNew =
      0;

    currentWeekIndex.forEach(
      weekPlayer => {
        const existingPlayer =
          activeIndex.get(
            weekPlayer.id
          );

        if (existingPlayer) {
          const wasMatchmakingNew =
            existingPlayer
              .matchmakingNewPlayer ===
              true ||
            existingPlayer
              .isNew ===
              true ||
            existingPlayer
              .notes?.new ===
              true;

          applyWeekPlayerToActive(
            existingPlayer,
            weekPlayer,
            options
          );

          if (
            weekNumber === 0 &&
            wasMatchmakingNew
          ) {
            clearedMatchmakingNew +=
              1;
          }

          updatedPlayers +=
            1;

          return;
        }

        /*
         * W0 participants should normally already exist after
         * Matchmaking. If not, still add them safely.
         *
         * W1 through W6 newcomers are added to Active & Average
         * with NEW and LV2, but never to Season Info.
         */

        const newPlayer =
          createNewActivePlayer(
            weekPlayer,
            seasonNumber,
            officialDate
          );

        if (weekNumber === 0) {
          newPlayer
            .seasonNewPlayer =
            false;

          newPlayer.isNew =
            false;

          newPlayer.notes.new =
            false;
        }

        activeIndex.set(
          newPlayer.id,
          newPlayer
        );

        addedPlayers +=
          1;
      }
    );

    const players =
      rebuildActiveRanks(
        [
          ...activeIndex.values()
        ]
      );

    const output =
      cloneData(
        activeAverageData
      );

    output.schemaVersion =
      output.schemaVersion ||
      SCHEMA_VERSION;

    output.kingdom =
      RULES.kingdom;

    output.dataset =
      "active-average";

    output.generatedFrom =
      `season-${seasonNumber}-W${weekNumber}`;

    output.generatedAt =
      generatedAt;

    output.activePlayerCount =
      players.length;

    output.currentSeason =
      seasonNumber;

    output.latestSeasonWeek =
      `W${weekNumber}`;

    output.latestSeasonWeekDate =
      officialDate;

    output.players =
      players;

    return {
      data:
        output,

      summary: {
        addedPlayers,

        updatedPlayers,

        clearedMatchmakingNew,

        totalPlayers:
          players.length
      }
    };
  }

  /* =====================================================
     MAIN SEASON INFO BUILD
  ===================================================== */

  function buildSeasonInfo(
    activeAverageOutput,
    seasonInfoData,
    currentWeekIndex,
    options
  ) {
    const {
      seasonNumber,
      weekNumber,
      officialDate,
      generatedAt,
      generatedBy,
      meritConfiguration
    } = options;

    const activePlayers =
      activeAverageOutput.players;

    const activeIndex =
      new Map();

    activePlayers.forEach(player => {
      activeIndex.set(
        player.id,
        player
      );
    });

    let seasonPlayers =
      [];

    if (weekNumber === 0) {
      /*
       * W0 fixes the Season participant list.
       * Only IDs present in Server 630 W0 enter Season Info.
       */

      currentWeekIndex.forEach(
        weekPlayer => {
          const activePlayer =
            activeIndex.get(
              weekPlayer.id
            );

          if (!activePlayer) {
            return;
          }

          seasonPlayers.push(
            createW0SeasonPlayer(
              activePlayer,
              weekPlayer,
              seasonPlayers.length,
              officialDate
            )
          );
        }
      );
    } else {
      /*
       * W1 through W6:
       * - Use only the existing W0 participant list.
       * - Never add newcomers from Active & Average.
       */

      seasonPlayers =
        extractSeasonPlayers(
          seasonInfoData
        )
          .filter(
            isPlainObject
          )
          .map(
            normalizeSeasonPlayer
          )
          .filter(
            player =>
              Boolean(player.id)
          )
          .map(player => {
            return updateSeasonPlayerState(
              player,
              currentWeekIndex.get(
                player.id
              ) ||
              null,
              options
            );
          });
    }

    seasonPlayers =
      rebuildSeasonRanks(
        seasonPlayers
      );

    const warriors =
      seasonPlayers.filter(
        player =>
          player.playerType ===
          "warrior"
      ).length;

    const farmers =
      seasonPlayers.filter(
        player =>
          player.playerType ===
          "farmer"
      ).length;

    const leftPlayers =
      seasonPlayers.filter(
        player =>
          player.leftDuringSeason ===
          true
      ).length;

    const availableWeeks =
      [];

    for (
      let index =
        RULES.firstWeek;
      index <=
        weekNumber;
      index +=
        1
    ) {
      availableWeeks.push(
        `W${index}`
      );
    }

    const output = {
      schemaVersion:
        SCHEMA_VERSION,

      kingdom:
        RULES.kingdom,

      dataset:
        "season-info",

      generatedFrom:
        "weekly-player-state",

      generatedAt,

      generatedBy:
        generatedBy ||
        null,

      season: {
        number:
          seasonNumber,

        availableWeeks,

        latestWeek:
          `W${weekNumber}`,

        latestWeekDate:
          officialDate
      },

      meritConfiguration:
        cloneData(
          meritConfiguration
        ),

      summary: {
        officialParticipants:
          seasonPlayers.length,

        warriors,

        farmers,

        leftPlayers
      },

      columns: {
        fixed: [
          "index",
          "id",
          "name",
          "alliance",
          "troopTier",
          "notes",
          "historicalPower"
        ],

        week0: [
          "merits",
          "currentPower"
        ],

        week1To6: [
          "merits",
          "meritPowerPercentage",
          "currentPower",
          "rank"
        ]
      },

      players:
        seasonPlayers
    };

    return {
      data:
        output,

      summary:
        output.summary
    };
  }
    /* =====================================================
     VALIDATION
  ===================================================== */

  function validate(
    activeAverageData,
    seasonInfoData,
    currentWeekData,
    options = {}
  ) {
    const seasonNumber =
      integerValue(
        options.seasonNumber
      );

    const weekNumber =
      normalizeWeekNumber(
        options.weekNumber ??
        options.week
      );

    const officialDate =
      normalizeText(
        options.officialDate
      );

    if (seasonNumber <= 0) {
      throw createError(
        "A valid Season number is required."
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        officialDate
      )
    ) {
      throw createError(
        "A valid official week date is required."
      );
    }

    const activePlayers =
      extractActivePlayers(
        activeAverageData
      );

    const weekRecords =
      extractWeekRecords(
        currentWeekData
      );

    if (
      activePlayers.length ===
      0
    ) {
      throw createError(
        "Active & Average contains no players."
      );
    }

    if (
      weekRecords.length ===
      0
    ) {
      throw createError(
        "The current weekly file contains no players."
      );
    }

    if (
      weekNumber > 0 &&
      extractSeasonPlayers(
        seasonInfoData
      ).length ===
        0
    ) {
      throw createError(
        (
          `Season Info must already contain the ` +
          `fixed W0 participant list before W${weekNumber}.`
        )
      );
    }

    return {
      valid:
        true,

      seasonNumber,

      weekNumber,

      officialDate,

      activePlayerCount:
        activePlayers.length,

      currentWeekRecordCount:
        weekRecords.length
    };
  }

  /* =====================================================
     MAIN BUILD
  ===================================================== */

  function build(
    activeAverageData,
    seasonInfoData,
    currentWeekData,
    options = {}
  ) {
    const validation =
      validate(
        activeAverageData,
        seasonInfoData,
        currentWeekData,
        options
      );

    const generatedAt =
      normalizeText(
        options.generatedAt
      ) ||
      nowIso();

    const generatedBy =
      normalizeText(
        options.generatedBy
      );

    const meritConfiguration =
      normalizeMeritConfiguration(
        options.meritConfiguration ||
        options.adminConfig
          ?.meritConfiguration ||
        seasonInfoData
          ?.meritConfiguration
      );

    const buildOptions = {
      seasonNumber:
        validation.seasonNumber,

      weekNumber:
        validation.weekNumber,

      officialDate:
        validation.officialDate,

      generatedAt,

      generatedBy,

      meritConfiguration
    };

    const currentWeekIndex =
      buildCurrentWeekIndex(
        currentWeekData
      );

    const activeAverageResult =
      buildActiveAverage(
        activeAverageData,
        currentWeekIndex,
        buildOptions
      );

    const seasonInfoResult =
      buildSeasonInfo(
        activeAverageResult.data,
        seasonInfoData,
        currentWeekIndex,
        buildOptions
      );

    return {
      success:
        true,

      engine: {
        name:
          MODULE_NAME,

        version:
          MODULE_VERSION
      },

      seasonNumber:
        validation.seasonNumber,

      weekNumber:
        validation.weekNumber,

      week:
        `W${validation.weekNumber}`,

      officialDate:
        validation.officialDate,

      generatedAt,

      meritConfiguration:
        cloneData(
          meritConfiguration
        ),

      summary: {
        activeAverage:
          activeAverageResult.summary,

        seasonInfo:
          seasonInfoResult.summary
      },

      data: {
        activeAverage:
          activeAverageResult.data,

        seasonInfo:
          seasonInfoResult.data
      },

      files: {
        [ACTIVE_AVERAGE_OUTPUT_PATH]:
          activeAverageResult.data,

        [SEASON_INFO_OUTPUT_PATH]:
          seasonInfoResult.data
      }
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

      paths:
        Object.freeze({
          activeAverage:
            ACTIVE_AVERAGE_OUTPUT_PATH,

          seasonInfo:
            SEASON_INFO_OUTPUT_PATH
        }),

      validate,

      build,

      getRules() {
        return {
          ...RULES
        };
      }
    });

  global.K630WeeklyPlayerStateEngine =
    publicApi;

  console.info(
    `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
  );
})(window);