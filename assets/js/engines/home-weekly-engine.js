/* =========================================================
   K630-REF HOME WEEKLY ENGINE

   File:
   assets/js/engines/home-weekly-engine.js

   Version:
   630.1.0 Gold Master

   Responsibilities:
   - Rebuild generated/home/current.json after every W0-W6
   - Calculate Warriors and Farmers
   - Calculate Server 630 Power, Merits, Kills and Healing
   - Preserve W0-W6 chart labels
   - Keep future week values null
   - Build Top 5 player merits
   - Build Top 5 participating-server merits
   - Use Historical Power as W0 player ranking fallback

   Public API:
   window.K630HomeWeeklyEngine.build(
     activeAverageData,
     homeWeekData,
     participatingServerWeekData,
     previousHomeData,
     options
   )
========================================================= */

(function initializeK630HomeWeeklyEngine(global) {
  "use strict";

  const MODULE_NAME =
    "K630 Home Weekly Engine";

  const MODULE_VERSION =
    "630.1.0";

  const SCHEMA_VERSION =
    1;

  const OUTPUT_PATH =
    "assets/data/generated/home/current.json";

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
      kingdom:
        630,

      warriorMinimumPower:
        20_000_000,

      minimumHistoricalPower:
        250_000
    });

  const FIELD_NAMES =
    Object.freeze({
      id: [
        "Lord ID",
        "LordID",
        "lordId",
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
      "K630HomeWeeklyEngineError";

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
      weekNumber < 0 ||
      weekNumber > 6
    ) {
      throw createError(
        "Week number must be W0 through W6."
      );
    }

    return weekNumber;
  }

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

    return [];
  }

  function extractActivePlayers(
    activeAverageData
  ) {
    if (
      !Array.isArray(
        activeAverageData?.players
      )
    ) {
      throw createError(
        "Active & Average contains no players array."
      );
    }

    return activeAverageData.players;
  }

  function normalizeWeekPlayer(record) {
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

      name:
        normalizeText(
          getRecordValue(
            record,
            FIELD_NAMES.name
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

  function normalizeWeekPlayers(source) {
    return extractPlayers(source)
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
      });
  }

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

  function readPreviousSeries(
    previousHomeData,
    chartKey
  ) {
    const source =
      previousHomeData
        ?.charts
        ?.[chartKey]
        ?.datasets
        ?.[0]
        ?.data;

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

  function normalizeServerEntries(
    participatingServerWeekData,
    participatingServers
  ) {
    const serverMap =
      new Map();

    if (
      Array.isArray(
        participatingServerWeekData
      )
    ) {
      participatingServerWeekData
        .forEach(entry => {
          const serverNumber =
            integerValue(
              entry?.serverNumber ??
              entry?.server ??
              entry?.kingdom
            );

          if (serverNumber <= 0) {
            return;
          }

          serverMap.set(
            serverNumber,
            entry?.data ??
            entry?.players ??
            entry
          );
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
            integerValue(key);

          if (serverNumber > 0) {
            serverMap.set(
              serverNumber,
              value
            );
          }
        }
      );
    }

    return participatingServers
      .map(serverNumber => {
        const source =
          serverMap.get(
            serverNumber
          );

        const players =
          source
            ? normalizeWeekPlayers(
                source
              )
            : [];

        return {
          serverNumber,

          players,

          totalMerits:
            sumMetric(
              players,
              "merits"
            ),

          totalPower:
            sumMetric(
              players,
              "currentPower"
            )
        };
      });
  }

  function buildTopPlayerRanking(
    activePlayers,
    homeWeekPlayers,
    weekNumber
  ) {
    const activeIndex =
      new Map();

    activePlayers.forEach(player => {
      const id =
        normalizeText(
          player.id
        );

      if (id) {
        activeIndex.set(
          id,
          player
        );
      }
    });

    return homeWeekPlayers
      .map(player => {
        const activePlayer =
          activeIndex.get(
            player.id
          );

        return {
          id:
            player.id,

          name:
            player.name ||
            normalizeText(
              activePlayer?.name
            ),

          kingdom:
            RULES.kingdom,

          merits:
            weekNumber === 0
              ? 0
              : player.merits,

          historicalPower:
            Math.max(
              player.historicalPower,
              integerValue(
                activePlayer
                  ?.historicalPower
              )
            )
        };
      })
      .sort(
        (
          first,
          second
        ) => {
          if (weekNumber === 0) {
            if (
              second.historicalPower !==
              first.historicalPower
            ) {
              return (
                second.historicalPower -
                first.historicalPower
              );
            }
          } else if (
            second.merits !==
            first.merits
          ) {
            return (
              second.merits -
              first.merits
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
            RULES.kingdom,

          merits:
            player.merits
        })
      );
  }

  function buildTopServerRanking(
    serverEntries,
    weekNumber
  ) {
    const sorted =
      [
        ...serverEntries
      ];

    if (weekNumber > 0) {
      sorted.sort(
        (
          first,
          second
        ) => {
          if (
            second.totalMerits !==
            first.totalMerits
          ) {
            return (
              second.totalMerits -
              first.totalMerits
            );
          }

          return (
            first.serverNumber -
            second.serverNumber
          );
        }
      );
    }

    return sorted
      .slice(0, 5)
      .map(
        (
          server,
          index
        ) => ({
          rank:
            index + 1,

          kingdom:
            server.serverNumber,

          server:
            server.serverNumber,

          merits:
            weekNumber === 0
              ? 0
              : server.totalMerits
        })
      );
  }

  function validate(
    activeAverageData,
    homeWeekData,
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

    const participatingServers =
      Array.isArray(
        options.participatingServers
      )
        ? options.participatingServers
            .map(integerValue)
            .filter(
              server =>
                server > 0
            )
        : [];

    const activePlayers =
      extractActivePlayers(
        activeAverageData
      );

    const homeWeekPlayers =
      normalizeWeekPlayers(
        homeWeekData
      );

    if (seasonNumber <= 0) {
      throw createError(
        "A valid Season number is required."
      );
    }

    if (
      activePlayers.length ===
      0
    ) {
      throw createError(
        "Active & Average contains no players."
      );
    }

    if (
      homeWeekPlayers.length ===
      0
    ) {
      throw createError(
        "Server 630 weekly data contains no players."
      );
    }

    if (
      participatingServers.length ===
      0
    ) {
      throw createError(
        "No participating servers were supplied."
      );
    }

    return {
      seasonNumber,

      weekNumber,

      participatingServers,

      activePlayers,

      homeWeekPlayers
    };
  }

  function build(
    activeAverageData,
    homeWeekData,
    participatingServerWeekData,
    previousHomeData,
    options = {}
  ) {
    const validation =
      validate(
        activeAverageData,
        homeWeekData,
        options
      );

    const {
      seasonNumber,
      weekNumber,
      participatingServers,
      activePlayers,
      homeWeekPlayers
    } = validation;

    const generatedAt =
      normalizeText(
        options.generatedAt
      ) ||
      nowIso();

    const officialDate =
      normalizeText(
        options.officialDate
      );

    const serverPower =
      sumMetric(
        homeWeekPlayers,
        "currentPower"
      );

    const serverMerits =
      weekNumber === 0
        ? 0
        : sumMetric(
            homeWeekPlayers,
            "merits"
          );

    const serverKills =
      sumMetric(
        homeWeekPlayers,
        "unitsKilled"
      );

    const serverHealing =
      sumMetric(
        homeWeekPlayers,
        "unitsHealed"
      );

    const warriors =
      homeWeekPlayers.filter(
        player =>
          player.historicalPower >
          RULES.warriorMinimumPower
      ).length;

    const farmers =
      homeWeekPlayers.length -
      warriors;

    const powerSeries =
      readPreviousSeries(
        previousHomeData,
        "powerDevelopment"
      );

    const meritsSeries =
      readPreviousSeries(
        previousHomeData,
        "meritsDevelopment"
      );

    powerSeries[
      weekNumber
    ] =
      serverPower;

    meritsSeries[
      weekNumber
    ] =
      serverMerits;

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
    }

    const serverEntries =
      normalizeServerEntries(
        participatingServerWeekData,
        participatingServers
      );

    const output = {
      schemaVersion:
        SCHEMA_VERSION,

      kingdom:
        RULES.kingdom,

      dataset:
        "home",

      generatedFrom:
        `season-${seasonNumber}-W${weekNumber}`,

      generatedAt,

      generatedBy:
        normalizeText(
          options.generatedBy
        ) ||
        null,

      currentSeason:
        seasonNumber,

      currentWeek:
        `W${weekNumber}`,

      currentWeekDate:
        officialDate ||
        null,

      seasonName:
        normalizeText(
          options.seasonName
        ) ||
        `Season ${seasonNumber}`,

      totals: {
        activePlayers:
          homeWeekPlayers.length,

        warriors,

        farmers,

        serverPower,

        serverMerits,

        serverKills,

        serverHealing
      },

      playerRanking: {
        topIdMerits:
          buildTopPlayerRanking(
            activePlayers,
            homeWeekPlayers,
            weekNumber
          )
      },

      serverRanking: {
        topServerMerits:
          buildTopServerRanking(
            serverEntries,
            weekNumber
          )
      },

      charts: {
        powerDevelopment: {
          active:
            true,

          labels:
            [
              ...WEEK_LABELS
            ],

          datasets: [
            {
              label:
                "Server 630 Power",

              data:
                powerSeries
            }
          ]
        },

        meritsDevelopment: {
          active:
            true,

          labels:
            [
              ...WEEK_LABELS
            ],

          datasets: [
            {
              label:
                "Server 630 Merits",

              data:
                meritsSeries
            }
          ]
        }
      },

      weeklyTotals: {
        [`W${weekNumber}`]: {
          officialDate:
            officialDate ||
            null,

          serverPower,

          serverMerits,

          serverKills,

          serverHealing
        }
      }
    };

    const previousWeeklyTotals =
  isPlainObject(
    previousHomeData?.weeklyTotals
  )
    ? cloneData(
        previousHomeData.weeklyTotals
      )
    : {};

previousWeeklyTotals[`W${weekNumber}`] = {
  officialDate:
    officialDate || null,

  serverPower,

  serverMerits,

  serverKills,

  serverHealing
};

for (let w = weekNumber + 1; w <= 6; w++) {
  delete previousWeeklyTotals[`W${w}`];
}

output.weeklyTotals =
  previousWeeklyTotals;

    output.weeklyTotals = {
      ...previousWeeklyTotals,
      ...output.weeklyTotals
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

      generatedAt,

      summary: {
        activePlayers:
          homeWeekPlayers.length,

        warriors,

        farmers,

        serverPower,

        serverMerits,

        serverKills,

        serverHealing
      },

      data:
        output,

      files: {
        [OUTPUT_PATH]:
          output
      }
    };
  }

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

  global.K630HomeWeeklyEngine =
    publicApi;

  console.info(
    `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
  );
})(window);