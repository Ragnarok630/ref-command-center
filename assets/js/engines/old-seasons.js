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
       PAGE RENDER
    ===================================================== */

    function renderPage() {

        const page =
            getPage();


        if (
            !page
        ) {

            return false;

        }


        const count =
            state.seasons.length;


        if (
            count <=
            0
        ) {

            page.innerHTML = `

                <section
                    class="old-seasons-empty"
                >

                    <h2>
                        No archived Seasons
                    </h2>

                    <p>
                        No entries are available in archive/index.json.
                    </p>

                </section>

            `;


            state.rendered =
                true;


            return true;

        }


        const cards =
            state.seasons
                .map(
                    renderSeasonCard
                )
                .join(
                    ""
                );


        page.innerHTML = `

            <section
                class="old-seasons-hero"
            >

                <div
                    class="eyebrow"
                >
                    KINGDOM 630
                </div>

                <h1>
                    Old Seasons
                </h1>

                <p>
                    Archived Season Info and
                    Server vs Server data.
                </p>

            </section>


            <section
                class="old-seasons-controls"
            >

                <strong>
                    Archived Seasons:
                    ${count}
                </strong>

            </section>


            <section
                class="old-seasons-list"
            >

                ${cards}

            </section>

        `;


        state.rendered =
            true;


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


        if (
            !entries.length
        ) {

            state.seasons =
                [];

            return;

        }


        /*
         * Load both archived datasets
         * for every indexed Season.
         */

        state.seasons =
            await Promise.all(

                entries.map(
                    async entry => {

                        const result =
                            clone(
                                entry
                            );


                        const [
                            seasonInfoData,
                            serverVsServerData
                        ] =
                            await Promise.all([

                                loadJson(
                                    entry.seasonInfo
                                ),

                                loadJson(
                                    entry.serverVsServer
                                )

                            ]);


                        result.seasonInfoData =
                            seasonInfoData;


                        result.serverVsServerData =
                            serverVsServerData;


                        return result;

                    }
                )

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