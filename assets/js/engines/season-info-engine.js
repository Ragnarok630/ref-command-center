/* =========================================================
   K630-REF SEASON INFO ENGINE
   File: assets/js/engines/season-info-engine.js
   Version: 630.1.0

   Responsibilities:
   - Build Season Info current.json
   - Use Active & Average as the player base
   - Merge W0 through W6 player files
   - Only include Kingdom 630 participants
   - Preserve fixed player information
   - Generate weekly Merits, Merits %, Power and Rank
   - Support NEW, LEFT and AFK notes
   - Never use localStorage or IndexedDB

   Public API:
   - window.K630SeasonInfoEngine.build(
       activeAverageData,
       weeklyFiles,
       options
     )

   Output:
   - assets/data/generated/season-info/current.json
========================================================= */

(function initializeK630SeasonInfoEngine(global) {
  "use strict";

  /* =====================================================
     MODULE INFORMATION
  ===================================================== */

  const MODULE_NAME =
    "K630 Season Info Engine";

  const MODULE_VERSION =
    "630.1.0";

  const SCHEMA_VERSION =
    1;

  const OUTPUT_PATH =
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

      serverRank: [
        "Server Rank",
        "ServerRank",
        "serverRank",
        "Rank",
        "rank"
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
      "K630SeasonInfoEngineError";

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

  function normalizeWeekNumber(value) {
    if (
      typeof value ===
      "number"
    ) {
      return (
        value >= RULES.firstWeek &&
        value <= RULES.lastWeek
      )
        ? Math.trunc(value)
        : null;
    }

    const normalized =
      normalizeText(value)
        .toUpperCase()
        .replace(/^W/, "");

    const parsed =
      Number(normalized);

    if (
      !Number.isInteger(parsed) ||
      parsed < RULES.firstWeek ||
      parsed > RULES.lastWeek
    ) {
      return null;
    }

    return parsed;
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
      historicalPower >
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
    const supplied =
      numberValue(
        suppliedRatio
      );

    if (supplied > 0) {
      return supplied;
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
      "Active & Average must contain a players array."
    );
  }

  function extractWeekRecords(
    source
  ) {
    if (Array.isArray(source)) {
      return source;
    }

    if (
      Array.isArray(
        source?.players
      )
    ) {
      return source.players;
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
        source?.players
      )
    ) {
      return Object.values(
        source.players
      );
    }

    return [];
  }

  function normalizeWeeklyFiles(
    weeklyFiles
  ) {
    const normalized =
      new Map();

    if (Array.isArray(weeklyFiles)) {
      weeklyFiles.forEach(entry => {
        if (!entry) {
          return;
        }

        const week =
          normalizeWeekNumber(
            entry.week ??
            entry.weekNumber ??
            entry.type
          );

        if (week === null) {
          return;
        }

        const sources =
          Array.isArray(entry.files)
            ? entry.files
            : (
                entry.data !== undefined
                  ? [entry.data]
                  : [entry]
              );

        if (!normalized.has(week)) {
          normalized.set(
            week,
            []
          );
        }

        normalized.get(week)
          .push(
            ...sources
          );
      });

      return normalized;
    }

    if (isPlainObject(weeklyFiles)) {
      Object.entries(weeklyFiles)
        .forEach(
          (
            [
              key,
              value
            ]
          ) => {
            const week =
              normalizeWeekNumber(key);

            if (week === null) {
              return;
            }

            const sources =
              Array.isArray(value)
                ? value
                : [value];

            normalized.set(
              week,
              sources
            );
          }
        );
    }

    return normalized;
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

  function createBasePlayer(
    player
  ) {
    const id =
      normalizeText(
        player.id
      );

    const historicalPower =
      integerValue(
        player.historicalPower
      );

    const techPower =
      integerValue(
        player.techPower
      );

    const notes =
      [];

    if (
      player.matchmakingNewPlayer ===
      true ||
      player.isNew ===
      true ||
      player.notes?.new ===
      true
    ) {
      notes.push("new");
    }

    if (
      player.leftDuringSeason ===
      true ||
      player.notes?.left ===
      true
    ) {
      notes.push("left");
    }

    if (
      player.afkApproved ===
      true ||
      player.notes?.afk ===
      true
    ) {
      notes.push("afk");
    }

    return {
      id,

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
        calculateTroopTier(
          techPower
        ),

      playerType:
        normalizeText(
          player.playerType
        ) ||
        calculatePlayerType(
          historicalPower
        ),

      historicalPower,

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

      notes,

      noteFlags: {
        new:
          notes.includes("new"),

        left:
          notes.includes("left"),

        afk:
          notes.includes("afk")
      },

      active:
        player.active !== false,

      weeks: {}
    };
  }

  function normalizeWeekPlayer(
    record,
    week
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
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.historicalPower
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

    const rank =
      integerValue(
        getRecordValue(
          record,
          FIELD_NAMES.serverRank
        )
      );

    const meritPowerPercentage =
      calculateMeritPowerPercentage(
        merits,
        currentPower,
        getRecordValue(
          record,
          FIELD_NAMES.meritPowerRatio
        )
      );

    return {
      id,

      week,

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

      rank,

      meritPowerPercentage
    };
  }

  /* =====================================================
     WEEK MERGE
  ===================================================== */

  function buildWeekIndex(
    sources,
    week
  ) {
    const index =
      new Map();

    sources.forEach(source => {
      extractWeekRecords(source)
        .filter(isPlainObject)
        .forEach(record => {
          const player =
            normalizeWeekPlayer(
              record,
              week
            );

          if (
            !player.id ||
            player.historicalPower <
              RULES.minimumHistoricalPower
          ) {
            return;
          }

          index.set(
            player.id,
            player
          );
        });
    });

    return index;
  }

  function createEmptyWeek(
    week
  ) {
    return {
      week,

      available:
        false,

      merits:
        null,

      meritPowerPercentage:
        null,

      currentPower:
        null,

      rank:
        null
    };
  }

  function createWeekData(
    weekPlayer,
    week
  ) {
    if (!weekPlayer) {
      return createEmptyWeek(
        week
      );
    }

    return {
      week,

      available:
        true,

      merits:
        weekPlayer.merits,

      meritPowerPercentage:
        week === 0
          ? null
          : weekPlayer
              .meritPowerPercentage,

      currentPower:
        weekPlayer.currentPower,

      rank:
        week === 0
          ? null
          : (
              weekPlayer.rank >
                0
                ? weekPlayer.rank
                : null
            )
    };
  }

  /* =====================================================
     VALIDATION
  ===================================================== */

  function validate(
    activeAverageData,
    weeklyFiles
  ) {
    const activePlayers =
      extractActivePlayers(
        activeAverageData
      );

    if (
      activePlayers.length ===
      0
    ) {
      throw createError(
        "Active & Average contains no players."
      );
    }

    const weeks =
      normalizeWeeklyFiles(
        weeklyFiles
      );

    if (weeks.size === 0) {
      throw createError(
        "No weekly Season files were supplied."
      );
    }

    const activeIds =
      new Set();

    activePlayers.forEach(player => {
      const id =
        normalizeText(
          player.id
        );

      if (id) {
        activeIds.add(id);
      }
    });

    return {
      valid:
        true,

      activePlayerCount:
        activePlayers.length,

      uniqueActivePlayerCount:
        activeIds.size,

      suppliedWeeks:
        [
          ...weeks.keys()
        ].sort(
          (
            first,
            second
          ) =>
            first -
            second
        )
    };
  }

  /* =====================================================
     MAIN BUILD
  ===================================================== */

  function build(
    activeAverageData,
    weeklyFiles,
    options = {}
  ) {
    const validation =
      validate(
        activeAverageData,
        weeklyFiles
      );

    const activePlayers =
      extractActivePlayers(
        activeAverageData
      );

    const normalizedWeeklyFiles =
      normalizeWeeklyFiles(
        weeklyFiles
      );

    const seasonNumber =
      Math.max(
        1,
        integerValue(
          options.seasonNumber ||
          activeAverageData
            ?.currentSeason ||
          1
        )
      );

    const generatedAt =
      normalizeText(
        options.generatedAt
      ) ||
      nowIso();

    const officialDate =
      normalizeText(
        options.officialDate
      );

    const weekIndexes =
      new Map();

    for (
      let week =
        RULES.firstWeek;
      week <=
        RULES.lastWeek;
      week +=
        1
    ) {
      const sources =
        normalizedWeeklyFiles.get(
          week
        ) ||
        [];

      weekIndexes.set(
        week,
        buildWeekIndex(
          sources,
          week
        )
      );
    }

    const availableWeeks =
      [
        ...normalizedWeeklyFiles.keys()
      ]
        .filter(week => {
          return (
            weekIndexes.get(week)
              ?.size >
            0
          );
        })
        .sort(
          (
            first,
            second
          ) =>
            first -
            second
        );

    const latestWeek =
      availableWeeks.length >
        0
        ? availableWeeks[
            availableWeeks.length - 1
          ]
        : null;

    const players =
      activePlayers
        .filter(isPlainObject)
        .map(
          createBasePlayer
        )
        .filter(player => {
          return (
            player.id &&
            player.historicalPower >=
              RULES.minimumHistoricalPower
          );
        })
        .map(player => {
          for (
            let week =
              RULES.firstWeek;
            week <=
              RULES.lastWeek;
            week +=
              1
          ) {
            const weekPlayer =
              weekIndexes
                .get(week)
                ?.get(
                  player.id
                ) ||
              null;

            player.weeks[
              `W${week}`
            ] =
              createWeekData(
                weekPlayer,
                week
              );

            if (weekPlayer) {
              if (
                weekPlayer.name
              ) {
                player.name =
                  weekPlayer.name;
              }

              if (
                weekPlayer.alliance
              ) {
                player.alliance =
                  weekPlayer.alliance;
              }

              if (
                weekPlayer
                  .historicalPower >
                player.historicalPower
              ) {
                player.historicalPower =
                  weekPlayer
                    .historicalPower;
              }

              if (
                weekPlayer.techPower >
                0
              ) {
                player.troopTier =
                  weekPlayer
                    .troopTier;
              }
            }
          }

          return player;
        })
        .filter(player => {
          return Boolean(
            player.weeks.W0
              ?.available
          );
        })
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
            index:
              index + 1,

            ...player
          })
        );

    const warriors =
      players.filter(
        player =>
          player.playerType ===
          "warrior"
      ).length;

    const farmers =
      players.filter(
        player =>
          player.playerType ===
          "farmer"
      ).length;

    const output = {
      schemaVersion:
        SCHEMA_VERSION,

      kingdom:
        RULES.kingdom,

      dataset:
        "season-info",

      generatedFrom:
        "active-average-and-week-files",

      generatedAt,

      generatedBy:
        normalizeText(
          options.generatedBy
        ) ||
        null,

      season: {
        number:
          seasonNumber,

        officialDate:
          officialDate ||
          null,

        availableWeeks:
          availableWeeks.map(
            week =>
              `W${week}`
          ),

        latestWeek:
          latestWeek === null
            ? null
            : `W${latestWeek}`
      },

      summary: {
        activeAveragePlayers:
          validation.activePlayerCount,

        officialParticipants:
          players.length,

        warriors,

        farmers
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

      players
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

      generatedAt,

      summary:
        output.summary,

      data:
        output,

      files: {
        [OUTPUT_PATH]:
          output
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

      outputPath:
        OUTPUT_PATH,

      validate,

      build,

      getRules() {
        return {
          ...RULES
        };
      }
    });

  global.K630SeasonInfoEngine =
    publicApi;

  console.info(
    `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
  );
})(window);