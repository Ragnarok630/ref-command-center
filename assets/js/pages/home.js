/* =========================================================
   K630-REF HOME PAGE CONTROLLER
   File: assets/js/pages/home.js
   Version: 630.1.0

   Responsibilities:
   - Load generated Home data from k630-public-data
   - Fill the Home dashboard statistics
   - Handle empty Foundation rankings
   - Handle empty Foundation charts
   - Work with dynamically loaded pages/home.html
   - Never use localStorage or IndexedDB
========================================================= */

(function initializeK630HomePage(global) {
  "use strict";

  const MODULE_NAME =
    "K630 Home Page";

  const MODULE_VERSION =
    "630.1.0";

  const HOME_DATA_URL =
    (
      "https://raw.githubusercontent.com/" +
      "Ragnarok630/k630-public-data/main/" +
      "assets/data/generated/home/current.json"
    );

  let activeRequestId =
    0;

  let serverPowerChart =
    null;

  let serverMeritsChart =
    null;

  /* =====================================================
     GENERAL HELPERS
  ===================================================== */

  function normalizeText(value) {
    return String(
      value ?? ""
    ).trim();
  }

  function numberValue(value) {
    const parsed =
      Number(value ?? 0);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function integerValue(value) {
    return Math.trunc(
      numberValue(value)
    );
  }

  function getElement(id) {
    return document.getElementById(
      id
    );
  }

  function setText(
    id,
    value
  ) {
    const element =
      getElement(id);

    if (!element) {
      return;
    }

    element.textContent =
      normalizeText(value);
  }

  function formatNumber(value) {
    return integerValue(value)
      .toLocaleString(
        "en-US"
      );
  }

function formatCompactNumber(value) {
  const number =
    integerValue(value);

  if (number >= 1000000000) {
    return {
      value:
        (number / 1000000000)
          .toFixed(2)
          .replace(
            /\.00$/,
            ""
          )
          .replace(
            /(\.\d)0$/,
            "$1"
          ),

      unit:
        "B"
    };
  }

  if (number >= 1000000) {
    return {
      value:
        (number / 1000000)
          .toFixed(2)
          .replace(
            /\.00$/,
            ""
          )
          .replace(
            /(\.\d)0$/,
            "$1"
          ),

      unit:
        "M"
    };
  }

  if (number >= 1000) {
    return {
      value:
        (number / 1000)
          .toFixed(1)
          .replace(
            /\.0$/,
            ""
          ),

      unit:
        "K"
    };
  }

  return {
    value:
      formatNumber(
        number
      ),

    unit:
      ""
  };
}

  function escapeHtml(value) {
    return normalizeText(value)
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );
  }

  function createCacheBustedUrl(
    url
  ) {
    const separator =
      url.includes("?")
        ? "&"
        : "?";

    return (
      `${url}${separator}` +
      `t=${Date.now()}`
    );
  }

  function isHomePagePresent() {
    return Boolean(
      getElement(
        "homePage"
      )
    );
  }

  /* =====================================================
     DATA LOADING
  ===================================================== */

  async function fetchHomeData() {
    const response =
      await fetch(
        createCacheBustedUrl(
          HOME_DATA_URL
        ),
        {
          method:
            "GET",

          cache:
            "no-store",

          headers: {
            Accept:
              "application/json"
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        (
          "Home data could not be loaded. " +
          `HTTP ${response.status}.`
        )
      );
    }

    const data =
      await response.json();

    if (
      !data ||
      typeof data !==
        "object"
    ) {
      throw new Error(
        "Home data has an invalid format."
      );
    }

    if (
      data.dataset !==
      "home"
    ) {
      throw new Error(
        "The loaded JSON is not a Home dataset."
      );
    }

    return data;
  }

  /* =====================================================
     CONTEXT BAR
  ===================================================== */

  function renderContext(data) {
    const kingdom =
      integerValue(
        data.kingdom
      ) || 630;

    setText(
      "homeKingdomLabel",
      `${kingdom} - Bloodsoaked Battle`
    );

    const currentSeason =
      data.currentSeason;

    if (
      currentSeason ===
        null ||
      currentSeason ===
        undefined ||
      currentSeason ===
        ""
    ) {
      setText(
        "homeSeasonLabel",
        "Season Not Set"
      );

      setText(
        "homeSeasonNameLabel",
        "No active season"
      );

      setText(
        "homePowerChartSeason",
        "Foundation"
      );

      setText(
        "homeMeritsChartSeason",
        "Foundation"
      );

      setText(
        "homeTopIdSeasonBadge",
        "Foundation"
      );

      setText(
        "homeTopServerSeasonBadge",
        "Foundation"
      );

      return;
    }

    const seasonLabel =
      `Season ${currentSeason}`;

    setText(
      "homeSeasonLabel",
      seasonLabel
    );

    setText(
      "homeSeasonNameLabel",
      data.seasonName ||
      "Current season"
    );

    setText(
      "homePowerChartSeason",
      seasonLabel
    );

    setText(
      "homeMeritsChartSeason",
      seasonLabel
    );

    setText(
      "homeTopIdSeasonBadge",
      seasonLabel
    );

    setText(
      "homeTopServerSeasonBadge",
      seasonLabel
    );
  }

  /* =====================================================
     STATISTICS
  ===================================================== */

  function renderTotals(data) {
  const totals =
    (
      data.totals &&
      typeof data.totals ===
        "object"
    )
      ? data.totals
      : {};

  setText(
    "homeTotalWarriors",
    formatNumber(
      totals.warriors
    )
  );

  setText(
    "homeTotalFarmers",
    formatNumber(
      totals.farmers
    )
  );

  const totalPower =
    getElement(
      "homeTotalPower"
    );

  if (totalPower) {
    totalPower.innerHTML =
      `
        <span class="compact-number-value">
          ${escapeHtml(
            formatCompactNumber(
              totals.serverPower
            ).value
          )}
        </span>
        <span class="compact-unit">
          ${escapeHtml(
            formatCompactNumber(
              totals.serverPower
            ).unit
          )}
        </span>
      `;
  }

  const totalMerits =
    getElement(
      "homeTotalMerits"
    );

  if (totalMerits) {
    totalMerits.innerHTML =
      `
        <span class="compact-number-value">
          ${escapeHtml(
            formatCompactNumber(
              totals.serverMerits
            ).value
          )}
        </span>
        <span class="compact-unit">
          ${escapeHtml(
            formatCompactNumber(
              totals.serverMerits
            ).unit
          )}
        </span>
      `;
  }

  const totalKills =
    getElement(
      "homeTotalKills"
    );

  if (totalKills) {
    totalKills.innerHTML =
      `
        <span class="compact-number-value">
          ${escapeHtml(
            formatCompactNumber(
              totals.serverKills
            ).value
          )}
        </span>
        <span class="compact-unit">
          ${escapeHtml(
            formatCompactNumber(
              totals.serverKills
            ).unit
          )}
        </span>
      `;
  }

  const totalHealing =
    getElement(
      "homeTotalHealing"
    );

  if (totalHealing) {
    totalHealing.innerHTML =
      `
        <span class="compact-number-value">
          ${escapeHtml(
            formatCompactNumber(
              totals.serverHealing
            ).value
          )}
        </span>
        <span class="compact-unit">
          ${escapeHtml(
            formatCompactNumber(
              totals.serverHealing
            ).unit
          )}
        </span>
      `;
  }
}

  /* =====================================================
     TOP PLAYER MERITS
  ===================================================== */

  function getRankClass(index) {
    if (index === 0) {
      return "gold-rank";
    }

    if (index === 1) {
      return "silver-rank";
    }

    if (index === 2) {
      return "bronze-rank";
    }

    return "";
  }

  function renderEmptyPlayerRanking(
    body
  ) {
    body.innerHTML =
      `
        <tr>
          <td
            colspan="5"
            class="text-center"
          >
            No player merit data available until Matchmaking or Season data is processed.
          </td>
        </tr>
      `;
  }

  function renderPlayerRanking(data) {
    const body =
      getElement(
        "homeTopIdMeritsBody"
      );

    if (!body) {
      return;
    }

    const rankings =
      Array.isArray(
        data?.playerRanking
          ?.topIdMerits
      )
        ? data.playerRanking
            .topIdMerits
        : [];

    if (
      rankings.length ===
      0
    ) {
      renderEmptyPlayerRanking(
        body
      );

      return;
    }

    body.innerHTML =
      rankings
        .slice(0, 5)
        .map(
          (
            entry,
            index
          ) => {
            const rank =
              integerValue(
                entry.rank
              ) ||
              index + 1;

            const id =
              escapeHtml(
                entry.id ||
                entry.playerId ||
                entry.lordId
              );

            const playerName =
              escapeHtml(
                entry.name ||
                entry.playerName ||
                entry.nickname ||
                "-"
              );

            const kingdom =
              integerValue(
                entry.kingdom
              ) || 630;

            const merits =
              formatNumber(
                entry.merits
              );

            const topRankClass =
              index < 3
                ? "top-rank"
                : "";

            const rankClass =
              getRankClass(
                index
              );

            return `
              <tr class="${topRankClass}">
                <td>
                  <span class="rank-badge ${rankClass}">
                    ${rank}
                  </span>
                </td>

                <td>
                  ${id || "-"}
                </td>

                <td>
                 ${playerName}
                </td>

                <td>
                  ${kingdom}
                </td>

                <td class="text-end merit-value">
                  ${merits}
                </td>
              </tr>
            `;
          }
        )
        .join("");
  }

  /* =====================================================
     TOP SERVER MERITS
  ===================================================== */

  function renderEmptyServerRanking(
    body
  ) {
    body.innerHTML =
      `
        <tr>
          <td
            colspan="3"
            class="text-center"
          >
            No server merit ranking available until Season data is processed.
          </td>
        </tr>
      `;
  }

  function renderServerRanking(data) {
    const body =
      getElement(
        "homeTopServerMeritsBody"
      );

    if (!body) {
      return;
    }

    const rankings =
      Array.isArray(
        data?.serverRanking
          ?.topServerMerits
      )
        ? data.serverRanking
            .topServerMerits
        : [];

    if (
      rankings.length ===
      0
    ) {
      renderEmptyServerRanking(
        body
      );

      return;
    }

    body.innerHTML =
      rankings
        .slice(0, 5)
        .map(
          (
            entry,
            index
          ) => {
            const rank =
              integerValue(
                entry.rank
              ) ||
              index + 1;

            const kingdom =
              integerValue(
                entry.kingdom ||
                entry.server
              );

            const merits =
              formatNumber(
                entry.merits
              );

            const topRankClass =
              index < 3
                ? "top-rank"
                : "";

            const rankClass =
              getRankClass(
                index
              );

            const kingdomContent =
              kingdom === 630
                ? `
                    <span class="home-kingdom-630">
                      <i
                        class="fa-solid fa-crown"
                        aria-hidden="true"
                      ></i>

                      630
                    </span>
                  `
                : escapeHtml(
                    kingdom
                  );

            return `
              <tr class="${topRankClass}">
                <td>
                  <span class="rank-badge ${rankClass}">
                    ${rank}
                  </span>
                </td>

                <td>
                  ${kingdomContent}
                </td>

                <td class="text-end merit-value">
                  ${merits}
                </td>
              </tr>
            `;
          }
        )
        .join("");
  }

  /* =====================================================
     CHARTS
  ===================================================== */

  function destroyChart(
    chart
  ) {
    if (
      chart &&
      typeof chart.destroy ===
        "function"
    ) {
      chart.destroy();
    }

    return null;
  }

  function renderChartUnavailable(
    canvasId,
    message
  ) {
    const canvas =
      getElement(
        canvasId
      );

    if (!canvas) {
      return;
    }

    const container =
      canvas.parentElement;

    if (!container) {
      return;
    }

    const existingMessage =
      container.querySelector(
        ".home-chart-empty-message"
      );

    if (existingMessage) {
      existingMessage.remove();
    }

    canvas.hidden =
      true;

    const emptyMessage =
      document.createElement(
        "div"
      );

    emptyMessage.className =
      "home-chart-empty-message";

    emptyMessage.textContent =
      message;

    container.appendChild(
      emptyMessage
    );
  }

  function restoreChartCanvas(
    canvasId
  ) {
    const canvas =
      getElement(
        canvasId
      );

    if (!canvas) {
      return null;
    }

    const container =
      canvas.parentElement;

    const existingMessage =
      container?.querySelector(
        ".home-chart-empty-message"
      );

    if (existingMessage) {
      existingMessage.remove();
    }

    canvas.hidden =
      false;

    return canvas;
  }

  function createChart(
    canvas,
    chartData,
    label
  ) {
    if (
      !global.Chart ||
      !canvas
    ) {
      return null;
    }

    const labels =
      Array.isArray(
        chartData.labels
      )
        ? chartData.labels
        : [];

    const datasets =
      Array.isArray(
        chartData.datasets
      )
        ? chartData.datasets
        : [];

    return new global.Chart(
      canvas,
      {
        type:
          "line",

        data: {
          labels,

          datasets:
            datasets.map(
              dataset => ({
                label:
                  normalizeText(
                    dataset.label
                  ) ||
                  label,

                data:
                  Array.isArray(
                    dataset.data
                  )
                    ? dataset.data
                    : [],

                borderWidth:
                  2,

                tension:
                  0.25,

                fill:
                  false
              })
            )
        },

        options: {
          responsive:
            true,

          maintainAspectRatio:
            false,

          interaction: {
            mode:
              "index",

            intersect:
              false
          },

          plugins: {
            legend: {
              display:
                true
            }
          },

          scales: {
            y: {
              beginAtZero:
                true,

              ticks: {
                callback(value) {
                  return Number(value)
                    .toLocaleString(
                      "en-US"
                    );
                }
              }
            }
          }
        }
      }
    );
  }

  function renderCharts(data) {
    serverPowerChart =
      destroyChart(
        serverPowerChart
      );

    serverMeritsChart =
      destroyChart(
        serverMeritsChart
      );

    const powerData =
      data?.charts
        ?.powerDevelopment;

    const meritsData =
      data?.charts
        ?.meritsDevelopment;

    const powerAvailable =
      Boolean(
        powerData?.active &&
        Array.isArray(
          powerData.labels
        ) &&
        powerData.labels.length >
          0 &&
        Array.isArray(
          powerData.datasets
        ) &&
        powerData.datasets.length >
          0
      );

    const meritsAvailable =
      Boolean(
        meritsData?.active &&
        Array.isArray(
          meritsData.labels
        ) &&
        meritsData.labels.length >
          0 &&
        Array.isArray(
          meritsData.datasets
        ) &&
        meritsData.datasets.length >
          0
      );

    if (!powerAvailable) {
      renderChartUnavailable(
        "serverPowerChart",
        "Power development becomes available after Week 0 is processed."
      );
    } else {
      const canvas =
        restoreChartCanvas(
          "serverPowerChart"
        );

      serverPowerChart =
        createChart(
          canvas,
          powerData,
          "Server Power"
        );
    }

    if (!meritsAvailable) {
      renderChartUnavailable(
        "serverMeritsChart",
        "Merit development becomes available after Week 0 is processed."
      );
    } else {
      const canvas =
        restoreChartCanvas(
          "serverMeritsChart"
        );

      serverMeritsChart =
        createChart(
          canvas,
          meritsData,
          "Server Merits"
        );
    }
  }

  /* =====================================================
     ERROR STATE
  ===================================================== */

  function renderError(error) {
    console.error(
      `[${MODULE_NAME}]`,
      error
    );

    setText(
      "homeTotalWarriors",
      "0"
    );

    setText(
      "homeTotalFarmers",
      "0"
    );

    setText(
      "homeTotalPower",
      "0"
    );

    setText(
      "homeTotalMerits",
      "0"
    );

    setText(
      "homeTotalKills",
      "0"
    );

    setText(
      "homeTotalHealing",
      "0"
    );

    const playerBody =
      getElement(
        "homeTopIdMeritsBody"
      );

    if (playerBody) {
      playerBody.innerHTML =
        `
          <tr>
            <td
              colspan="5"
              class="text-center"
            >
              Home data could not be loaded.
            </td>
          </tr>
        `;
    }

    const serverBody =
      getElement(
        "homeTopServerMeritsBody"
      );

    if (serverBody) {
      serverBody.innerHTML =
        `
          <tr>
            <td
              colspan="3"
              class="text-center"
            >
              Home data could not be loaded.
            </td>
          </tr>
        `;
    }

    renderChartUnavailable(
      "serverPowerChart",
      "Home chart data could not be loaded."
    );

    renderChartUnavailable(
      "serverMeritsChart",
      "Home chart data could not be loaded."
    );
  }

  /* =====================================================
     MAIN RENDER
  ===================================================== */

  function renderHome(data) {
    if (!isHomePagePresent()) {
      return;
    }

    renderContext(
      data
    );

    renderTotals(
      data
    );

    renderPlayerRanking(
      data
    );

    renderServerRanking(
      data
    );

    renderCharts(
      data
    );

    document.dispatchEvent(
      new CustomEvent(
        "k630:home-rendered",
        {
          detail: {
            generatedAt:
              data.generatedAt ||
              null,

            totals:
              data.totals ||
              {}
          }
        }
      )
    );
  }

  async function loadHome() {
    if (!isHomePagePresent()) {
      return;
    }

    const requestId =
      ++activeRequestId;

    try {
      const data =
        await fetchHomeData();

      if (
        requestId !==
        activeRequestId
      ) {
        return;
      }

      if (!isHomePagePresent()) {
        return;
      }

      renderHome(
        data
      );
    } catch (error) {
      if (
        requestId !==
        activeRequestId
      ) {
        return;
      }

      renderError(
        error
      );
    }
  }

  /* =====================================================
     DYNAMIC PAGE DETECTION
  ===================================================== */

  function scheduleHomeLoad() {
    global.setTimeout(
      () => {
        if (
          isHomePagePresent()
        ) {
          loadHome();
        }
      },
      0
    );
  }

  function startObserver() {
  const observer =
    new MutationObserver(
      mutations => {
        const homePageAdded =
          mutations.some(
            mutation => {
              return Array.from(
                mutation.addedNodes
              ).some(node => {
                if (
                  !(node instanceof Element)
                ) {
                  return false;
                }

                return (
                  node.id === "homePage" ||
                  Boolean(
                    node.querySelector(
                      "#homePage"
                    )
                  )
                );
              });
            }
          );

        if (!homePageAdded) {
          return;
        }

        scheduleHomeLoad();
      }
    );

  observer.observe(
    document.body,
    {
      childList:
        true,

      subtree:
        true
    }
  );
}

  function initialize() {
    startObserver();

    if (
      document.readyState ===
      "loading"
    ) {
      document.addEventListener(
        "DOMContentLoaded",
        scheduleHomeLoad,
        {
          once:
            true
        }
      );
    } else {
      scheduleHomeLoad();
    }

    document.addEventListener(
      "k630:page-loaded",
      scheduleHomeLoad
    );

    global.addEventListener(
      "hashchange",
      scheduleHomeLoad
    );

    global.addEventListener(
      "popstate",
      scheduleHomeLoad
    );
  }

  /* =====================================================
     PUBLIC API
  ===================================================== */

  global.K630HomePage =
    Object.freeze({
      name:
        MODULE_NAME,

      version:
        MODULE_VERSION,

      load:
        loadHome,

      refresh:
        loadHome,

      dataUrl:
        HOME_DATA_URL
    });

  initialize();

  console.info(
    `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
  );
})(window);