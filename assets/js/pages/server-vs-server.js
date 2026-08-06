/* =========================================================
   K630-REF SERVER VS SERVER PAGE CONTROLLER

   File:
   assets/js/pages/server-vs-server.js

   Version:
   630.1.0 Gold Master

   Responsibilities:
   - Load generated Server vs Server data
   - Render summary, rankings and charts
   - Support dynamic page loading
   - Expose K630ServerVsServerPage.init()
========================================================= */

(function initializeK630ServerVsServerPage(global) {
  "use strict";

  const MODULE_NAME =
    "K630 Server vs Server Page";

  const MODULE_VERSION =
    "630.1.0";

  const DATA_URL =
    (
      "https://raw.githubusercontent.com/" +
      "Ragnarok630/k630-public-data/main/" +
      "assets/data/generated/server-vs-server/current.json"
    );

  const HOME_SERVER =
    630;

  const GROUP_STORAGE_KEY =
   "k630_server_vs_server_groups_v1";

  const SERVER_COLOURS =
  Object.freeze([
    "#00E5FF",
    "#FF3D71",
    "#FF8A00",
    "#FFE600",
    "#00D68F",
    "#A855F7",
    "#FFFFFF",
    "#00B8FF",
    "#FF1744",
    "#FF6D00",
    "#C6FF00",
    "#7C4DFF",
    "#00FFB3",
    "#FF6B9A",
    "#2979FF",
    "#FF4081",
    "#FFAB00",
    "#B388FF",
    "#18FFFF",
    "#76FF03"
  ]);

  const GROUP_DEFINITIONS =
   Object.freeze([
    {
      id:
        "A",

      colour:
        "#ff405c"
    },

    {
      id:
        "B",

      colour:
        "#318cff"
    },

    {
      id:
        "C",

      colour:
        "#24c980"
    },

    {
      id:
        "D",

      colour:
        "#f4c430"
    },

    {
      id:
        "E",

      colour:
        "#b35cff"
    },

    {
      id:
        "F",

      colour:
        "#ff8a24"
    }
  ]);

  let currentDataset =
    null;

  let serverGroups =
    loadServerGroups();

  let initialized =
    false;

  let hiddenServers =
    new Set();

  let activeRequestId =
    0;

  let powerChart =
    null;

  let meritsChart =
    null;

  let killsChart =
    null;

  let healingChart =
    null;

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

function getServerColour(
  serverNumber,
  servers = []
) {
  const index =
    Math.max(
      0,
      servers.findIndex(server => {
        return (
          integerValue(
            server?.serverNumber
          ) ===
          integerValue(
            serverNumber
          )
        );
      })
    );

  return SERVER_COLOURS[
    index %
    SERVER_COLOURS.length
  ];
}

function createEmptyGroups() {
  return {
    A: [],
    B: [],
    C: [],
    D: [],
    E: [],
    F: []
  };
}

function normalizeServerGroups(value) {
  const source =
    value &&
    typeof value ===
      "object"
      ? value
      : {};

  const output =
    createEmptyGroups();

  GROUP_DEFINITIONS.forEach(group => {
    const servers =
      Array.isArray(
        source[group.id]
      )
        ? source[group.id]
        : [];

    output[group.id] =
      [
        ...new Set(
          servers
            .map(integerValue)
            .filter(
              server =>
                server > 0
            )
        )
      ];
  });

  return output;
}

function loadServerGroups() {
  try {
    const saved =
      localStorage.getItem(
        GROUP_STORAGE_KEY
      );

    return normalizeServerGroups(
      saved
        ? JSON.parse(saved)
        : {}
    );
  } catch (error) {
    console.warn(
      "[Server vs Server] Could not load groups.",
      error
    );

    return createEmptyGroups();
  }
}

function saveServerGroups() {
  localStorage.setItem(
    GROUP_STORAGE_KEY,
    JSON.stringify(
      serverGroups
    )
  );
}

function clearServerGroups() {
  serverGroups =
    createEmptyGroups();

  localStorage.removeItem(
    GROUP_STORAGE_KEY
  );

  if (currentDataset) {
    renderLegend(
      currentDataset
    );

    renderGroupManager(
      currentDataset
    );

    renderCharts(
      currentDataset
    );
  }
}

function removeServerFromGroups(
  serverNumber
) {
  GROUP_DEFINITIONS.forEach(group => {
    serverGroups[group.id] =
      serverGroups[group.id]
        .filter(server => {
          return (
            integerValue(server) !==
            integerValue(serverNumber)
          );
        });
  });
}

function moveServerToGroup(
  serverNumber,
  groupId
) {
  const normalizedServer =
    integerValue(
      serverNumber
    );

  if (
    normalizedServer <= 0 ||
    !GROUP_DEFINITIONS.some(
      group =>
        group.id ===
        groupId
    )
  ) {
    return;
  }

  removeServerFromGroups(
    normalizedServer
  );

  serverGroups[groupId].push(
    normalizedServer
  );

  serverGroups =
    normalizeServerGroups(
      serverGroups
    );

  saveServerGroups();

  if (currentDataset) {
    renderLegend(
      currentDataset
    );

    renderGroupManager(
      currentDataset
    );

    renderCharts(
      currentDataset
    );
  }
}

function hasActiveGroups() {
  return GROUP_DEFINITIONS.some(
    group =>
      serverGroups[group.id]
        .length >
      0
  );
}

function getGroupedServerNumbers() {
  return new Set(
    GROUP_DEFINITIONS.flatMap(
      group =>
        serverGroups[group.id]
    )
  );
}

function sumNullableValues(
  values
) {
  const available =
    values.filter(value => {
      return (
        value !== null &&
        value !== undefined &&
        Number.isFinite(
          Number(value)
        )
      );
    });

  if (
    available.length ===
    0
  ) {
    return null;
  }

  return available.reduce(
    (
      total,
      value
    ) =>
      total +
      Number(value),
    0
  );
}

function getServerSeries(
  server,
  metric
) {
  const series =
    server?.series?.[metric];

  return Array.isArray(series)
    ? [
        ...series
      ]
    : [
        null,
        null,
        null,
        null,
        null,
        null,
        null
      ];
}

function buildGroupedDatasets(
  data,
  metric
) {
  const servers =
    Array.isArray(
      data?.servers
    )
      ? data.servers
      : [];

  return GROUP_DEFINITIONS
    .map(group => {
      const groupServers =
        servers.filter(server => {
          return serverGroups[
            group.id
          ].includes(
            integerValue(
              server.serverNumber
            )
          );
        });

      if (
        groupServers.length ===
        0
      ) {
        return null;
      }

      const values =
        Array.from(
          {
            length:
              7
          },
          (
            _,
            weekIndex
          ) => {
            return sumNullableValues(
              groupServers.map(
                server =>
                  getServerSeries(
                    server,
                    metric
                  )[weekIndex]
              )
            );
          }
        );

      return {
        label:
          `Group ${group.id}`,

        data:
          values,

        borderColor:
          group.colour,

        backgroundColor:
          group.colour,

        pointBackgroundColor:
          group.colour,

        pointBorderColor:
          group.colour,

        borderWidth:
          3,

        pointRadius:
          4,

        tension:
          0.25,

        fill:
          false,

        spanGaps:
          false,

        groupId:
          group.id
      };
    })
    .filter(Boolean);
}

function buildNormalDatasets(
  data,
  metric
) {
  const servers =
    Array.isArray(
      data?.servers
    )
      ? data.servers
      : [];

  return servers
    .filter(server => {
      const serverNumber =
        integerValue(
          server.serverNumber
        );

      return !hiddenServers.has(
        serverNumber
      );
    })
    .map(server => {
      const serverNumber =
        integerValue(
          server.serverNumber
        );

      const colour =
        getServerColour(
          serverNumber,
          servers
        );

      return {
        label:
          String(
            serverNumber
          ),

        data:
          getServerSeries(
            server,
            metric
          ),

        borderColor:
          colour,

        backgroundColor:
          colour,

        pointBackgroundColor:
          colour,

        pointBorderColor:
          colour,

        borderWidth:
          serverNumber ===
          HOME_SERVER
            ? 4
            : 2,

        pointRadius:
          serverNumber ===
          HOME_SERVER
            ? 5
            : 3,

        tension:
          0.25,

        fill:
          false,

        spanGaps:
          false,

        serverNumber
      };
    });
}

  function getElement(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return normalizeText(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value) {
    return integerValue(value)
      .toLocaleString("en-US");
  }

  function createCacheBustedUrl(url) {
    const separator =
      url.includes("?")
        ? "&"
        : "?";

    return (
      `${url}${separator}` +
      `t=${Date.now()}`
    );
  }

  function isPagePresent() {
    return Boolean(
      getElement(
        "serverVsServerPage"
      )
    );
  }

  async function fetchData() {
    const response =
      await fetch(
        createCacheBustedUrl(
          DATA_URL
        ),
        {
          method:
            "GET",

          cache:
            "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        (
          "Server vs Server data could not be loaded. " +
          `HTTP ${response.status}.`
        )
      );
    }

    const data =
      await response.json();

    if (
      !data ||
      typeof data !==
        "object" ||
      data.dataset !==
        "server-vs-server"
    ) {
      throw new Error(
        "The loaded JSON is not a Server vs Server dataset."
      );
    }

    return data;
  }

  function setText(
    id,
    value
  ) {
    const element =
      getElement(id);

    if (element) {
      element.textContent =
        normalizeText(value);
    }
  }

  function destroyChart(chart) {
    if (
      chart &&
      typeof chart.destroy ===
        "function"
    ) {
      chart.destroy();
    }

    return null;
  }

  function getChartCanvas(id) {
    const canvas =
      getElement(id);

    return canvas instanceof
      HTMLCanvasElement
        ? canvas
        : null;
  }

  function createChart(
  canvas,
  chartData,
  fallbackLabel,
  metric
) {
  if (
    !canvas ||
    !global.Chart
  ) {
    return null;
  }

  const labels =
    Array.isArray(
      chartData?.labels
    )
      ? chartData.labels
      : [
          "W0",
          "W1",
          "W2",
          "W3",
          "W4",
          "W5",
          "W6"
        ];

  const datasets =
    hasActiveGroups()
      ? buildGroupedDatasets(
          currentDataset,
          metric
        )
      : buildNormalDatasets(
          currentDataset,
          metric
        );

  return new global.Chart(
    canvas,
    {
      type:
        "line",

      data: {
        labels,
        datasets
      },

      options: {
        responsive:
          true,

        maintainAspectRatio:
          false,

        animation:
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
              false
          }
        },

        scales: {
          x: {
            ticks: {
              color:
                "#8f8a99"
            },

            grid: {
              color:
                "rgba(255, 255, 255, 0.05)"
            }
          },

          y: {
            beginAtZero:
              true,

            ticks: {
              color:
                "#8f8a99",

              callback(value) {
                return Number(value)
                  .toLocaleString(
                    "en-US"
                  );
              }
            },

            grid: {
              color:
                "rgba(255, 255, 255, 0.05)"
            }
          }
        }
      }
    }
  );
}

  function renderSummary(data) {
  const season =
    data?.season ||
    {};

  const servers =
    Array.isArray(
      data?.participatingServers
    )
      ? data.participatingServers
      : [];

  const availableWeeks =
    Array.isArray(
      season.availableWeeks
    )
      ? season.availableWeeks
      : [];

  setText(
    "svsSummarySeason",
    season.number
      ? `Season ${season.number}`
      : "-"
  );

  setText(
    "svsSummarySeasonMeta",
    season.currentWeek
      ? `Current week: ${season.currentWeek}`
      : "No active week"
  );

  setText(
    "svsSummaryServers",
    servers.length
  );

  setText(
    "svsSummaryWeeks",
    availableWeeks.length > 0
      ? availableWeeks.join(" - ")
      : "W0"
  );

  setText(
    "svsSummaryWeeksMeta",
    availableWeeks.length > 0
      ? `${availableWeeks.length} processed week${availableWeeks.length === 1 ? "" : "s"}`
      : "No processed week data"
  );

  const generatedDate =
    data?.generatedAt
      ? new Date(
          data.generatedAt
        )
      : null;

  setText(
    "svsSummaryGenerated",
    generatedDate &&
    !Number.isNaN(
      generatedDate.getTime()
    )
      ? generatedDate.toLocaleString(
          "en-GB"
        )
      : "-"
  );

  const status =
    getElement(
      "svsDataStatus"
    );

  if (status) {
    status.innerHTML = `
      <i
        class="fa-solid fa-circle"
        aria-hidden="true"
      ></i>

      <span>
        Data ready
      </span>
    `;

    status.classList.add(
      "is-ready"
    );
  }
}

function renderLegend(data) {
  const legend =
    getElement(
      "svsServerLegend"
    );

  if (!legend) {
    return;
  }

  const servers =
    Array.isArray(
      data?.servers
    )
      ? data.servers
      : [];

  const groupedServers =
    getGroupedServerNumbers();

  legend.innerHTML =
    servers.map(server => {
      const serverNumber =
        integerValue(
          server.serverNumber
        );

      const colour =
        getServerColour(
          serverNumber,
          servers
        );

      const assignedGroup =
        GROUP_DEFINITIONS.find(
          group =>
            serverGroups[
              group.id
            ].includes(
              serverNumber
            )
        );

      const isHidden =
        hiddenServers.has(
          serverNumber
        );

      return `
        <button
          type="button"
          class="
            svs-server-legend-item
            ${serverNumber === HOME_SERVER ? "is-home-kingdom" : ""}
            ${groupedServers.has(serverNumber) ? "is-grouped" : ""}
            ${isHidden ? "is-hidden-server" : ""}
          "
          data-server="${serverNumber}"
          draggable="true"
          style="
            --svs-server-colour: ${colour};
          "
          title="${
            assignedGroup
              ? `Server ${serverNumber} - Group ${assignedGroup.id}`
              : (
                  isHidden
                    ? `Show Server ${serverNumber}`
                    : `Hide Server ${serverNumber}`
                )
          }"
        >
          <span>
            ${serverNumber}
          </span>

          ${
            serverNumber ===
            HOME_SERVER
              ? `
                <i
                  class="fa-solid fa-crown"
                  aria-label="Home Kingdom"
                ></i>
              `
              : ""
          }

          ${
            assignedGroup
              ? `
                <small>
                  ${assignedGroup.id}
                </small>
              `
              : ""
          }
        </button>
      `;
    }).join("");

  legend
    .querySelectorAll(
      "[data-server]"
    )
    .forEach(button => {
      let dragStarted =
        false;

      button.addEventListener(
        "dragstart",
        event => {
          dragStarted =
            true;

          event.dataTransfer
            .setData(
              "text/plain",
              button.dataset.server
            );

          event.dataTransfer
            .effectAllowed =
            "move";
        }
      );

      button.addEventListener(
        "dragend",
        () => {
          window.setTimeout(
            () => {
              dragStarted =
                false;
            },
            0
          );
        }
      );

      button.addEventListener(
        "click",
        event => {
          if (
            dragStarted ||
            hasActiveGroups()
          ) {
            return;
          }

          event.preventDefault();

          const serverNumber =
            integerValue(
              button.dataset.server
            );

          if (
            hiddenServers.has(
              serverNumber
            )
          ) {
            hiddenServers.delete(
              serverNumber
            );
          } else {
            hiddenServers.add(
              serverNumber
            );
          }

          renderLegend(
            data
          );

          renderCharts(
            data
          );
        }
      );
    });
}

function renderGroupManager(data) {
  const legend =
    getElement(
      "svsServerLegend"
    );

  if (!legend) {
    return;
  }

  let manager =
    getElement(
      "svsGroupManager"
    );

  if (!manager) {
    manager =
      document.createElement(
        "section"
      );

    manager.id =
      "svsGroupManager";

    manager.className =
      "svs-group-manager";

    legend.parentElement
      ?.insertAdjacentElement(
        "afterend",
        manager
      );
  }

  manager.innerHTML = `
    <div class="svs-group-manager-header">
      <div>
        <strong>
          Custom Server Groups
        </strong>

        <span>
          Drag servers into Group A through F.
        </span>
      </div>

      <button
        type="button"
        id="svsClearGroupsBtn"
        class="svs-clear-groups-btn"
      >
        <i class="fa-solid fa-eraser"></i>
        Clear Groups
      </button>
    </div>

    <div class="svs-group-grid">
      ${GROUP_DEFINITIONS.map(group => {
        const groupServers =
          serverGroups[group.id];

        return `
          <div
            class="svs-group-dropzone"
            data-group="${group.id}"
            style="
              --svs-group-colour: ${group.colour};
            "
          >
            <div class="svs-group-title">
              <strong>
                Group ${group.id}
              </strong>

              <span>
                ${groupServers.length}
              </span>
            </div>

            <div class="svs-group-members">
              ${
                groupServers.length > 0
                  ? groupServers
                      .map(serverNumber => {
                        return `
                          <button
                            type="button"
                            class="svs-group-member"
                            data-remove-server="${serverNumber}"
                            title="Remove Server ${serverNumber} from Group ${group.id}"
                          >
                            ${serverNumber}

                            ${
                              serverNumber ===
                              HOME_SERVER
                                ? `
                                  <i class="fa-solid fa-crown"></i>
                                `
                                : ""
                            }

                            <i class="fa-solid fa-xmark"></i>
                          </button>
                        `;
                      })
                      .join("")
                  : `
                    <span class="svs-group-empty">
                      Drop servers here
                    </span>
                  `
              }
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  manager
    .querySelectorAll(
      "[data-group]"
    )
    .forEach(dropzone => {
      dropzone.addEventListener(
        "dragover",
        event => {
          event.preventDefault();

          event.dataTransfer
            .dropEffect =
            "move";

          dropzone.classList.add(
            "is-drag-over"
          );
        }
      );

      dropzone.addEventListener(
        "dragleave",
        () => {
          dropzone.classList.remove(
            "is-drag-over"
          );
        }
      );

      dropzone.addEventListener(
        "drop",
        event => {
          event.preventDefault();

          dropzone.classList.remove(
            "is-drag-over"
          );

          moveServerToGroup(
            event.dataTransfer
              .getData(
                "text/plain"
              ),
            dropzone.dataset.group
          );
        }
      );
    });

  manager
    .querySelectorAll(
      "[data-remove-server]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          removeServerFromGroups(
            button.dataset
              .removeServer
          );

          saveServerGroups();

          renderLegend(
            data
          );

          renderGroupManager(
            data
          );

          renderCharts(
            data
          );
        }
      );
    });

  getElement(
    "svsClearGroupsBtn"
  )?.addEventListener(
    "click",
    clearServerGroups
  );
}

  function renderRanking(
    bodyId,
    rankings
  ) {
    const body =
      getElement(bodyId);

    if (!body) {
      return;
    }

    if (
      !Array.isArray(rankings) ||
      rankings.length ===
        0
    ) {
      body.innerHTML = `
        <tr>
          <td colspan="4">
            No ranking data available.
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML =
      rankings.map(entry => {
        const serverNumber =
          integerValue(
            entry.serverNumber ||
            entry.kingdom
          );

        return `
          <tr class="${entry.isHomeKingdom ? "is-home-kingdom" : ""}">
            <td>
              ${escapeHtml(entry.rank)}
            </td>

            <td>
              Server ${escapeHtml(serverNumber)}
            </td>

            <td>
              ${entry.isHomeKingdom ? "Home Kingdom" : ""}
            </td>

            <td class="text-end">
              ${escapeHtml(
                formatNumber(
                  entry.value
                )
              )}
            </td>
          </tr>
        `;
      }).join("");
  }

  function renderRankings(data) {
    renderRanking(
      "serverVsServerPowerRankingBody",
      data?.rankings?.power
    );

    renderRanking(
      "serverVsServerMeritsRankingBody",
      data?.rankings?.merits
    );

    renderRanking(
      "serverVsServerKillsRankingBody",
      data?.rankings?.kills
    );

    renderRanking(
      "serverVsServerHealingRankingBody",
      data?.rankings?.healing
    );
  }

let activeTableMetric =
  "merits";

let activeSortWeekIndex =
  0;

let activeSortDirection =
  "desc";

function getMetricSeriesKey(metric) {
  const metricMap = {
    merits:
      "merits",

    power:
      "power",

    kills:
      "kills",

    dead:
      "dead",

    healed:
      "healing"
  };

  return metricMap[metric] ||
    "merits";
}

function getMetricLabel(metric) {
  const labelMap = {
    merits:
      "Merits",

    power:
      "Power",

    kills:
      "Kills",

    dead:
      "Dead",

    healed:
      "Healed"
  };

  return labelMap[metric] ||
    "Merits";
}

function getTableSeries(
  server,
  metric
) {
  const seriesKey =
    getMetricSeriesKey(
      metric
    );

  const source =
    server?.series?.[
      seriesKey
    ];

  if (!Array.isArray(source)) {
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

  return Array.from(
    {
      length:
        7
    },
    (
      _,
      index
    ) => {
      const value =
        source[index];

      return value === null ||
        value === undefined
          ? null
          : integerValue(value);
    }
  );
}

function formatTableValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  return formatNumber(
    value
  );
}

function renderServerTable(data) {
  const body =
    getElement(
      "svsMetricTableBody"
    );

  if (!body) {
    return;
  }

  const allServers =
    Array.isArray(
      data?.servers
    )
      ? data.servers
      : [];

  const servers =
    [...allServers];

  servers.sort(
    (
      first,
      second
    ) => {
      const firstSeries =
        getTableSeries(
          first,
          activeTableMetric
        );

      const secondSeries =
        getTableSeries(
          second,
          activeTableMetric
        );

      const firstValue =
        firstSeries[
          activeSortWeekIndex
        ];

      const secondValue =
        secondSeries[
          activeSortWeekIndex
        ];

      if (
        firstValue === null &&
        secondValue === null
      ) {
        return (
          integerValue(
            first.serverNumber
          ) -
          integerValue(
            second.serverNumber
          )
        );
      }

      if (firstValue === null) {
        return 1;
      }

      if (secondValue === null) {
        return -1;
      }

      if (
        firstValue !==
        secondValue
      ) {
        return activeSortDirection ===
          "asc"
            ? firstValue -
              secondValue
            : secondValue -
              firstValue;
      }

      return (
        integerValue(
          first.serverNumber
        ) -
        integerValue(
          second.serverNumber
        )
      );
    }
  );

  if (
    servers.length ===
    0
  ) {
    body.innerHTML = `
      <tr>
        <td
          colspan="8"
          class="svs-table-empty"
        >
          No Server vs Server data available.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML =
    servers
      .map(server => {
        const serverNumber =
          integerValue(
            server.serverNumber
          );

        const series =
          getTableSeries(
            server,
            activeTableMetric
          );

        const colour =
          getServerColour(
            serverNumber,
            allServers
          );

        return `
          <tr class="${
            serverNumber === HOME_SERVER
              ? "is-home-kingdom"
              : ""
          }">
            <td>
              <span
                class="svs-table-server"
                style="
                  color: ${colour};
                  font-weight: 700;
                "
              >
                Server ${serverNumber}

                ${
                  serverNumber ===
                  HOME_SERVER
                    ? `
                      <i
                        class="fa-solid fa-crown"
                        title="Kingdom 630"
                        aria-label="Kingdom 630"
                      ></i>
                    `
                    : ""
                }
              </span>
            </td>

            ${series
              .map(value => {
                return `
                  <td>
                    ${formatTableValue(
                      value
                    )}
                  </td>
                `;
              })
              .join("")}
          </tr>
        `;
      })
      .join("");

  setText(
    "svsMetricSummary",
    (
      `Metric: Total ` +
      `${getMetricLabel(
        activeTableMetric
      )}`
    )
  );
}

function updateMetricButtons() {
  document
    .querySelectorAll(
      "#svsMetricTabs [data-metric]"
    )
    .forEach(button => {
      const active =
        button.dataset.metric ===
        activeTableMetric;

      button.classList.toggle(
        "is-active",
        active
      );

      button.setAttribute(
        "aria-pressed",
        active
          ? "true"
          : "false"
      );
    });
}

function updateSortButtons() {
  document
    .querySelectorAll(
      ".svs-week-sort-button"
    )
    .forEach(button => {
      const weekIndex =
        integerValue(
          button.dataset
            .weekIndex
        );

      const direction =
        normalizeText(
          button.dataset
            .direction
        );

      const active =
        weekIndex ===
          activeSortWeekIndex &&
        direction ===
          activeSortDirection;

      button.classList.toggle(
        "is-active",
        active
      );
    });
}

function bindServerTableControls(data) {
  document
    .querySelectorAll(
      "#svsMetricTabs [data-metric]"
    )
    .forEach(button => {
      button.onclick =
        () => {
          activeTableMetric =
            normalizeText(
              button.dataset.metric
            ).toLowerCase() ||
            "merits";

          updateMetricButtons();

          renderServerTable(
            data
          );
        };
    });

  document
    .querySelectorAll(
      ".svs-week-sort-button"
    )
    .forEach(button => {
      button.onclick =
        () => {
          const weekIndex =
            integerValue(
              button.dataset
                .weekIndex
            );

          const direction =
            normalizeText(
              button.dataset
                .direction
            ).toLowerCase();

          if (
            weekIndex < 0 ||
            weekIndex > 6
          ) {
            return;
          }

          activeSortWeekIndex =
            weekIndex;

          activeSortDirection =
            direction === "asc"
              ? "asc"
              : "desc";

          updateSortButtons();

          renderServerTable(
            data
          );
        };
    });

  updateMetricButtons();
  updateSortButtons();
}

  function renderCharts(data) {
  currentDataset =
    data;

  powerChart =
    destroyChart(
      powerChart
    );

  meritsChart =
    destroyChart(
      meritsChart
    );

  killsChart =
    destroyChart(
      killsChart
    );

  healingChart =
    destroyChart(
      healingChart
    );

  meritsChart =
    createChart(
      getChartCanvas(
        "svsMeritsChart"
      ),
      data?.charts?.merits,
      "Merits",
      "merits"
    );

  killsChart =
    createChart(
      getChartCanvas(
        "svsKillsChart"
      ),
      data?.charts?.kills,
      "Kills",
      "kills"
    );

  powerChart =
    createChart(
      getChartCanvas(
        "svsPowerChart"
      ),
      data?.charts?.power,
      "Power",
      "power"
    );

  healingChart =
    createChart(
      getChartCanvas(
        "svsDeadChart"
      ),
      data?.charts?.healing,
      "Healing",
      "healing"
    );
}

  function renderPage(data) {
  if (!isPagePresent()) {
    return;
  }

  if (
    !data ||
    typeof data !==
      "object"
  ) {
    return load();
  }

  currentDataset =
    data;

  renderSummary(
    data
  );

  renderLegend(
    data
  );

  renderGroupManager(
    data
  );

  renderCharts(
    data
  );

  renderServerTable(
    data
  );

  bindServerTableControls(
    data
  );

  document.dispatchEvent(
    new CustomEvent(
      "k630:server-vs-server-rendered",
      {
        detail: {
          generatedAt:
            data.generatedAt ||
            null,

          season:
            data.season ||
            null,

          grouped:
            hasActiveGroups()
        }
      }
    )
  );

  return data;
}

  function renderError(error) {
    console.error(
      `[${MODULE_NAME}]`,
      error
    );

    const root =
      getElement(
        "serverVsServerPage"
      );

    if (!root) {
      return;
    }

    root.innerHTML = `
      <section class="page-error-state">
        <h2>
          <i class="fa-solid fa-triangle-exclamation"></i>
          Server vs Server Error
        </h2>

        <p>
          ${escapeHtml(
            error?.message ||
            "Server vs Server data could not be loaded."
          )}
        </p>
      </section>
    `;
  }

  async function load() {
    if (!isPagePresent()) {
      return;
    }

    const requestId =
      ++activeRequestId;

    try {
      const data =
        await fetchData();

      if (
        requestId !==
        activeRequestId ||
        !isPagePresent()
      ) {
        return;
      }

      renderPage(data);
    } catch (error) {
      if (
        requestId !==
        activeRequestId
      ) {
        return;
      }

      renderError(error);
    }
  }


  
  function init() {
  if (!isPagePresent()) {
    return;
  }

  injectServerVsServerStyles();

  initialized = true;

  return load();
}

  function destroy() {
    activeRequestId +=
      1;

    powerChart =
      destroyChart(
        powerChart
      );

    meritsChart =
      destroyChart(
        meritsChart
      );

    killsChart =
      destroyChart(
        killsChart
      );

    healingChart =
      destroyChart(
        healingChart
      );

    initialized =
      false;
  }

function injectServerVsServerStyles() {
  if (
    getElement(
      "k630ServerVsServerGroupStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "k630ServerVsServerGroupStyles";

  style.textContent = `
    #svsServerLegend {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
      gap: 5px;
    }

    .svs-server-legend-item.is-hidden-server {
     opacity: 0.28;
     filter: grayscale(1);
     background: #17151d;
     border-style: dashed;
    }

    .svs-server-legend-item.is-hidden-server:hover {
    opacity: 0.65;
    }

    .svs-server-legend-item {
      min-width: 0;
      width: 100%;
      height: 31px;
      padding: 3px 7px;
      border: 2px solid var(--svs-server-colour);
      border-radius: 4px;
      background: color-mix(
        in srgb,
        var(--svs-server-colour) 72%,
        #101018
      );
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: grab;
      box-sizing: border-box;
    }

    .svs-server-legend-item:active {
      cursor: grabbing;
    }

    .svs-server-legend-item .fa-crown {
      color: #ffe24d;
      font-size: 11px;
    }

    .svs-server-legend-item small {
      min-width: 17px;
      height: 17px;
      display: inline-grid;
      place-items: center;
      border-radius: 50%;
      background: rgba(0,0,0,0.45);
      color: #fff;
      font-size: 9px;
    }

    .svs-server-legend-item.is-grouped {
      opacity: 0.75;
    }

    .svs-group-manager {
      margin: 7px 0 10px;
      padding: 8px;
      border: 1px solid rgba(181, 92, 255, 0.4);
      border-radius: 8px;
      background: rgba(17, 13, 27, 0.82);
    }

    .svs-group-manager-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 7px;
    }

    .svs-group-manager-header > div {
      display: grid;
      gap: 2px;
    }

    .svs-group-manager-header strong {
      color: #ffd23f;
      font-size: 12px;
      text-transform: uppercase;
    }

    .svs-group-manager-header span {
      color: #9490a3;
      font-size: 10px;
    }

    .svs-clear-groups-btn {
      min-height: 28px;
      padding: 4px 10px;
      border: 1px solid #ff4f68;
      border-radius: 5px;
      background: rgba(255, 79, 104, 0.13);
      color: #ff758a;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
    }

    .svs-group-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 6px;
    }

    .svs-group-dropzone {
      min-height: 66px;
      padding: 6px;
      border: 2px dashed var(--svs-group-colour);
      border-radius: 6px;
      background: color-mix(
        in srgb,
        var(--svs-group-colour) 10%,
        #0b0911
      );
      transition: 0.15s ease;
    }

    .svs-group-dropzone.is-drag-over {
      transform: translateY(-2px);
      background: color-mix(
        in srgb,
        var(--svs-group-colour) 25%,
        #0b0911
      );
      box-shadow: 0 0 12px var(--svs-group-colour);
    }

    .svs-group-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--svs-group-colour);
      font-size: 11px;
      margin-bottom: 5px;
    }

    .svs-group-title span {
      min-width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--svs-group-colour);
      color: #09080d;
      font-weight: 900;
    }

    .svs-group-members {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .svs-group-member {
      min-height: 23px;
      padding: 2px 6px;
      border: 1px solid var(--svs-group-colour);
      border-radius: 4px;
      background: rgba(0,0,0,0.34);
      color: #fff;
      font-size: 10px;
      cursor: pointer;
    }

    .svs-group-member .fa-crown {
      color: #ffe24d;
      margin-left: 3px;
    }

    .svs-group-member .fa-xmark {
      margin-left: 4px;
      color: #ff6b7b;
    }

    .svs-group-empty {
      color: #777382;
      font-size: 9px;
    }

    @media (max-width: 1100px) {
      .svs-group-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 650px) {
      .svs-group-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

  const publicApi =
    Object.freeze({
      name:
        MODULE_NAME,

      version:
        MODULE_VERSION,

      init,

      initialize:
        init,

      load,

      refresh:
        load,

      render:
        renderPage,

      destroy,

      dataUrl:
        DATA_URL,

      isInitialized() {
        return initialized;
      }
    });

  global.K630ServerVsServerPage =
    publicApi;

  global.initializeK630ServerVsServerPage =
    init;

  console.info(
    `[${MODULE_NAME}] Version ${MODULE_VERSION} ready.`
  );
})(window);