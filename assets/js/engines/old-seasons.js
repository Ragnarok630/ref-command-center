/*!
 * =====================================================
 * Kingdom 630 - Old Seasons Page
 * File: assets/js/pages/old-seasons.js
 * Version: 630.2.0
 * =====================================================
 *
 * Responsibilities:
 * - Read archive/index.json from k630-public-data
 * - Load archived Season Info
 * - Load archived Server vs Server
 * - Show newest Season first
 * - Never calculate gameplay data
 * - Never use localStorage for gameplay data
 *
 * =====================================================
 */

(function initializeK630OldSeasonsPage(global) {

    "use strict";


    const MODULE_NAME =
        "K630 Old Seasons Page";


    const MODULE_VERSION =
        "630.2.0";


    const DATA_ROOT =
        "https://raw.githubusercontent.com/Ragnarok630/k630-public-data/main/assets/data";


    const ARCHIVE_ROOT =
        "archive";


    const ARCHIVE_INDEX =
        `${ARCHIVE_ROOT}/index.json`;


    const state = {

        initialized:
            false,

        rendered:
            false,

        loading:
            false,

        index:
            [],

        seasons:
            [],

        selectedSeason:
            null

    };


    /* =====================================================
       HELPERS
    ===================================================== */

    function normalizeText(
        value
    ) {

        return String(
            value ??
            ""
        ).trim();

    }


    function normalizeSeason(
        value
    ) {

        const number =
            Number(
                value
            );

        if (
            !Number.isFinite(
                number
            )
        ) {

            return 0;

        }

        return Math.trunc(
            number
        );

    }


    function clone(
        value
    ) {

        return JSON.parse(
            JSON.stringify(
                value
            )
        );

    }


    function escapeHtml(
        value
    ) {

        return normalizeText(
            value
        )
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


    function resolveDataUrl(
        path
    ) {

        const value =
            normalizeText(
                path
            );


        if (
            !value
        ) {

            throw new Error(
                "Archive data path is empty."
            );

        }


        if (
            /^https?:\/\//i.test(
                value
            )
        ) {

            return value;

        }


        return (
            `${DATA_ROOT}/` +
            value.replace(
                /^assets\/data\//,
                ""
            )
        );

    }


    /* =====================================================
       JSON LOADER
    ===================================================== */

    async function loadJson(
        path
    ) {

        const url =
            resolveDataUrl(
                path
            );


        console.info(
            `[${MODULE_NAME}] READ:`,
            url
        );


        const response =
            await fetch(
                `${url}?t=${Date.now()}`,
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


        if (
            !response.ok
        ) {

            throw new Error(
                `Unable to load ${url}. HTTP ${response.status}.`
            );

        }


        try {

            return await response.json();

        } catch (
            error
        ) {

            throw new Error(
                `Invalid JSON returned by ${url}.`
            );

        }

    }


    /* =====================================================
       ARCHIVE INDEX NORMALIZATION
    ===================================================== */

    function normalizeArchiveIndex(
        data
    ) {

        let entries = [];


        if (
            Array.isArray(
                data
            )
        ) {

            entries =
                data;

        } else if (
            Array.isArray(
                data?.archives
            )
        ) {

            entries =
                data.archives;

        } else if (
            Array.isArray(
                data?.seasons
            )
        ) {

            entries =
                data.seasons;

        }


        return entries
            .map(
                entry => {

                    const season =
                        normalizeSeason(
                            entry?.season
                        );


                    if (
                        season <=
                        0
                    ) {

                        return null;

                    }


                    return {

                        season,

                        archivedAt:
                            normalizeText(
                                entry?.archivedAt
                            ),

                        seasonInfo:
                            normalizeText(
                                entry?.seasonInfo
                            ) ||
                            `${ARCHIVE_ROOT}/season-${season}/season-info.json`,

                        serverVsServer:
                            normalizeText(
                                entry?.serverVsServer
                            ) ||
                            `${ARCHIVE_ROOT}/season-${season}/server-vs-server.json`,

                        seasonInfoData:
                            null,

                        serverVsServerData:
                            null

                    };

                }
            )
            .filter(
                Boolean
            )
            .sort(
                (
                    first,
                    second
                ) =>
                    second.season -
                    first.season
            );

    }


    /* =====================================================
       PAGE ELEMENT
    ===================================================== */

    function getPage() {

        return document.querySelector(
            "#oldSeasonsPage"
        );

    }


    /* =====================================================
       LOADING STATE
    ===================================================== */

    function renderLoading() {

        const page =
            getPage();


        if (
            !page
        ) {

            return;

        }


        page.innerHTML = `

            <section
                class="old-seasons-loading"
            >

                <i
                    class="fa-solid fa-spinner fa-spin"
                ></i>

                <span>
                    Loading archived Seasons...
                </span>

            </section>

        `;

    }


    /* =====================================================
       ERROR STATE
    ===================================================== */

    function renderError(
        message
    ) {

        const page =
            getPage();


        if (
            !page
        ) {

            return;

        }


        page.innerHTML = `

            <section
                class="old-seasons-empty"
            >

                <h2>
                    Archived Seasons could not be loaded
                </h2>

                <p>
                    ${escapeHtml(
                        message
                    )}
                </p>

            </section>

        `;

    }


    /* =====================================================
       JSON PREVIEW
    ===================================================== */

    function renderJsonPreview(
        data
    ) {

        if (
            data ===
            null ||
            data ===
            undefined
        ) {

            return `
                <div class="oldSeasonInfo">
                    <div>
                        No archived data available.
                    </div>
                </div>
            `;

        }


        const preview =
            JSON.stringify(
                data,
                null,
                2
            );


        return `

            <details>

                <summary>
                    View archived dataset
                </summary>

                <pre
                    style="
                        margin-top:12px;
                        max-height:520px;
                        overflow:auto;
                        white-space:pre-wrap;
                        word-break:break-word;
                    "
                >${escapeHtml(
                    preview
                )}</pre>

            </details>

        `;

    }


    /* =====================================================
       SEASON CARD
    ===================================================== */

    function renderSeasonCard(
        seasonEntry
    ) {

        const season =
            seasonEntry.season;


        return `

            <article
                class="oldSeasonCard"
                data-season="${season}"
            >

                <div
                    class="oldSeasonHeader"
                >

                    <div>

                        <div
                            class="eyebrow"
                        >
                            KINGDOM 630
                        </div>

                        <h2>
                            Season ${season}
                        </h2>

                        <p>

                            Archive Official Date:

                            <strong>
                                ${
                                    escapeHtml(
                                        seasonEntry.archivedAt ||
                                        "Unknown"
                                    )
                                }
                            </strong>

                        </p>

                    </div>

                </div>


                <div
                    class="oldSeasonInfo"
                >

                    <div>

                        <strong>
                            Season Info
                        </strong>

                        ${
                            renderJsonPreview(
                                seasonEntry.seasonInfoData
                            )
                        }

                    </div>


                    <div>

                        <strong>
                            Server vs Server
                        </strong>

                        ${
                            renderJsonPreview(
                                seasonEntry.serverVsServerData
                            )
                        }

                    </div>

                </div>

            </article>

        `;

    }

/* =====================================================
   ARCHIVE VIEWER
===================================================== */

async function openArchivedSeason(
    seasonNumber,
    viewType
) {

    const page =
        getPage();

    if (!page) {
        return false;
    }

    const seasonEntry =
        state.seasons.find(
            entry =>
                Number(entry.season) ===
                Number(seasonNumber)
        );

    if (!seasonEntry) {
        console.error(
            `[${MODULE_NAME}] Archived Season not found:`,
            seasonNumber
        );

        return false;
    }

    const viewer =
        document.getElementById(
            "oldSeasonsArchiveViewer"
        );

    if (!viewer) {
        return false;
    }

/*
 * =====================================================
 * LOAD ONLY THE SELECTED ARCHIVED SUB-PAGE DATA
 *
 * The Old Seasons overview remains untouched.
 * Data is loaded only after the user chooses
 * Season Info or Server vs Server.
 * =====================================================
 */

try {

    if (
        viewType ===
        "season-info"
    ) {

        if (
            !seasonEntry.seasonInfoData
        ) {

            seasonEntry.seasonInfoData =
                await loadJson(
                    seasonEntry.seasonInfo
                );

        }

    } else if (
        viewType ===
        "server-vs-server"
    ) {

        if (
            !seasonEntry.serverVsServerData
        ) {

            seasonEntry.serverVsServerData =
                await loadJson(
                    seasonEntry.serverVsServer
                );

        }

    }

} catch (
    error
) {

    console.error(
        `[${MODULE_NAME}] Failed to load archived ${viewType} data for Season ${seasonEntry.season}:`,
        error
    );

    /*
     * IMPORTANT:
     * Do NOT replace the Old Seasons overview.
     * The user remains on the main Old Seasons page.
     */

    return false;
}

    const selection =
        page.querySelector(
            ".old-seasons-selection"
        );

    const hero =
        page.querySelector(
            ".old-seasons-hero"
        );

    if (selection) {
        selection.hidden = true;
    }

    if (hero) {
        hero.hidden = true;
    }

    viewer.hidden = false;

    /* =====================================================
   SEASON INFO
   OFFICIAL ARCHIVED PAGE
===================================================== */

if (
    viewType ===
    "season-info"
) {

    const archiveData =
        seasonEntry.seasonInfoData;

    if (
        !archiveData
    ) {
        throw new Error(
            `No archived Season Info data available for Season ${seasonEntry.season}.`
        );
    }

    /*
     * -----------------------------------------------------
     * NORMALIZE ARCHIVED DATA
     *
     * The official Season Info page expects:
     *
     * {
     *     players: [...]
     * }
     *
     * Older archive files may expose the same records as
     * participants or rows. We normalize only the container
     * here. No gameplay values are calculated.
     * -----------------------------------------------------
     */

    let officialArchiveData;

    if (
        Array.isArray(
            archiveData?.players
        )
    ) {

        officialArchiveData =
            clone(
                archiveData
            );

    } else if (
        Array.isArray(
            archiveData?.participants
        )
    ) {

        officialArchiveData =
            clone(
                archiveData
            );

        officialArchiveData.players =
            clone(
                archiveData.participants
            );

    } else if (
        Array.isArray(
            archiveData?.rows
        )
    ) {

        officialArchiveData =
            clone(
                archiveData
            );

        officialArchiveData.players =
            clone(
                archiveData.rows
            );

    } else if (
        Array.isArray(
            archiveData
        )
    ) {

        officialArchiveData = {
            players:
                clone(
                    archiveData
                )
        };

    } else {

        throw new Error(
            `Archived Season ${seasonEntry.season} contains no Season Info player records.`
        );

    }

    /*
     * -----------------------------------------------------
     * LOAD THE EXACT OFFICIAL PAGE TEMPLATE
     * -----------------------------------------------------
     */

    const templateResponse =
        await fetch(
            "pages/season-info.html?t=" +
            Date.now(),
            {
                method:
                    "GET",
                cache:
                    "no-store"
            }
        );

    if (
        !templateResponse.ok
    ) {

        throw new Error(
            `Unable to load official Season Info page template. HTTP ${templateResponse.status}.`
        );

    }

    const officialHtml =
        await templateResponse.text();

    /*
     * -----------------------------------------------------
     * OLD SEASONS TOOLBAR
     * -----------------------------------------------------
     */

    viewer.innerHTML = `

        <div
            class="old-seasons-archive-toolbar"
        >

            <button
                type="button"
                class="old-seasons-back-button"
                id="oldSeasonsBackButton"
            >

                <i
                    class="fa-solid fa-arrow-left"
                    aria-hidden="true"
                ></i>

                Back to Old Seasons

            </button>

            <div
                class="old-seasons-archive-title"
            >
                Season ${seasonEntry.season}
                · Season Info
            </div>

        </div>

        <div
            class="old-seasons-official-page"
            id="oldSeasonsOfficialSeasonInfo"
        >
            ${officialHtml}
        </div>

    `;

    /*
     * -----------------------------------------------------
     * FIND OFFICIAL PAGE
     * -----------------------------------------------------
     */

    /*
     * -----------------------------------------------------
     * ARCHIVED SEASON INFO HEIGHT
     *
     * The official Season Info page contains its own
     * vertical scroll area. Because the official page is
     * embedded inside the Old Seasons archive viewer, the
     * embedded page must receive an explicit available
     * height. Without that, the official 100% height
     * chain has no constrained parent and mouse-wheel
     * scrolling cannot operate correctly.
     * -----------------------------------------------------
     */

    const officialSeasonInfoWrapper =
        document.getElementById(
            "oldSeasonsOfficialSeasonInfo"
        );

    if (officialSeasonInfoWrapper) {

        const topBarHeight =
            document.querySelector(
                ".top-status-bar"
            )?.offsetHeight || 0;

        const bottomBarHeight =
            document.querySelector(
                ".bottom-status-bar"
            )?.offsetHeight || 0;

        const availableHeight =
            Math.max(
                300,
                window.innerHeight -
                topBarHeight -
                bottomBarHeight -
                24
            );

        officialSeasonInfoWrapper.style.height =
            `${availableHeight}px`;

        officialSeasonInfoWrapper.style.minHeight =
            "0";

        officialSeasonInfoWrapper.style.overflow =
            "hidden";
    }

    const officialPage =
        document.getElementById(
            "seasonInfoPage"
        );

    if (officialPage) {

        officialPage.style.height =
            "100%";

        officialPage.style.minHeight =
            "0";
    }

    if (
        !officialPage
    ) {

        throw new Error(
            "Official Season Info page could not be created."
        );

    }

    /*
     * -----------------------------------------------------
     * FEED ARCHIVED DATA INTO THE OFFICIAL MODULE
     *
     * The official module normally fetches:
     *
     * generated/season-info/current.json
     *
     * We temporarily intercept only that request and
     * return the selected archived Season dataset.
     *
     * No archive data is written to current.json.
     * No localStorage is used.
     * -----------------------------------------------------
     */

    const originalFetch =
        window.fetch;

    const archivedSeasonInfoFetch =
        async function (
            input,
            init
        ) {

            let requestUrl = "";

            if (
                typeof input ===
                "string"
            ) {

                requestUrl =
                    input;

            } else if (
                input &&
                typeof input.url ===
                "string"
            ) {

                requestUrl =
                    input.url;

            }

            if (
                requestUrl.includes(
                    "generated/season-info/current.json"
                )
            ) {

                return new Response(
                    JSON.stringify(
                        officialArchiveData
                    ),
                    {
                        status:
                            200,

                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );

            }

            return originalFetch(
                input,
                init
            );

        };

    /*
     * -----------------------------------------------------
     * INITIALIZE OFFICIAL SEASON INFO MODULE
     * -----------------------------------------------------
     */

    window.fetch =
        archivedSeasonInfoFetch;

    try {

        if (
            window.K630SeasonInfoPage &&
            typeof
                window.K630SeasonInfoPage.init ===
                "function"
        ) {

            await window.K630SeasonInfoPage.init();

        } else if (
            typeof
                window.initializeK630SeasonInfoPage ===
                "function"
        ) {

            await window.initializeK630SeasonInfoPage();

        } else {

            throw new Error(
                "Official Season Info module is not available."
            );

        }

    } finally {

        window.fetch =
            originalFetch;

    }

    /*
     * -----------------------------------------------------
     * MARK PAGE AS ARCHIVED
     * -----------------------------------------------------
     */

    const description =
        document.getElementById(
            "siSeasonDescription"
        );

    if (
        description
    ) {

        description.textContent =
            `Archived Season ${seasonEntry.season} · Official Season Info data`;

    }

    /*
     * The official module controls the real player count.
     * We deliberately do not replace its table, columns,
     * filters, sorting or weekly data.
     */

    /*
     * -----------------------------------------------------
     * BACK BUTTON
     * -----------------------------------------------------
     */

    const backButton =
        document.getElementById(
            "oldSeasonsBackButton"
        );

    if (
        backButton
    ) {

        backButton.addEventListener(
            "click",
            () => {

                /*
                 * Destroy the official module first so all
                 * listeners and internal Season Info state
                 * are cleaned up.
                 */

                if (
                    window.K630SeasonInfoPage &&
                    typeof
                        window.K630SeasonInfoPage.destroy ===
                        "function"
                ) {

                    window.K630SeasonInfoPage.destroy();

                }

                viewer.hidden =
                    true;

                viewer.innerHTML =
                    "";

                if (
                    hero
                ) {

                    hero.hidden =
                        false;

                }

                if (
                    selection
                ) {

                    selection.hidden =
                        false;

                }

            }
        );

    }

    return true;
}


        /* =====================================================
       SERVER VS SERVER
    ===================================================== */

    if (
        viewType ===
        "server-vs-server"
    ) {

        const archiveData =
            seasonEntry.serverVsServerData;

        if (
            !archiveData ||
            typeof archiveData !==
                "object"
        ) {

            throw new Error(
                `No archived Server vs Server data available for Season ${seasonEntry.season}.`
            );

        }

        /*
         * -----------------------------------------------------
         * LOAD THE EXACT OFFICIAL SERVER VS SERVER TEMPLATE
         * -----------------------------------------------------
         */

        const templateResponse =
            await fetch(
                "pages/server-vs-server.html?t=" +
                Date.now(),
                {
                    method:
                        "GET",

                    cache:
                        "no-store"
                }
            );

        if (
            !templateResponse.ok
        ) {

            throw new Error(
                `Unable to load official Server vs Server page template. HTTP ${templateResponse.status}.`
            );

        }

        const officialHtml =
            await templateResponse.text();

        /*
         * -----------------------------------------------------
         * OLD SEASONS TOOLBAR + OFFICIAL PAGE
         * -----------------------------------------------------
         */

        viewer.innerHTML = `

            <div
                class="old-seasons-archive-toolbar"
            >

                <button
                    type="button"
                    class="old-seasons-back-button"
                    id="oldSeasonsBackButton"
                >

                    <i
                        class="fa-solid fa-arrow-left"
                        aria-hidden="true"
                    ></i>

                    Back to Old Seasons

                </button>

                <div
                    class="old-seasons-archive-title"
                >
                    Season ${seasonEntry.season}
                    · Server vs Server
                </div>

            </div>

            <div
                class="old-seasons-official-page"
                id="oldSeasonsOfficialServerVsServer"
            >

                ${officialHtml}

            </div>
        `;

        /*
         * -----------------------------------------------------
         * ARCHIVED SERVER VS SERVER SCROLL CONTAINER
         *
         * The official page contains the complete Server vs
         * Server layout. Because it is embedded inside the
         * Old Seasons archive viewer, this wrapper receives
         * an explicit viewport height and vertical scrolling.
         *
         * Mouse-wheel scrolling therefore works on the
         * archived sub-page without changing the official
         * Server vs Server module.
         * -----------------------------------------------------
         */

        const officialServerVsServerWrapper =
            document.getElementById(
                "oldSeasonsOfficialServerVsServer"
            );

        if (
            officialServerVsServerWrapper
        ) {

            const topBarHeight =
                document.querySelector(
                    ".topbar"
                )?.offsetHeight || 0;

            const availableHeight =
                Math.max(
                    300,
                    window.innerHeight -
                    topBarHeight -
                    24
                );

            officialServerVsServerWrapper.style.height =
                `${availableHeight}px`;

            officialServerVsServerWrapper.style.minHeight =
                "0";

            officialServerVsServerWrapper.style.overflowY =
                "auto";

            officialServerVsServerWrapper.style.overflowX =
                "hidden";

            officialServerVsServerWrapper.style.overscrollBehavior =
                "contain";

            officialServerVsServerWrapper.style.scrollbarGutter =
                "stable";
        }

        /*
         * -----------------------------------------------------
         * FIND THE OFFICIAL PAGE ROOT
         * -----------------------------------------------------
         */

        const officialPage =
            document.getElementById(
                "serverVsServerPage"
            );

        if (
            !officialPage
        ) {

            throw new Error(
                "Official Server vs Server page could not be created."
            );

        }

        officialPage.style.height =
            "100%";

        officialPage.style.minHeight =
            "0";

        /*
         * -----------------------------------------------------
         * FEED ARCHIVED DATA INTO THE OFFICIAL MODULE
         *
         * The official module normally requests:
         *
         * generated/server-vs-server/current.json
         *
         * We intercept only that request and return the
         * selected archived Season dataset.
         *
         * No current data is overwritten.
         * No archive data is written.
         * No localStorage is used.
         * -----------------------------------------------------
         */

        const originalFetch =
            window.fetch;

        const archivedServerVsServerFetch =
            async function (
                input,
                init
            ) {

                let requestUrl =
                    "";

                if (
                    typeof input ===
                    "string"
                ) {

                    requestUrl =
                        input;

                } else if (
                    input &&
                    typeof input.url ===
                    "string"
                ) {

                    requestUrl =
                        input.url;

                }

                if (
                    requestUrl.includes(
                        "generated/server-vs-server/current.json"
                    )
                ) {

                    return new Response(
                        JSON.stringify(
                            archiveData
                        ),
                        {
                            status:
                                200,

                            headers: {
                                "Content-Type":
                                    "application/json"
                            }
                        }
                    );

                }

                return originalFetch(
                    input,
                    init
                );

            };

        /*
         * -----------------------------------------------------
         * INITIALIZE OFFICIAL SERVER VS SERVER MODULE
         * -----------------------------------------------------
         */

        window.fetch =
            archivedServerVsServerFetch;

        try {

            if (
                window.K630ServerVsServerPage &&
                typeof
                    window.K630ServerVsServerPage.init ===
                    "function"
            ) {

                await window.K630ServerVsServerPage.init();

            } else {

                throw new Error(
                    "Official Server vs Server module is not available."
                );

            }

        } finally {

            window.fetch =
                originalFetch;

        }

        /*
         * -----------------------------------------------------
         * MARK THE PAGE AS ARCHIVED
         * -----------------------------------------------------
         */

        const description =
            document.getElementById(
                "svsPageDescription"
            );

        if (
            description
        ) {

            description.textContent =
                `Archived Season ${seasonEntry.season} · Official Server vs Server data`;

        }

        /*
         * -----------------------------------------------------
         * BACK BUTTON
         * -----------------------------------------------------
         */

        const backButton =
            document.getElementById(
                "oldSeasonsBackButton"
            );

        if (
            backButton
        ) {

            backButton.addEventListener(
                "click",
                () => {

                    /*
                     * Destroy the official Server vs Server
                     * module first so charts and listeners
                     * are cleaned up correctly.
                     */

                    if (
                        window.K630ServerVsServerPage &&
                        typeof
                            window.K630ServerVsServerPage.destroy ===
                            "function"
                    ) {

                        window.K630ServerVsServerPage.destroy();

                    }

                    viewer.hidden =
                        true;

                    viewer.innerHTML =
                        "";

                    if (
                        hero
                    ) {

                        hero.hidden =
                            false;

                    }

                    if (
                        selection
                    ) {

                        selection.hidden =
                            false;

                    }

                }
            );

        }

        return true;
    }

    return false;}

    /* =====================================================
       PAGE RENDER
    ===================================================== */

    function renderPage() {

    const page =
        getPage();

    if (!page) {
        return false;
    }

    const count =
        state.seasons.length;

    if (count <= 0) {

        page.innerHTML = `
            <section class="old-seasons-empty">

                <h2>
                    No archived Seasons
                </h2>

                <p>
                    No entries are available in archive/index.json.
                </p>

            </section>
        `;

        state.rendered = true;

        return true;
    }


    const seasonOptions =
        state.seasons
            .map(
                seasonEntry => `
                    <option value="${seasonEntry.season}">
                        Season ${seasonEntry.season}
                    </option>
                `
            )
            .join("");


    page.innerHTML = `

        <section class="old-seasons-hero">

    <div class="old-seasons-hero-image">
        <img
            src="assets/images/old-seasons-banner.png"
            alt="Kingdom 630 Old Seasons"
        >
    </div>

</section>


        <section
            class="old-seasons-selection"
            aria-label="Archived season selection"
        >


            <!-- =====================================
                 SEASON INFO
            ====================================== -->

            <article
                class="old-seasons-selection-card"
            >

                <div class="old-seasons-selection-icon">
                    <i
                        class="fa-solid fa-calendar-days"
                        aria-hidden="true"
                    ></i>
                </div>


                <div class="old-seasons-selection-content">

                    <span class="old-seasons-selection-kicker">
                        ARCHIVED SEASONS
                    </span>

                    <h2>
                        Season Info
                    </h2>

                    <p>
                        View the official Season Info
                        table for a completed season.
                    </p>


                    <label
                        for="oldSeasonInfoSelect"
                    >
                        Season
                    </label>

                    <select
                        id="oldSeasonInfoSelect"
                        class="old-seasons-season-select"
                    >
                        ${seasonOptions}
                    </select>


                    <button
                        type="button"
                        id="oldSeasonInfoOpen"
                        class="old-seasons-open-button"
                    >

                        <i
                            class="fa-solid fa-table"
                            aria-hidden="true"
                        ></i>

                        Open Season Info

                    </button>

                </div>

            </article>



            <!-- =====================================
                 SERVER VS SERVER
            ====================================== -->

            <article
                class="old-seasons-selection-card"
            >

                <div class="old-seasons-selection-icon">
                    <i
                        class="fa-solid fa-scale-balanced"
                        aria-hidden="true"
                    ></i>
                </div>


                <div class="old-seasons-selection-content">

                    <span class="old-seasons-selection-kicker">
                        ARCHIVED SEASONS
                    </span>

                    <h2>
                        Server vs Server
                    </h2>

                    <p>
                        View the official Server vs Server
                        comparison for a completed season.
                    </p>


                    <label
                        for="oldSeasonSvsSelect"
                    >
                        Season
                    </label>

                    <select
                        id="oldSeasonSvsSelect"
                        class="old-seasons-season-select"
                    >
                        ${seasonOptions}
                    </select>


                    <button
                        type="button"
                        id="oldSeasonSvsOpen"
                        class="old-seasons-open-button"
                    >

                        <i
                            class="fa-solid fa-chart-line"
                            aria-hidden="true"
                        ></i>

                        Open Server vs Server

                    </button>

                </div>

            </article>


        </section>


        <section
            id="oldSeasonsArchiveViewer"
            class="old-seasons-archive-viewer"
            hidden
        ></section>

    `;


    const seasonInfoSelect =
        document.getElementById(
            "oldSeasonInfoSelect"
        );

    const seasonInfoOpen =
        document.getElementById(
            "oldSeasonInfoOpen"
        );

    const svsSelect =
        document.getElementById(
            "oldSeasonSvsSelect"
        );

    const svsOpen =
        document.getElementById(
            "oldSeasonSvsOpen"
        );


    if (
        seasonInfoOpen &&
        seasonInfoSelect
    ) {

        seasonInfoOpen.addEventListener(
            "click",
            () => {

                const seasonNumber =
                    Number(
                        seasonInfoSelect.value
                    );

                state.selectedSeason =
                    seasonNumber;

                openArchivedSeason(
                    seasonNumber,
                    "season-info"
                );

            }
        );

    }


    if (
        svsOpen &&
        svsSelect
    ) {

        svsOpen.addEventListener(
            "click",
            () => {

                const seasonNumber =
                    Number(
                        svsSelect.value
                    );

                state.selectedSeason =
                    seasonNumber;

                openArchivedSeason(
                    seasonNumber,
                    "server-vs-server"
                );

            }
        );

    }


    state.rendered = true;

    return true;
}


    /* =====================================================
       LOAD ARCHIVED DATA
    ===================================================== */

    async function loadArchiveData() {

    state.index =
        await loadJson(
            ARCHIVE_INDEX
        );

    const entries =
        normalizeArchiveIndex(
            state.index
        );

    state.seasons =
        entries.map(
            entry => {

                const result =
                    clone(
                        entry
                    );

                result.seasonInfoData =
                    null;

                result.serverVsServerData =
                    null;

                return result;
            }
        );
}


    /* =====================================================
       INIT
    ===================================================== */

    async function init() {

        state.initialized =
            true;

        return true;

    }


    /* =====================================================
       RENDER
    ===================================================== */

    async function render() {

        if (
            state.loading
        ) {

            return false;

        }


        const page =
            getPage();


        if (
            !page
        ) {

            return false;

        }


        state.loading =
            true;


        renderLoading();


        try {

            await loadArchiveData();

            renderPage();


            console.info(
                `[${MODULE_NAME}] ${MODULE_VERSION} loaded.`,
                {
                    seasons:
                        state.seasons.length
                }
            );


            return true;

        } catch (
            error
        ) {

            console.error(
                `[${MODULE_NAME}] Failed:`,
                error
            );


            renderError(
                error?.message ||
                "Unknown archive loading error."
            );


            return false;

        } finally {

            state.loading =
                false;

        }

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    global.K630OldSeasonsPage = {

        init,

        render,

        getState() {

            return {

                initialized:
                    state.initialized,

                rendered:
                    state.rendered,

                loading:
                    state.loading,

                seasons:
                    clone(
                        state.seasons
                    )

            };

        }

    };


    console.info(
        `[${MODULE_NAME}] ${MODULE_VERSION} loaded.`
    );


})(
    window
);