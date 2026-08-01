/* =========================================================
   K630-REF ADMIN CONFIG ENGINE
   File: assets/js/engines/admin-config-engine.js
   Version: 630.1.0

   Responsibilities:
   - Create and normalize admin-config.json
   - Preserve permanent GitHub and Foundation status
   - Update individual Admin Center workflow sections
   - Reset the workflow to Matchmaking after Season Archive
   - Never use localStorage or IndexedDB

   Output:
   - assets/data/config/admin-config.json
========================================================= */

(function initializeK630AdminConfigEngine(global) {
  "use strict";

  const ENGINE_NAME =
    "K630 Admin Config Engine";

  const ENGINE_VERSION =
    "630.1.0";

  const SCHEMA_VERSION =
    "630.1.0";

  const CONFIG_PATH =
    "assets/data/config/admin-config.json";

  const DEFAULT_WEBSITE_STATUS =
    "home-farming-migration-open";

  /* =====================================================
     GENERAL HELPERS
  ===================================================== */

  function normalizeText(value) {
    return String(
      value ?? ""
    ).trim();
  }

  function normalizeBoolean(value) {
    return value === true;
  }

  function normalizeNumber(value) {
    const parsed =
      Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function normalizeInteger(value) {
    return Math.max(
      0,
      Math.trunc(
        normalizeNumber(value)
      )
    );
  }

  function normalizeIsoDateTime(value) {
    const text =
      normalizeText(value);

    if (!text) {
      return "";
    }

    const date =
      new Date(text);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return date.toISOString();
  }

  function normalizeOfficialDate(value) {
    const text =
      normalizeText(value);

    return /^\d{4}-\d{2}-\d{2}$/.test(text)
      ? text
      : "";
  }

  function nowIso() {
    return new Date()
      .toISOString();
  }

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function isObject(value) {
    return Boolean(
      value &&
      typeof value ===
        "object" &&
      !Array.isArray(value)
    );
  }

  function uniquePositiveIntegers(values) {
    if (!Array.isArray(values)) {
      return [];
    }

    return [
      ...new Set(
        values
          .map(normalizeInteger)
          .filter(value => value > 0)
      )
    ].sort(
      (
        first,
        second
      ) =>
        first -
        second
    );
  }

  function normalizeWeeks(values) {
    if (!Array.isArray(values)) {
      return [];
    }

    const normalized =
      values
        .map(value =>
          normalizeText(value)
            .toUpperCase()
        )
        .filter(value =>
          /^W[0-6]$/.test(value)
        );

    return [
      ...new Set(normalized)
    ].sort(
      (
        first,
        second
      ) =>
        Number(
          first.slice(1)
        ) -
        Number(
          second.slice(1)
        )
    );
  }

  /* =====================================================
     DEFAULT CONFIGURATION
  ===================================================== */

  function createDefaultConfig(options = {}) {
    const timestamp =
      normalizeIsoDateTime(
        options.updatedAt
      ) ||
      nowIso();

    return {
      schemaVersion:
        SCHEMA_VERSION,

      updatedAt:
        timestamp,

      updatedBy:
        normalizeText(
          options.updatedBy
        ),

      github: {
        repositoryRead:
          false,

        repositoryWrite:
          false,

        lastCheckedAt:
          ""
      },

      foundation: {
        ready:
          false,

        officialDate:
          "",

        playerCount:
          0,

        updatedAt:
          ""
      },

      matchmaking: {
        ready:
          false,

        seasonNumber:
          0,

        officialDate:
          "",

        playerCount:
          0,

        updatedAt:
          ""
      },

      season: {
        websiteStatus:
          DEFAULT_WEBSITE_STATUS,

        selectedSeason:
          null,

        participatingServers:
          [],

        active:
          false,

        week0Unlocked:
          false,

        updatedAt:
          ""
      },

      weeks: {
        uploaded:
          [],

        latestWeek:
          null,

        ready:
          false,

        updatedAt:
          ""
      },

      websiteBuild: {
        ready:
          false,

        lastBuiltAt:
          ""
      },

      archive: {
        ready:
          false,

        archived:
          false,

        seasonNumber:
          0,

        archivedAt:
          ""
      }
    };
  }

  /* =====================================================
     NORMALIZATION
  ===================================================== */

  function normalizeSelectedSeason(value) {
    if (!isObject(value)) {
      return null;
    }

    const year =
      normalizeInteger(
        value.year
      );

    const season =
      normalizeInteger(
        value.season
      );

    const sosNumber =
      normalizeInteger(
        value.sosNumber
      );

    const sosName =
      normalizeText(
        value.sosName
      );

    if (
      year <= 0 ||
      season <= 0
    ) {
      return null;
    }

    return {
      year,
      season,
      sosNumber,
      sosName
    };
  }

  function normalizeConfig(
    source,
    options = {}
  ) {
    const defaults =
      createDefaultConfig(options);

    const input =
      isObject(source)
        ? source
        : {};

    const selectedSeason =
      normalizeSelectedSeason(
        input.season
          ?.selectedSeason
      );

    const uploadedWeeks =
      normalizeWeeks(
        input.weeks
          ?.uploaded
      );

    const latestWeek =
      uploadedWeeks.length > 0
        ? uploadedWeeks[
            uploadedWeeks.length - 1
          ]
        : null;

    const seasonActive =
      normalizeBoolean(
        input.season
          ?.active
      );

    const matchmakingReady =
      normalizeBoolean(
        input.matchmaking
          ?.ready
      );

    const participatingServers =
      uniquePositiveIntegers(
        input.season
          ?.participatingServers
      );

    return {
      schemaVersion:
        SCHEMA_VERSION,

      updatedAt:
        normalizeIsoDateTime(
          input.updatedAt
        ) ||
        defaults.updatedAt,

      updatedBy:
        normalizeText(
          input.updatedBy
        ),

      github: {
        repositoryRead:
          normalizeBoolean(
            input.github
              ?.repositoryRead
          ),

        repositoryWrite:
          normalizeBoolean(
            input.github
              ?.repositoryWrite
          ),

        lastCheckedAt:
          normalizeIsoDateTime(
            input.github
              ?.lastCheckedAt
          )
      },

      foundation: {
        ready:
          normalizeBoolean(
            input.foundation
              ?.ready
          ),

        officialDate:
          normalizeOfficialDate(
            input.foundation
              ?.officialDate
          ),

        playerCount:
          normalizeInteger(
            input.foundation
              ?.playerCount
          ),

        updatedAt:
          normalizeIsoDateTime(
            input.foundation
              ?.updatedAt
          )
      },

      matchmaking: {
        ready:
          matchmakingReady,

        seasonNumber:
          normalizeInteger(
            input.matchmaking
              ?.seasonNumber
          ),

        officialDate:
          normalizeOfficialDate(
            input.matchmaking
              ?.officialDate
          ),

        playerCount:
          normalizeInteger(
            input.matchmaking
              ?.playerCount
          ),

        updatedAt:
          normalizeIsoDateTime(
            input.matchmaking
              ?.updatedAt
          )
      },

      season: {
        websiteStatus:
          normalizeText(
            input.season
              ?.websiteStatus
          ) ||
          DEFAULT_WEBSITE_STATUS,

        selectedSeason,

        participatingServers,

        active:
          seasonActive,

        week0Unlocked:
          Boolean(
            seasonActive &&
            matchmakingReady &&
            selectedSeason &&
            participatingServers.length >
              0
          ),

        updatedAt:
          normalizeIsoDateTime(
            input.season
              ?.updatedAt
          )
      },

      weeks: {
        uploaded:
          uploadedWeeks,

        latestWeek,

        ready:
          uploadedWeeks.length >
          0,

        updatedAt:
          normalizeIsoDateTime(
            input.weeks
              ?.updatedAt
          )
      },

      websiteBuild: {
        ready:
          normalizeBoolean(
            input.websiteBuild
              ?.ready
          ),

        lastBuiltAt:
          normalizeIsoDateTime(
            input.websiteBuild
              ?.lastBuiltAt
          )
      },

      archive: {
        ready:
          normalizeBoolean(
            input.archive
              ?.ready
          ),

        archived:
          normalizeBoolean(
            input.archive
              ?.archived
          ),

        seasonNumber:
          normalizeInteger(
            input.archive
              ?.seasonNumber
          ),

        archivedAt:
          normalizeIsoDateTime(
            input.archive
              ?.archivedAt
          )
      }
    };
  }

  /* =====================================================
     UPDATE HELPERS
  ===================================================== */

  function finalizeConfig(
    config,
    options = {}
  ) {
    const normalized =
      normalizeConfig(config);

    normalized.updatedAt =
      normalizeIsoDateTime(
        options.updatedAt
      ) ||
      nowIso();

    if (
      Object.prototype.hasOwnProperty.call(
        options,
        "updatedBy"
      )
    ) {
      normalized.updatedBy =
        normalizeText(
          options.updatedBy
        );
    }

    return normalized;
  }

  function updateGithub(
    currentConfig,
    githubUpdate = {},
    options = {}
  ) {
    const config =
  loadOrCreateConfig(currentConfig);

    config.github = {
      ...config.github,

      repositoryRead:
        Object.prototype.hasOwnProperty.call(
          githubUpdate,
          "repositoryRead"
        )
          ? normalizeBoolean(
              githubUpdate.repositoryRead
            )
          : config.github
              .repositoryRead,

      repositoryWrite:
        Object.prototype.hasOwnProperty.call(
          githubUpdate,
          "repositoryWrite"
        )
          ? normalizeBoolean(
              githubUpdate.repositoryWrite
            )
          : config.github
              .repositoryWrite,

      lastCheckedAt:
        normalizeIsoDateTime(
          githubUpdate.lastCheckedAt
        ) ||
        nowIso()
    };

    return finalizeConfig(
      config,
      options
    );
  }

  function updateFoundation(
    currentConfig,
    foundationUpdate = {},
    options = {}
  ) {
    const config =
  loadOrCreateConfig(currentConfig);

    const ready =
      Object.prototype.hasOwnProperty.call(
        foundationUpdate,
        "ready"
      )
        ? normalizeBoolean(
            foundationUpdate.ready
          )
        : config.foundation.ready;

    config.foundation = {
      ready,

      officialDate:
        normalizeOfficialDate(
          foundationUpdate.officialDate
        ) ||
        config.foundation
          .officialDate,

      playerCount:
        Object.prototype.hasOwnProperty.call(
          foundationUpdate,
          "playerCount"
        )
          ? normalizeInteger(
              foundationUpdate.playerCount
            )
          : config.foundation
              .playerCount,

      updatedAt:
        normalizeIsoDateTime(
          foundationUpdate.updatedAt
        ) ||
        nowIso()
    };

    return finalizeConfig(
      config,
      options
    );
  }

  function updateMatchmaking(
    currentConfig,
    matchmakingUpdate = {},
    options = {}
  ) {
    const config =
  loadOrCreateConfig(currentConfig);

    const ready =
      Object.prototype.hasOwnProperty.call(
        matchmakingUpdate,
        "ready"
      )
        ? normalizeBoolean(
            matchmakingUpdate.ready
          )
        : config.matchmaking.ready;

    config.matchmaking = {
      ready,

      seasonNumber:
        Object.prototype.hasOwnProperty.call(
          matchmakingUpdate,
          "seasonNumber"
        )
          ? normalizeInteger(
              matchmakingUpdate.seasonNumber
            )
          : config.matchmaking
              .seasonNumber,

      officialDate:
        normalizeOfficialDate(
          matchmakingUpdate.officialDate
        ) ||
        config.matchmaking
          .officialDate,

      playerCount:
        Object.prototype.hasOwnProperty.call(
          matchmakingUpdate,
          "playerCount"
        )
          ? normalizeInteger(
              matchmakingUpdate.playerCount
            )
          : config.matchmaking
              .playerCount,

      updatedAt:
        normalizeIsoDateTime(
          matchmakingUpdate.updatedAt
        ) ||
        nowIso()
    };

    if (!ready) {
      config.season.active =
        false;

      config.season.week0Unlocked =
        false;
    }

    return finalizeConfig(
      config,
      options
    );
  }

  function updateSeason(
    currentConfig,
    seasonUpdate = {},
    options = {}
  ) {
    const config =
  loadOrCreateConfig(currentConfig);

    if (
      Object.prototype.hasOwnProperty.call(
        seasonUpdate,
        "websiteStatus"
      )
    ) {
      config.season.websiteStatus =
        normalizeText(
          seasonUpdate.websiteStatus
        ) ||
        DEFAULT_WEBSITE_STATUS;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        seasonUpdate,
        "selectedSeason"
      )
    ) {
      config.season.selectedSeason =
        normalizeSelectedSeason(
          seasonUpdate.selectedSeason
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        seasonUpdate,
        "participatingServers"
      )
    ) {
      config.season
        .participatingServers =
        uniquePositiveIntegers(
          seasonUpdate
            .participatingServers
        );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        seasonUpdate,
        "active"
      )
    ) {
      config.season.active =
        normalizeBoolean(
          seasonUpdate.active
        );
    }

    config.season.week0Unlocked =
      Boolean(
        config.season.active &&
        config.matchmaking.ready &&
        config.season
          .selectedSeason &&
        config.season
          .participatingServers
          .length >
          0
      );

    config.season.updatedAt =
      normalizeIsoDateTime(
        seasonUpdate.updatedAt
      ) ||
      nowIso();

    return finalizeConfig(
      config,
      options
    );
  }

  function updateWeeks(
    currentConfig,
    weeksUpdate = {},
    options = {}
  ) {
    const config =
  loadOrCreateConfig(currentConfig);

    let uploaded =
      normalizeWeeks(
        config.weeks.uploaded
      );

    if (
      Array.isArray(
        weeksUpdate.uploaded
      )
    ) {
      uploaded =
        normalizeWeeks(
          weeksUpdate.uploaded
        );
    }

    const addedWeek =
      normalizeText(
        weeksUpdate.addWeek
      ).toUpperCase();

    if (
      /^W[0-6]$/.test(
        addedWeek
      )
    ) {
      uploaded =
        normalizeWeeks([
          ...uploaded,
          addedWeek
        ]);
    }

    const latestWeek =
      uploaded.length >
        0
        ? uploaded[
            uploaded.length - 1
          ]
        : null;

    config.weeks = {
      uploaded,

      latestWeek,

      ready:
        uploaded.length >
        0,

      updatedAt:
        normalizeIsoDateTime(
          weeksUpdate.updatedAt
        ) ||
        nowIso()
    };

    config.websiteBuild.ready =
      false;

    config.websiteBuild.lastBuiltAt =
      "";

    config.archive.ready =
      false;

    return finalizeConfig(
      config,
      options
    );
  }

  function updateWebsiteBuild(
    currentConfig,
    buildUpdate = {},
    options = {}
  ) {
    const config =
  loadOrCreateConfig(currentConfig);

    config.websiteBuild = {
      ready:
        Object.prototype.hasOwnProperty.call(
          buildUpdate,
          "ready"
        )
          ? normalizeBoolean(
              buildUpdate.ready
            )
          : true,

      lastBuiltAt:
        normalizeIsoDateTime(
          buildUpdate.lastBuiltAt
        ) ||
        nowIso()
    };

    config.archive.ready =
      Boolean(
        config.websiteBuild.ready &&
        config.weeks.ready
      );

    return finalizeConfig(
      config,
      options
    );
  }

  function updateArchive(
    currentConfig,
    archiveUpdate = {},
    options = {}
  ) {
    const config =
  loadOrCreateConfig(currentConfig);

    config.archive = {
      ready:
        Object.prototype.hasOwnProperty.call(
          archiveUpdate,
          "ready"
        )
          ? normalizeBoolean(
              archiveUpdate.ready
            )
          : config.archive.ready,

      archived:
        Object.prototype.hasOwnProperty.call(
          archiveUpdate,
          "archived"
        )
          ? normalizeBoolean(
              archiveUpdate.archived
            )
          : config.archive.archived,

      seasonNumber:
        Object.prototype.hasOwnProperty.call(
          archiveUpdate,
          "seasonNumber"
        )
          ? normalizeInteger(
              archiveUpdate.seasonNumber
            )
          : config.archive
              .seasonNumber,

      archivedAt:
        normalizeIsoDateTime(
          archiveUpdate.archivedAt
        ) ||
        (
          archiveUpdate.archived === true
            ? nowIso()
            : config.archive
                .archivedAt
        )
    };

    return finalizeConfig(
      config,
      options
    );
  }

  /* =====================================================
     SEASON ARCHIVE RESET

     Permanent:
     - GitHub status
     - Foundation status

     Reset:
     - Matchmaking
     - Season configuration
     - Participating servers
     - Season activation
     - W0-W6 status
     - Website build
     - Archive workflow

     New workflow starts at step 3:
     Matchmaking
  ===================================================== */

  function resetAfterSeasonArchive(
    currentConfig,
    archiveDetails = {},
    options = {}
  ) {
    const current =
  loadOrCreateConfig(currentConfig);

    const archivedSeasonNumber =
      normalizeInteger(
        archiveDetails.seasonNumber ||
        current.season
          .selectedSeason
          ?.season ||
        current.matchmaking
          .seasonNumber
      );

    const archivedAt =
      normalizeIsoDateTime(
        archiveDetails.archivedAt
      ) ||
      nowIso();

    const nextConfig =
      createDefaultConfig({
        updatedAt:
          archivedAt,

        updatedBy:
          options.updatedBy
      });

    nextConfig.github =
      clone(
        current.github
      );

    nextConfig.foundation =
      clone(
        current.foundation
      );

    nextConfig.season.websiteStatus =
      normalizeText(
        archiveDetails.websiteStatus
      ) ||
      DEFAULT_WEBSITE_STATUS;

    nextConfig.archive = {
      ready:
        false,

      archived:
        true,

      seasonNumber:
        archivedSeasonNumber,

      archivedAt
    };

    return finalizeConfig(
      nextConfig,
      {
        ...options,

        updatedAt:
          archivedAt
      }
    );
  }

  /* =====================================================
     FILE OUTPUT
  ===================================================== */

  function buildFile(
    config,
    options = {}
  ) {
    const normalized =
      finalizeConfig(
        config,
        options
      );

    return {
      path:
        CONFIG_PATH,

      data:
        normalized,

      files: {
        [CONFIG_PATH]:
          normalized
      }
    };
  }

  function buildDefaultFile(
    options = {}
  ) {
    return buildFile(
      createDefaultConfig(
        options
      ),
      options
    );
  }

function loadOrCreateConfig(existingConfig = null) {
  if (
    existingConfig &&
    typeof existingConfig === "object"
  ) {
    return normalizeConfig(existingConfig);
  }

  return createDefaultConfig();
}

  /* =====================================================
     VALIDATION
  ===================================================== */

  function validate(config) {
    const normalized =
      normalizeConfig(config);

    const errors =
      [];

    if (
      normalized.foundation.ready &&
      normalized.foundation
        .playerCount <=
        0
    ) {
      errors.push(
        "Foundation is ready but contains no players."
      );
    }

    if (
      normalized.matchmaking.ready &&
      normalized.matchmaking
        .seasonNumber <=
        0
    ) {
      errors.push(
        "Matchmaking is ready but has no valid Season number."
      );
    }

    if (
      normalized.season.active &&
      !normalized.matchmaking.ready
    ) {
      errors.push(
        "Season cannot be active before Matchmaking is ready."
      );
    }

    if (
      normalized.season.active &&
      !normalized.season
        .selectedSeason
    ) {
      errors.push(
        "Season cannot be active without a selected Season."
      );
    }

    if (
      normalized.season.active &&
      normalized.season
        .participatingServers
        .length ===
        0
    ) {
      errors.push(
        "Season cannot be active without participating servers."
      );
    }

    return {
      valid:
        errors.length ===
        0,

      errors,

      config:
        normalized
    };
  }

  /* =====================================================
     PUBLIC API
  ===================================================== */

  const publicApi =
    Object.freeze({
      name:
        ENGINE_NAME,

      version:
        ENGINE_VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      configPath:
        CONFIG_PATH,

      createDefaultConfig,

      normalize:
        normalizeConfig,

      validate,

      updateGithub,

      updateFoundation,

      updateMatchmaking,

      updateSeason,

      updateWeeks,

      updateWebsiteBuild,

      updateArchive,

      resetAfterSeasonArchive,

      buildFile,

      buildDefaultFile
    });

  global.K630AdminConfigEngine =
    publicApi;
})(window);