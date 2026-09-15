/* =========================================================
   KINGDOM 630 – DRAGON COMMAND CENTER

   File:
   assets/js/admin/admin-afk.js

   Version:
   630.3.0

   Purpose:
   - Load AFK requests directly from k630-public-data
   - Display pending / approved / rejected requests
   - Allow Owner and Admin to approve or reject requests
   - Allow Owner and Admin to return requests to pending
   - Allow Owner and Admin to delete requests
   - Keep AFK request data in k630-public-data
========================================================= */

(function initializeK630AdminAfk(global) {
  "use strict";

  const MODULE_NAME =
    "K630 Admin AFK";

  const MODULE_VERSION =
    "630.3.0";

  const EDGE_FUNCTION_URL =
    "https://umkdgzawpgoltgpmcumh.supabase.co/functions/v1/afk-request";

  const GITHUB_OWNER =
    "Ragnarok630";

  const GITHUB_REPOSITORY =
    "k630-public-data";

  const GITHUB_BRANCH =
    "main";

  const REQUEST_DIRECTORY =
    "assets/data/afk/requests";

  const PAGE_SELECTOR =
    ".admin-afk-page";

  const VALID_STATUSES =
    [
      "pending",
      "approved",
      "rejected"
    ];

  let initialized =
    false;

  let loading =
    false;

  let processing =
    false;

  let requests =
    [];

  let selectedFilter =
    "all";

  function text(value) {
    return String(
      value ?? ""
    ).trim();
  }

  function lower(value) {
    return text(value)
      .toLowerCase();
  }

  function escapeHtml(value) {
    return text(value)
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

  function getPage() {
    return document.querySelector(
      PAGE_SELECTOR
    );
  }

  function getSession() {
    try {
      return (
        global.K630Auth
          ?.getSession?.() ||
        null
      );
    } catch (error) {
      return null;
    }
  }

  function getRole() {
    try {
      return lower(
        global.K630Auth
          ?.getCurrentRole?.() ||
        getSession()?.role
      );
    } catch (error) {
      return "guest";
    }
  }

  function getCurrentRole() {
    try {
      return (
        lower(
          global.K630AdminCore
            ?.getCurrentRole?.() ||
          global.K630Auth
            ?.getCurrentRole?.() ||
          getSession()?.role
        ) ||
        "guest"
      );
    } catch (error) {
      return "guest";
    }
  }

  function canManage() {
    return [
      "owner",
      "admin",
      "officer"
    ].includes(
      getCurrentRole()
    );
  }

  function getReviewerName() {
    const session =
      getSession();

    return (
      text(
        session?.email
      ) ||
      text(
        session?.name
      ) ||
      getRole()
    );
  }

  function normalizeStatus(value) {
    const status =
      lower(value);

    return VALID_STATUSES.includes(
      status
    )
      ? status
      : "pending";
  }

  function normalizeWeeks(value) {
    const source =
      Array.isArray(value)
        ? value
        : text(value)
            .split(",");

    return source
      .map(
        value =>
          Number(value)
      )
      .filter(
        value =>
          Number.isInteger(
            value
          ) &&
          value >= 0 &&
          value <= 6
      );
  }

  function normalizeRequest(
    request,
    file = null
  ) {
    return {
      ...request,

      requestId:
        text(
          request?.requestId ??
          request?.request_id ??
          request?.id ??
          file?.name?.replace(
            /\.json$/i,
            ""
          )
        ),

      playerId:
        text(
          request?.playerId ??
          request?.player_id
        ),

      playerName:
        text(
          request?.playerName ??
          request?.player_name
        ) ||
        "Unknown Player",

      reason:
        text(
          request?.reason
        ) ||
        "Not specified",

      weeks:
        normalizeWeeks(
          request?.weeks
        ),

      note:
        text(
          request?.note
        ),

      adminNote:
        text(
          request?.adminNote
        ),

      status:
        normalizeStatus(
          request?.status
        ),

      createdAt:
        text(
          request?.createdAt ??
          request?.created_at ??
          request?.submittedAt ??
          request?.submitted_at ??
          file?.name?.match(
            /^\d{4}-\d{2}-\d{2}/
          )?.[0]
        ),

      reviewedAt:
        text(
          request?.reviewedAt ??
          request?.reviewed_at
        ),

      reviewedBy:
        text(
          request?.reviewedBy ??
          request?.reviewed_by
        ),

      repositoryPath:
        text(
          request?.repositoryPath
        ) ||
        text(
          file?.path
        ) ||
        `${REQUEST_DIRECTORY}/${file?.name || ""}`,

      filename:
        text(
          request?.filename
        ) ||
        text(
          file?.name
        ),

      sha:
        text(
          request?.sha
        ) ||
        text(
          file?.sha
        )
    };
  }

  function buildDirectoryUrl() {
    return (
      "https://api.github.com/repos/" +
      `${encodeURIComponent(GITHUB_OWNER)}/` +
      `${encodeURIComponent(GITHUB_REPOSITORY)}/` +
      "contents/" +
      REQUEST_DIRECTORY
        .split("/")
        .map(encodeURIComponent)
        .join("/") +
      `?ref=${encodeURIComponent(GITHUB_BRANCH)}` +
      `&t=${Date.now()}`
    );
  }

  async function fetchJson(url) {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          cache:
            "no-store",

          headers: {
            Accept:
              "application/vnd.github+json"
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        `GitHub request failed: HTTP ${response.status}`
      );
    }

    return response.json();
  }

  function decodeBase64Json(
    content
  ) {
    const compact =
      text(content)
        .replace(
          /\s+/g,
          ""
        );

    if (!compact) {
      return null;
    }

    const decoded =
      decodeURIComponent(
        Array.prototype.map
          .call(
            atob(compact),
            character =>
              "%" +
              character
                .charCodeAt(0)
                .toString(16)
                .padStart(2, "0")
          )
          .join("")
      );

    return JSON.parse(
      decoded
    );
  }

  async function loadRequestFile(
    file
  ) {
    let data =
      null;

    if (
      file?.download_url
    ) {
      data =
        await fetchJson(
          `${file.download_url}?t=${Date.now()}`
        );
    } else if (
      file?.url
    ) {
      const fileResponse =
        await fetchJson(
          `${file.url}&t=${Date.now()}`
        );

      data =
        decodeBase64Json(
          fileResponse.content
        );
    }

    if (
      !data ||
      typeof data !==
        "object"
    ) {
      return null;
    }

    return normalizeRequest(
      data,
      file
    );
  }

  async function getHeaders() {
    const headers = {
      "Content-Type":
        "application/json",

      Accept:
        "application/json"
    };

    const auth =
      global.K630Auth;

    if (
      !auth ||
      typeof auth.init !==
        "function" ||
      typeof auth.getClient !==
        "function"
    ) {
      throw new Error(
        "Supabase authentication is unavailable."
      );
    }

    await auth.init();

    const client =
      auth.getClient();

    if (
      !client ||
      !client.auth ||
      typeof client.auth.getSession !==
        "function"
    ) {
      throw new Error(
        "The Supabase authentication client is unavailable."
      );
    }

    const {
      data,
      error
    } =
      await client.auth.getSession();

    if (error) {
      throw new Error(
        error.message ||
        "Your login session could not be loaded."
      );
    }

    const accessToken =
      text(
        data?.session?.access_token
      );

    if (!accessToken) {
      throw new Error(
        "You must be signed in to manage AFK requests."
      );
    }

    headers.Authorization =
      `Bearer ${accessToken}`;

    return headers;
  }

  async function callEdgeFunction(
    body
  ) {
    const response =
      await fetch(
        EDGE_FUNCTION_URL,
        {
          method:
            "POST",

          headers:
            await getHeaders(),

          body:
            JSON.stringify(body)
        }
      );

    let result =
      null;

    try {
      result =
        await response.json();
    } catch (error) {
      result =
        null;
    }

    if (
      !response.ok ||
      result?.success ===
        false
    ) {
      throw new Error(
        result?.message ||
        result?.error ||
        `AFK request failed (HTTP ${response.status}).`
      );
    }

    return result;
  }

  function getTableBody() {
    return getPage()
      ?.querySelector(
        "#afkRequestTable tbody"
      ) ||
      null;
  }

  function formatDateTime(value) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleString();
  }

  function statusBadge(
    status
  ) {
    const cleanStatus =
      normalizeStatus(
        status
      );

    const icon =
      cleanStatus ===
        "approved"
        ? "fa-circle-check"
        : cleanStatus ===
            "rejected"
          ? "fa-circle-xmark"
          : "fa-clock";

    return `
      <span class="afk-admin-badge afk-admin-badge-${cleanStatus}">
        <i class="fa-solid ${icon}"></i>
        ${escapeHtml(
          cleanStatus
            .charAt(0)
            .toUpperCase() +
          cleanStatus.slice(1)
        )}
      </span>
    `;
  }

  function actionButtons(
  request
) {
  if (!canManage()) {
    return "-";
  }

  if (processing) {
    return "";
  }

  return `
    <div class="afk-admin-actions">

      <button
        type="button"
        class="admin-btn afk-action-approve"
        data-afk-action="approve"
        data-afk-request-id="${escapeHtml(
          request.requestId
        )}"
        title="Approve request"
      >
        <i class="fa-solid fa-check"></i>
        Approve
      </button>

      <button
        type="button"
        class="admin-btn afk-action-reject"
        data-afk-action="reject"
        data-afk-request-id="${escapeHtml(
          request.requestId
        )}"
        title="Reject request"
      >
        <i class="fa-solid fa-xmark"></i>
        Reject
      </button>

      <button
        type="button"
        class="admin-btn afk-action-delete"
        data-afk-action="delete"
        data-afk-request-id="${escapeHtml(
          request.requestId
        )}"
        title="Delete request"
      >
        <i class="fa-solid fa-trash"></i>
        Delete
      </button>

    </div>
  `;
}

  function renderRow(
    request
  ) {
    const weeks =
      request.weeks.length
        ? request.weeks
            .map(
              week =>
                `W${week}`
            )
            .join(", ")
        : "-";

    return `
      <tr>

        <td>
          ${escapeHtml(
            formatDateTime(
              request.createdAt
            )
          )}
        </td>

        <td>
          <strong>
            ${escapeHtml(
              request.playerName
            )}
          </strong>

          ${
            request.note
              ? `
                <small class="d-block text-secondary">
                  ${escapeHtml(
                    request.note
                  )}
                </small>
              `
              : ""
          }
        </td>

        <td>
          <code>
            ${escapeHtml(
              request.playerId ||
              "-"
            )}
          </code>
        </td>

        <td>
          ${escapeHtml(
            request.reason
          )}
        </td>

        <td>
          ${escapeHtml(
            weeks
          )}
        </td>

        <td>
          ${statusBadge(
            request.status
          )}

          ${
            request.reviewedBy
              ? `
                <small class="d-block text-secondary">
                  ${escapeHtml(
                    request.reviewedBy
                  )}
                </small>
              `
              : ""
          }
        </td>

        <td>
          ${actionButtons(
            request
          )}
        </td>

      </tr>
    `;
  }

  function renderEmpty() {
    const body =
      getTableBody();

    if (!body) {
      return;
    }

    body.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="text-center py-5"
        >
          No AFK requests found.
        </td>
      </tr>
    `;
  }

  function renderLoading() {
    const body =
      getTableBody();

    if (!body) {
      return;
    }

    body.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="text-center py-5"
        >
          <i class="fa-solid fa-spinner fa-spin"></i>
          Loading AFK requests...
        </td>
      </tr>
    `;
  }

  function getVisibleRequests() {
    return requests.filter(
      request =>
        selectedFilter ===
          "all" ||
        request.status ===
          selectedFilter
    );
  }

  function render() {
    const page =
      getPage();

    if (!page) {
      return;
    }

    const body =
      getTableBody();

    if (!body) {
      return;
    }

    const visible =
      getVisibleRequests();

    if (!visible.length) {
      renderEmpty();
      return;
    }

    body.innerHTML =
      visible
        .map(
          renderRow
        )
        .join("");
  }

  async function loadRequests() {
    if (loading) {
      return requests;
    }

    if (!canManage()) {
      requests =
        [];

      render();

      return [];
    }

    loading =
      true;

    renderLoading();

    try {
      const directory =
        await fetchJson(
          buildDirectoryUrl()
        );

      if (
        !Array.isArray(
          directory
        )
      ) {
        throw new Error(
          "The AFK request directory did not return a file list."
        );
      }

      const files =
        directory.filter(
          item =>
            item?.type ===
              "file" &&
            /\.json$/i.test(
              item?.name || ""
            )
        );

      const loaded =
        await Promise.allSettled(
          files.map(
            file =>
              loadRequestFile(
                file
              )
          )
        );

      requests =
        loaded
          .filter(
            result =>
              result.status ===
                "fulfilled" &&
              result.value
          )
          .map(
            result =>
              result.value
          )
          .sort(
            (
              left,
              right
            ) => {
              const leftTime =
                new Date(
                  left.createdAt
                ).getTime() || 0;

              const rightTime =
                new Date(
                  right.createdAt
                ).getTime() || 0;

              return (
                rightTime -
                leftTime
              );
            }
          );

      render();

      return requests.slice();

    } catch (error) {
      console.error(
        `[${MODULE_NAME}] Could not load AFK requests.`,
        error
      );

      requests =
        [];

      const body =
        getTableBody();

      if (body) {
        body.innerHTML = `
          <tr>
            <td
              colspan="7"
              class="text-center py-5"
            >
              <i class="fa-solid fa-triangle-exclamation"></i>
              ${escapeHtml(
                error?.message ||
                "AFK requests could not be loaded."
              )}
            </td>
          </tr>
        `;
      }

      return [];

    } finally {
      loading =
        false;
    }
  }

  async function updateRequest(
  request,
  status
) {
  if (
    processing ||
    !canManage()
  ) {
    return;
  }

  processing =
    true;

  try {
    const reviewedAt =
      new Date()
        .toISOString();

    /*
     * STEP 1:
     * Update the AFK request on GitHub.
     */
    await callEdgeFunction({
      action:
        "update",
      requestId:
        request.requestId,
      repositoryPath:
        request.repositoryPath,
      filename:
        request.filename,
      sha:
        request.sha,
      status,
      adminNote:
        request.adminNote || "",
      reviewedAt,
      reviewedBy:
        getReviewerName()
    });

    /*
     * STEP 2:
     * Update the player's AFK flag
     * in both generated JSON files.
     */
    await callEdgeFunction({
      action:
        "sync-player-afk",
      playerId:
        request.playerId,
      approved:
        status === "approved",
      reviewedAt,
      reviewedBy:
        getReviewerName()
    });

    await loadRequests();

  } catch (error) {
    console.error(
      `[${MODULE_NAME}] AFK request update failed.`,
      error
    );

    alert(
      error?.message ||
      "The AFK request could not be updated."
    );

  } finally {
    processing =
      false;
  }
}

  async function deleteRequest(
    request
  ) {
    if (
      processing ||
      !canManage()
    ) {
      return;
    }

    const confirmed =
      global.confirm(
        `Delete the AFK request from ${request.playerName} (${request.playerId})?`
      );

    if (!confirmed) {
      return;
    }

    processing =
      true;

    try {
      await callEdgeFunction({
        action:
          "delete",

        requestId:
          request.requestId,

        repositoryPath:
          request.repositoryPath,

        filename:
          request.filename,

        sha:
          request.sha
      });

      await loadRequests();

    } catch (error) {
      console.error(
        `[${MODULE_NAME}] AFK request delete failed.`,
        error
      );

      alert(
        error?.message ||
        "The AFK request could not be deleted."
      );

    } finally {
      processing =
        false;
    }
  }

  function bindPageEvents(
    page
  ) {
    if (
      page.dataset
        .afkEventsBound ===
      "true"
    ) {
      return;
    }

    page.dataset
      .afkEventsBound =
      "true";

    page.addEventListener(
      "change",
      event => {
        if (
          event.target.id ===
          "afkFilter"
        ) {
          selectedFilter =
            lower(
              event.target.value
            ) ||
            "all";

          render();
        }
      }
    );

    page.addEventListener(
      "click",
      async event => {
        const refresh =
          event.target.closest(
            "#afkRefreshBtn"
          );

        if (refresh) {
          await loadRequests();
          return;
        }

        const button =
          event.target.closest(
            "[data-afk-action]"
          );

        if (!button) {
          return;
        }

        const requestId =
          button.dataset
            .afkRequestId;

        const action =
          button.dataset
            .afkAction;

        const request =
          requests.find(
            item =>
              item.requestId ===
              requestId
          );

        if (!request) {
          return;
        }

        if (
          action ===
          "approve"
        ) {
          await updateRequest(
            request,
            "approved"
          );

          return;
        }

        if (
          action ===
          "reject"
        ) {
          await updateRequest(
            request,
            "rejected"
          );

          return;
        }

        if (
          action ===
          "delete"
        ) {
          await deleteRequest(
            request
          );
        }
      }
    );
  }

  async function init() {
    const page =
      getPage();

    if (!page) {
      return;
    }

    if (initialized) {
      return;
    }

    initialized =
      true;

    bindPageEvents(
      page
    );

    await loadRequests();
  }

  function observePage() {
    const content =
      document.getElementById(
        "app-content"
      );

    if (!content) {
      return;
    }

    const observer =
      new MutationObserver(
        () => {
          const page =
            getPage();

          if (!page) {
            initialized =
              false;

            return;
          }

          init();
        }
      );

    observer.observe(
      content,
      {
        childList:
          true,

        subtree:
          true
      }
    );

    if (
      getPage()
    ) {
      init();
    }
  }

  global.K630AdminAfk =
    Object.freeze({
      name:
        MODULE_NAME,

      version:
        MODULE_VERSION,

      init,

      loadRequests,

      getRequests() {
        return requests.slice();
      }
    });

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      observePage,
      {
        once:
          true
      }
    );
  } else {
    observePage();
  }

})(window);