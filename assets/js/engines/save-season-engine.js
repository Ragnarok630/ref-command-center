/* =========================================================
   KINGDOM 630 — SAVE SEASON ENGINE
=========================================================

Version:
    630.2.0

Project:
    Kingdom 630 — Rebels of Fury

Purpose:
    Final Season Archive workflow.

=========================================================
SINGLE SOURCE OF TRUTH
=========================================================

ALL DATA IS READ FROM:

    Ragnarok630/k630-public-data

ALL DATA IS WRITTEN TO:

    Ragnarok630/k630-public-data

The website does not store gameplay data locally.

The Save Season Engine does not use localStorage
for gameplay data.

=========================================================
SAVE SEASON WORKFLOW
=========================================================

STEP 7
    SAVE SEASON ARCHIVE

    7A
        Archive Season Info
        Archive Server vs Server

    7B
        Update Season Data

    7C
        Calculate Averages

    7D
        Update Notes

    7E
        Update Server Status

    7F
        Create Next Season Columns

    7G
        Reset Current Season Data

=========================================================
IMPORTANT
=========================================================

Each step can be executed independently.

The Admin Center will later call:

    step7AArchive()
    step7BSeasonData()
    step7CAverages()
    step7DNote()
    step7EServerStatus()
    step7FSeasonColumns()
    step7GReset()

The final Save Season button will execute them
in the correct order.

========================================================= */

(function initializeK630SaveSeasonEngine(
    global
) {

    "use strict";


    /* =====================================================
       ENGINE INFORMATION
    ===================================================== */

    const ENGINE_NAME =
        "K630 Save Season Engine";

    const ENGINE_VERSION =
        "630.2.0";


    const LOG_PREFIX =
        "[K630 Save Season]";


    /* =====================================================
       DATA ROOT
    =====================================================

       Every read goes to k630-public-data.

       DATA_ROOT is the RAW GitHub data root.
    ===================================================== */

    const DATA_ROOT =
        global.K630Paths?.DATA_ROOT ??
        "https://raw.githubusercontent.com/" +
        "Ragnarok630/k630-public-data/main/assets/data";


    /* =====================================================
       CURRENT DATA PATHS
    ===================================================== */

    const PATHS = Object.freeze({

        SEASON_INFO:
            `${DATA_ROOT}/generated/season-info/current.json`,

        SERVER_VS_SERVER:
            `${DATA_ROOT}/generated/server-vs-server/current.json`,

        ACTIVE_AVERAGE:
            `${DATA_ROOT}/generated/active-average/current.json`,

        OLD_PLAYERS:
            `${DATA_ROOT}/generated/old-players/current.json`,

        ADMIN_CONFIG:
            `${DATA_ROOT}/config/admin-config.json`,

        ARCHIVE_ROOT:
            `${DATA_ROOT}/archive`

    });


    /* =====================================================
       REPOSITORY INFORMATION
    ===================================================== */

    const GITHUB_REPOSITORY =
        Object.freeze({

            owner:
                "Ragnarok630",

            repository:
                "k630-public-data",

            branch:
                "main"

        });


    /* =====================================================
   GENERAL HELPERS
===================================================== */

function clone(
    value
) {

    return JSON.parse(
        JSON.stringify(
            value
        )
    );

}


function normalizeText(
    value
) {

    return String(
        value ??
        ""
    ).trim();

}


/* -----------------------------------------------------
   CURRENT ISO DATETIME
----------------------------------------------------- */

function nowIso() {

    return new Date()
        .toISOString();

}


/* -----------------------------------------------------
   SEASON NUMBER
----------------------------------------------------- */

function normalizeSeason(
    value
) {

    const season =
        Number(
            value
        );

    if (
        !Number.isFinite(
            season
        )
    ) {

        throw new Error(
            "Invalid Season Number."
        );

    }

    if (
        season < 1
    ) {

        throw new Error(
            "Season Number must be 1 or higher."
        );

    }

    return Math.trunc(
        season
    );

}


/* -----------------------------------------------------
   ARCHIVE DATE
----------------------------------------------------- */

function normalizeDate(
    value
) {

    const date =
        normalizeText(
            value
        );


    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
            date
        )
    ) {

        throw new Error(
            "Archive Date must use YYYY-MM-DD."
        );

    }


    return date;

}


/* -----------------------------------------------------
   REQUIRED VALUE
----------------------------------------------------- */

function requireValue(
    value,
    message
) {

    if (
        value ===
            undefined ||
        value ===
            null
    ) {

        throw new Error(
            message
        );

    }

    return value;

}

    /* =====================================================
       READ JSON
    =====================================================

       This is the ONLY generic JSON reader used by
       Save Season.

       Relative paths are resolved against DATA_ROOT.

       Absolute HTTP URLs are allowed when another
       k630-public-data URL is already supplied.
    ===================================================== */

    async function readJson(
        url
    ) {

        const input =
            normalizeText(
                url
            );


        if (
            !input
        ) {

            throw new Error(
                "readJson() received an empty URL."
            );

        }


        const finalUrl =
            /^https?:\/\//i.test(
                input
            )
                ? input
                : `${DATA_ROOT}/${input.replace(
                    /^assets\/data\//,
                    ""
                )}`;


        console.info(
            `${LOG_PREFIX} READ:`,
            finalUrl
        );


        const response =
            await fetch(
                finalUrl,
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
                `Unable to load ${finalUrl}. HTTP ${response.status}.`
            );

        }


        return await response.json();

    }


    /* =====================================================
       ARCHIVE PATH
    ===================================================== */

    function getArchiveSeasonPath(
        season
    ) {

        const seasonNumber =
            normalizeSeason(
                season
            );


        return (
            `${PATHS.ARCHIVE_ROOT}/season-${seasonNumber}`
        );

    }


    /* =====================================================
   REPOSITORY PATH
========================================================= */

/*
    Normalize every Save Season write path so the
    GitHub writer always receives a path inside:

        assets/data/

    Accepted input:
        assets/data/...
        /assets/data/...
        https://raw.githubusercontent.com/.../assets/data/...
        archive/season-1/...

    Output:
        assets/data/...
*/

function toRepositoryPath(
    path
) {

    const value =
        String(
            path ??
            ""
        ).trim();


    if (
        !value
    ) {

        throw new Error(
            "GitHub write path is empty."
        );

    }


    const marker =
        "/assets/data/";


    const markerIndex =
        value.indexOf(
            marker
        );


    /* -------------------------------------------------
       FULL GITHUB / RAW URL
    ------------------------------------------------- */

    if (
        markerIndex >= 0
    ) {

        return (
            "assets/data/" +
            value.slice(
                markerIndex +
                marker.length
            )
        );

    }


    /* -------------------------------------------------
       ALREADY NORMALIZED PATH
    ------------------------------------------------- */

    if (
        value.startsWith(
            "assets/data/"
        )
    ) {

        return value;

    }


    /* -------------------------------------------------
       ROOT-RELATIVE ASSETS/DATA PATH
    ------------------------------------------------- */

    const normalized =
        value
            .replace(
                /^\/+/,
                ""
            )
            .replace(
                /^assets\/data\//,
                ""
            );


    /* -------------------------------------------------
       SAVE-SEASON DATA MAY ONLY EXIST INSIDE
       assets/data
    ------------------------------------------------- */

    return (
        "assets/data/" +
        normalized
    );

}

    /* =====================================================
       STEP 7 STATE
    ===================================================== */

    const state = {

        configured:
            false,

        season:
            null,

        officialDate:
            null,

        step7A:
            false,

        step7B:
            false,

        step7C:
            false,

        step7D:
            false,

        step7E:
            false,

        step7F:
            false,

        step7G:
            false

    };


    /* =====================================================
       ENGINE READY MESSAGE
    ===================================================== */

    console.info(
        `${LOG_PREFIX} ${ENGINE_NAME} ${ENGINE_VERSION} loaded.`
    );


    /* =====================================================
   STEP 7 — SET SEASON
=====================================================

   Stores the Season Number and Official Archive Date
   for the current Save Season operation.

   Nothing is written to GitHub here.

   Nothing is archived here.

   This step only configures the engine.

========================================================= */

function setSeason(
    season,
    officialDate
) {

    /* -------------------------------------------------
       NORMALIZE INPUT
    ------------------------------------------------- */

    const seasonNumber =
        normalizeSeason(
            season
        );

    const archiveDate =
        normalizeDate(
            officialDate
        );


    /* -------------------------------------------------
       STORE CONFIGURATION
    ------------------------------------------------- */

    state.season =
        seasonNumber;

    state.officialDate =
        archiveDate;

    state.configured =
        true;


    /* -------------------------------------------------
       RESET STEP STATUS
    -------------------------------------------------

       Changing the Season or Official Date creates
       a completely new Save Season operation.

       Therefore all previous Step 7 completion flags
       must be cleared.
    ------------------------------------------------- */

    state.step7A =
        false;

    state.step7B =
        false;

    state.step7C =
        false;

    state.step7D =
        false;

    state.step7E =
        false;

    state.step7F =
        false;

    state.step7G =
        false;


    /* -------------------------------------------------
       LOG
    ------------------------------------------------- */

    console.info(
        `${LOG_PREFIX} STEP 7 configured.`,
        {
            season:
                state.season,

            officialDate:
                state.officialDate
        }
    );


    /* -------------------------------------------------
       RETURN COPY
    ------------------------------------------------- */

    return getState();

}


/* =====================================================
   GET STATE
========================================================= */

function getState() {

    return clone(
        state
    );

}


/* =====================================================
   REQUIRE CONFIGURATION
=========================================================

   Every Step 7 operation will use this guard.

   No archive/write step is allowed to run before
   Season Number and Official Archive Date are set.
========================================================= */

function requireConfigured() {

    if (
        !state.configured
    ) {

        throw new Error(
            "Save Season is not configured. " +
            "Set Season Number and Official Archive Date first."
        );

    }


    requireValue(
        state.season,
        "Save Season Number is missing."
    );


    requireValue(
        state.officialDate,
        "Save Season Official Date is missing."
    );


    return true;

}


/* =====================================================
   RESET ENGINE
=========================================================

   Clears the current Step 7 configuration.

   This does NOT modify GitHub data.
========================================================= */

function reset() {

    state.configured =
        false;

    state.season =
        null;

    state.officialDate =
        null;

    state.step7A =
        false;

    state.step7B =
        false;

    state.step7C =
        false;

    state.step7D =
        false;

    state.step7E =
        false;

    state.step7F =
        false;

    state.step7G =
        false;


    console.info(
        `${LOG_PREFIX} STEP 7 state reset.`
    );


    return getState();

}

/* =====================================================
   STEP 7A — ARCHIVE
=========================================================

PURPOSE
-------
Create the permanent archive copies for the selected
Season.

STEP 7A ARCHIVES:

    Season Info
    Server vs Server

SOURCE
------
All source data is read directly from:

    k630-public-data

SOURCE FILES:

    generated/season-info/current.json

    generated/server-vs-server/current.json

DESTINATION
-----------
The completed Season is stored in:

    archive/season-{season}/

FILES:

    season-info.json

    server-vs-server.json

IMPORTANT
---------
The source current.json files are NOT changed here.

They remain available for the following steps.

STEP 7G is responsible for resetting the current
files for the next Season.

This step performs the actual GitHub writes.

========================================================= */


/* -----------------------------------------------------
   GET GITHUB WRITER
----------------------------------------------------- */

function getGitHubWriter() {

    const writer =
        global.K630GitHubWriter;


    if (
        !writer ||
        typeof writer.writeJson !==
            "function"
    ) {

        throw new Error(
            "K630GitHubWriter is not available."
        );

    }


    return writer;

}


/* -----------------------------------------------------
   WRITE JSON TO k630-public-data
----------------------------------------------------- */

async function writePublicDataJson(
    path,
    data,
    message
) {

    const writer =
        getGitHubWriter();


    if (
        !path
    ) {

        throw new Error(
            "GitHub write path is missing."
        );

    }


    if (
        data ===
        undefined
    ) {

        throw new Error(
            `GitHub write data is missing for ${path}.`
        );

    }


    const repositoryPath =
        toRepositoryPath(
            path
        );


    console.info(
        `${LOG_PREFIX} WRITE:`,
        repositoryPath
    );


    return await writer.writeJson(

        repositoryPath,

        clone(
            data
        ),

        message

    );

}

/* =====================================================
   PERSIST SAVE SEASON STEP STATUS
=========================================================

PURPOSE
-------
Persist the Save Season workflow state to:

    k630-public-data
    assets/data/config/admin-config.json

This is the permanent shared workflow state.

No localStorage.
No sessionStorage.
No browser cache.

Every Admin Center instance reads the same state.

========================================================= */

async function persistSaveSeasonStep(
    step,
    status,
    options = {}
) {

    const normalizedStep =
        normalizeText(
            step
        ).toUpperCase();


    if (
        !/^7[A-G]$/.test(
            normalizedStep
        )
    ) {

        throw new Error(
            `Invalid Save Season step: ${step}`
        );

    }


    const normalizedStatus =
        normalizeText(
            status
        ).toLowerCase();


    if (
        ![
            "waiting",
            "running",
            "completed",
            "error"
        ].includes(
            normalizedStatus
        )
    ) {

        throw new Error(
            `Invalid Save Season status: ${status}`
        );

    }


    /* -------------------------------------------------
       READ CURRENT ADMIN CONFIG
    ------------------------------------------------- */

    const currentConfig =
        await readJson(
            PATHS.ADMIN_CONFIG
        );


    if (
        !currentConfig ||
        typeof currentConfig !==
            "object"
    ) {

        throw new Error(
            "Save Season progress could not be saved: admin-config.json is empty or invalid."
        );

    }


    /* -------------------------------------------------
       ADMIN CONFIG ENGINE
    ------------------------------------------------- */

    const configEngine =
        global.K630AdminConfigEngine;


    if (
        !configEngine ||
        typeof configEngine.updateSaveSeason !==
            "function"
    ) {

        throw new Error(
            "K630AdminConfigEngine.updateSaveSeason() is not available."
        );

    }


    /* -------------------------------------------------
       DETERMINE CURRENT STEP
    ------------------------------------------------- */

    let currentStep =
        normalizedStep;


    if (
        normalizedStatus ===
        "completed"
    ) {

        const nextStep =
            normalizeText(
                options.nextStep
            ).toUpperCase();


        if (
            /^7[A-G]$/.test(
                nextStep
            )
        ) {

            currentStep =
                nextStep;

        } else {

            currentStep =
                normalizedStep;

        }

    }


    /* -------------------------------------------------
       OVERALL SAVE SEASON STATUS
    ------------------------------------------------- */

    let overallStatus =
        "running";


    if (
        normalizedStatus ===
        "error"
    ) {

        overallStatus =
            "error";

    }


    if (
        normalizedStep ===
            "7G" &&
        normalizedStatus ===
            "completed"
    ) {

        overallStatus =
            "completed";

    }


    /* -------------------------------------------------
       UPDATE ADMIN CONFIG
    ------------------------------------------------- */

    const nextConfig =
        configEngine.updateSaveSeason(
            currentConfig,
            {

                active:
                    true,

                seasonNumber:
                    normalizeSeason(
                        state.season
                    ),

                officialDate:
                    state.officialDate,

                currentStep,

                status:
                    overallStatus,

                step:
                    normalizedStep,

                stepStatus:
                    normalizedStatus,

                updatedAt:
                    nowIso(),

                updatedBy:
                    normalizeText(
                        options.updatedBy
                    )

            },
            {

                updatedBy:
                    normalizeText(
                        options.updatedBy
                    )

            }
        );


    /* -------------------------------------------------
       WRITE TO k630-public-data
    ------------------------------------------------- */

    await writePublicDataJson(

        PATHS.ADMIN_CONFIG,

        nextConfig,

        (
            `K630 Save Season ${state.season} ` +
            `${normalizedStep} ${normalizedStatus}`
        )

    );


    console.info(
        `${LOG_PREFIX} Persistent workflow state saved:`,
        normalizedStep,
        normalizedStatus
    );


    return nextConfig;

}

/* =====================================================
   STEP 7A — ARCHIVE SEASON
========================================================= */

async function step7AArchive(
    options = {}
) {

    /* -------------------------------------------------
       REQUIRE STEP 7 SET
    ------------------------------------------------- */

    if (
        !state.configured
    ) {

        throw new Error(
            "STEP 7A cannot start. " +
            "Set the Season Number and Official Archive Date first."
        );

    }

    await persistSaveSeasonStep(
    "7A",
    "running",
    {
        updatedBy:
            options.updatedBy
    }
);

    const season =
        state.season;


    /* -------------------------------------------------
       SOURCE PATHS
    ------------------------------------------------- */

    const seasonInfoSource =
        PATHS.SEASON_INFO;


    const serverVsServerSource =
        PATHS.SERVER_VS_SERVER;


    /* -------------------------------------------------
       ARCHIVE PATH
    ------------------------------------------------- */

    const archiveSeasonPath =
        getArchiveSeasonPath(
            season
        );


    const seasonInfoArchivePath =
        `${archiveSeasonPath}/season-info.json`;


    const serverVsServerArchivePath =
        `${archiveSeasonPath}/server-vs-server.json`;


    /* -------------------------------------------------
       LOG START
    ------------------------------------------------- */

    console.info(
        `${LOG_PREFIX} STEP 7A STARTED.`
    );


    console.info(
        `${LOG_PREFIX} Season:`,
        season
    );


    console.info(
        `${LOG_PREFIX} Archive Date:`,
        state.officialDate
    );


    /* =================================================
       READ SEASON INFO
    ================================================= */

    console.info(
        `${LOG_PREFIX} STEP 7A — Reading Season Info...`
    );


    const seasonInfo =
        await readJson(
            seasonInfoSource
        );


    if (
        !seasonInfo ||
        typeof seasonInfo !==
            "object"
    ) {

        throw new Error(
            "STEP 7A failed: Season Info is empty or invalid."
        );

    }


    /* =================================================
       READ SERVER VS SERVER
    ================================================= */

    console.info(
        `${LOG_PREFIX} STEP 7A — Reading Server vs Server...`
    );


    const serverVsServer =
        await readJson(
            serverVsServerSource
        );


    if (
        !serverVsServer ||
        typeof serverVsServer !==
            "object"
    ) {

        throw new Error(
            "STEP 7A failed: Server vs Server is empty or invalid."
        );

    }


    /* =================================================
       WRITE SEASON INFO ARCHIVE
    ================================================= */

    await writePublicDataJson(

        seasonInfoArchivePath,

        seasonInfo,

        `K630 Season ${season} - Archive Season Info`

    );


    console.info(
        `${LOG_PREFIX} Season Info archived:`,
        seasonInfoArchivePath
    );


    /* =================================================
       WRITE SERVER VS SERVER ARCHIVE
    ================================================= */

    await writePublicDataJson(

        serverVsServerArchivePath,

        serverVsServer,

        `K630 Season ${season} - Archive Server vs Server`

    );

    /* =================================================
   UPDATE ARCHIVE INDEX
================================================= */

const archiveIndexPath =
    `${PATHS.ARCHIVE_ROOT}/index.json`;


let archiveIndex = [];


/* -------------------------------------------------
   READ EXISTING ARCHIVE INDEX
------------------------------------------------- */

try {

    archiveIndex =
        await readJson(
            archiveIndexPath
        );


    if (
        !Array.isArray(
            archiveIndex
        )
    ) {

        archiveIndex =
            [];

    }

} catch (
    error
) {

    console.warn(
        `${LOG_PREFIX} Archive index could not be loaded. ` +
        `Creating a new index.`,
        error
    );


    archiveIndex =
        [];

}


/* -------------------------------------------------
   REMOVE EXISTING ENTRY FOR THIS SEASON
------------------------------------------------- */

archiveIndex =
    archiveIndex.filter(
        entry =>
            normalizeSeasonNumber(
                entry?.season
            ) !==
            season
    );


/* -------------------------------------------------
   ADD CURRENT SEASON
------------------------------------------------- */

archiveIndex.push({

    season:
        season,

    archivedAt:
    state.officialDate,

    seasonInfo:
        seasonInfoArchivePath,

    serverVsServer:
        serverVsServerArchivePath

});


/* -------------------------------------------------
   SORT NEWEST SEASON FIRST
------------------------------------------------- */

archiveIndex.sort(

    (
        first,
        second
    ) =>

        normalizeSeasonNumber(
            second?.season
        ) -

        normalizeSeasonNumber(
            first?.season
        )

);


/* -------------------------------------------------
   WRITE ARCHIVE INDEX
------------------------------------------------- */

await writePublicDataJson(

    archiveIndexPath,

    archiveIndex,

    `K630 Season ${season} - Archive Index`

);


console.info(
    `${LOG_PREFIX} Archive index updated:`,
    archiveIndex
);


    console.info(
        `${LOG_PREFIX} Server vs Server archived:`,
        serverVsServerArchivePath
    );

/* =================================================
   MARK STEP COMPLETE
================================================= */

state.step7A =
    true;

await persistSaveSeasonStep(
    "7A",
    "completed",
    {
        nextStep:
            "7B",

        updatedBy:
            options.updatedBy
    }
);

    console.info(
        `${LOG_PREFIX} STEP 7A COMPLETED.`
    );


    return {

        success:
            true,

        step:
            "7A",

        season:
            season,

        officialDate:
            state.officialDate,

        seasonInfo:
            seasonInfoArchivePath,

        serverVsServer:
            serverVsServerArchivePath

    };

}

/* =====================================================
   SELECT LAST AVAILABLE WEEK
========================================================= */

function selectLastAvailableWeek(
    seasonPlayer
) {

    if (
        !seasonPlayer ||
        typeof seasonPlayer !==
            "object"
    ) {

        return null;

    }


    const weeks =
        seasonPlayer.weeks;


    if (
        !weeks ||
        typeof weeks !==
            "object"
    ) {

        return null;

    }


    for (
        let weekNumber = 6;
        weekNumber >= 0;
        weekNumber -= 1
    ) {

        const weekKey =
            `W${weekNumber}`;


        const weekData =
            weeks[
                weekKey
            ];


        if (
            weekData &&
            weekData.available ===
                true
        ) {

            return {

                week:
                    weekKey,

                weekNumber:
                    weekNumber,

                data:
                    weekData

            };

        }

    }


    return null;

}

/* =====================================================
   STEP 7B — UPDATE SEASON DATA
========================================================= */

async function step7BSeasonData(
    options = {}
) {
    /* -------------------------------------------------
       STEP 7A MUST BE COMPLETE
    ------------------------------------------------- */

    if (
        !state.step7A
    ) {

        throw new Error(
            "STEP 7B cannot start. " +
            "STEP 7A — Archive must be completed first."
        );

    }


    /* -------------------------------------------------
       PERSIST — STEP 7B RUNNING
    ------------------------------------------------- */

    await persistSaveSeasonStep(
        "7B",
        "running",
        {
            updatedBy:
                options.updatedBy
        }
    );


    try {

        /* -------------------------------------------------
           READ SEASON INFO
        ------------------------------------------------- */

        console.info(
            `${LOG_PREFIX} STEP 7B — Reading Season Info...`
        );


        const seasonInfo =
            await readJson(
                PATHS.SEASON_INFO
            );


        if (
            !seasonInfo ||
            typeof seasonInfo !==
                "object"
        ) {

            throw new Error(
                "STEP 7B failed: Season Info is empty or invalid."
            );

        }


        /* -------------------------------------------------
           READ ACTIVE & AVERAGE
        ------------------------------------------------- */

        console.info(
            `${LOG_PREFIX} STEP 7B — Reading Active & Average...`
        );


        const activeAverage =
            await readJson(
                PATHS.ACTIVE_AVERAGE
            );


        if (
            !activeAverage ||
            typeof activeAverage !==
                "object"
        ) {

            throw new Error(
                "STEP 7B failed: Active & Average is empty or invalid."
            );

        }


        /* -------------------------------------------------
           GET PLAYER ARRAYS
        ------------------------------------------------- */

        const seasonPlayers =
            Array.isArray(
                seasonInfo.players
            )
                ? seasonInfo.players
                : [];


        const activePlayers =
            Array.isArray(
                activeAverage.players
            )
                ? activeAverage.players
                : [];


        if (
            !seasonPlayers.length
        ) {

            throw new Error(
                "STEP 7B failed: Season Info contains no players."
            );

        }


        if (
            !activePlayers.length
        ) {

            throw new Error(
                "STEP 7B failed: Active & Average contains no players."
            );

        }


        /* -------------------------------------------------
           SEASON NUMBER
        ------------------------------------------------- */

        const seasonNumber =
            normalizeSeason(
                state.season
            );


        /* -------------------------------------------------
           BUILD ACTIVE PLAYER LOOKUP
        ------------------------------------------------- */

        const activePlayerById =
            new Map();


        for (
            const player of
            activePlayers
        ) {

            const id =
                normalizeText(
                    player?.id
                );


            if (
                id
            ) {

                activePlayerById.set(
                    id,
                    player
                );

            }

        }


        /* -------------------------------------------------
           RESULT COUNTERS
        ------------------------------------------------- */

        let updatedPlayers =
            0;

        let selectedW6 =
            0;

        let selectedW5 =
            0;

        let selectedW4 =
            0;

        let selectedW3 =
            0;

        let selectedW2 =
            0;

        let selectedW1 =
            0;

        let selectedW0 =
            0;


        /* -------------------------------------------------
           TEMPORARY SELECTED DATA
        ------------------------------------------------- */

        const selectedSeasonData =
            [];


        /* =================================================
           PROCESS EVERY SEASON INFO PLAYER
        ================================================= */

        for (
            const seasonPlayer of
            seasonPlayers
        ) {

            const id =
                normalizeText(
                    seasonPlayer?.id
                );


            if (
                !id
            ) {

                continue;

            }


            /* ---------------------------------------------
               FIND SAME ID IN ACTIVE & AVERAGE
            --------------------------------------------- */

            const activePlayer =
                activePlayerById.get(
                    id
                );


            if (
                !activePlayer
            ) {

                throw new Error(
                    `STEP 7B failed: ID ${id} exists in Season Info ` +
                    `but does not exist in Active & Average.`
                );

            }


            /* ---------------------------------------------
               SELECT LAST AVAILABLE WEEK
            --------------------------------------------- */

            const selected =
                selectLastAvailableWeek(
                    seasonPlayer
                );


            if (
                !selected
            ) {

                throw new Error(
                    `STEP 7B failed: ID ${id} has no available ` +
                    `Season week from W6 through W0.`
                );

            }


            const weekData =
                selected.data;


            /* ---------------------------------------------
               COUNT SELECTED WEEK
            --------------------------------------------- */

            switch (
                selected.weekNumber
            ) {

                case 6:

                    selectedW6 +=
                        1;

                    break;


                case 5:

                    selectedW5 +=
                        1;

                    break;


                case 4:

                    selectedW4 +=
                        1;

                    break;


                case 3:

                    selectedW3 +=
                        1;

                    break;


                case 2:

                    selectedW2 +=
                        1;

                    break;


                case 1:

                    selectedW1 +=
                        1;

                    break;


                case 0:

                    selectedW0 +=
                        1;

                    break;

            }


            /* ---------------------------------------------
               HISTORICAL POWER
            ---------------------------------------------

               Season Power comes from Active &
               Average Historical Power.

               It does NOT come from weekly Power.
            --------------------------------------------- */

            const historicalPower =
                Number(
                    activePlayer
                        ?.historicalPower
                );


            if (
                !Number.isFinite(
                    historicalPower
                )
            ) {

                throw new Error(
                    `STEP 7B failed: ID ${id} has no valid Historical Power ` +
                    `in Active & Average.`
                );

            }


            /* ---------------------------------------------
               CREATE / PRESERVE SEASONS OBJECT
            --------------------------------------------- */

            if (
                !activePlayer.seasons ||
                typeof activePlayer.seasons !==
                    "object" ||
                Array.isArray(
                    activePlayer.seasons
                )
            ) {

                activePlayer.seasons =
                    {};

            }


            /* ---------------------------------------------
               WRITE CURRENT SEASON
            ---------------------------------------------

               Existing previous Seasons remain untouched.

               Only the selected Season is created or
               updated.
            --------------------------------------------- */

            activePlayer.seasons[
                String(
                    seasonNumber
                )
            ] = {

                season:
                    seasonNumber,

                currentPower:
                    historicalPower,

                merits:
                    weekData?.merits ??
                    0,

                meritPowerPercentage:
                    weekData
                        ?.meritPowerPercentage ??
                    null

            };


            /* ---------------------------------------------
               KEEP CURRENT SEASON MARKER
            --------------------------------------------- */

            activePlayer.currentSeason =
                seasonNumber;


            /* ---------------------------------------------
               STORE SELECTED DATA FOR LATER STEPS
            --------------------------------------------- */

            selectedSeasonData.push({

                id:
                    id,

                name:
                    seasonPlayer?.name ??
                    activePlayer?.name ??
                    "",

                selectedWeek:
                    selected.week,

                selectedWeekNumber:
                    selected.weekNumber,

                merits:
                    weekData?.merits ??
                    0,

                meritPowerPercentage:
                    weekData
                        ?.meritPowerPercentage ??
                    null,

                rank:
                    weekData?.rank ??
                    null,

                meritRank:
                    weekData?.meritRank ??
                    null,

                historicalPower:
                    historicalPower,

                activePlayer:
                    activePlayer

            });


            updatedPlayers +=
                1;

        }


        /* =================================================
           STORE UPDATED ACTIVE & AVERAGE
        ================================================= */

        state.activeAverageData =
            clone(
                activeAverage
            );

/* -------------------------------------------------
   WRITE UPDATED ACTIVE & AVERAGE
   TO k630-public-data
------------------------------------------------- */

console.info(
    `${LOG_PREFIX} STEP 7B — Writing Active & Average...`
);


await writePublicDataJson(

    PATHS.ACTIVE_AVERAGE,

    activeAverage,

    `K630 Season ${seasonNumber} - STEP 7B Active & Average`

);

        /* -------------------------------------------------
           KEEP SELECTED DATA FOR 7D / 7E
        ------------------------------------------------- */

        state.selectedSeasonData =
            selectedSeasonData;


        state.seasonInfo =
            clone(
                seasonInfo
            );


        /* -------------------------------------------------
           KEEP FINAL WEEK DATA AVAILABLE
        ------------------------------------------------- */

        state.server630WeekData =
            Array.isArray(
                seasonInfo
                    .server630WeekData
            )
                ? clone(
                    seasonInfo
                        .server630WeekData
                )
                : [];


        /* =================================================
           LOG SUMMARY
        ================================================= */

        console.info(
            `${LOG_PREFIX} STEP 7B — Season Data updated.`
        );


        console.info(
            `${LOG_PREFIX} Season:`,
            seasonNumber
        );


        console.info(
            `${LOG_PREFIX} Players updated:`,
            updatedPlayers
        );


        console.info(
            `${LOG_PREFIX} Selected W6:`,
            selectedW6
        );


        console.info(
            `${LOG_PREFIX} Selected W5:`,
            selectedW5
        );


        console.info(
            `${LOG_PREFIX} Selected W4:`,
            selectedW4
        );


        console.info(
            `${LOG_PREFIX} Selected W3:`,
            selectedW3
        );


        console.info(
            `${LOG_PREFIX} Selected W2:`,
            selectedW2
        );


        console.info(
            `${LOG_PREFIX} Selected W1:`,
            selectedW1
        );


        console.info(
            `${LOG_PREFIX} Selected W0:`,
            selectedW0
        );


        /* =================================================
           MARK STEP COMPLETE
        ================================================= */

        state.step7B =
            true;


        /* -------------------------------------------------
           PERSIST — STEP 7B COMPLETED
           NEXT STEP = 7C
        ------------------------------------------------- */

        await persistSaveSeasonStep(
            "7B",
            "completed",
            {
                nextStep:
                    "7C",

                updatedBy:
                    options.updatedBy
            }
        );


        console.info(
            `${LOG_PREFIX} STEP 7B COMPLETED.`
        );


        /* =================================================
           RETURN RESULT
        ================================================= */

        return {

            success:
                true,

            step:
                "7B",

            season:
                seasonNumber,

            playersUpdated:
                updatedPlayers,

            selectedWeeks: {

                W6:
                    selectedW6,

                W5:
                    selectedW5,

                W4:
                    selectedW4,

                W3:
                    selectedW3,

                W2:
                    selectedW2,

                W1:
                    selectedW1,

                W0:
                    selectedW0

            },

            data:
                clone(
                    activeAverage
                )

        };

    } catch (
        error
    ) {

        /* -------------------------------------------------
           PERSIST — STEP 7B ERROR
        ------------------------------------------------- */

        try {

            await persistSaveSeasonStep(
                "7B",
                "error",
                {
                    updatedBy:
                        options.updatedBy
                }
            );

        } catch (
            persistError
        ) {

            console.error(
                `${LOG_PREFIX} STEP 7B error status could not be persisted:`,
                persistError
            );

        }


        console.error(
            `${LOG_PREFIX} STEP 7B FAILED:`,
            error
        );


        throw error;

    }

}

/* =====================================================
   STEP 7C — AVERAGE MERITS
=========================================================

PURPOSE
-------
Calculate the player's Average Merits values after
the completed Season has been added to Active & Average.

CALCULATIONS
------------

Average Merits (V):

    SUM of all available Season Merits
    -----------------------------------
    number of Seasons with data


Average Merits (%):

    SUM of all available Season M-P (%)
    ------------------------------------
    number of Seasons with data


IMPORTANT
---------
A player does NOT have to participate in every Season.

Example:

    Season 3
    Season 4
    Season 5

participated in 3 Seasons.

Therefore:

    Average = total / 3


Another example:

    Season 2
    Season 3
    Season 6
    Season 7
    Season 8

participated in 5 Seasons.

Therefore:

    Average = total / 5


IMPORTANT ZERO RULE
-------------------
0 IS VALID DATA.

Example:

    Season 3 Merits = 0

This Season DOES count as a participating Season.

Only:

    null
    undefined
    missing Season entry

means that the player has no data for that Season.

SOURCE
------
Current Active & Average:

    k630-public-data
    generated/active-average/current.json

The complete dataset is kept intact.

STEP 7C only changes:

    averageMeritsValue

    averageMeritsPercentage

The actual GitHub write is performed by the later
Save Season write step.

========================================================= */


/* -----------------------------------------------------
   CHECK WHETHER A SEASON VALUE IS VALID
----------------------------------------------------- */

function isValidSeasonAverageValue(
    value
) {

    /*
     * null and undefined mean:
     *
     * no Season data
     */

    if (
        value === null ||
        value === undefined
    ) {

        return false;

    }


    /*
     * Empty strings are also treated as
     * missing data.
     */

    if (
        typeof value ===
            "string" &&
        value.trim() ===
            ""
    ) {

        return false;

    }


    /*
     * Zero is VALID.
     */

    const numericValue =
        Number(
            value
        );


    return Number.isFinite(
        numericValue
    );

}


/* -----------------------------------------------------
   CALCULATE PLAYER AVERAGES
----------------------------------------------------- */

function calculatePlayerSeasonAverages(
    player
) {

    const seasons =
        player?.seasons;


    /*
     * No season object.
     */

    if (
        !seasons ||
        typeof seasons !==
            "object"
    ) {

        return {

            averageMeritsValue:
                null,

            averageMeritsPercentage:
                null,

            seasonsPlayedForAverage:
                0

        };

    }


    let meritsTotal =
        0;

    let meritsCount =
        0;


    let percentageTotal =
        0;

    let percentageCount =
        0;


    /*
     * Read every Season dynamically.
     *
     * We do NOT hard-code:
     *
     * Season 1
     * Season 2
     * Season 3
     *
     * etc.
     *
     * This allows the engine to continue working
     * when future Seasons are added.
     */

    Object.entries(
        seasons
    ).forEach(
        (
            [
                seasonNumber,
                seasonData
            ]
        ) => {

            if (
                !seasonData ||
                typeof seasonData !==
                    "object"
            ) {

                return;

            }


            /* -----------------------------------------
               MERITS
            ----------------------------------------- */

            if (
                isValidSeasonAverageValue(
                    seasonData.merits
                )
            ) {

                meritsTotal +=
                    Number(
                        seasonData.merits
                    );

                meritsCount +=
                    1;

            }


            /* -----------------------------------------
               MERITS %
            ----------------------------------------- */

            if (
                isValidSeasonAverageValue(
                    seasonData
                        .meritPowerPercentage
                )
            ) {

                percentageTotal +=
                    Number(
                        seasonData
                            .meritPowerPercentage
                    );

                percentageCount +=
                    1;

            }

        }
    );


    /* -----------------------------------------------
       AVERAGE MERITS VALUE
    ----------------------------------------------- */

    const averageMeritsValue =
        meritsCount >
        0

            ? Math.round(
                meritsTotal /
                meritsCount
            )

            : null;


    /* -----------------------------------------------
       AVERAGE MERITS %
    ----------------------------------------------- */

    const averageMeritsPercentage =
        percentageCount >
        0

            ? Number(
                (
                    percentageTotal /
                    percentageCount
                ).toFixed(
                    2
                )
            )

            : null;


    return {

        averageMeritsValue,

        averageMeritsPercentage,

        seasonsPlayedForAverage:
            Math.max(
                meritsCount,
                percentageCount
            ),

        meritsSeasonCount:
            meritsCount,

        percentageSeasonCount:
            percentageCount

    };

}

/* =====================================================
   STEP 7C — CALCULATE AVERAGES
========================================================= */

async function step7CAverages() {

    /* -------------------------------------------------
       STEP 7B MUST BE COMPLETE
    ------------------------------------------------- */

    if (
        !state.step7B
    ) {

        throw new Error(
            "STEP 7C cannot start. " +
            "STEP 7B — Season Data must be completed first."
        );

    }

    /* -------------------------------------------------
       PERSIST — STEP 7C RUNNING
    ------------------------------------------------- */

    await persistSaveSeasonStep(
        "7C",
        "running",
        {
            updatedBy:
                arguments?.[0]?.updatedBy
        }
    );

    try {

        /* -------------------------------------------------
           LOAD ACTIVE & AVERAGE
        ------------------------------------------------- */

        console.info(
            `${LOG_PREFIX} STEP 7C — Reading Active & Average...`
        );

        const activeAverage =
            await readJson(
                PATHS.ACTIVE_AVERAGE
            );


        if (
            !activeAverage ||
            typeof activeAverage !==
                "object"
        ) {

            throw new Error(
                "STEP 7C failed: Active & Average is empty or invalid."
            );

        }


        /* -------------------------------------------------
           READ PLAYERS
        ------------------------------------------------- */

        const players =
            Array.isArray(
                activeAverage.players
            )

                ? activeAverage.players

                : [];


        if (
            !players.length
        ) {

            throw new Error(
                "STEP 7C failed: Active & Average contains no players."
            );

        }


        /* -------------------------------------------------
           CALCULATE AVERAGE FOR EVERY PLAYER
        ------------------------------------------------- */

        let playersWithAverage =
            0;

        let playersWithoutSeasonData =
            0;

        let totalSeasonEntriesUsed =
            0;


        for (
            const player of
            players
        ) {

            if (
                !player ||
                typeof player !==
                    "object"
            ) {

                continue;

            }


            const averages =
                calculatePlayerSeasonAverages(
                    player
                );


            /* ---------------------------------------------
               SAVE AVERAGE MERITS
            --------------------------------------------- */

            player.averageMeritsValue =
                averages
                    .averageMeritsValue;


            /* ---------------------------------------------
               SAVE AVERAGE MERITS %
            --------------------------------------------- */

            player.averageMeritsPercentage =
                averages
                    .averageMeritsPercentage;


            /* ---------------------------------------------
               COUNT
            --------------------------------------------- */

            if (
                averages
                    .seasonsPlayedForAverage >
                0
            ) {

                playersWithAverage +=
                    1;

                totalSeasonEntriesUsed +=
                    averages
                        .seasonsPlayedForAverage;

            } else {

                playersWithoutSeasonData +=
                    1;

            }

        }


        /* =================================================
           WRITE UPDATED ACTIVE & AVERAGE
        ================================================= */

        console.info(
            `${LOG_PREFIX} STEP 7C — Writing updated Active & Average...`
        );


        await writePublicDataJson(

            PATHS.ACTIVE_AVERAGE,

            activeAverage,

            `K630 Season ${state.season} - Calculate Averages`

        );


        /* -------------------------------------------------
           REFRESH ACTIVE & AVERAGE PAGE
        ------------------------------------------------- */

        try {

            document.dispatchEvent(
                new CustomEvent(
                    "k630:active-average-refresh"
                )
            );

        } catch (
            refreshError
        ) {

            console.warn(
                `${LOG_PREFIX} Active & Average refresh event could not be dispatched:`,
                refreshError
            );

        }


        /* -------------------------------------------------
           STORE UPDATED DATA IN ENGINE STATE
        ------------------------------------------------- */

        state.activeAverageData =
            clone(
                activeAverage
            );


        state.activeAverageResult = {

            success:
                true,

            data:
                clone(
                    activeAverage
                ),

            summary: {

                playerCount:
                    players.length,

                playersWithAverage:
                    playersWithAverage,

                playersWithoutSeasonData:
                    playersWithoutSeasonData,

                totalSeasonEntriesUsed:
                    totalSeasonEntriesUsed

            }

        };


        /* -------------------------------------------------
           LOG SUMMARY
        ------------------------------------------------- */

        console.info(
            `${LOG_PREFIX} STEP 7C — Average calculations completed.`
        );


        console.info(
            `${LOG_PREFIX} Players:`,
            players.length
        );


        console.info(
            `${LOG_PREFIX} Players with average:`,
            playersWithAverage
        );


        console.info(
            `${LOG_PREFIX} Players without season data:`,
            playersWithoutSeasonData
        );


        console.info(
            `${LOG_PREFIX} Season entries used:`,
            totalSeasonEntriesUsed
        );


        /* -------------------------------------------------
           PERSIST — STEP 7C COMPLETED
        ------------------------------------------------- */

        await persistSaveSeasonStep(
            "7C",
            "completed",
            {
                updatedBy:
                    arguments?.[0]?.updatedBy
            }
        );


        /* -------------------------------------------------
           MARK STEP COMPLETE
        ------------------------------------------------- */

        state.step7C =
            true;


        console.info(
            `${LOG_PREFIX} STEP 7C COMPLETED.`
        );


        /* -------------------------------------------------
           RETURN RESULT
        ------------------------------------------------- */

        return {

            success:
                true,

            step:
                "7C",

            summary:
                clone(
                    state.activeAverageResult
                        .summary
                )

        };


    } catch (
        error
    ) {

        /* -------------------------------------------------
           PERSIST — STEP 7C ERROR
        ------------------------------------------------- */

        try {

            await persistSaveSeasonStep(
                "7C",
                "error",
                {
                    updatedBy:
                        arguments?.[0]?.updatedBy
                }
            );

        } catch (
            persistError
        ) {

            console.error(
                `${LOG_PREFIX} STEP 7C error status could not be persisted:`,
                persistError
            );

        }


        console.error(
            `${LOG_PREFIX} STEP 7C FAILED:`,
            error
        );


        throw error;

    }

}

/* =====================================================
   STEP 7D — UPDATE NOTE
=========================================================

PURPOSE
-------
Copy the Note information from the completed Season
Info dataset to the matching ID in Active & Average.

SOURCE
------
k630-public-data

    generated/season-info/current.json

TARGET
------
k630-public-data

    generated/active-average/current.json

MATCH
-----
Players are matched by ID.

NOTE DATA
---------
The existing Season Info Note structure is copied:

    notes

    noteFlags.new

    noteFlags.left

    noteFlags.afk

    leftDuringSeason

    dateLeftKingdom

IMPORTANT
---------
The Note symbols are NOT recreated here.

They already exist in Season Info.

For example:

    noteFlags.left = true

is copied to Active & Average.

The Active & Average page can then display the
corresponding triangle symbol.

IMPORTANT
---------
STEP 7D does not calculate Server Status.

STEP 7D does not calculate averages.

STEP 7D does not create Season columns.

STEP 7D only updates Note information.

/* =====================================================
   STEP 7D — UPDATE NOTES
========================================================= */

async function step7DUpdateNotes(
    options = {}
) {

    /* -------------------------------------------------
       STEP 7C MUST BE COMPLETE
    ------------------------------------------------- */

    if (
        !state.step7C
    ) {

        throw new Error(
            "STEP 7D cannot start. " +
            "STEP 7C — Averages must be completed first."
        );

    }


    /* -------------------------------------------------
       PERSIST — STEP 7D RUNNING
    ------------------------------------------------- */

    await persistSaveSeasonStep(
        "7D",
        "running",
        {
            updatedBy:
                options.updatedBy
        }
    );


    try {

        /* -------------------------------------------------
           READ ACTIVE & AVERAGE
        ------------------------------------------------- */

        console.info(
            `${LOG_PREFIX} STEP 7D — Reading Active & Average...`
        );


        const activeAverage =
            await readJson(
                PATHS.ACTIVE_AVERAGE
            );


        if (
            !activeAverage ||
            typeof activeAverage !==
                "object"
        ) {

            throw new Error(
                "STEP 7D failed: Active & Average is empty or invalid."
            );

        }


        /* -------------------------------------------------
           READ SEASON INFO
        ------------------------------------------------- */

        console.info(
            `${LOG_PREFIX} STEP 7D — Reading Season Info...`
        );


        const seasonInfo =
            await readJson(
                PATHS.SEASON_INFO
            );


        if (
            !seasonInfo ||
            typeof seasonInfo !==
                "object"
        ) {

            throw new Error(
                "STEP 7D failed: Season Info is empty or invalid."
            );

        }


        /* -------------------------------------------------
           PLAYER ARRAYS
        ------------------------------------------------- */

        const seasonPlayers =
            Array.isArray(
                seasonInfo.players
            )
                ? seasonInfo.players
                : [];


        const activePlayers =
            Array.isArray(
                activeAverage.players
            )
                ? activeAverage.players
                : [];


        if (
            !seasonPlayers.length
        ) {

            throw new Error(
                "STEP 7D failed: Season Info contains no players."
            );

        }


        if (
            !activePlayers.length
        ) {

            throw new Error(
                "STEP 7D failed: Active & Average contains no players."
            );

        }


        /* -------------------------------------------------
           BUILD SEASON INFO LOOKUP
        ------------------------------------------------- */

        const seasonPlayerById =
            new Map();


        for (
            const player of
            seasonPlayers
        ) {

            const id =
                normalizeText(
                    player?.id
                );


            if (
                id
            ) {

                seasonPlayerById.set(
                    id,
                    player
                );

            }

        }


        /* -------------------------------------------------
           COUNTERS
        ------------------------------------------------- */

        let updatedPlayers =
            0;

        let playersWithNote =
            0;

        let playersWithoutNote =
            0;

        let playersMarkedLeft =
            0;


        /* =================================================
           PROCESS EVERY ACTIVE PLAYER
        ================================================= */

        for (
            const activePlayer of
            activePlayers
        ) {

            const id =
                normalizeText(
                    activePlayer?.id
                );


            if (
                !id
            ) {

                continue;

            }


            const seasonPlayer =
                seasonPlayerById.get(
                    id
                );


            /* =================================================
               PLAYER STILL EXISTS IN SEASON INFO
            ================================================= */

            if (
                seasonPlayer
            ) {

                /* ---------------------------------------------
                   COPY NOTES
                --------------------------------------------- */

                activePlayer.notes =
                    Array.isArray(
                        seasonPlayer.notes
                    )
                        ? clone(
                            seasonPlayer.notes
                        )
                        : [];


                /* ---------------------------------------------
                   COPY SYMBOL FLAGS
                   
                   new  = STAR
                   left = TRIANGLE
                   afk  = AFK SYMBOL
                --------------------------------------------- */

                const sourceNoteFlags =
                    seasonPlayer.noteFlags ||
                    {};


                activePlayer.noteFlags = {

                    new:
                        sourceNoteFlags.new ===
                        true,

                    left:
                        sourceNoteFlags.left ===
                        true,

                    afk:
                        sourceNoteFlags.afk ===
                        true

                };


                /* ---------------------------------------------
                   LEFT DURING SEASON
                --------------------------------------------- */

                activePlayer.leftDuringSeason =
                    seasonPlayer.leftDuringSeason ===
                    true ||
                    activePlayer.noteFlags.left ===
                    true;


                /* ---------------------------------------------
                   DATE LEFT KINGDOM
                --------------------------------------------- */

                activePlayer.dateLeftKingdom =
                    normalizeText(
                        seasonPlayer.dateLeftKingdom
                    ) ||
                    null;


                updatedPlayers +=
                    1;


            } else {

                /* =================================================
                   PLAYER DISAPPEARED FROM SEASON INFO
                   
                   Mark as LEFT.
                   This creates the TRIANGLE symbol.
                ================================================= */

                activePlayer.notes = [
                    "leftDuringSeason"
                ];


                activePlayer.noteFlags = {

                    new:
                        false,

                    left:
                        true,

                    afk:
                        false

                };


                activePlayer.leftDuringSeason =
                    true;


                activePlayer.dateLeftKingdom =
                    state.officialDate;


                playersMarkedLeft +=
                    1;

                updatedPlayers +=
                    1;

            }


            /* -------------------------------------------------
               COUNT RESULT
            ------------------------------------------------- */

            const hasNote =
                activePlayer.noteFlags?.new ===
                    true ||

                activePlayer.noteFlags?.left ===
                    true ||

                activePlayer.noteFlags?.afk ===
                    true ||

                (
                    Array.isArray(
                        activePlayer.notes
                    ) &&
                    activePlayer.notes.length >
                        0
                );


            if (
                hasNote
            ) {

                playersWithNote +=
                    1;

            } else {

                playersWithoutNote +=
                    1;

            }

        }


        /* =================================================
           STORE UPDATED DATA
        ================================================= */

        state.activeAverageData =
            clone(
                activeAverage
            );


        /* =================================================
           WRITE ACTIVE & AVERAGE
        ================================================= */

        console.info(
            `${LOG_PREFIX} STEP 7D — Writing updated Active & Average...`
        );


        await writePublicDataJson(

            PATHS.ACTIVE_AVERAGE,

            activeAverage,

            `K630 Season ${state.season} - STEP 7D Update Notes`

        );


        /* -------------------------------------------------
           REFRESH ACTIVE & AVERAGE PAGE
        ------------------------------------------------- */

        try {

            document.dispatchEvent(
                new CustomEvent(
                    "k630:active-average-refresh"
                )
            );

        } catch (
            refreshError
        ) {

            console.warn(
                `${LOG_PREFIX} Active & Average refresh event could not be dispatched:`,
                refreshError
            );

        }


        /* =================================================
           LOG SUMMARY
        ================================================= */

        console.info(
            `${LOG_PREFIX} STEP 7D — Notes updated.`
        );


        console.info(
            `${LOG_PREFIX} Players updated:`,
            updatedPlayers
        );


        console.info(
            `${LOG_PREFIX} Players with Note:`,
            playersWithNote
        );


        console.info(
            `${LOG_PREFIX} Players without Note:`,
            playersWithoutNote
        );


        console.info(
            `${LOG_PREFIX} Players marked Left:`,
            playersMarkedLeft
        );


        /* =================================================
           MARK STEP COMPLETE
        ================================================= */

        state.step7D =
            true;


        /* -------------------------------------------------
           PERSIST — STEP 7D COMPLETED
           NEXT STEP = 7E
        ------------------------------------------------- */

        await persistSaveSeasonStep(
            "7D",
            "completed",
            {
                nextStep:
                    "7E",

                updatedBy:
                    options.updatedBy
            }
        );


        console.info(
            `${LOG_PREFIX} STEP 7D COMPLETED.`
        );


        return {

            success:
                true,

            step:
                "7D",

            playersUpdated:
                updatedPlayers,

            playersWithNote:
                playersWithNote,

            playersWithoutNote:
                playersWithoutNote,

            playersMarkedLeft:
                playersMarkedLeft

        };


    } catch (
        error
    ) {

        /* -------------------------------------------------
           PERSIST — STEP 7D ERROR
        ------------------------------------------------- */

        try {

            await persistSaveSeasonStep(
                "7D",
                "error",
                {
                    updatedBy:
                        options.updatedBy
                }
            );

        } catch (
            persistError
        ) {

            console.error(
                `${LOG_PREFIX} STEP 7D error status could not be persisted:`,
                persistError
            );

        }


        console.error(
            `${LOG_PREFIX} STEP 7D FAILED:`,
            error
        );


        throw error;

    }

}

/* =====================================================
   STEP 7E — UPDATE SERVER STATUS
=========================================================

PURPOSE
-------
Determine the player's new Server Status LV after
the completed Season.

SOURCE
------
1. Active & Average
2. Season Info
3. Admin Config

---------------------------------------------------------
SERVER STATUS RULES
---------------------------------------------------------

NEW ID
-------
Every new ID starts at:

    LV2


REJOIN ID
---------
Every rejoin ID starts at:

    LV2


LV2
---
Rank Move:
    LV2 -> LV1

Rank 1:
    LV2 -> LV2

Rank 2:
    LV2 -> LV2

Rank 3:
    LV2 -> LV2

Rank 3 + required Merit %:
    LV2 -> LV3


LV1
---
Rank Move:
    LV1 -> LV0

Rank 1:
    LV1 -> LV1

Rank 2:
    LV1 -> LV2

Rank 3:
    LV1 -> LV2


LV0
---
LV0 cannot participate in the next Season.

The player is NOT deleted by this engine.

The engine reports the player so the Admin/Owner
can remove the ID from the Kingdom in-game.


---------------------------------------------------------
LV3 MERIT RULE
---------------------------------------------------------

LV3 is only possible for:

    LV2 + Rank 3

The LV3 threshold is:

    Rank 3 target + 8 percentage points


EXAMPLE T5
-----------

Rank 3 target:

    12%

LV3 threshold:

    12% + 8%
    = 20%


EXAMPLE FUTURE CONFIGURATION
----------------------------

Rank 3 target:

    16%

LV3 threshold:

    16% + 8%
    = 24%


Therefore:

    Rank 3 + 19.99%
        -> LV2

    Rank 3 + 20.00%
        -> LV3

when the Rank 3 target is 12%.


---------------------------------------------------------
IMPORTANT
---------------------------------------------------------

The Rank 3 target comes from Admin Config.

The +8 percentage points are the fixed K630
LV3 promotion rule.

STEP 7E does not delete LV0 players.

STEP 7E only updates the calculated Server Status.

========================================================= */


/* -----------------------------------------------------
   NORMALIZE SERVER STATUS LEVEL
----------------------------------------------------- */

function normalizeServerStatusLevel(
    value
) {

    const text =
        normalizeText(
            value
        ).toUpperCase();


    const match =
        text.match(
            /LV\s*(\d+)/
        );


    if (
        !match
    ) {

        return 2;

    }


    const level =
        Number(
            match[1]
        );


    if (
        !Number.isFinite(
            level
        )
    ) {

        return 2;

    }


    return Math.max(
        0,
        Math.min(
            3,
            Math.trunc(
                level
            )
        )
    );

}


/* -----------------------------------------------------
   FORMAT SERVER STATUS
----------------------------------------------------- */

function formatServerStatusLevel(
    level
) {

    return `LV${Math.max(
        0,
        Math.min(
            3,
            Math.trunc(
                Number(level) || 0
            )
        )
    )}`;

}


/* -----------------------------------------------------
   NORMALIZE SEASON RANK
----------------------------------------------------- */

function normalizeSeasonRank(
    value
) {

    const text =
        normalizeText(
            value
        ).toUpperCase();


    /* -------------------------------------------------
       MOVE
    ------------------------------------------------- */

    if (
        text ===
        "MOVE"
    ) {

        return "MOVE";

    }


    /* -------------------------------------------------
       CONVERT TO NUMBER
    ------------------------------------------------- */

    const number =
        Number(
            text
        );


    /* -------------------------------------------------
       NO MERIT RANK
       
       0 = player participated,
           but did not achieve enough merits.

       Internally this becomes -1:
       no Server Status change.
    ------------------------------------------------- */

    if (
        number ===
        0
    ) {

        return "-1";

    }


    /* -------------------------------------------------
       RANK 1
    ------------------------------------------------- */

    if (
        number ===
        1
    ) {

        return "1";

    }


    /* -------------------------------------------------
       RANK 2
    ------------------------------------------------- */

    if (
        number ===
        2
    ) {

        return "2";

    }


    /* -------------------------------------------------
       RANK 3
    ------------------------------------------------- */

    if (
        number ===
        3
    ) {

        return "3";

    }


    /* -------------------------------------------------
       UNKNOWN / EMPTY
    ------------------------------------------------- */

    return text;

}


/* -----------------------------------------------------
   GET TROOP TIER
----------------------------------------------------- */

function normalizeTroopTier(
    player
) {

    const directTier =
        normalizeText(
            player?.troopTier
        ).toUpperCase();


    if (
        directTier ===
            "T4" ||
        directTier ===
            "T5"
    ) {

        return directTier;

    }


    const tierValue =
        Number(
            player?.troopTier
        );


    if (
        tierValue ===
        4
    ) {

        return "T4";

    }


    if (
        tierValue ===
        5
    ) {

        return "T5";

    }


    return "T4";

}


/* -----------------------------------------------------
   GET RANK 3 TARGET FROM ADMIN CONFIG
----------------------------------------------------- */

function getRank3MeritTarget(
    adminConfig,
    troopTier
) {

    const target =
        Number(
            adminConfig
                ?.meritConfiguration
                ?.w6
                ?.[troopTier]
                ?.rank3
        );


    if (
        !Number.isFinite(
            target
        )
    ) {

        throw new Error(
            `STEP 7E failed: No Rank 3 Merit target configured for ${troopTier}.`
        );

    }


    return target;

}


/* -----------------------------------------------------
   CALCULATE LV3 MERIT THRESHOLD
----------------------------------------------------- */

function calculateLv3MeritThreshold(
    rank3Target
) {

    /*
     * FIXED K630 RULE:
     *
     * Rank 3 target + 8 percentage points.
     *
     * 12% -> 20%
     * 16% -> 24%
     */

    return (
        Number(
            rank3Target
        ) +
        8
    );

}


/* -----------------------------------------------------
   DETECT NEW / REJOIN
----------------------------------------------------- */

function isNewOrRejoinPlayer(
    player
) {

    const noteFlags =
        player?.noteFlags;


    const isNew =
        noteFlags?.new ===
        true;


    const hasRejoinDate =
        Boolean(
            normalizeText(
                player?.rejoinDate
            )
        );


    return (
        isNew ||
        hasRejoinDate
    );

}


/* =====================================================
   CALCULATE NEXT SERVER STATUS
========================================================= */

/* =====================================================
   CALCULATE NEXT SERVER STATUS
========================================================= */

function calculateNextServerStatus(
    player,
    selectedSeasonData,
    adminConfig
) {

    /* -------------------------------------------------
       NEW / REJOIN
    ------------------------------------------------- */

    if (
        isNewOrRejoinPlayer(
            player
        )
    ) {

        return {

            previousLevel:
                normalizeServerStatusLevel(
                    player?.serverStatus
                ),

            newLevel:
                2,

            newStatus:
                "LV2",

            reason:
                "NEW_OR_REJOIN"

        };

    }


    /* -------------------------------------------------
       CURRENT LEVEL
    ------------------------------------------------- */

    const currentLevel =
        normalizeServerStatusLevel(
            player?.serverStatus
        );


    /* -------------------------------------------------
       SEASON RANK
    ------------------------------------------------- */

    const rank =
        normalizeSeasonRank(
            selectedSeasonData?.rank
        );


    /* -------------------------------------------------
       MERIT POWER PERCENTAGE
    ------------------------------------------------- */

    const meritPercentage =
        Number(
            selectedSeasonData
                ?.meritPowerPercentage
        );


    const hasMeritPercentage =
        Number.isFinite(
            meritPercentage
        );


    /* -------------------------------------------------
       ALREADY LV0
    ------------------------------------------------- */

    if (
        currentLevel <=
        0
    ) {

        return {

            previousLevel:
                0,

            newLevel:
                0,

            newStatus:
                "LV0",

            reason:
                "ALREADY_LV0"

        };

    }


    /* -------------------------------------------------
       RANK -1
       
       Player participated but did not
       achieve enough merits.
       
       KEEP CURRENT STATUS.
    ------------------------------------------------- */

    if (
        rank ===
        "-1"
    ) {

        return {

            previousLevel:
                currentLevel,

            newLevel:
                currentLevel,

            newStatus:
                formatServerStatusLevel(
                    currentLevel
                ),

            reason:
                "NO_MERIT_RANK"

        };

    }


    /* -------------------------------------------------
       RANK MOVE
    ------------------------------------------------- */

    if (
        rank ===
        "MOVE"
    ) {

        const newLevel =
            Math.max(
                0,
                currentLevel - 1
            );


        return {

            previousLevel:
                currentLevel,

            newLevel:
                newLevel,

            newStatus:
                formatServerStatusLevel(
                    newLevel
                ),

            reason:
                "RANK_MOVE"

        };

    }


    /* -------------------------------------------------
       RANK 1
    ------------------------------------------------- */

    if (
        rank ===
        "1"
    ) {

        return {

            previousLevel:
                currentLevel,

            newLevel:
                currentLevel,

            newStatus:
                formatServerStatusLevel(
                    currentLevel
                ),

            reason:
                "RANK_1"

        };

    }


    /* -------------------------------------------------
       RANK 2
    ------------------------------------------------- */

    if (
        rank ===
        "2"
    ) {

        const newLevel =
            currentLevel ===
                1
                ? 2
                : currentLevel;


        return {

            previousLevel:
                currentLevel,

            newLevel:
                newLevel,

            newStatus:
                formatServerStatusLevel(
                    newLevel
                ),

            reason:
                "RANK_2"

        };

    }


    /* -------------------------------------------------
       RANK 3
    ------------------------------------------------- */

    if (
        rank ===
        "3"
    ) {

        /* ---------------------------------------------
           LV1 + RANK 3 -> LV2
        --------------------------------------------- */

        if (
            currentLevel ===
            1
        ) {

            return {

                previousLevel:
                    1,

                newLevel:
                    2,

                newStatus:
                    "LV2",

                reason:
                    "LV1_RANK_3"

            };

        }


        /* ---------------------------------------------
           LV2 + RANK 3
           
           IMPORTANT:
           Use the merit target directly from
           Season Info for the selected week.
        --------------------------------------------- */

        if (
            currentLevel ===
            2
        ) {

            const troopTier =
                normalizeTroopTier(
                    player
                );


            const rank3Target =
                Number(
                    selectedSeasonData
                        ?.meritTargets
                        ?.rank3
                );


            /* -----------------------------------------
               NO RANK 3 TARGET
               
               Do NOT crash the workflow.
               Keep current status.
            ----------------------------------------- */

            if (
                !Number.isFinite(
                    rank3Target
                )
            ) {

                return {

                    previousLevel:
                        2,

                    newLevel:
                        2,

                    newStatus:
                        "LV2",

                    reason:
                        "NO_RANK3_TARGET",

                    troopTier:
                        troopTier,

                    rank3Target:
                        null,

                    meritPercentage:
                        hasMeritPercentage
                            ? meritPercentage
                            : null

                };

            }


            const lv3Threshold =
                calculateLv3MeritThreshold(
                    rank3Target
                );


            /* -----------------------------------------
               LV3 REQUIREMENT
            ----------------------------------------- */

            if (
                hasMeritPercentage &&
                meritPercentage >=
                    lv3Threshold
            ) {

                return {

                    previousLevel:
                        2,

                    newLevel:
                        3,

                    newStatus:
                        "LV3",

                    reason:
                        "LV2_RANK_3_LV3_THRESHOLD",

                    troopTier:
                        troopTier,

                    rank3Target:
                        rank3Target,

                    lv3Threshold:
                        lv3Threshold,

                    meritPercentage:
                        meritPercentage

                };

            }


            /* -----------------------------------------
               REMAIN LV2
            ----------------------------------------- */

            return {

                previousLevel:
                    2,

                newLevel:
                    2,

                newStatus:
                    "LV2",

                reason:
                    "LV2_RANK_3_BELOW_LV3_THRESHOLD",

                troopTier:
                    troopTier,

                rank3Target:
                    rank3Target,

                lv3Threshold:
                    lv3Threshold,

                meritPercentage:
                    hasMeritPercentage
                        ? meritPercentage
                        : null

            };

        }

    }


    /* -------------------------------------------------
       UNKNOWN RANK
    ------------------------------------------------- */

    throw new Error(
        `STEP 7E failed: ID ${player?.id ?? "UNKNOWN"} ` +
        `has an unsupported Season rank: ${rank}.`
    );

}


/* =====================================================
   STEP 7E — UPDATE SERVER STATUS
========================================================= */

/* =====================================================
   STEP 7E — UPDATE SERVER STATUS
========================================================= */

async function step7EServerStatus(
    options = {}
) {

    /* -------------------------------------------------
       STEP 7D MUST BE COMPLETE
    ------------------------------------------------- */

    if (
        !state.step7D
    ) {

        throw new Error(
            "STEP 7E cannot start. " +
            "STEP 7D — Note must be completed first."
        );

    }


    /* -------------------------------------------------
       PERSIST — STEP 7E RUNNING
    ------------------------------------------------- */

    await persistSaveSeasonStep(
        "7E",
        "running",
        {
            updatedBy:
                options.updatedBy
        }
    );


    try {

        /* -------------------------------------------------
           /* -------------------------------------------------
   READ CURRENT ACTIVE & AVERAGE
------------------------------------------------- */

console.info(
    `${LOG_PREFIX} STEP 7E — Reading Active & Average...`
);

const activeAverage =
    await readJson(
        PATHS.ACTIVE_AVERAGE
    );


if (
    !activeAverage ||
    typeof activeAverage !==
        "object"
) {

    throw new Error(
        "STEP 7E failed: Active & Average is empty or invalid."
    );

}


/* -------------------------------------------------
   READ CURRENT SEASON INFO
------------------------------------------------- */

console.info(
    `${LOG_PREFIX} STEP 7E — Reading Season Info...`
);

const seasonInfo =
    await readJson(
        PATHS.SEASON_INFO
    );


if (
    !seasonInfo ||
    typeof seasonInfo !==
        "object"
) {

    throw new Error(
        "STEP 7E failed: Season Info is empty or invalid."
    );

}

        /* -------------------------------------------------
           ADMIN CONFIG
        ------------------------------------------------- */

        console.info(
            `${LOG_PREFIX} STEP 7E — Reading Admin Config...`
        );


        const adminConfig =
            await readJson(
                PATHS.ADMIN_CONFIG
            );


        if (
            !adminConfig ||
            typeof adminConfig !==
                "object"
        ) {

            throw new Error(
                "STEP 7E failed: Admin Config is empty or invalid."
            );

        }


        if (
            !adminConfig
                .meritConfiguration
                ?.w6
        ) {

            throw new Error(
                "STEP 7E failed: Admin Config contains no W6 Merit Configuration."
            );

        }


        /* -------------------------------------------------
           SEASON PLAYERS
        ------------------------------------------------- */

        const seasonPlayers =
            Array.isArray(
                seasonInfo.players
            )
                ? seasonInfo.players
                : [];


        const activePlayers =
            Array.isArray(
                activeAverage.players
            )
                ? activeAverage.players
                : [];


        if (
            !seasonPlayers.length
        ) {

            throw new Error(
                "STEP 7E failed: Season Info contains no players."
            );

        }


        if (
            !activePlayers.length
        ) {

            throw new Error(
                "STEP 7E failed: Active & Average contains no players."
            );

        }


        /* -------------------------------------------------
           SELECTED SEASON DATA LOOKUP
        ------------------------------------------------- */

        const selectedDataById =
            new Map();


        if (
            Array.isArray(
                state.selectedSeasonData
            )
        ) {

            for (
                const entry of
                state.selectedSeasonData
            ) {

                const id =
                    normalizeText(
                        entry?.id
                    );


                if (
                    id
                ) {

                    selectedDataById.set(
                        id,
                        entry
                    );

                }

            }

        }


        /* -------------------------------------------------
           SEASON PLAYER LOOKUP
        ------------------------------------------------- */

        const seasonPlayerById =
            new Map();


        for (
            const player of
            seasonPlayers
        ) {

            const id =
                normalizeText(
                    player?.id
                );


            if (
                id
            ) {

                seasonPlayerById.set(
                    id,
                    player
                );

            }

        }


        /* -------------------------------------------------
           RESULT COUNTERS
        ------------------------------------------------- */

        let updatedPlayers =
            0;

        let lv3Players =
            0;

        let lv2Players =
            0;

        let lv1Players =
            0;

        let lv0Players =
            0;

        let newPlayers =
            0;

        let rejoinPlayers =
            0;

        let movePlayers =
            0;


        const lv0Warnings =
            [];


        /* =================================================
           UPDATE PLAYERS
        ================================================= */

        for (
            const activePlayer of
            activePlayers
        ) {

            const id =
                normalizeText(
                    activePlayer?.id
                );


            if (
                !id
            ) {

                continue;

            }


            const seasonPlayer =
                seasonPlayerById.get(
                    id
                );


            if (
                !seasonPlayer
            ) {

                continue;

            }

/* ---------------------------------------------
   SERVER STATUS ONLY FOR ELIGIBLE WARRIORS
--------------------------------------------- */

/*
   Server Status is NOT recalculated for:

   1. Farmers
      Historical Power < 20,000,000

   2. AFK players
      noteFlags.afk === true

   Their existing Server Status and
   Server Status Level remain untouched.
*/

const historicalPower =
    Number(
        activePlayer?.historicalPower
    );

const isAfk =
    activePlayer?.noteFlags?.afk ===
    true ||
    seasonPlayer?.noteFlags?.afk ===
    true;


/* ---------------------------------------------
   FARMER
--------------------------------------------- */

if (
    !Number.isFinite(
        historicalPower
    ) ||
    historicalPower < 20000000
) {

    continue;

}


/* ---------------------------------------------
   AFK
--------------------------------------------- */

if (
    isAfk
) {

    continue;

}

/* -------------------------------------------------
   GET LAST AVAILABLE SEASON WEEK
------------------------------------------------- */

const lastAvailableWeek =
    selectLastAvailableWeek(
        seasonPlayer
    );


/* -------------------------------------------------
   NO VALID SEASON DATA
   = PLAYER DID NOTHING THIS SEASON
   = NO STATUS CHANGE
------------------------------------------------- */

if (
    !lastAvailableWeek ||
    !lastAvailableWeek.data
) {

    console.info(
        `${LOG_PREFIX} STEP 7E — ID ${id}: no available Season week. ` +
        `No Server Status change.`
    );

    continue;

}


const selectedSeasonData =
    lastAvailableWeek.data;


/* -------------------------------------------------
   NO VALID RANK
   = PLAYER DID NOTHING
   = NO STATUS CHANGE
------------------------------------------------- */

const seasonRank =
    normalizeSeasonRank(
        selectedSeasonData?.rank
    );


if (
    !seasonRank ||
    seasonRank ===
        "-1"
) {

    console.info(
        `${LOG_PREFIX} STEP 7E — ID ${id}: no action/rank (-1). ` +
        `No Server Status change.`
    );

    continue;

}


            /* ---------------------------------------------
               CALCULATE STATUS
            --------------------------------------------- */

            const result =
                calculateNextServerStatus(
                    activePlayer,
                    selectedSeasonData,
                    adminConfig
                );


            /* ---------------------------------------------
               WRITE STATUS
            --------------------------------------------- */

            activePlayer.serverStatus =
                result.newStatus;


            activePlayer.serverStatusLevel =
                result.newLevel;


            /* ---------------------------------------------
               STATUS UPDATE RECORD
            --------------------------------------------- */

            activePlayer.serverStatusUpdate = {

                season:
                    normalizeSeason(
                        state.season
                    ),

                previous:
                    result.previousLevel,

                current:
                    result.newLevel,

                reason:
                    result.reason

            };


            updatedPlayers +=
                1;


            /* ---------------------------------------------
               COUNT LEVEL
            --------------------------------------------- */

            switch (
                result.newLevel
            ) {

                case 3:

                    lv3Players +=
                        1;

                    break;


                case 2:

                    lv2Players +=
                        1;

                    break;


                case 1:

                    lv1Players +=
                        1;

                    break;


                case 0:

                    lv0Players +=
                        1;


                    lv0Warnings.push({

                        id:
                            id,

                        name:
                            activePlayer?.name ??
                            "",

                        rank:
                            selectedSeasonData
                                ?.rank ??
                            "",

                        meritPowerPercentage:
                            selectedSeasonData
                                ?.meritPowerPercentage ??
                            null,

                        reason:
                            result.reason

                    });

                    break;

            }


            /* ---------------------------------------------
               NEW / REJOIN COUNTERS
            --------------------------------------------- */

            if (
                seasonPlayer
                    ?.noteFlags
                    ?.new ===
                true
            ) {

                newPlayers +=
                    1;

            }


            if (
                normalizeText(
                    seasonPlayer
                        ?.rejoinDate
                )
            ) {

                rejoinPlayers +=
                    1;

            }


            if (
                result.reason ===
                "RANK_MOVE"
            ) {

                movePlayers +=
                    1;

            }

        }

/* =================================================
   WRITE UPDATED ACTIVE & AVERAGE
================================================ */

console.info(
    `${LOG_PREFIX} STEP 7E — Writing updated Active & Average...`
);


await writePublicDataJson(

    PATHS.ACTIVE_AVERAGE,

    activeAverage,

    `K630 Season ${state.season} - STEP 7E Server Status`

);


/* -------------------------------------------------
   REFRESH ACTIVE & AVERAGE PAGE
------------------------------------------------- */

try {

    document.dispatchEvent(
        new CustomEvent(
            "k630:active-average-refresh"
        )
    );

} catch (
    refreshError
) {

    console.warn(
        `${LOG_PREFIX} STEP 7E Active & Average refresh event failed:`,
        refreshError
    );

}


/* =================================================
   STORE UPDATED DATA
================================================ */

state.activeAverageData =
    clone(
        activeAverage
    );

        
        /* =================================================
           STORE UPDATED DATA
        ================================================= */

        state.activeAverageData =
            clone(
                activeAverage
            );


        state.serverStatusResult = {

            success:
                true,

            season:
                normalizeSeason(
                    state.season
                ),

            updatedPlayers:
                updatedPlayers,

            lv3Players:
                lv3Players,

            lv2Players:
                lv2Players,

            lv1Players:
                lv1Players,

            lv0Players:
                lv0Players,

            newPlayers:
                newPlayers,

            rejoinPlayers:
                rejoinPlayers,

            movePlayers:
                movePlayers,

            lv0Warnings:
                clone(
                    lv0Warnings
                )

        };


        /* =================================================
           LOG
        ================================================= */

        console.info(
            `${LOG_PREFIX} STEP 7E — Server Status updated.`
        );


        console.info(
            `${LOG_PREFIX} LV3:`,
            lv3Players
        );


        console.info(
            `${LOG_PREFIX} LV2:`,
            lv2Players
        );


        console.info(
            `${LOG_PREFIX} LV1:`,
            lv1Players
        );


        console.info(
            `${LOG_PREFIX} LV0:`,
            lv0Players
        );


        if (
            lv0Warnings.length >
            0
        ) {

            console.warn(
                `${LOG_PREFIX} WARNING — LV0 players require in-game removal:`,
                lv0Warnings
            );

        }


        /* =================================================
           MARK COMPLETE
        ================================================= */

        state.step7E =
            true;


        /* -------------------------------------------------
           PERSIST — STEP 7E COMPLETED
           NEXT STEP = 7F
        ------------------------------------------------- */

        await persistSaveSeasonStep(
            "7E",
            "completed",
            {
                nextStep:
                    "7F",

                updatedBy:
                    options.updatedBy
            }
        );


        console.info(
            `${LOG_PREFIX} STEP 7E COMPLETED.`
        );


        /* =================================================
           RETURN
        ================================================= */

        return {

            success:
                true,

            step:
                "7E",

            summary:
                clone(
                    state.serverStatusResult
                )

        };

    } catch (
        error
    ) {

        /* -------------------------------------------------
           PERSIST — STEP 7E ERROR
        ------------------------------------------------- */

        try {

            await persistSaveSeasonStep(
                "7E",
                "error",
                {
                    updatedBy:
                        options.updatedBy
                }
            );

        } catch (
            persistError
        ) {

            console.error(
                `${LOG_PREFIX} STEP 7E error status could not be persisted:`,
                persistError
            );

        }


        console.error(
            `${LOG_PREFIX} STEP 7E FAILED:`,
            error
        );


        throw error;

    }

}

/* =====================================================
   STEP 7F — CREATE NEXT SEASON COLUMNS
=========================================================

PURPOSE
-------
Create the next Season structure for:

    Active & Average
    Old Players

The completed Season remains untouched.

Example:

    Current Season = 1

STEP 7F creates:

    Season 2

Season 2 starts empty.

No Season 1 data is copied into Season 2.

The existing page structure will then display
the new Season using the same Season column
structure as the previous Season.

========================================================= */


/* -----------------------------------------------------
   GET NEXT SEASON NUMBER
----------------------------------------------------- */

function getNextSeasonNumber() {

    const currentSeason =
        normalizeSeason(
            state.season
        );


    return (
        currentSeason +
        1
    );

}


/* -----------------------------------------------------
   CREATE NEXT SEASON ENTRY
----------------------------------------------------- */

function createNextSeasonEntry(
    player,
    nextSeason
) {

    if (
        !player ||
        typeof player !==
            "object"
    ) {

        return;

    }


    /* -------------------------------------------------
       ENSURE SEASONS OBJECT
    ------------------------------------------------- */

    if (
        !player.seasons ||
        typeof player.seasons !==
            "object" ||
        Array.isArray(
            player.seasons
        )
    ) {

        player.seasons =
            {};

    }


    const seasonKey =
        String(
            nextSeason
        );


    /* -------------------------------------------------
       DO NOT OVERWRITE EXISTING DATA
    ------------------------------------------------- */

    if (
        Object.prototype
            .hasOwnProperty.call(
                player.seasons,
                seasonKey
            )
    ) {

        return;

    }


    /* -------------------------------------------------
       CREATE EMPTY NEXT SEASON
    -------------------------------------------------

       null means:

           no data for this Season yet

       It must NOT be interpreted as:

           0

       because 0 is valid Season data.

    ------------------------------------------------- */

    player.seasons[
        seasonKey
    ] = null;

}


/* -----------------------------------------------------
   CREATE NEXT SEASON FOR DATASET
----------------------------------------------------- */

function createNextSeasonForDataset(
    dataset,
    nextSeason
) {

    if (
        !dataset ||
        typeof dataset !==
            "object"
    ) {

        throw new Error(
            "STEP 7F failed: Dataset is empty or invalid."
        );

    }


    const players =
        Array.isArray(
            dataset.players
        )
            ? dataset.players
            : [];


    if (
        !players.length
    ) {

        throw new Error(
            "STEP 7F failed: Dataset contains no players."
        );

    }


    for (
        const player of
        players
    ) {

        createNextSeasonEntry(
            player,
            nextSeason
        );

    }


    return dataset;

}


/* =====================================================
   STEP 7F — CREATE NEXT SEASON COLUMNS
========================================================= */

/* =====================================================
   STEP 7F — CREATE NEXT SEASON COLUMNS
========================================================= */

async function step7FSeasonColumns(
    options = {}
) {

    /* -------------------------------------------------
       STEP 7E MUST BE COMPLETE
    ------------------------------------------------- */

    if (
        !state.step7E
    ) {

        throw new Error(
            "STEP 7F cannot start. " +
            "STEP 7E — Server Status must be completed first."
        );

    }


    /* -------------------------------------------------
       PERSIST — STEP 7F RUNNING
    ------------------------------------------------- */

    await persistSaveSeasonStep(
        "7F",
        "running",
        {
            updatedBy:
                options.updatedBy
        }
    );


    try {

        /* -------------------------------------------------
           CURRENT / NEXT SEASON
        ------------------------------------------------- */

        const currentSeason =
            normalizeSeason(
                state.season
            );


        const nextSeason =
            getNextSeasonNumber();


        console.info(
            `${LOG_PREFIX} STEP 7F — Creating Season ${nextSeason} columns...`
        );

/* =================================================
   READ CURRENT ACTIVE & AVERAGE
================================================= */

console.info(
    `${LOG_PREFIX} STEP 7F — Reading Active & Average...`
);

const activeAverage =
    await readJson(
        PATHS.ACTIVE_AVERAGE
    );


if (
    !activeAverage ||
    typeof activeAverage !==
        "object"
) {

    throw new Error(
        "STEP 7F failed: Active & Average is empty or invalid."
    );

}

        createNextSeasonForDataset(
            activeAverage,
            nextSeason
        );


        /* =================================================
           OLD PLAYERS
        =================================================

           IMPORTANT:
           This is the current Old Players DATASET.

           We are NOT using any OLD engine file,
           OLD2 file, backup file, or previous code version.

        ================================================= */

        console.info(
            `${LOG_PREFIX} STEP 7F — Reading current Old Players dataset...`
        );


        const oldPlayers =
            await readJson(
                PATHS.OLD_PLAYERS
            );


        if (
            !oldPlayers ||
            typeof oldPlayers !==
                "object"
        ) {

            throw new Error(
                "STEP 7F failed: Current Old Players dataset is empty or invalid."
            );

        }


        createNextSeasonForDataset(
            oldPlayers,
            nextSeason
        );

/* =================================================
   WRITE UPDATED ACTIVE & AVERAGE
================================================= */

console.info(
    `${LOG_PREFIX} STEP 7E — Writing updated Active & Average...`
);


await writePublicDataJson(

    PATHS.ACTIVE_AVERAGE,

    activeAverage,

    `K630 Season ${state.season} - STEP 7E Server Status`

);


/* -------------------------------------------------
   REFRESH ACTIVE & AVERAGE PAGE
------------------------------------------------- */

try {

    document.dispatchEvent(
        new CustomEvent(
            "k630:active-average-refresh"
        )
    );

} catch (
    refreshError
) {

    console.warn(
        `${LOG_PREFIX} Active & Average refresh event could not be dispatched:`,
        refreshError
    );

}


/* =================================================
   STORE UPDATED DATA
================================================= */

state.activeAverageData =
    clone(
        activeAverage
    );


state.serverStatusResult = {

    success:
        true,

    season:
        normalizeSeason(
            state.season
        ),

    updatedPlayers:
        updatedPlayers,

    lv3Players:
        lv3Players,

    lv2Players:
        lv2Players,

    lv1Players:
        lv1Players,

    lv0Players:
        lv0Players,

    newPlayers:
        newPlayers,

    rejoinPlayers:
        rejoinPlayers,

    movePlayers:
        movePlayers,

    lv0Warnings:
        clone(
            lv0Warnings
        )

};

        /* =================================================
           STORE UPDATED DATA
        ================================================= */

        state.activeAverageData =
            clone(
                activeAverage
            );


        state.oldPlayersData =
            clone(
                oldPlayers
            );


        /* =================================================
           RESULT
        ================================================= */

        state.seasonColumnsResult = {

            success:
                true,

            completedSeason:
                currentSeason,

            nextSeason:
                nextSeason,

            activeAverage:
                true,

            oldPlayers:
                true

        };


        /* =================================================
           MARK COMPLETE
        ================================================= */

        state.step7F =
            true;


        /* =================================================
           LOG
        ================================================= */

        console.info(
            `${LOG_PREFIX} STEP 7F — Season ${nextSeason} created for Active & Average.`
        );


        console.info(
            `${LOG_PREFIX} STEP 7F — Season ${nextSeason} created for Old Players.`
        );


        console.info(
            `${LOG_PREFIX} STEP 7F COMPLETED.`
        );


        /* -------------------------------------------------
           PERSIST — STEP 7F COMPLETED
           NEXT STEP = 7G
        ------------------------------------------------- */

        await persistSaveSeasonStep(
            "7F",
            "completed",
            {
                nextStep:
                    "7G",

                updatedBy:
                    options.updatedBy
            }
        );


        /* =================================================
           RETURN
        ================================================= */

        return {

            success:
                true,

            step:
                "7F",

            completedSeason:
                currentSeason,

            nextSeason:
                nextSeason,

            activeAverage:
                true,

            oldPlayers:
                true

        };

    } catch (
        error
    ) {

        /* -------------------------------------------------
           PERSIST — STEP 7F ERROR
        ------------------------------------------------- */

        try {

            await persistSaveSeasonStep(
                "7F",
                "error",
                {
                    updatedBy:
                        options.updatedBy
                }
            );

        } catch (
            persistError
        ) {

            console.error(
                `${LOG_PREFIX} STEP 7F error status could not be persisted:`,
                persistError
            );

        }


        console.error(
            `${LOG_PREFIX} STEP 7F FAILED:`,
            error
        );


        throw error;

    }

}

/* =====================================================
   STEP 7G — RESET CURRENT SEASON DATA
========================================================= */

async function step7GReset(
    options = {}
) {

    /* -------------------------------------------------
       STEP 7F MUST BE COMPLETE
    ------------------------------------------------- */

    if (
        !state.step7F
    ) {

        throw new Error(
            "STEP 7G cannot start. " +
            "STEP 7F — Next Season Columns must be completed first."
        );

    }


    /* -------------------------------------------------
       PERSIST — STEP 7G RUNNING
    ------------------------------------------------- */

    await persistSaveSeasonStep(
        "7G",
        "running",
        {
            updatedBy:
                options.updatedBy
        }
    );


    try {

        const completedSeason =
            normalizeSeason(
                state.season
            );


        const nextSeason =
            completedSeason +
            1;


        console.info(
            `${LOG_PREFIX} STEP 7G — Resetting current Season data...`
        );


        /* =================================================
           EMPTY SEASON INFO
        =================================================

           The file remains present.

           Only the current Season player data is removed.

           0 is NOT used here because 0 is valid gameplay
           data. An empty players array means there is no
           current Season data yet.

        ================================================= */

        const emptySeasonInfo = {

            players:
                []

        };


        /* =================================================
           EMPTY SERVER VS SERVER
        =================================================

           The file remains present.

           The next Matchmaking / Season engines will
           populate it again.

        ================================================= */

        const emptyServerVsServer = {};


        /* =================================================
           RESET SEASON INFO CURRENT.JSON
        ================================================= */

        await writePublicDataJson(

            PATHS.SEASON_INFO,

            emptySeasonInfo,

            (
                `K630 Season ${completedSeason} - ` +
                `Reset Current Season Info for Season ${nextSeason}`
            )

        );


        console.info(
            `${LOG_PREFIX} STEP 7G — Season Info current.json reset.`
        );


        /* =================================================
           RESET SERVER VS SERVER CURRENT.JSON
        ================================================= */

        await writePublicDataJson(

            PATHS.SERVER_VS_SERVER,

            emptyServerVsServer,

            (
                `K630 Season ${completedSeason} - ` +
                `Reset Current Server vs Server for Season ${nextSeason}`
            )

        );


        console.info(
            `${LOG_PREFIX} STEP 7G — Server vs Server current.json reset.`
        );


        /* =================================================
           STORE RESET RESULT
        ================================================= */

        state.seasonResetResult = {

            success:
                true,

            completedSeason:
                completedSeason,

            nextSeason:
                nextSeason,

            seasonInfoReset:
                true,

            serverVsServerReset:
                true

        };


        /* =================================================
           MARK STEP COMPLETE
        ================================================= */

        state.step7G =
            true;


        /* =================================================
           PERSIST — STEP 7G COMPLETED
        =================================================

           7G is the final Save Season step.

           The overall Save Season workflow becomes
           completed.

        ================================================= */

        await persistSaveSeasonStep(
            "7G",
            "completed",
            {
                updatedBy:
                    options.updatedBy
            }
        );


        /* =================================================
           LOG
        ================================================= */

        console.info(
            `${LOG_PREFIX} STEP 7G COMPLETED.`
        );


        console.info(
            `${LOG_PREFIX} Season ${completedSeason} is fully processed.`
        );


        console.info(
            `${LOG_PREFIX} Season ${nextSeason} current data is ready to be populated.`
        );


        /* =================================================
           RETURN
        ================================================= */

        return {

            success:
                true,

            step:
                "7G",

            completedSeason:
                completedSeason,

            nextSeason:
                nextSeason,

            seasonInfoReset:
                true,

            serverVsServerReset:
                true

        };

    } catch (
        error
    ) {

        /* -------------------------------------------------
           PERSIST — STEP 7G ERROR
        ------------------------------------------------- */

        try {

            await persistSaveSeasonStep(
                "7G",
                "error",
                {
                    updatedBy:
                        options.updatedBy
                }
            );

        } catch (
            persistError
        ) {

            console.error(
                `${LOG_PREFIX} STEP 7G error status could not be persisted:`,
                persistError
            );

        }


        console.error(
            `${LOG_PREFIX} STEP 7G FAILED:`,
            error
        );


        throw error;

    }

}

/* =====================================================
   RESTORE PERSISTENT STEP STATE
========================================================= */

/*
    Rebuild the internal Save Season step flags from the
    persistent admin-config.json workflow state.

    This is required because setSeason() intentionally
    resets all step flags when the engine is configured.

    The public admin-config.json remains the source of truth.
*/

function restoreWorkflowState(
    saveSeasonState = {}
) {

    const steps =
        saveSeasonState?.steps ||
        {};


    /* -------------------------------------------------
       RESTORE CONFIGURATION
    ------------------------------------------------- */

    const season =
        Number(
            saveSeasonState?.seasonNumber
        );

    const officialDate =
        normalizeText(
            saveSeasonState?.officialDate
        );


    if (
        Number.isInteger(
            season
        ) &&
        season > 0 &&
        /^\d{4}-\d{2}-\d{2}$/.test(
            officialDate
        )
    ) {

        state.season =
            season;

        state.officialDate =
            officialDate;

        state.configured =
            true;

    }


    /* -------------------------------------------------
       RESTORE COMPLETED FLAGS
    ------------------------------------------------- */

    state.step7A =
        normalizeText(
            steps?.["7A"]?.status
        ).toLowerCase() ===
        "completed";


    state.step7B =
        normalizeText(
            steps?.["7B"]?.status
        ).toLowerCase() ===
        "completed";


    state.step7C =
        normalizeText(
            steps?.["7C"]?.status
        ).toLowerCase() ===
        "completed";


    state.step7D =
        normalizeText(
            steps?.["7D"]?.status
        ).toLowerCase() ===
        "completed";


    state.step7E =
        normalizeText(
            steps?.["7E"]?.status
        ).toLowerCase() ===
        "completed";


    state.step7F =
        normalizeText(
            steps?.["7F"]?.status
        ).toLowerCase() ===
        "completed";


    state.step7G =
        normalizeText(
            steps?.["7G"]?.status
        ).toLowerCase() ===
        "completed";


    console.info(
        `${LOG_PREFIX} Persistent Save Season state restored.`,
        {
            season:
                state.season,

            officialDate:
                state.officialDate,

            step7A:
                state.step7A,

            step7B:
                state.step7B,

            step7C:
                state.step7C,

            step7D:
                state.step7D,

            step7E:
                state.step7E,

            step7F:
                state.step7F,

            step7G:
                state.step7G
        }
    );

    return getState();

}

/* =====================================================
   PUBLIC ENGINE API
========================================================= */

global.K630SaveSeasonEngine = Object.freeze({

    name:
        ENGINE_NAME,

    version:
        ENGINE_VERSION,

    paths:
        PATHS,

    repository:
        GITHUB_REPOSITORY,


    /* -------------------------------------------------
       SEASON CONFIGURATION
    ------------------------------------------------- */

    setSeason,

    restoreWorkflowState,

    getState,

    requireConfigured,


    /* -------------------------------------------------
       RESET
    ------------------------------------------------- */

    reset,


    /* -------------------------------------------------
       SAVE SEASON STEPS
    ------------------------------------------------- */

    step7AArchive,

    step7BSeasonData,

    step7CAverages,

    step7DUpdateNotes,

    step7EServerStatus,

    step7FSeasonColumns

});

})(window);