/*!
 * =====================================================
 * Kingdom 630 Save Season Engine
 * Version 630.1.0
 * =====================================================
 */

(function () {

  "use strict";

  const ENGINE_NAME =
    "K630SaveSeasonEngine";

  const ENGINE_VERSION =
    "630.1.0";

  const LOG_PREFIX =
    "[Save Season]";

const PATHS = Object.freeze({

  DATA:
    "assets/data",

  GENERATED:
    "assets/data/generated",

  SEASONS:
    "assets/data/generated/season-info",

  SERVER_VS_SERVER:
    "assets/data/generated/server-vs-server",

  HOME:
    "assets/data/generated/home",

  ACTIVE_AVERAGE:
    "assets/data/generated/active-average",

  ARCHIVES:
    "assets/data/archives",

  RECORDS:
    "assets/data/records",

  ADMIN:
    "assets/data/admin"

});

const RAW_DATA_ROOT =
  "https://raw.githubusercontent.com/Ragnarok630/k630-public-data/main/assets/data";

  function clone(value) {

    return JSON.parse(
      JSON.stringify(value)
    );

  }

  function normalizeSeasonNumber(
    seasonNumber
  ) {

    return Math.max(
      1,
      Math.trunc(
        Number(seasonNumber) || 1
      )
    );

  }

  function seasonFolder(
    seasonNumber
  ) {

    return (
      `${PATHS.ARCHIVES}/season-${normalizeSeasonNumber(
        seasonNumber
      )}`
    );

  }

  function seasonFile(
    seasonNumber,
    fileName
  ) {

    return (
      `${seasonFolder(
        seasonNumber
      )}/${fileName}`
    );

  }

  function isoNow() {

    return (
      new Date()
        .toISOString()
    );

  }

  function pad2(
    value
  ) {

    return String(
      value
    ).padStart(
      2,
      "0"
    );

  }

  function todayString() {

    const now =
      new Date();

    return (
      `${now.getFullYear()}-${pad2(
        now.getMonth() + 1
      )}-${pad2(
        now.getDate()
      )}`
    );

  }

  function requireValue(
    value,
    message
  ) {

    if (
      value === undefined ||
      value === null
    ) {

      throw new Error(
        message
      );

    }

    return value;

  }

  async function readJson(
  url
) {

  console.log(
    "readJson() CALLED"
  );

  console.log(
    "RAW =",
    RAW_DATA_ROOT
  );

  console.log(
    "INPUT =",
    url
  );

  const finalUrl =
    /^https?:\/\//i.test(
      url
    )
      ? url
      : `${RAW_DATA_ROOT}/${url.replace(
          /^assets\/data\//,
          ""
        )}`;

  console.log(
    "FINAL =",
    finalUrl
  );

  const response =
    await fetch(
      finalUrl,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept:
            "application/json"
        }
      }
    );

  if (
    !response.ok
  ) {

    throw new Error(
      `Unable to load ${finalUrl}. HTTP ${response.status}.`
    );

  }

  return await response.json();

}

  async function writeJson(
    github,
    path,
    data,
    message
  ) {

    requireValue(
      github,
      "GitHub API is required."
    );

    if (
      typeof github.writeJson !==
      "function"
    ) {

      throw new Error(
        "github.writeJson() not available."
      );

    }

    return await github.writeJson(
      path,
      data,
      message
    );

  }

  function sortNewestSeasonFirst(
    list
  ) {

    return (
      [...list]
    ).sort(
      (
        a,
        b
      ) =>
        normalizeSeasonNumber(
          b.season
        ) -
        normalizeSeasonNumber(
          a.season
        )
    );

  }

  function createContext(
  options = {}
) {

  return {

    github:
  options.github ??
  window.K630GitHubWriter ??
  null,

    adminConfig:
      options.adminConfig ??
      null,

    foundation:
      options.foundation ??
      null,

    matchmaking:
      options.matchmaking ??
      null,

    season:
      normalizeSeasonNumber(
        options.season ??
        1
      ),

    createdAt:
      isoNow(),

    today:
      todayString(),

    activeAverageData:
      null,

    activeAverageResult:
      null,

    seasonInfoData:
      null,

    seasonInfoResult:
      null,

    homeResult:
      null,

    previousHomeData:
      null,

    server630WeekData:
      [],

    participatingServerWeekData:
      [],

    participatingServers:
      [],

    oldPlayers:
      null,

    archiveIndex:
      [],

    nextSeason:
      null,

    playerChanges:
      null,

    previousPlayers:
      [],

    currentPlayers:
      [],

  };

}


  function log(
  message,
  ...args
) {

  console.log(
    LOG_PREFIX,
    message,
    ...args
  );

}

function error(
  message,
  ...args
) {

  console.error(
    LOG_PREFIX,
    message,
    ...args
  );

}

function notImplemented(
  moduleName
) {

  error(
    `${moduleName} not implemented yet.`
  );

  throw new Error(
    `${LOG_PREFIX} ${moduleName} not implemented yet.`
  );

}

async function archiveJsonFile(
  context,
  sourcePath,
  targetPath,
 commitMessage
) {

  const json =
    await readJson(
      sourcePath
    );

  await writeJson(

    context.github,

    targetPath,

    clone(
      json
    ),

    commitMessage

  );

  return json;

}

function createSaveResult(
  context
) {

  return {

    success:
      true,

    season:
      context.season,

    nextSeason:
      context.nextSeason,

    archivedPlayers:
      context.oldPlayersAdded ??
      0,

    existingPlayers:
      context.playerChanges
        ?.existing
        ?.length ??
      0,

    newPlayers:
      context.playerChanges
        ?.newPlayers
        ?.length ??
      0,

    departedPlayers:
      context.playerChanges
        ?.departedPlayers
        ?.length ??
      0,

    completedAt:
      context.createdAt

  };

}

function buildPlayerLookup(
  players = []
) {

  const lookup =
    new Map();

  for (
    const player of players
  ) {

    lookup.set(
      String(
        player.id
      ),
      player
    );

  }

  return lookup;

}

function comparePlayers(
  previousPlayers = [],
  currentPlayers = []
) {

  const previousLookup =
    buildPlayerLookup(
      previousPlayers
    );

  const currentLookup =
    buildPlayerLookup(
      currentPlayers
    );

  const result = {

    existing: [],

    newPlayers: [],

    departedPlayers: []

  };

  for (
    const player of currentPlayers
  ) {

    const id =
      String(
        player.id
      );

    if (
      previousLookup.has(
        id
      )
    ) {

      result.existing.push({

        previous:
          previousLookup.get(
            id
          ),

        current:
          player

      });

    } else {

      result.newPlayers.push(
        player
      );

    }

  }

  for (
    const player of previousPlayers
  ) {

    const id =
      String(
        player.id
      );

    if (
      !currentLookup.has(
        id
      )
    ) {

      result.departedPlayers.push(
        player
      );

    }

  }

  return result;

}

function mergePlayerHistory(
  previousPlayer,
  currentPlayer
) {

  if (
    !previousPlayer
  ) {

    currentPlayer.seasonsPlayed =
      Number(
        currentPlayer.seasonsPlayed ??
        1
      );

    currentPlayer.historicalPower =
      Math.max(

        Number(
          currentPlayer.historicalPower ??
          0
        ),

        Number(
          currentPlayer.power ??
          0
        )

      );

    currentPlayer.topMerits =
      Math.max(

        Number(
          currentPlayer.topMerits ??
          0
        ),

        Number(
          currentPlayer.currentMerits ??
          currentPlayer.merits ??
          0
        )

      );

    return currentPlayer;

  }

  currentPlayer.seasonsPlayed =
    Math.max(

      Number(
        previousPlayer.seasonsPlayed ??
        1
      ),

      Number(
        currentPlayer.seasonsPlayed ??
        1
      )

    );

  currentPlayer.historicalPower =
    Math.max(

      Number(
        previousPlayer.historicalPower ??
        0
      ),

      Number(
        currentPlayer.power ??
        0
      ),

      Number(
        currentPlayer.historicalPower ??
        0
      )

    );

  currentPlayer.topMerits =
    Math.max(

      Number(
        previousPlayer.topMerits ??
        0
      ),

      Number(
        currentPlayer.currentMerits ??
        currentPlayer.merits ??
        0
      ),

      Number(
        currentPlayer.topMerits ??
        0
      )

    );

  return currentPlayer;

}

function initializeNewPlayer(
  player,
  context
) {

  player.seasonsPlayed =
    1;

  player.serverStatus =
    "LV2";

  player.historicalPower =
    Number(
      player.power ??
      0
    );

  player.topMerits =
    Number(
      player.currentMerits ??
      player.merits ??
      0
    );

  player.firstSeason =
    context.season;

  return player;

}

function validateContext(
  context
) {

  requireValue(
    context.github,
    "GitHub engine missing."
  );

  requireValue(
    context.activeAverageResult,
    "Active Average missing."
  );

  requireValue(
    context.seasonInfoData,
    "Season Info missing."
  );

  if (
    !Array.isArray(
      context.currentPlayers
    )
  ) {

    throw new Error(
      "Current players missing."
    );

  }

}

function finalizePlayerStatistics(
  player
) {

  const historicalPower =
    Number(
      player.historicalPower ??
      0
    );

  const currentPower =
    Number(
      player.power ??
      0
    );

  player.powerGrowth =
  Math.max(
    0,
    currentPower -
    historicalPower
  );

  const currentMerits =
    Number(
      player.currentMerits ??
      player.merits ??
      0
    );

  const seasonsPlayed =
    Math.max(
      1,
      Number(
        player.seasonsPlayed ??
        1
      )
    );

  player.averageMeritsValue =
    Math.round(
      currentMerits /
      seasonsPlayed
    );

  player.averageMeritsPercentage =
    Number(

      (
        player.averageMeritsValue /

        Math.max(
          1,
          Number(
            player.topMerits ??
            1
          )
        ) *

        100

      ).toFixed(2)

    );

  return player;

}

function finalizeCompletedSeason(
  context
) {

  for (
    const pair of
    context.playerChanges.existing
  ) {

    const player =
      pair.current;

    player.seasonsPlayed =
      Math.max(

        Number(
          pair.previous
            ?.seasonsPlayed ??
          1
        ) + 1,

        Number(
          player.seasonsPlayed ??
          1
        )

      );

  }

  for (
    const player of
    context.playerChanges.newPlayers
  ) {

    player.seasonsPlayed =
      1;

  }

}

  async function saveSeason(
  options = {}
) {

  const context =
    createContext(
      options
    );


context.seasonInfoData =
  await readJson(
    `${PATHS.SEASONS}/current.json`
  );

context.activeAverageData =
  await readJson(
    `${PATHS.DATA}/generated/active-average/current.json`
  );

context.previousPlayers =
  Array.isArray(
    context.activeAverageData
      ?.players
  )
    ? clone(
        context.activeAverageData
          .players
      )
    : [];

try {

  context.previousHomeData =
    await readJson(
      `${PATHS.DATA}/generated/home/current.json`
    );

} catch {

  context.previousHomeData =
    null;

}

context.participatingServers =
  Array.isArray(
    context.seasonInfoData
      ?.participatingServers
  )
    ? clone(
        context.seasonInfoData
          .participatingServers
      )
    : [];

context.server630WeekData =
  Array.isArray(
    context.seasonInfoData
      ?.server630WeekData
  )
    ? clone(
        context.seasonInfoData
          .server630WeekData
      )
    : [];

context.participatingServerWeekData =
  Array.isArray(
    context.seasonInfoData
      ?.participatingServerWeekData
  )
    ? clone(
        context.seasonInfoData
          .participatingServerWeekData
      )
    : [];

  log(
    "Starting Save Season",
    context.season
  );

  await archiveSeasonInfo(
    context
  );

  await archiveServerVsServer(
    context
  );

  await updateArchiveIndex(
    context
  );

  await rebuildActiveAverage(
    context
  );

context.currentPlayers =
  Array.isArray(
    context.activeAverageResult
      ?.data
      ?.players
  )
    ? clone(
        context.activeAverageResult
          .data
          .players
      )
    : [];

context.playerChanges =
  comparePlayers(

    context.previousPlayers,

    context.currentPlayers

  );

validateContext(
  context
);

  for (
  const pair of
  context.playerChanges.existing
) {

  mergePlayerHistory(

    pair.previous,

    pair.current

  );

}

for (
  const player of
  context.playerChanges.newPlayers
) {

  mergePlayerHistory(
    null,
    player
  );

  initializeNewPlayer(
    player,
    context
  );

}

for (
  const player of
  context.currentPlayers
) {

  finalizePlayerStatistics(
    player
  );

}

finalizeCompletedSeason(
  context
);

log(

  "Existing:",

  context.playerChanges
    .existing.length,

  "New:",

  context.playerChanges
    .newPlayers.length,

  "Departed:",

  context.playerChanges
    .departedPlayers.length

);

  await updateServerStatus(
    context
  );

  await archiveOldPlayers(
    context
  );

  await rebuildHome(
    context
  );

  await regenerateCurrentFiles(
    context
  );

  await resetSeason(
    context
  );

  log(
    "Save Season completed."
  );

  logSummary(
    context
   );

  return createSaveResult(
  context
);

}

  async function archiveSeasonInfo(
  context
) {

  log(
    "Archive Season Info..."
  );

  context.seasonInfoData =
    await archiveJsonFile(

      context,

      `${PATHS.SEASONS}/current.json`,

      seasonFile(
        context.season,
        "season-info.json"
      ),

      `Archive Season ${context.season} Season Info`

    );

  context.archivedSeasonInfo =
    true;

}

  async function archiveServerVsServer(
  context
) {

  log(
    "Archive Server vs Server..."
  );

  context.serverVsServerData =
    await archiveJsonFile(

      context,

      `${PATHS.SERVER_VS_SERVER}/current.json`,

      seasonFile(
        context.season,
        "server-vs-server.json"
      ),

      `Archive Season ${context.season} Server vs Server`

    );

  context.archivedServerVsServer =
    true;

}

  async function updateArchiveIndex(
  context
) {

  log(
    "Updating archive index..."
  );

  const indexPath =
    `${PATHS.ARCHIVES}/index.json`;

  let index = [];

  try {

    index =
      await readJson(
        indexPath
      );

    if (
      !Array.isArray(
        index
      )
    ) {

      index = [];

    }

  } catch {

    index = [];

  }

  index =
    index.filter(
      entry =>
        normalizeSeasonNumber(
          entry?.season
        ) !== context.season
    );

  index.push({

    season:
      context.season,

    archivedAt:
      context.createdAt,

    seasonInfo:
      seasonFile(
        context.season,
        "season-info.json"
      ),

    serverVsServer:
      seasonFile(
        context.season,
        "server-vs-server.json"
      )

  });

  index =
    sortNewestSeasonFirst(
      index
    );

  await writeJson(
    context.github,
    indexPath,
    index,
    `Save Season ${context.season} - Archive Index`
  );

  context.archiveIndex =
    clone(
      index
    );

  log(
    "Archive index updated."
  );

}

  async function rebuildActiveAverage(
  context
) {

  log(
    "Rebuilding Active & Average..."
  );

  if (
    !window.K630WeeklyPlayerStateEngine
  ) {

    throw new Error(
      "K630WeeklyPlayerStateEngine not found."
    );

  }

  const result =
    await window
      .K630WeeklyPlayerStateEngine
      .build(

        context.activeAverageData,

        context.seasonInfoData,

        context.server630WeekData,

        {

          seasonNumber:
            context.season,

          weekNumber:
            6,

          officialDate:
            context.today,

          generatedAt:
            context.createdAt,

          generatedBy:
            ENGINE_NAME,

          meritConfiguration:
            context.adminConfig
              ?.meritConfiguration ??
            null

        }

      );

  context.activeAverageResult =
    result;

  context.seasonInfoResult =
    result;

  context.activeAverageData =
    result.data;



  log(
    "Active & Average rebuild finished."
  );

}

  async function updateServerStatus(
  context
) {

  log(
    "Updating Server Status..."
  );

  requireValue(
    context.activeAverageResult,
    "Active & Average rebuild missing."
  );

  const players =
    Array.isArray(
      context.activeAverageResult.data?.players
    )
      ? context.activeAverageResult.data.players
      : [];

  const meritConfiguration =
    context.adminConfig
      ?.meritConfiguration ??
    {};

  const t5Rank3Target =
    Number(
      meritConfiguration?.w6?.t5?.rank3 ?? 0
    );

  const t4Rank3Target =
    Number(
      meritConfiguration?.w6?.t4?.rank3 ?? 0
    );

  for (
    const player of players
  ) {

    const currentStatus =
      String(
        player.serverStatus ??
        player.server_status ??
        "LV2"
      ).toUpperCase();

    const isT5 =
  String(
    player.troopTier ??
    ""
  ).toUpperCase() ===
  "T5";

const target =
  isT5
    ? t5Rank3Target
    : t4Rank3Target;

const rank =
  Number(
    player.rank ??
    999
  );

const averagePercent =
  Number(
    player.averageMeritsPercentage ??
    0
  );

    let nextStatus =
      currentStatus;

    switch (
      currentStatus
    ) {

      case "LV2":

        if (
          rank <= 3 &&
          averagePercent >= target
        ) {

          nextStatus =
            "LV2";

        } else {

          nextStatus =
            "LV1";

        }

        break;

      case "LV1":

        if (
          rank === 1
        ) {

          nextStatus =
            "LV1";

        } else if (
          rank <= 3
        ) {

          nextStatus =
            "LV2";

        } else {

          nextStatus =
            "LV0";

        }

        break;

      case "LV0":

        nextStatus =
          "LV0";

        break;

      case "LV3":

        nextStatus =
          "LV3";

        break;

      default:

        nextStatus =
          "LV2";

        break;

    }

    player.serverStatus =
      nextStatus;

  }

  context.activeAverageResult.data.players =
    players;

  log(
    "Server Status updated."
  );

}

  async function archiveOldPlayers(
  context
) {

  log(
    "Updating Old Players..."
  );

  requireValue(
    context.activeAverageResult,
    "Active & Average rebuild missing."
  );

  const oldPlayersPath =
    `${PATHS.RECORDS}/old-players/current.json`;

  let oldPlayersData;

  try {

    oldPlayersData =
      await readJson(
        oldPlayersPath
      );

  } catch {

    oldPlayersData = {

      schemaVersion: 1,
      kingdom: 630,
      dataset: "old-players",
      generatedAt:
        context.createdAt,
      currentSeason:
        context.season,
      playerCount: 0,
      players: []

    };

  }

  const players =
    Array.isArray(
      oldPlayersData.players
    )
      ? oldPlayersData.players
      : [];

  const activeIds =
    new Set(
      context.activeAverageResult.data.players.map(
        player => String(
          player.id
        )
      )
    );

  const departedPlayers =
  Array.isArray(
    context.playerChanges
      ?.departedPlayers
  )
    ? context.playerChanges
        .departedPlayers
    : [];

    context.oldPlayersAdded =
  departedPlayers.length;

log(
  "Players archived:",
  departedPlayers.length
);

for (
  const player of
  departedPlayers
) {

    const id =
      String(
        player.id
      );

    if (
      activeIds.has(
        id
      )
    ) {

      continue;

    }

    let existing =
      players.find(
        oldPlayer =>
          String(
            oldPlayer.id
          ) === id
      );

    if (
      !existing
    ) {

      existing = {};

      players.push(
        existing
      );

    }

    Object.assign(

      existing,

      clone(
        player
      )

    );

    existing.active =
  false;

existing.serverStatus =
  "LV3";

existing.seasonLeft =
  context.season;

existing.leftBeforeSeason =
  context.season + 1;

existing.dateLeaveKingdom =
  context.today;

existing.lastSeasonPlayed =
  context.season;

existing.leaveReason =
  "Player not found after season close.";

  }

  oldPlayersData.generatedAt =
    context.createdAt;

  oldPlayersData.currentSeason =
    context.season;

  oldPlayersData.playerCount =
    players.length;

  oldPlayersData.players =
    players.sort(

      (
        a,
        b
      ) =>

        Number(
          a.id
        ) -

        Number(
          b.id
        )

    );

  await writeJson(

    context.github,

    oldPlayersPath,

    oldPlayersData,

    `Season ${context.season} Old Players`

  );

  context.oldPlayers =
    oldPlayersData;

  log(
    "Old Players updated."
  );

}

  async function rebuildHome(
  context
) {

  log(
    "Rebuilding Home..."
  );

  if (
    !window.K630HomeWeeklyEngine
  ) {

    throw new Error(
      "K630HomeWeeklyEngine not found."
    );

  }

  context.homeResult =
    await window
      .K630HomeWeeklyEngine
      .build(

        context.activeAverageData,

        context.server630WeekData,

        context.participatingServerWeekData,

        context.previousHomeData,

        {

          seasonNumber:
            context.season,

          weekNumber:
            6,

          officialDate:
            context.today,

          generatedAt:
            context.createdAt,

          generatedBy:
            ENGINE_NAME,

          participatingServers:
            context.participatingServers

        }

      );

  log(
    "Home rebuild finished."
  );

}

  async function regenerateCurrentFiles(
  context
) {

  log(
    "Generating current files..."
  );

  requireValue(
    context.homeResult,
    "Home rebuild missing."
  );

  await writeJson(

    context.github,

    "assets/data/generated/home/current.json",

    context.homeResult.data,

    `Season ${context.season} Home`

  );

  requireValue(
    context.activeAverageResult,
    "Active Average rebuild missing."
  );

  await writeJson(

    context.github,

    "assets/data/generated/active-average/current.json",

    context.activeAverageResult.data,

    `Season ${context.season} Active & Average`

  );

  requireValue(
    context.seasonInfoResult,
    "Season Info rebuild missing."
  );

  await writeJson(

    context.github,

    "assets/data/generated/season-info/current.json",

    context.seasonInfoResult.data,

    `Season ${context.season} Season Info`

  );

  log(
    "Current files generated."
  );

}

  async function resetSeason(
  context
) {

  log(
    "Resetting season..."
  );

  const emptySeasonInfo = {

    schemaVersion: 1,

    kingdom: 630,

    season:
      context.season + 1,

    week: 0,

    generatedAt:
      context.createdAt,

    generatedBy:
      ENGINE_NAME,

    participatingServers: [],

    servers: []

  };

  const emptyServerVsServer = {

    schemaVersion: 1,

    kingdom: 630,

    season:
      context.season + 1,

    generatedAt:
      context.createdAt,

    generatedBy:
      ENGINE_NAME,

    groups: [],

    servers: []

  };

  await writeJson(

    context.github,

    `${PATHS.SEASONS}/current.json`,

    emptySeasonInfo,

    `Reset Season Info`

  );

  await writeJson(

    context.github,

    `${PATHS.SERVER_VS_SERVER}/current.json`,

    emptyServerVsServer,

    `Reset Server vs Server`

  );

  if (
    context.adminConfig
  ) {

    context.adminConfig.currentSeason =
      context.season + 1;

    context.adminConfig.currentWeek =
      0;

    context.adminConfig.matchmakingUploaded =
      false;

    context.adminConfig.foundationReady =
      true;

    context.adminConfig.weeks = {

      week0: false,
      week1: false,
      week2: false,
      week3: false,
      week4: false,
      week5: false,
      week6: false

    };

    await writeJson(

      context.github,

      `${PATHS.DATA}/admin/admin-config.json`,

      context.adminConfig,

      `Prepare Season ${context.season + 1}`

    );

  }

  context.nextSeason =
    context.season + 1;

  log(
    `Season ${context.season} closed. Season ${context.nextSeason} ready.`
  );

}

function logSummary(
  context
) {

  console.group(
    `${LOG_PREFIX} Summary`
  );

  console.log(
    "Season:",
    context.season
  );

  console.log(
    "Existing:",
    context.playerChanges
      ?.existing
      ?.length ??
      0
  );

  console.log(
    "New:",
    context.playerChanges
      ?.newPlayers
      ?.length ??
      0
  );

  console.log(
    "Departed:",
    context.playerChanges
      ?.departedPlayers
      ?.length ??
      0
  );

  console.log(
    "Archived:",
    context.oldPlayersAdded ??
    0
  );

  console.groupEnd();

}

  window.K630SaveSeasonEngine = {

    ENGINE_NAME,
    ENGINE_VERSION,
    saveSeason

  };

})();