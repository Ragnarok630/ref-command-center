/* =========================================================
   K630-REF OLD PLAYERS ENGINE
   File: assets/js/engines/old-players-engine.js
   Version: 630.1.0

   Responsibilities:
   - Build and maintain the generated Old Players dataset
   - Preserve existing historical player data
   - Add players who left Kingdom 630
   - Remove returning players from Old Players
   - Prevent duplicate player IDs
   - Preserve archived Season results
   - Return the GitHub file that must be written
   - Never use localStorage or IndexedDB

   Public API:
   - window.K630OldPlayersEngine.build(options)
   - window.K630OldPlayersEngine.validateDataset(dataset)
   - window.K630OldPlayersEngine.getPaths()
   - window.K630OldPlayersEngine.getRules()

   Important:
   - This engine does not write to GitHub.
   - The calling workflow writes result.files through
     assets/js/services/github-writer.js.
========================================================= */

(function initializeK630OldPlayersEngine(global) {
  "use strict";

  /* =====================================================
     MODULE INFORMATION
  ===================================================== */

  const MODULE_NAME =
    "K630 Old Players Engine";

  const MODULE_VERSION =
    "630.1.0";

  const SCHEMA_VERSION =
    1;

  /* =====================================================
     PATHS
  ===================================================== */

  const PATHS =
    Object.freeze({
      current:
        "assets/data/generated/old-players/current.json"
    });

  /* =====================================================
     BUSINESS RULES
  ===================================================== */

  const RULES =
    Object.freeze({
      homeKingdom:
        630,

      minimumHistoricalPower:
        250_000,

      defaultLeaveReason:
        "missing-from-matchmaking"
    });

  /* =====================================================
     BASIC HELPERS
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
        return structuredClone(value);
      } catch (_error) {
        // Continue with JSON cloning.
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

  function nowIso() {
    return new Date()
      .toISOString();
  }

  function createError(
    message,
    details = null
  ) {
    const error =
      new Error(message);

    error.name =
      "K630OldPlayersEngineError";

    error.details =
      details;

    return error;
  }

  function normalizeDate(
    value,
    fallback = null
  ) {
    const text =
      normalizeText(value);

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        text
      )
    ) {
      return text;
    }

    return fallback;
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
    const text =
      normalizeText(value);

    return text || "LV2";
  }

  function normalizeStatusColor(value) {
    const text =
      normalizeLower(value);

    return text || "green";
  }

  /* =====================================================
     SOURCE EXTRACTION
  ===================================================== */

  function extractPlayers(dataset) {
    if (!dataset) {
      return [];
    }

    if (Array.isArray(dataset)) {
      return dataset;
    }

    if (
      Array.isArray(
        dataset.players
      )
    ) {
      return dataset.players;
    }

    if (
      isPlainObject(
        dataset.players
      )
    ) {
      return Object.values(
        dataset.players
      );
    }

    return [];
  }

  function getPlayerId(player) {
    return normalizeText(
      player?.id ??
      player?.playerId ??
      player?.lordId ??
      player?.["Lord ID"] ??
      player?.["Player ID"]
    );
  }

  /* =====================================================
     SEASON DATA
  ===================================================== */

  function normalizeSeasonEntry(
    seasonNumber,
    seasonData
  ) {
    const number =
      integerValue(
        seasonData?.season ??
        seasonNumber
      );

    if (number <= 0) {
      return null;
    }

    const currentPower =
      seasonData?.currentPower ===
        null
        ? null
        : integerValue(
            seasonData?.currentPower ??
            seasonData?.power ??
            seasonData?.finalPower
          );

    const merits =
      seasonData?.merits ===
        null
        ? null
        : integerValue(
            seasonData?.merits ??
            seasonData?.finalMerits
          );

    const meritPowerPercentage =
      seasonData
        ?.meritPowerPercentage ===
        null
        ? null
        : numberValue(
            seasonData
              ?.meritPowerPercentage ??
            seasonData
              ?.meritPowerRatio ??
            seasonData
              ?.meritPercent
          );

    return {
      season:
        number,

      currentPower,

      merits,

      meritPowerPercentage
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

        if (!normalized) {
          return;
        }

        seasons[
          String(
            normalized.season
          )
        ] =
          normalized;
      });

      return seasons;
    }

    if (isPlainObject(value)) {
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

            if (!normalized) {
              return;
            }

            seasons[
              String(
                normalized.season
              )
            ] =
              normalized;
          }
        );
    }

    return seasons;
  }

  function mergeSeasons(
    existingSeasons,
    incomingSeasons
  ) {
    const merged = {
      ...normalizeSeasons(
        existingSeasons
      )
    };

    const normalizedIncoming =
      normalizeSeasons(
        incomingSeasons
      );

    Object.entries(
      normalizedIncoming
    ).forEach(
      (
        [
          seasonNumber,
          incoming
        ]
      ) => {
        const existing =
          merged[seasonNumber] ||
          {};

        merged[seasonNumber] = {
          season:
            incoming.season,

          currentPower:
            incoming.currentPower ??
            existing.currentPower ??
            null,

          merits:
            incoming.merits ??
            existing.merits ??
            null,

          meritPowerPercentage:
            incoming
              .meritPowerPercentage ??
            existing
              .meritPowerPercentage ??
            null
        };
      }
    );

    return merged;
  }

  function countPlayedSeasons(seasons) {
    return Object.values(
      normalizeSeasons(seasons)
    ).filter(season => {
      return (
        numberValue(
          season.currentPower
        ) > 0 ||
        numberValue(
          season.merits
        ) > 0 ||
        numberValue(
          season
            .meritPowerPercentage
        ) > 0
      );
    }).length;
  }

  /* =====================================================
     PLAYER NORMALIZATION
  ===================================================== */

  function normalizeOldPlayer(
    player,
    options = {}
  ) {
    if (!isPlainObject(player)) {
      throw createError(
        "An Old Players record must be an object."
      );
    }

    const id =
      getPlayerId(player);

    if (!id) {
      throw createError(
        "An Old Players record contains no valid player ID.",
        {
          player
        }
      );
    }

    const startPower =
      integerValue(
        player.startPower
      );

    const historicalPower =
      integerValue(
        player.historicalPower ??
        player.topPower ??
        player.currentPower
      );

    const powerGrowth =
      player.powerGrowth ===
        null ||
      player.powerGrowth ===
        undefined ||
      player.powerGrowth ===
        ""
        ? (
            historicalPower -
            startPower
          )
        : integerValue(
            player.powerGrowth
          );

    const seasons =
      normalizeSeasons(
        player.seasons
      );

    const fallbackLeaveDate =
      normalizeDate(
        options.leaveDate,
        null
      );

    const dateLeaveKingdom =
      normalizeDate(
        player.dateLeaveKingdom,
        fallbackLeaveDate
      );

    if (!dateLeaveKingdom) {
      throw createError(
        (
          `Old Player ${id} contains no valid ` +
          "dateLeaveKingdom."
        )
      );
    }

    return {
      id,

      name:
        normalizeText(
          player.name
        ) || "-",

      alliance:
        normalizeText(
          player.alliance
        ) || "-",

      dateJoinKingdom:
        normalizeDate(
          player.dateJoinKingdom,
          null
        ),

      dateLeaveKingdom,

      leaveReason:
        normalizeText(
          player.leaveReason ??
          options.leaveReason
        ) ||
        RULES.defaultLeaveReason,

      serverStatus:
        normalizeStatus(
          player.serverStatus
        ),

      serverStatusColor:
        normalizeStatusColor(
          player.serverStatusColor
        ),

      troopTier:
        normalizeTier(
          player.troopTier
        ),

      startPower,

      currentPower:
        integerValue(
          player.currentPower
        ),

      historicalPower,

      powerGrowth,

      merits:
        integerValue(
          player.merits
        ),

      topMerits:
        integerValue(
          player.topMerits
        ),

      techPower:
        integerValue(
          player.techPower
        ),

      unitsKilled:
        integerValue(
          player.unitsKilled
        ),

      unitsHealed:
        integerValue(
          player.unitsHealed
        ),

      serverRank:
        integerValue(
          player.serverRank
        ),

      castleLevel:
        integerValue(
          player.castleLevel
        ),

      faction:
        normalizeText(
          player.faction
        ),

      playerType:
        normalizeText(
          player.playerType
        ) || (
          historicalPower >=
          20_000_000
            ? "warrior"
            : "farmer"
        ),

      averageMeritsValue:
        player.averageMeritsValue ===
          null ||
        player.averageMeritsValue ===
          undefined
          ? null
          : integerValue(
              player.averageMeritsValue
            ),

      averageMeritsPercentage:
        player
          .averageMeritsPercentage ===
          null ||
        player
          .averageMeritsPercentage ===
          undefined
          ? null
          : numberValue(
              player
                .averageMeritsPercentage
            ),

      seasonsPlayed:
        integerValue(
          player.seasonsPlayed
        ) ||
        countPlayedSeasons(
          seasons
        ),

      seasons,

      active:
        false,

      archived:
        player.archived ===
        true,

      source:
        normalizeText(
          player.source
        ) || "matchmaking",

      sourceDate:
        normalizeDate(
          player.sourceDate,
          dateLeaveKingdom
        ),

      updatedAt:
        normalizeText(
          player.updatedAt
        ) ||
        normalizeText(
          options.generatedAt
        ) ||
        nowIso()
    };
  }

  function mergePlayer(
    existingPlayer,
    incomingPlayer,
    options
  ) {
    const existing =
      existingPlayer
        ? normalizeOldPlayer(
            existingPlayer,
            {
              leaveDate:
                incomingPlayer
                  ?.dateLeaveKingdom ??
                options.leaveDate,

              leaveReason:
                incomingPlayer
                  ?.leaveReason ??
                options.leaveReason,

              generatedAt:
                options.generatedAt
            }
          )
        : null;

    const incoming =
      normalizeOldPlayer(
        incomingPlayer,
        {
          leaveDate:
            options.leaveDate,

          leaveReason:
            options.leaveReason,

          generatedAt:
            options.generatedAt
        }
      );

    if (!existing) {
      return incoming;
    }

    const mergedSeasons =
      mergeSeasons(
        existing.seasons,
        incoming.seasons
      );

    return {
      ...existing,
      ...incoming,

      name:
        incoming.name !==
          "-"
          ? incoming.name
          : existing.name,

      alliance:
        incoming.alliance !==
          "-"
          ? incoming.alliance
          : existing.alliance,

      dateJoinKingdom:
        incoming.dateJoinKingdom ??
        existing.dateJoinKingdom,

      dateLeaveKingdom:
        incoming.dateLeaveKingdom ??
        existing.dateLeaveKingdom,

      leaveReason:
        incoming.leaveReason ||
        existing.leaveReason,

      startPower:
        incoming.startPower ||
        existing.startPower,

      currentPower:
        incoming.currentPower ||
        existing.currentPower,

      historicalPower:
        Math.max(
          incoming.historicalPower,
          existing.historicalPower
        ),

      powerGrowth:
        incoming.powerGrowth,

      merits:
        Math.max(
          incoming.merits,
          existing.merits
        ),

      topMerits:
        Math.max(
          incoming.topMerits,
          existing.topMerits
        ),

      techPower:
        Math.max(
          incoming.techPower,
          existing.techPower
        ),

      unitsKilled:
        Math.max(
          incoming.unitsKilled,
          existing.unitsKilled
        ),

      unitsHealed:
        Math.max(
          incoming.unitsHealed,
          existing.unitsHealed
        ),

      averageMeritsValue:
        incoming.averageMeritsValue ??
        existing.averageMeritsValue,

      averageMeritsPercentage:
        incoming
          .averageMeritsPercentage ??
        existing
          .averageMeritsPercentage,

      seasons:
        mergedSeasons,

      seasonsPlayed:
        countPlayedSeasons(
          mergedSeasons
        ),

      active:
        false,

      updatedAt:
        options.generatedAt
    };
  }

  /* =====================================================
     DATASET VALIDATION
  ===================================================== */

  function validateDataset(dataset) {
    if (
      dataset === null ||
      dataset === undefined
    ) {
      return {
        valid:
          true,

        playerCount:
          0,

        duplicateIds: []
      };
    }

    const players =
      extractPlayers(dataset);

    const seenIds =
      new Set();

    const duplicateIds =
      [];

    players.forEach(
      (
        player,
        index
      ) => {
        const id =
          getPlayerId(player);

        if (!id) {
          throw createError(
            (
              "The Old Players dataset contains " +
              `an invalid record at index ${index}.`
            )
          );
        }

        if (seenIds.has(id)) {
          duplicateIds.push(id);
        }

        seenIds.add(id);
      }
    );

    if (
      duplicateIds.length >
      0
    ) {
      throw createError(
        (
          "The Old Players dataset contains duplicate IDs: " +
          [
            ...new Set(
              duplicateIds
            )
          ]
            .slice(0, 20)
            .join(", ")
        ),
        {
          duplicateIds
        }
      );
    }

    return {
      valid:
        true,

      playerCount:
        players.length,

      duplicateIds: []
    };
  }

  /* =====================================================
     SEASON COLUMNS
  ===================================================== */

  function buildSeasonColumns(players) {
    const seasonNumbers =
      new Set();

    players.forEach(player => {
      Object.keys(
        normalizeSeasons(
          player.seasons
        )
      ).forEach(
        seasonNumber => {
          const number =
            integerValue(
              seasonNumber
            );

          if (number > 0) {
            seasonNumbers.add(
              number
            );
          }
        }
      );
    });

    return [
      ...seasonNumbers
    ]
      .sort(
        (
          first,
          second
        ) =>
          first -
          second
      )
      .map(seasonNumber => ({
        season:
          seasonNumber,

        columns: [
          "merits",
          "currentPower",
          "meritPowerPercentage"
        ]
      }));
  }

  /* =====================================================
     DATASET BUILDING
  ===================================================== */

  function buildDataset(
    players,
    generatedAt,
    options
  ) {
    const sortedPlayers =
      [...players]
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
        "old-players",

      generatedFrom:
        normalizeText(
          options.generatedFrom
        ) || "matchmaking",

      generatedAt,

      updatedAt:
        generatedAt,

      playerCount:
        sortedPlayers.length,

      activePlayerCount:
        0,

      seasonColumns:
        buildSeasonColumns(
          sortedPlayers
        ),

      columns: {
        fixed: [
          "rank",
          "id",
          "name",
          "alliance",
          "serverStatus",
          "troopTier",
          "startPower",
          "historicalPower",
          "powerGrowth",
          "topMerits",
          "averageMeritsValue",
          "averageMeritsPercentage",
          "dateLeaveKingdom"
        ],

        season: [
          "merits",
          "currentPower",
          "meritPowerPercentage"
        ]
      },

      players:
        sortedPlayers
    };
  }

  /* =====================================================
     MAIN BUILD
  ===================================================== */

  function build(options = {}) {
    const generatedAt =
      normalizeText(
        options.generatedAt
      ) ||
      nowIso();

    const leaveDate =
      normalizeDate(
        options.leaveDate,
        generatedAt.slice(
          0,
          10
        )
      );

    const existingDataset =
      options.existingDataset ??
      null;

    const departedPlayers =
      extractPlayers(
        options.departedPlayers
      );

    const activePlayers =
      extractPlayers(
        options.activePlayers
      );

    validateDataset(
      existingDataset
    );

    const activeIds =
      new Set(
        activePlayers
          .map(getPlayerId)
          .filter(Boolean)
      );

    const playerMap =
      new Map();

    extractPlayers(
      existingDataset
    ).forEach(player => {
      const id =
        getPlayerId(player);

      if (
        !id ||
        activeIds.has(id)
      ) {
        return;
      }

      const normalized =
        normalizeOldPlayer(
          player,
          {
            leaveDate,
            generatedAt
          }
        );

      playerMap.set(
        id,
        normalized
      );
    });

    let addedCount =
      0;

    let updatedCount =
      0;

    departedPlayers.forEach(player => {
      const id =
        getPlayerId(player);

      if (!id) {
        throw createError(
          "A departed player contains no valid player ID."
        );
      }

      if (
        activeIds.has(id)
      ) {
        return;
      }

      const existing =
        playerMap.get(id);

      const merged =
        mergePlayer(
          existing,
          {
            ...cloneData(player),

            dateLeaveKingdom:
              normalizeDate(
                player.dateLeaveKingdom,
                leaveDate
              ),

            leaveReason:
              normalizeText(
                player.leaveReason
              ) ||
              normalizeText(
                options.leaveReason
              ) ||
              RULES.defaultLeaveReason
          },
          {
            leaveDate,
            leaveReason:
              options.leaveReason,
            generatedAt
          }
        );

      playerMap.set(
        id,
        merged
      );

      if (existing) {
        updatedCount +=
          1;
      } else {
        addedCount +=
          1;
      }
    });

    const players =
      [
        ...playerMap.values()
      ];

    const dataset =
      buildDataset(
        players,
        generatedAt,
        options
      );

    const files = {
      [PATHS.current]:
        dataset
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

      generatedAt,

      leaveDate,

      summary: {
        existingPlayers:
          extractPlayers(
            existingDataset
          ).length,

        departedPlayers:
          departedPlayers.length,

        activePlayers:
          activePlayers.length,

        addedPlayers:
          addedCount,

        updatedPlayers:
          updatedCount,

        returningPlayersRemoved:
          extractPlayers(
            existingDataset
          ).filter(player => {
            return activeIds.has(
              getPlayerId(player)
            );
          }).length,

        oldPlayers:
          players.length
      },

      data: {
        oldPlayers:
          dataset
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

      validateDataset,

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

  global.K630OldPlayersEngine =
    publicApi;
})(window);