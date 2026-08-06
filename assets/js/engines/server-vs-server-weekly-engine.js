/* =========================================================
   K630-REF SERVER VS SERVER WEEKLY ENGINE

   File:
   assets/js/engines/server-vs-server-weekly-engine.js

   Version:
   630.1.0 Gold Master

   Responsibilities:
   - Rebuild Server vs Server after every W0 through W6
   - Process every participating server
   - Preserve previous weekly totals
   - Keep W0 through W6 labels permanently visible
   - Keep future week values null
   - Calculate Power, Merits, Kills and Healing
   - Generate current server rankings
   - Generate graph datasets for every server
   - Store only generated repository data
   - Never use localStorage

   Public API:
   window.K630ServerVsServerWeeklyEngine.build(
     participatingServerWeekData,
     previousServerVsServerData,
     options
   )

   Output:
   assets/data/generated/server-vs-server/current.json
========================================================= */

(function initializeK630ServerVsServerWeeklyEngine(global) {
  "use strict";

  const MODULE_NAME =
    "K630 Server vs Server Weekly Engine";

  const MODULE_VERSION =
    "630.1.0";

  const SCHEMA_VERSION =
    1;

  const OUTPUT_PATH =
    "assets/data/generated/server-vs-server/current.json";

  const WEEK_LABELS =
    Object.freeze([
      "W0",
      "W1",
      "W2",
      "W3",
      "W4",
      "W5",
      "W6"
    ]);

  const RULES =
    Object.freeze({
      homeKingdom:
        630,

      minimumHistoricalPower:
        250_000,

      firstWeek:
        0,

      lastWeek:
        6
    });

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

      unitsKilled: [
        "Units Killed",
        "UnitsKilled",
        "unitsKilled"
      ],

      unitsHealed: [
        "Units Healed",
        "UnitsHealed",
        "unitsHealed"
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

  function nowIso() {
    return new Date()
      .toISOString();
  }

  function isPlainObject(value) {
    return Boolean(
      value &&
      typeof value ===
        "object" &&
      !Array.isArray(value)
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

  function createError(message) {
    const error =
      new Error(message);

    error.name =
      "K630ServerVsServerWeeklyEngineError";

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

  function normalizeServerNumber(value) {
    const serverNumber =
      integerValue(value);

    return serverNumber > 0
      ? serverNumber
      : 0;
  }

  /* =====================================================
     SOURCE EXTRACTION
  ===================================================== */

  function extractPlayers(source) {
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

  function normalizePlayer(record) {
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

    return {
      id:
        normalizeText(
          getRecordValue(
            record,
            FIELD_NAMES.id
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
        )
    };
  }

  function normalizePlayers(source) {
    return extractPlayers(source)
      .filter(
        isPlainObject
      )
      .map(
        normalizePlayer
      )
      .filter(player => {
        return Boolean(
          player.id &&
          player.historicalPower >=
            RULES.minimumHistoricalPower
        );
      });
  }

  function normalizeServerSources(
    participatingServerWeekData
  ) {
    const output =
      [];

    if (
      Array.isArray(
        participatingServerWeekData
      )
    ) {
      participatingServerWeekData
        .forEach(entry => {
          const serverNumber =
            normalizeServerNumber(
              entry?.serverNumber ??
              entry?.server ??
              entry?.kingdom
            );

          if (!serverNumber) {
            return;
          }

          output.push({
            serverNumber,

            data:
              entry?.data ??
              entry?.players ??
              entry
          });
        });
    } else if (
      isPlainObject(
        participatingServerWeekData
      )
    ) {
      Object.entries(
        participatingServerWeekData
      ).forEach(
        (
          [
            key,
            value
          ]
        ) => {
          const serverNumber =
            normalizeServerNumber(key);

          if (!serverNumber) {
            return;
          }

          output.push({
            serverNumber,
            data:
              value
          });
        }
      );
    }

    const unique =
      new Map();

    output.forEach(entry => {
      unique.set(
        entry.serverNumber,
        entry
      );
    });

    return [
      ...unique.values()
    ].sort(
      (
        first,
        second
      ) =>
        first.serverNumber -
        second.serverNumber
    );
  }

  /* =====================================================
     TOTAL HELPERS
  ===================================================== */

  function sumMetric(
    players,
    metric
  ) {
    return players.reduce(
      (
        total,
        player
      ) => {
        return (
          total +
          integerValue(
            player[metric]
          )
        );
      },
      0
    );
  }

  function calculateServerTotals(
    serverNumber,
    source,
    weekNumber,
    officialDate
  ) {
    const players =
      normalizePlayers(source);

    return {
      serverNumber,

      kingdom:
        serverNumber,

      week:
        `W${weekNumber}`,

      officialDate:
        officialDate ||
        null,

      playerCount:
        players.length,

      totalPower:
        sumMetric(
          players,
          "currentPower"
        ),

      totalMerits:
        weekNumber === 0
          ? 0
          : sumMetric(
              players,
              "merits"
            ),

      totalKills:
        sumMetric(
          players,
          "unitsKilled"
        ),

      totalHealing:
        sumMetric(
          players,
          "unitsHealed"
        )
    };
  }

  function createEmptySeries() {
    return [
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ];
  }

  function normalizeSeries(source) {
    const output =
      createEmptySeries();

    if (!Array.isArray(source)) {
      return output;
    }

    for (
      let index = 0;
      index <= 6;
      index += 1
    ) {
      const value =
        source[index];

      output[index] =
        value === null ||
        value === undefined
          ? null
          : integerValue(value);
    }

    return output;
  }

  function getPreviousServer(
    previousData,
    serverNumber
  ) {
    const servers =
      Array.isArray(
        previousData?.servers
      )
        ? previousData.servers
        : [];

    return servers.find(
      server =>
        integerValue(
          server.serverNumber ??
          server.kingdom ??
          server.server
        ) ===
        serverNumber
    ) ||
    null;
  }

  function readPreviousSeries(
    previousData,
    serverNumber,
    metric
  ) {
    const previousServer =
      getPreviousServer(
        previousData,
        serverNumber
      );

    return normalizeSeries(
      previousServer
        ?.series
        ?.[metric]
    );
  }

  function readPreviousWeeklyTotals(
    previousData,
    serverNumber
  ) {
    const previousServer =
      getPreviousServer(
        previousData,
        serverNumber
      );

    return isPlainObject(
      previousServer
        ?.weeklyTotals
    )
      ? cloneData(
          previousServer
            .weeklyTotals
        )
      : {};
  }

  /* =====================================================
     SERVER BUILD
  ===================================================== */

  function buildServerEntry(
    totals,
    previousData,
    weekNumber
  ) {
    const serverNumber =
      totals.serverNumber;

    const powerSeries =
      readPreviousSeries(
        previousData,
        serverNumber,
        "power"
      );

    const meritsSeries =
      readPreviousSeries(
        previousData,
        serverNumber,
        "merits"
      );

    const killsSeries =
      readPreviousSeries(
        previousData,
        serverNumber,
        "kills"
      );

    const healingSeries =
      readPreviousSeries(
        previousData,
        serverNumber,
        "healing"
      );

    powerSeries[
      weekNumber
    ] =
      totals.totalPower;

    meritsSeries[
      weekNumber
    ] =
      totals.totalMerits;

    killsSeries[
      weekNumber
    ] =
      totals.totalKills;

    healingSeries[
      weekNumber
    ] =
      totals.totalHealing;

    for (
      let index =
        weekNumber + 1;
      index <= 6;
      index += 1
    ) {
      powerSeries[index] =
        null;

      meritsSeries[index] =
        null;

      killsSeries[index] =
        null;

      healingSeries[index] =
        null;
    }

    const weeklyTotals =
      readPreviousWeeklyTotals(
        previousData,
        serverNumber
      );

    weeklyTotals[
      `W${weekNumber}`
    ] = {
      officialDate:
        totals.officialDate,

      playerCount:
        totals.playerCount,

      totalPower:
        totals.totalPower,

      totalMerits:
        totals.totalMerits,

      totalKills:
        totals.totalKills,

      totalHealing:
        totals.totalHealing
    };

    for (
      let index =
        weekNumber + 1;
      index <= 6;
      index += 1
    ) {
      delete weeklyTotals[
        `W${index}`
      ];
    }

    return {
      serverNumber,

      kingdom:
        serverNumber,

      isHomeKingdom:
        serverNumber ===
        RULES.homeKingdom,

      current: {
        week:
          totals.week,

        officialDate:
          totals.officialDate,

        playerCount:
          totals.playerCount,

        totalPower:
          totals.totalPower,

        totalMerits:
          totals.totalMerits,

        totalKills:
          totals.totalKills,

        totalHealing:
          totals.totalHealing
      },

      weeklyTotals,

      series: {
        power:
          powerSeries,

        merits:
          meritsSeries,

        kills:
          killsSeries,

        healing:
          healingSeries
      }
    };
  }

  /* =====================================================
     RANKINGS
  ===================================================== */

  function rankServers(
    servers,
    metric
  ) {
    return [
      ...servers
    ]
      .sort(
        (
          first,
          second
        ) => {
          const firstValue =
            integerValue(
              first.current?.[metric]
            );

          const secondValue =
            integerValue(
              second.current?.[metric]
            );

          if (
            secondValue !==
            firstValue
          ) {
            return (
              secondValue -
              firstValue
            );
          }

          return (
            first.serverNumber -
            second.serverNumber
          );
        }
      )
      .map(
        (
          server,
          index
        ) => ({
          rank:
            index + 1,

          serverNumber:
            server.serverNumber,

          kingdom:
            server.serverNumber,

          value:
            integerValue(
              server.current?.[metric]
            ),

          isHomeKingdom:
            server.isHomeKingdom
        })
      );
  }

  /* =====================================================
     CHART DATA
  ===================================================== */

  function buildDatasets(
    servers,
    metric,
    labelSuffix
  ) {
    return servers.map(server => ({
      serverNumber:
        server.serverNumber,

      kingdom:
        server.serverNumber,

      label:
        `Server ${server.serverNumber} ${labelSuffix}`,

      data:
        Array.isArray(
          server.series?.[metric]
        )
          ? [
              ...server.series[
                metric
              ]
            ]
          : createEmptySeries(),

      isHomeKingdom:
        server.isHomeKingdom
    }));
  }

  /* =====================================================
     VALIDATION
  ===================================================== */

  function validate(
    participatingServerWeekData,
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

    const serverSources =
      normalizeServerSources(
        participatingServerWeekData
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

    if (
      serverSources.length ===
      0
    ) {
      throw createError(
        "No participating server files were supplied."
      );
    }

    const emptyServers =
      serverSources
        .filter(entry => {
          return (
            normalizePlayers(
              entry.data
            ).length ===
            0
          );
        })
        .map(
          entry =>
            entry.serverNumber
        );

    if (
      emptyServers.length >
      0
    ) {
      throw createError(
        (
          `The following servers contain no eligible players: ` +
          `${emptyServers.join(", ")}.`
        )
      );
    }

    return {
      seasonNumber,
      weekNumber,
      officialDate,
      serverSources
    };
  }

  /* =====================================================
     MAIN BUILD
  ===================================================== */

  function build(
    participatingServerWeekData,
    previousServerVsServerData,
    options = {}
  ) {
    const validation =
      validate(
        participatingServerWeekData,
        options
      );

    const {
      seasonNumber,
      weekNumber,
      officialDate,
      serverSources
    } = validation;

    const generatedAt =
      normalizeText(
        options.generatedAt
      ) ||
      nowIso();

    const generatedBy =
      normalizeText(
        options.generatedBy
      );

    const servers =
      serverSources
        .map(entry => {
          const totals =
            calculateServerTotals(
              entry.serverNumber,
              entry.data,
              weekNumber,
              officialDate
            );

          return buildServerEntry(
            totals,
            previousServerVsServerData,
            weekNumber
          );
        })
        .sort(
          (
            first,
            second
          ) =>
            first.serverNumber -
            second.serverNumber
        );

    const homeServer =
      servers.find(
        server =>
          server.serverNumber ===
          RULES.homeKingdom
      ) ||
      null;

    const output = {
      schemaVersion:
        SCHEMA_VERSION,

      kingdom:
        RULES.homeKingdom,

      dataset:
        "server-vs-server",

      generatedFrom:
        `season-${seasonNumber}-W${weekNumber}`,

      generatedAt,

      generatedBy:
        generatedBy ||
        null,

      season: {
        number:
          seasonNumber,

        currentWeek:
          `W${weekNumber}`,

        officialDate,

        availableWeeks:
          WEEK_LABELS.slice(
            0,
            weekNumber + 1
          )
      },

      participatingServers:
        servers.map(
          server =>
            server.serverNumber
        ),

      summary: {
        serverCount:
          servers.length,

        currentWeek:
          `W${weekNumber}`,

        homeServer:
          homeServer
            ? {
                serverNumber:
                  homeServer.serverNumber,

                playerCount:
                  homeServer.current
                    .playerCount,

                totalPower:
                  homeServer.current
                    .totalPower,

                totalMerits:
                  homeServer.current
                    .totalMerits,

                totalKills:
                  homeServer.current
                    .totalKills,

                totalHealing:
                  homeServer.current
                    .totalHealing
              }
            : null
      },

      labels:
        [
          ...WEEK_LABELS
        ],

      servers,

      rankings: {
        power:
          rankServers(
            servers,
            "totalPower"
          ),

        merits:
          rankServers(
            servers,
            "totalMerits"
          ),

        kills:
          rankServers(
            servers,
            "totalKills"
          ),

        healing:
          rankServers(
            servers,
            "totalHealing"
          )
      },

      charts: {
        power: {
          active:
            true,

          labels:
            [
              ...WEEK_LABELS
            ],

          datasets:
            buildDatasets(
              servers,
              "power",
              "Power"
            )
        },

        merits: {
          active:
            true,

          labels:
            [
              ...WEEK_LABELS
            ],

          datasets:
            buildDatasets(
              servers,
              "merits",
              "Merits"
            )
        },

        kills: {
          active:
            true,

          labels:
            [
              ...WEEK_LABELS
            ],

          datasets:
            buildDatasets(
              servers,
              "kills",
              "Kills"
            )
        },

        healing: {
          active:
            true,

          labels:
            [
              ...WEEK_LABELS
            ],

          datasets:
            buildDatasets(
              servers,
              "healing",
              "Healing"
            )
        }
      }
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

      weekNumber,

      week:
        `W${weekNumber}`,

      officialDate,

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

  global.K630ServerVsServerWeeklyEngine =
    publicApi;

  console.info(
    `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
  );
})(window);