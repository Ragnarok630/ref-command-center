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

  const ARCHIVES_ROOT =
    "assets/data/archives";

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
      Math.trunc(Number(seasonNumber) || 1)
    );

  }

  function seasonFolder(
    seasonNumber
  ) {

    return (
      `${ARCHIVES_ROOT}/season-${normalizeSeasonNumber(seasonNumber)}`
    );

  }

  async function save(
    options = {}
  ) {

    throw new Error(
      "Save Season engine is not implemented yet."
    );

  }

  async function archiveSeason(
    options = {}
  ) {

    throw new Error(
      "archiveSeason() is not implemented yet."
    );

  }

  async function updateActiveAverage(
    options = {}
  ) {

    throw new Error(
      "updateActiveAverage() is not implemented yet."
    );

  }

  async function updateServerStatus(
    options = {}
  ) {

    throw new Error(
      "updateServerStatus() is not implemented yet."
    );

  }

  async function updateOldPlayers(
    options = {}
  ) {

    throw new Error(
      "updateOldPlayers() is not implemented yet."
    );

  }

  async function rebuildHome(
    options = {}
  ) {

    throw new Error(
      "rebuildHome() is not implemented yet."
    );

  }

  async function buildArchiveIndex(
    options = {}
  ) {

    throw new Error(
      "buildArchiveIndex() is not implemented yet."
    );

  }

  async function resetSeason(
    options = {}
  ) {

    throw new Error(
      "resetSeason() is not implemented yet."
    );

  }

  window[ENGINE_NAME] = {

    save,

    archiveSeason,

    updateActiveAverage,

    updateServerStatus,

    updateOldPlayers,

    rebuildHome,

    buildArchiveIndex,

    resetSeason

  };

})();