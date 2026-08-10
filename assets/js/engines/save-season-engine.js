/*!
 * =====================================================
 * Kingdom 630 Save Season Engine
 * =====================================================
 *
 * Version : 630.2.0
 * Project : Kingdom 630 – Rebels of Fury
 * Module  : Save Season Engine
 *
 * =====================================================
 *
 * FINAL ENGINE OF THE COMPLETE KINGDOM CYCLE
 *
 * This engine is the FINAL step after:
 *
 * Foundation
 * Matchmaking
 * Week 0
 * Week 1
 * Week 2
 * Week 3
 * Week 4
 * Week 5
 * Week 6
 *
 * After Week 6 this engine performs the complete
 * Season Finalization.
 *
 * -----------------------------------------------------
 *
 * SINGLE SOURCE OF TRUTH
 *
 * ALL DATA IS READ FROM
 *
 * k630-public-data
 *
 * ALL DATA IS WRITTEN TO
 *
 * k630-public-data
 *
 * No gameplay data is stored locally.
 *
 * The ONLY exception is the Player ID search history,
 * which may use browser cache/localStorage.
 *
 * -----------------------------------------------------
 *
 * WEBSITE PRINCIPLE
 *
 * Pages NEVER calculate data.
 *
 * Pages ONLY load generated JSON files.
 *
 * Every generated JSON file is produced by this
 * engine or another dedicated engine.
 *
 /* =====================================================
   MODULE INDEX
=====================================================

   MODULE 01 — HELPER FUNCTIONS
   -----------------------------------------------------
   Algemene hulpfuncties voor de volledige engine.


   MODULE 02 — PATH CONFIGURATION
   -----------------------------------------------------
   Centrale configuratie van alle paden binnen
   k630-public-data.


   MODULE 03 — CONTEXT
   -----------------------------------------------------
   Centrale gegevensstructuur voor Save Season.


   MODULE 04 — LOAD FINAL SEASON DATA
   -----------------------------------------------------
   Haalt de actuele einddatasets rechtstreeks op
   vanaf k630-public-data.

   Save Season haalt hier alleen de datasets op
   die voor de laatste seizoensafhandeling nodig zijn.

   W0 t/m W5 worden hier NIET opnieuw verwerkt.

   W6 wordt gebruikt vanuit Season Info.


   MODULE 05 — ARCHIVE SEASON INFO
   -----------------------------------------------------
   Maakt een letterlijke kopie van de actuele
   Season Info en slaat deze op als afgesloten
   seizoen.


   MODULE 06 — ARCHIVE SERVER VS SERVER
   -----------------------------------------------------
   Maakt een letterlijke kopie van de actuele
   Server vs Server dataset en slaat deze op
   als afgesloten seizoen.


   MODULE 07 — REBUILD ACTIVE & AVERAGE
   -----------------------------------------------------
   Gebruikt de W6-eindgegevens uit Season Info
   om Active & Average definitief bij te werken.


   MODULE 08 — UPDATE ARCHIVE INDEX
   -----------------------------------------------------
   Werkt de archive-index bij zodat Old Seasons
   de opgeslagen seizoenen kan vinden.


   MODULE 09 — UPDATE OLD PLAYERS
   -----------------------------------------------------
   Bouwt de actuele Old Players dataset.


   MODULE 10 — UPDATE HOME
   -----------------------------------------------------
   Bouwt de actuele Home dataset.


   MODULE 11 — WRITE GENERATED FILES
   -----------------------------------------------------
   Schrijft alle gewijzigde datasets terug naar
   k630-public-data.


   MODULE 12 — RESET NEXT SEASON
   -----------------------------------------------------
   Zet de status klaar voor de volgende
   Kingdom 630 season cycle.


   MODULE 13 — SAVE SEASON ORCHESTRATOR
   -----------------------------------------------------
   Voert de Save Season modules in de juiste
   volgorde uit.


   MODULE 14 — PUBLIC API
   -----------------------------------------------------
   Maakt K630SaveSeasonEngine beschikbaar voor
   de website en Admin Center.


===================================================== */

(function () {

"use strict";

/* =====================================================
   ENGINE INFORMATION
===================================================== */

const ENGINE_NAME =
    "K630SaveSeasonEngine";

const ENGINE_VERSION =
    "630.2.0";

const LOG_PREFIX =
    "[Save Season]";

console.info(
    `${LOG_PREFIX} ${ENGINE_NAME} ${ENGINE_VERSION} Loaded`
);
/* =====================================================
   MODULE 01 — HELPER FUNCTIONS
=====================================================

PURPOSE
-------
General helper functions used by every module.

This module contains only reusable functions.

No season-specific processing happens here.

===================================================== */


/* -----------------------------------------------------
   LOGGING
----------------------------------------------------- */

function log(
    ...messages
) {

    console.log(
        LOG_PREFIX,
        ...messages
    );

}


function warning(
    ...messages
) {

    console.warn(
        LOG_PREFIX,
        ...messages
    );

}


function error(
    ...messages
) {

    console.error(
        LOG_PREFIX,
        ...messages
    );

}


/* -----------------------------------------------------
   CLONE OBJECT
----------------------------------------------------- */

function clone(
    value
) {

    return JSON.parse(
        JSON.stringify(
            value
        )
    );

}


/* -----------------------------------------------------
   DATE & TIME
----------------------------------------------------- */

function isoNow() {

    return new Date()
        .toISOString();

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


/* -----------------------------------------------------
   SEASON NUMBER
----------------------------------------------------- */

function normalizeSeasonNumber(
    season
) {

    return Math.max(

        1,

        Math.trunc(

            Number(
                season
            ) || 1

        )

    );

}


/* -----------------------------------------------------
   VALIDATION
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

/* -----------------------------------------------------
   READ JSON FROM k630-public-data
----------------------------------------------------- */

async function readJson(
    url
) {

    const finalUrl =
        /^https?:\/\//i.test(
            url
        )
            ? url
            : `${DATA_ROOT}/${url.replace(
                /^assets\/data\//,
                ""
            )}`;


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


    const data =
        await response.json();


    if (
        !data ||
        typeof data !==
            "object"
    ) {

        throw new Error(
            `Invalid JSON data received from ${finalUrl}.`
        );

    }


    return data;

}

/* =====================================================
   MODULE 02 — PATH CONFIGURATION
=====================================================

PURPOSE
-------
Central configuration for every location used by
the Save Season Engine.

SINGLE SOURCE OF TRUTH
----------------------
All application data is stored in:

k630-public-data

The Save Season Engine reads from and writes to
this repository.

IMPORTANT
---------
Save Season does NOT reload W0 through W5.

The previous engines have already processed those
weeks.

The final W6 information required by Save Season is
contained inside the current Season Info dataset.

===================================================== */


/* -----------------------------------------------------
   DATA ROOT
----------------------------------------------------- */

const DATA_ROOT =

    window.K630Paths?.DATA_ROOT ??

    "https://raw.githubusercontent.com/" +
    "Ragnarok630/k630-public-data/main/assets/data";


/* -----------------------------------------------------
   CURRENT GENERATED DATA
----------------------------------------------------- */

const PATHS = Object.freeze({

    /* ================================================
       CURRENT SEASON INFO
    ================================================ */

    SEASON_INFO:
        `${DATA_ROOT}/generated/season-info/current.json`,


    /* ================================================
       CURRENT ACTIVE & AVERAGE
    ================================================ */

    ACTIVE_AVERAGE:
        `${DATA_ROOT}/generated/active-average/current.json`,


    /* ================================================
       CURRENT SERVER VS SERVER
    ================================================ */

    SERVER_VS_SERVER:
        `${DATA_ROOT}/generated/server-vs-server/current.json`,


    /* ================================================
       CURRENT HOME
       
       Used later when the final Home dataset needs
       to be rebuilt.
    ================================================ */

    HOME:
        `${DATA_ROOT}/generated/home/current.json`,


    /* ================================================
       CURRENT OLD PLAYERS
       
       Used later when Old Players needs to be rebuilt.
    ================================================ */

    OLD_PLAYERS:
        `${DATA_ROOT}/generated/old-players/current.json`,


    /* ================================================
       ADMIN CONFIGURATION
    ================================================ */

    ADMIN_CONFIG:
        `${DATA_ROOT}/config/admin-config.json`,


    /* ================================================
       ARCHIVE ROOT
    ================================================ */

    ARCHIVE_ROOT:
        `${DATA_ROOT}/archive`

});


/* -----------------------------------------------------
   ARCHIVE SEASON PATH
----------------------------------------------------- */

function getArchiveSeasonPath(
    season
) {

    const seasonNumber =
        normalizeSeasonNumber(
            season
        );

    return (
        `${PATHS.ARCHIVE_ROOT}/season-${seasonNumber}`
    );

}

/* =====================================================
   MODULE 03 — CONTEXT
=====================================================

PURPOSE
-------
Creates the central Save Season context.

The context is the single working object shared by
all Save Season modules.

IMPORTANT
---------
Save Season runs AFTER Week 6.

Therefore:

- W0 is not loaded here.
- W1 is not loaded here.
- W2 is not loaded here.
- W3 is not loaded here.
- W4 is not loaded here.
- W5 is not loaded here.
- W6 is NOT loaded as a separate file.

The final W6 information required by Save Season
already exists inside:

generated/season-info/current.json

===================================================== */


/* -----------------------------------------------------
   CREATE CONTEXT
----------------------------------------------------- */

function createContext(
    options = {}
) {

    const season =
        normalizeSeasonNumber(
            options.season ?? 1
        );


    return {

        /* ================================================
           ENGINE INFORMATION
        ================================================ */

        engine: {

            name:
                ENGINE_NAME,

            version:
                ENGINE_VERSION,

            started:
                isoNow(),

            today:
                todayString()

        },


        /* ================================================
           SETTINGS
        ================================================ */

        season,

        github:
            options.github ??
            window.K630GitHubWriter ??
            null,


        /* ================================================
           SOURCE DATA
           
           These datasets are read directly from
           k630-public-data.
        ================================================ */

        source: {

            adminConfig:
                null

        },


        /* ================================================
           CURRENT GENERATED DATA
           
           These are the current JSON datasets that
           already exist on k630-public-data.
           
           Save Season reads these first.
        ================================================ */

        generated: {

            seasonInfo:
                null,

            activeAverage:
                null,

            serverVsServer:
                null,

            home:
                null,

            oldPlayers:
                null,

            archiveIndex:
                null

        },


        /* ================================================
           ARCHIVE
           
           Information about the season that is currently
           being finalized.
        ================================================ */

        archive: {

            season:
                season,

            seasonPath:
                null,

            files:
                [],

            written:
                false

        },


        /* ================================================
           GENERATED RESULTS
           
           New versions produced during this Save Season
           operation.
        ================================================ */

        results: {

            activeAverage:
                null,

            home:
                null,

            oldPlayers:
                null,

            archiveIndex:
                null

        },


        /* ================================================
           WRITE QUEUE
           
           Files are prepared here first.
           
           Module 11 performs the actual GitHub writes.
        ================================================ */

        writeQueue:
            [],


        /* ================================================
           STATUS
        ================================================ */

        status: {

            completedModules:
                [],

            currentModule:
                null,

            failed:
                false,

            finished:
                false

        }

    };

}

    /* ===============================================
       SEASON INFO
    ================================================ */

    context.generated.seasonInfo =
        await readJson(
            PATHS.SEASON_INFO
        );


    /* ================================================
       ACTIVE & AVERAGE
    ================================================ */

    context.generated.activeAverage =
        await readJson(
            PATHS.ACTIVE_AVERAGE
        );


    /* ================================================
       SERVER VS SERVER
    ================================================ */

    context.generated.serverVsServer =
        await readJson(
            PATHS.SERVER_VS_SERVER
        );


    /* ================================================
       ADMIN CONFIGURATION
    ================================================ */

    context.source.adminConfig =
        await readJson(
            PATHS.ADMIN_CONFIG
        );


    /* ================================================
       VALIDATE SEASON INFO
    ================================================ */

    if (
        !context.generated.seasonInfo ||
        typeof context.generated.seasonInfo !==
            "object"
    ) {

        throw new Error(
            "Season Info data is invalid."
        );

    }


    /* ================================================
       VALIDATE ACTIVE & AVERAGE
    ================================================ */

    if (
        !context.generated.activeAverage ||
        typeof context.generated.activeAverage !==
            "object"
    ) {

        throw new Error(
            "Active & Average data is invalid."
        );

    }


    /* ================================================
       VALIDATE SERVER VS SERVER
    ================================================ */

    if (
        !context.generated.serverVsServer ||
        typeof context.generated.serverVsServer !==
            "object"
    ) {

        throw new Error(
            "Server vs Server data is invalid."
        );

    }


    /* ================================================
       VALIDATE ADMIN CONFIG
    ================================================ */

    if (
        !context.source.adminConfig ||
        typeof context.source.adminConfig !==
            "object"
    ) {

        throw new Error(
            "Admin configuration is invalid."
        );

    }


    /* ================================================
       STORE ARCHIVE SEASON PATH
    ================================================ */

    context.archive.seasonPath =
        getArchiveSeasonPath(
            context.season
        );


    /* ================================================
       STATUS
    ================================================ */

    context.status.completedModules.push(
        "MODULE 04 — LOAD FINAL SEASON DATA"
    );


    log(
        "Final Season data loaded successfully."
    );


    return context;

}

/* =====================================================
   MODULE 05 — ARCHIVE SEASON INFO
=====================================================

PURPOSE
-------
Archives the completed Season Info dataset.

SOURCE
------
generated/season-info/current.json

DESTINATION
-----------
archive/season-{season}/season-info.json

IMPORTANT
---------
This is the final Season Info dataset.

The data is NOT rebuilt here.

The existing Season Info dataset is copied into
the archive for the completed season.

The archive is required by the Old Seasons page.

===================================================== */


/* -----------------------------------------------------
   ARCHIVE SEASON INFO
----------------------------------------------------- */

async function archiveSeasonInfo(
    context
) {

    log(
        `Archiving Season ${context.season} Season Info...`
    );


    if (
        !context
    ) {

        throw new Error(
            "Save Season context is required."
        );

    }


    if (
        !context.generated ||
        !context.generated.seasonInfo
    ) {

        throw new Error(
            "Season Info data has not been loaded."
        );

    }


    /* ================================================
       ARCHIVE PATH
    ================================================ */

    const archivePath =
        `${context.archive.seasonPath}/season-info.json`;


    /* ================================================
       CREATE ARCHIVE ENTRY
       
       The dataset itself is copied.
       
       No recalculation takes place here.
    ================================================ */

    const archiveEntry = {

        path:
            archivePath,

        data:
            clone(
                context.generated.seasonInfo
            ),

        source:
            PATHS.SEASON_INFO,

        type:
            "season-info",

        season:
            context.season

    };


    /* ================================================
       ADD TO WRITE QUEUE
    ================================================ */

    context.writeQueue.push(
        archiveEntry
    );


    /* ================================================
       STORE ARCHIVE INFORMATION
    ================================================ */

    context.archive.files.push(
        archivePath
    );


    context.archive.seasonInfo =
        archiveEntry;


    /* ================================================
       STATUS
    ================================================ */

    context.status.completedModules.push(
        "MODULE 05 — ARCHIVE SEASON INFO"
    );


    log(
        `Season ${context.season} Season Info prepared for archive:`,
        archivePath
    );


    return context;

}

/* =====================================================
   MODULE 06 — ARCHIVE SERVER VS SERVER
=====================================================

PURPOSE
-------
Archives the completed Server vs Server dataset.

SOURCE
------
generated/server-vs-server/current.json

DESTINATION
-----------
archive/season-{season}/server-vs-server.json

IMPORTANT
---------
The Server vs Server dataset has already been built
by the Server vs Server engines.

Save Season does NOT rebuild the data here.

This module only prepares a complete copy of the
current dataset for the completed season.

The archived file is used by the Old Seasons page.

===================================================== */


/* -----------------------------------------------------
   ARCHIVE SERVER VS SERVER
----------------------------------------------------- */

async function archiveServerVsServer(
    context
) {

    log(
        `Archiving Season ${context.season} Server vs Server...`
    );


    if (
        !context
    ) {

        throw new Error(
            "Save Season context is required."
        );

    }


    if (
        !context.generated ||
        !context.generated.serverVsServer
    ) {

        throw new Error(
            "Server vs Server data has not been loaded."
        );

    }


    /* ================================================
       ARCHIVE PATH
    ================================================ */

    const archivePath =
        `${context.archive.seasonPath}/server-vs-server.json`;


    /* ================================================
       CREATE ARCHIVE ENTRY
       
       The complete current dataset is copied.
       
       No recalculation takes place here.
    ================================================ */

    const archiveEntry = {

        path:
            archivePath,

        data:
            clone(
                context.generated.serverVsServer
            ),

        source:
            PATHS.SERVER_VS_SERVER,

        type:
            "server-vs-server",

        season:
            context.season

    };


    /* ================================================
       ADD TO WRITE QUEUE
    ================================================ */

    context.writeQueue.push(
        archiveEntry
    );


    /* ================================================
       STORE ARCHIVE INFORMATION
    ================================================ */

    context.archive.files.push(
        archivePath
    );


    context.archive.serverVsServer =
        archiveEntry;


    /* ================================================
       STATUS
    ================================================ */

    context.status.completedModules.push(
        "MODULE 06 — ARCHIVE SERVER VS SERVER"
    );


    log(
        `Season ${context.season} Server vs Server prepared for archive:`,
        archivePath
    );


    return context;

}

/* =====================================================
   MODULE 07 — REBUILD ACTIVE & AVERAGE
=====================================================

PURPOSE
-------
Rebuilds the final Active & Average dataset for the
completed season.

INPUT
-----
1. Current Active & Average
2. Current Season Info
3. W6 final data stored inside Season Info
4. Admin configuration

IMPORTANT
---------
Save Season does NOT reload W0 through W6.

The previous weekly engines have already completed
those processing steps.

The final W6 data needed here is read directly from:

generated/season-info/current.json

Specifically:

seasonInfo.server630WeekData

PROCESS
-------
Current Active & Average
        +
Season Info
        +
W6 final data
        ↓
K630WeeklyPlayerStateEngine
        ↓
New Active & Average dataset

OUTPUT
------
context.results.activeAverage

The actual GitHub write happens later in:

MODULE 11 — WRITE GENERATED FILES

===================================================== */


/* -----------------------------------------------------
   REBUILD ACTIVE & AVERAGE
----------------------------------------------------- */

async function rebuildActiveAverage(
    context
) {

    log(
        "Rebuilding Active & Average..."
    );


    /* ================================================
       VALIDATE CONTEXT
    ================================================ */

    if (
        !context
    ) {

        throw new Error(
            "Save Season context is required."
        );

    }


    /* ================================================
       VALIDATE CURRENT ACTIVE & AVERAGE
    ================================================ */

    if (
        !context.generated ||
        !context.generated.activeAverage
    ) {

        throw new Error(
            "Current Active & Average data has not been loaded."
        );

    }


    /* ================================================
       VALIDATE SEASON INFO
    ================================================ */

    if (
        !context.generated ||
        !context.generated.seasonInfo
    ) {

        throw new Error(
            "Current Season Info data has not been loaded."
        );

    }


    /* ================================================
       VALIDATE WEEKLY PLAYER STATE ENGINE
    ================================================ */

    if (
        !window.K630WeeklyPlayerStateEngine
    ) {

        throw new Error(
            "K630WeeklyPlayerStateEngine not found."
        );

    }


    /* ================================================
       READ W6 FROM SEASON INFO
       
       Save Season does NOT load a separate W6 file.
       
       The final W6 data is already stored inside
       Season Info.
    ================================================ */

    const server630WeekData =
        Array.isArray(
            context.generated
                .seasonInfo
                ?.server630WeekData
        )

            ? clone(
                context.generated
                    .seasonInfo
                    .server630WeekData
            )

            : [];


    /* ================================================
       VALIDATE W6 DATA
    ================================================ */

    if (
        !server630WeekData.length
    ) {

        throw new Error(
            "Season Info does not contain final W6 server630WeekData."
        );

    }


    log(
        "Final W6 data loaded from Season Info:",
        server630WeekData.length,
        "records."
    );


    /* ================================================
       BUILD FINAL ACTIVE & AVERAGE
    ================================================ */

    const result =
        await window
            .K630WeeklyPlayerStateEngine
            .build(

                clone(
                    context.generated
                        .activeAverage
                ),

                clone(
                    context.generated
                        .seasonInfo
                ),

                server630WeekData,

                {

                    seasonNumber:
                        context.season,

                    weekNumber:
                        6,

                    officialDate:
                        context.engine
                            .today,

                    generatedAt:
                        context.engine
                            .started,

                    generatedBy:
                        ENGINE_NAME,

                    meritConfiguration:
                        context.source
                            .adminConfig
                            ?.meritConfiguration ??
                        null

                }

            );


    /* ================================================
       VALIDATE ENGINE RESULT
    ================================================ */

    if (
        !result ||
        typeof result !==
            "object"
    ) {

        throw new Error(
            "Weekly Player State Engine returned an invalid result."
        );

    }


    if (
        !result.data ||
        typeof result.data !==
            "object"
    ) {

        throw new Error(
            "Weekly Player State Engine returned no Active & Average data."
        );

    }


    /* ================================================
       STORE RESULT
    ================================================ */

    context.results.activeAverage =
        result.data;


    /* ================================================
       STATUS
    ================================================ */

    context.status.completedModules.push(
        "MODULE 07 — REBUILD ACTIVE & AVERAGE"
    );


    log(
        "Active & Average rebuild finished."
    );


    return context;

}

/* =====================================================
   MODULE 08 — UPDATE ARCHIVE INDEX
=====================================================

PURPOSE
-------
Updates the central archive index used by the
Old Seasons page.

SOURCE
------
archive/index.json

ARCHIVED FILES
--------------
archive/season-{season}/season-info.json
archive/season-{season}/server-vs-server.json

PROCESS
-------
1. Load the existing archive index.
2. Remove an existing entry for this season.
3. Add the completed season.
4. Sort newest season first.
5. Prepare the new index for Module 11.

IMPORTANT
---------
This module does NOT write to GitHub.

The actual write happens in:

MODULE 11 — WRITE GENERATED FILES

===================================================== */


/* -----------------------------------------------------
   UPDATE ARCHIVE INDEX
----------------------------------------------------- */

async function updateArchiveIndex(
    context
) {

    log(
        `Updating Archive Index for Season ${context.season}...`
    );


    /* ================================================
       VALIDATE CONTEXT
    ================================================ */

    if (
        !context
    ) {

        throw new Error(
            "Save Season context is required."
        );

    }


    /* ================================================
       ARCHIVE INDEX PATH
    ================================================ */

    const indexPath =
        `${PATHS.ARCHIVE_ROOT}/index.json`;


    /* ================================================
       LOAD EXISTING INDEX
       
       If no index exists yet, start with an empty
       archive list.
    ================================================ */

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

    } catch (
        indexError
    ) {

        warning(
            "Archive index could not be loaded.",
            "Starting a new archive index.",
            indexError
        );

        index = [];

    }


    /* ================================================
       REMOVE EXISTING ENTRY FOR THIS SEASON
       
       This prevents duplicate Season 1 / Season 2
       entries when Save Season is run again.
    ================================================ */

    index =
        index.filter(
            entry =>

                normalizeSeasonNumber(
                    entry?.season
                ) !==
                context.season

        );


    /* ================================================
       CREATE ARCHIVE PATHS
    ================================================ */

    const seasonPath =
        getArchiveSeasonPath(
            context.season
        );


    const seasonInfoPath =
        `${seasonPath}/season-info.json`;


    const serverVsServerPath =
        `${seasonPath}/server-vs-server.json`;


    /* ================================================
       ADD COMPLETED SEASON
    ================================================ */

    index.push({

        season:
            context.season,

        archivedAt:
            context.engine.started,

        seasonInfo:
            seasonInfoPath,

        serverVsServer:
            serverVsServerPath

    });


    /* ================================================
       SORT NEWEST SEASON FIRST
    ================================================ */

    index.sort(
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


    /* ================================================
       STORE RESULT
    ================================================ */

    context.results.archiveIndex =
        index;


    /* ================================================
       PREPARE WRITE QUEUE ENTRY
       
       Module 11 will perform the actual write.
    ================================================ */

    context.writeQueue.push({

        path:
            indexPath,

        data:
            clone(
                index
            ),

        source:
            indexPath,

        type:
            "archive-index",

        season:
            context.season

    });


    /* ================================================
       STATUS
    ================================================ */

    context.status.completedModules.push(
        "MODULE 08 — UPDATE ARCHIVE INDEX"
    );


    log(
        "Archive Index prepared.",
        index
    );


    return context;

}

/* -----------------------------------------------------
   LOAD FINAL SEASON DATA
----------------------------------------------------- */

async function loadFinalSeasonData(
    context
) {

    log(
        "Loading final Season data..."
    );


    /* ================================================
       VALIDATE CONTEXT
    ================================================ */

    if (
        !context
    ) {

        throw new Error(
            "Save Season context is required."
        );

    }


    /* ================================================
       SEASON INFO
    ================================================ */

    context.generated.seasonInfo =
        await readJson(
            PATHS.SEASON_INFO
        );


    /* ================================================
       ACTIVE & AVERAGE
    ================================================ */

    context.generated.activeAverage =
        await readJson(
            PATHS.ACTIVE_AVERAGE
        );


    /* ================================================
       SERVER VS SERVER
    ================================================ */

    context.generated.serverVsServer =
        await readJson(
            PATHS.SERVER_VS_SERVER
        );


    /* ================================================
       HOME
    ================================================ */

    context.generated.home =
        await readJson(
            PATHS.HOME
        );


    /* ================================================
       OLD PLAYERS
    ================================================ */

    context.generated.oldPlayers =
        await readJson(
            PATHS.OLD_PLAYERS
        );


    /* ================================================
       ADMIN CONFIGURATION
    ================================================ */

    context.source.adminConfig =
        await readJson(
            PATHS.ADMIN_CONFIG
        );


    /* ================================================
       VALIDATE SEASON INFO
    ================================================ */

    if (
        !context.generated.seasonInfo ||
        typeof context.generated.seasonInfo !==
            "object"
    ) {

        throw new Error(
            "Season Info data is invalid."
        );

    }


    /* ================================================
       VALIDATE ACTIVE & AVERAGE
    ================================================ */

    if (
        !context.generated.activeAverage ||
        typeof context.generated.activeAverage !==
            "object"
    ) {

        throw new Error(
            "Active & Average data is invalid."
        );

    }


    /* ================================================
       VALIDATE SERVER VS SERVER
    ================================================ */

    if (
        !context.generated.serverVsServer ||
        typeof context.generated.serverVsServer !==
            "object"
    ) {

        throw new Error(
            "Server vs Server data is invalid."
        );

    }


    /* ================================================
       VALIDATE HOME
    ================================================ */

    if (
        !context.generated.home ||
        typeof context.generated.home !==
            "object"
    ) {

        throw new Error(
            "Home data is invalid."
        );

    }


    /* ================================================
       VALIDATE OLD PLAYERS
    ================================================ */

    if (
        !context.generated.oldPlayers ||
        typeof context.generated.oldPlayers !==
            "object"
    ) {

        throw new Error(
            "Old Players data is invalid."
        );

    }


    /* ================================================
       VALIDATE ADMIN CONFIG
    ================================================ */

    if (
        !context.source.adminConfig ||
        typeof context.source.adminConfig !==
            "object"
    ) {

        throw new Error(
            "Admin configuration is invalid."
        );

    }


    /* ================================================
       STORE ARCHIVE SEASON PATH
    ================================================ */

    context.archive.seasonPath =
        getArchiveSeasonPath(
            context.season
        );


    /* ================================================
       STATUS
    ================================================ */

    context.status.completedModules.push(
        "MODULE 04 — LOAD FINAL SEASON DATA"
    );


    log(
        "Final Season data loaded successfully."
    );


    return context;

}

/* =====================================================
   MODULE 10 — UPDATE HOME
=====================================================

PURPOSE
-------
Rebuilds the current Home dataset after Save Season.

SOURCE
------
- Final Active & Average
- Final Season Info
- Existing Home dataset

PROCESS
-------
1. Take the final Active & Average data.
2. Take the final Season Info week data.
3. Rebuild the Home dataset.
4. Preserve the Home structure expected by the page.
5. Prepare the new Home JSON for Module 11.

IMPORTANT
---------
This module does NOT write directly to GitHub.

The final write is performed by:

MODULE 11 — WRITE GENERATED FILES

===================================================== */


/* -----------------------------------------------------
   UPDATE HOME
----------------------------------------------------- */

async function updateHome(
    context
) {

    log(
        `Updating Home for Season ${context.season}...`
    );


    /* ================================================
       VALIDATE CONTEXT
    ================================================ */

    if (
        !context
    ) {

        throw new Error(
            "Save Season context is required."
        );

    }


    /* ================================================
       VALIDATE FINAL ACTIVE & AVERAGE
    ================================================ */

    if (
        !context.results?.activeAverage
    ) {

        throw new Error(
            "Final Active & Average data is missing."
        );

    }


    /* ================================================
       VALIDATE FINAL SEASON INFO
    ================================================ */

    if (
        !context.generated?.seasonInfo
    ) {

        throw new Error(
            "Season Info data is missing."
        );

    }


    /* ================================================
       READ FINAL PLAYERS
    ================================================ */

    const players =
        Array.isArray(
            context.results
                .activeAverage
                ?.players
        )

            ? context.results
                .activeAverage
                .players

            : [];


    /* ================================================
       READ SEASON INFO
    ================================================ */

    const seasonInfo =
        context.generated
            .seasonInfo;


    /* ================================================
       PARTICIPATING SERVERS
    ================================================ */

    const participatingServers =
        Array.isArray(
            seasonInfo
                ?.participatingServers
        )

            ? clone(
                seasonInfo
                    .participatingServers
            )

            : [];


    /* ================================================
       SERVER 630 WEEK DATA
    ================================================ */

    const server630WeekData =
        Array.isArray(
            seasonInfo
                ?.server630WeekData
        )

            ? clone(
                seasonInfo
                    .server630WeekData
            )

            : [];


    /* ================================================
       PARTICIPATING SERVER WEEK DATA
    ================================================ */

    const participatingServerWeekData =
        Array.isArray(
            seasonInfo
                ?.participatingServerWeekData
        )

            ? clone(
                seasonInfo
                    .participatingServerWeekData
            )

            : [];


    /* ================================================
       CALCULATE BASIC HOME TOTALS
    ================================================ */

    const activePlayers =
        players.length;


    const warriors =
        players.filter(

            player =>
                Number(
                    player?.historicalPower ??
                    player?.topPower ??
                    player?.power ??
                    0
                ) > 20000000

        ).length;


    const farmers =
        players.filter(

            player =>
                Number(
                    player?.historicalPower ??
                    player?.topPower ??
                    player?.power ??
                    0
                ) < 20000000

        ).length;


    const serverPower =
        players.reduce(

            (
                total,
                player
            ) =>

                total +

                Number(
                    player?.historicalPower ??
                    player?.topPower ??
                    player?.power ??
                    0
                ),

            0

        );


    /* ================================================
       MERITS
    ================================================ */

    const serverMerits =
        players.reduce(

            (
                total,
                player
            ) =>

                total +

                Number(
                    player?.topMerits ??
                    player?.merits ??
                    0
                ),

            0

        );


    /* ================================================
       KILLS
    ================================================ */

    const serverKills =
        players.reduce(

            (
                total,
                player
            ) =>

                total +

                Number(
                    player?.topKills ??
                    player?.kills ??
                    0
                ),

            0

        );


    /* ================================================
       BUILD HOME DATASET
    ================================================ */

    const homeData = {

        schemaVersion:
            context.generated
                .home
                ?.schemaVersion ??
            1,

        kingdom:
            context.generated
                .home
                ?.kingdom ??
            630,

        dataset:
            "home",

        generatedAt:
            context.engine.started,

        currentSeason:
            context.season,

        currentWeek:
            6,

        officialDate:
            context.engine.today,

        activePlayers:
            activePlayers,

        warriors:
            warriors,

        farmers:
            farmers,

        serverPower:
            serverPower,

        serverMerits:
            serverMerits,

        serverKills:
            serverKills,

        participatingServers:
            participatingServers,

        server630WeekData:
            server630WeekData,

        participatingServerWeekData:
            participatingServerWeekData

    };


    /* ================================================
       STORE RESULT
    ================================================ */

    context.results.home =
        homeData;


    /* ================================================
       WRITE QUEUE
    ================================================ */

    context.writeQueue.push({

        path:
            PATHS.HOME,

        data:
            clone(
                homeData
            ),

        source:
            PATHS.HOME,

        type:
            "home",

        season:
            context.season

    });


    /* ================================================
       STATUS
    ================================================ */

    context.status.completedModules.push(
        "MODULE 10 — UPDATE HOME"
    );


    log(
        "Home update prepared."
    );

    log(
        "Active Players:",
        activePlayers
    );

    log(
        "Warriors:",
        warriors
    );

    log(
        "Farmers:",
        farmers
    );

    log(
        "Server Power:",
        serverPower
    );

    log(
        "Server Merits:",
        serverMerits
    );

    log(
        "Server Kills:",
        serverKills
    );


    return context;

}

/* =====================================================
   MODULE 11 — WRITE GENERATED FILES
=====================================================

PURPOSE
-------
Writes all final Save Season datasets to
k630-public-data.

SINGLE WRITE POINT
------------------
This is the only module responsible for the final
Save Season writes.

DATA WRITTEN
------------
1. Archived Season Info
2. Archived Server vs Server
3. Archive Index
4. Active & Average
5. Old Players
6. Home

REPOSITORY
----------
Ragnarok630/k630-public-data

BRANCH
------
main

IMPORTANT
---------
All previous modules only prepare data.

This module performs the actual writes.

===================================================== */


/* -----------------------------------------------------
   WRITE ONE JSON FILE
----------------------------------------------------- */

async function writeSaveSeasonJson(
    context,
    path,
    data,
    message
) {

    requireValue(
        context?.github,
        "GitHub writer is required."
    );


    /* ================================================
       WRITER METHOD
       
       Preferred method.
    ================================================ */

    if (
        typeof context.github.writeJson ===
        "function"
    ) {

        return await context
            .github
            .writeJson(
                path,
                data,
                message
            );

    }


    /* ================================================
       INVOKE METHOD
       
       Fallback for the K630 GitHub Writer.
    ================================================ */

    if (
        typeof context.github.invoke ===
        "function"
    ) {

        return await context
            .github
            .invoke(

                "write-json",

                {

                    repository: {

                        owner:
                            "Ragnarok630",

                        repository:
                            "k630-public-data",

                        branch:
                            "main"

                    },

                    path:

                        path.replace(
                            /^assets\/data\//,
                            ""
                        ),

                    data:
                        clone(
                            data
                        ),

                    message:
                        message

                }

            );

    }


    /* ================================================
       NO WRITER AVAILABLE
    ================================================ */

    throw new Error(
        "GitHub writer does not provide writeJson() or invoke()."
    );

}


/* -----------------------------------------------------
   WRITE GENERATED FILES
----------------------------------------------------- */

async function writeGeneratedFiles(
    context
) {

    log(
        `Writing Season ${context.season} data to k630-public-data...`
    );


    /* ================================================
       VALIDATE CONTEXT
    ================================================ */

    if (
        !context
    ) {

        throw new Error(
            "Save Season context is required."
        );

    }


    /* ================================================
       VALIDATE GITHUB WRITER
    ================================================ */

    requireValue(
        context.github,
        "GitHub writer is required before Save Season can write data."
    );


    /* ================================================
       WRITE ARCHIVED SEASON INFO
    ================================================ */

    if (
        context.archive?.seasonInfo
    ) {

        await writeSaveSeasonJson(

            context,

            context.archive
                .seasonInfo
                .path,

            context.archive
                .seasonInfo
                .data,

            `Save Season ${context.season} - Archive Season Info`

        );

        log(
            "Archived Season Info written."
        );

    }


    /* ================================================
       WRITE ARCHIVED SERVER VS SERVER
    ================================================ */

    if (
        context.archive?.serverVsServer
    ) {

        await writeSaveSeasonJson(

            context,

            context.archive
                .serverVsServer
                .path,

            context.archive
                .serverVsServer
                .data,

            `Save Season ${context.season} - Archive Server vs Server`

        );

        log(
            "Archived Server vs Server written."
        );

    }


    /* ================================================
       WRITE ACTIVE & AVERAGE
    ================================================ */

    if (
        context.results?.activeAverage
    ) {

        await writeSaveSeasonJson(

            context,

            PATHS.ACTIVE_AVERAGE,

            context.results
                .activeAverage,

            `Save Season ${context.season} - Active & Average`

        );

        log(
            "Active & Average written."
        );

    }


    /* ================================================
       WRITE OLD PLAYERS
    ================================================ */

    if (
        context.results?.oldPlayers
    ) {

        await writeSaveSeasonJson(

            context,

            PATHS.OLD_PLAYERS,

            context.results
                .oldPlayers,

            `Save Season ${context.season} - Old Players`

        );

        log(
            "Old Players written."
        );

    }


    /* ================================================
       WRITE HOME
    ================================================ */

    if (
        context.results?.home
    ) {

        await writeSaveSeasonJson(

            context,

            PATHS.HOME,

            context.results
                .home,

            `Save Season ${context.season} - Home`

        );

        log(
            "Home written."
        );

    }


    /* ================================================
       WRITE ARCHIVE INDEX
    ================================================ */

    if (
        context.results?.archiveIndex
    ) {

        await writeSaveSeasonJson(

            context,

            `${PATHS.ARCHIVE_ROOT}/index.json`,

            context.results
                .archiveIndex,

            `Save Season ${context.season} - Archive Index`

        );

        log(
            "Archive Index written."
        );

    }


    /* ================================================
       MARK ARCHIVE AS WRITTEN
    ================================================ */

    context.archive.written =
        true;


    /* ================================================
       STATUS
    ================================================ */

    context.status.completedModules.push(
        "MODULE 11 — WRITE GENERATED FILES"
    );


    log(
        `Season ${context.season} data successfully written to k630-public-data.`
    );


    return context;

}

/* =====================================================
   MODULE 12 — RESET NEXT SEASON
=====================================================

PURPOSE
-------
Prepare the system for the next Kingdom 630 season.

IMPORTANT
---------
This module does NOT delete archived season data.

Archived data remains permanently available in:

k630-public-data

Only the CURRENT season state is advanced.

===================================================== */


/* -----------------------------------------------------
   RESET / PREPARE NEXT SEASON
----------------------------------------------------- */

async function resetNextSeason(
    context
) {

    log(
        `Preparing next season after Season ${context.season}...`
    );


    /* ================================================
       VALIDATE CURRENT SEASON
    ================================================ */

    const currentSeason =
        normalizeSeasonNumber(
            context.season
        );


    /* ================================================
       CALCULATE NEXT SEASON
    ================================================ */

    const nextSeason =
        currentSeason + 1;


    context.nextSeason =
        nextSeason;


    log(
        `Current Season: ${currentSeason}`
    );

    log(
        `Next Season: ${nextSeason}`
    );


    /* ================================================
       RESET CURRENT WEEK
    ================================================ */

    context.currentWeek =
        0;


    /* ================================================
       RESET WEEK STATUS
    ================================================ */

    context.weekStatus = {

        w0:
            false,

        w1:
            false,

        w2:
            false,

        w3:
            false,

        w4:
            false,

        w5:
            false,

        w6:
            false

    };


    /* ================================================
       RESET PARTICIPATING SERVER WEEK DATA
    ================================================ */

    context.participatingServerWeekData =
        [];


    /* ================================================
       RESET SERVER 630 WEEK DATA
    ================================================ */

    context.server630WeekData =
        [];


    /* ================================================
       RESET PARTICIPATING SERVERS
    ================================================ */

    context.participatingServers =
        [];


    /* ================================================
       PREPARE NEXT SEASON STATUS
       
       This object is kept in memory for the
       Save Season result.

       The actual persistent Admin Center /
       website status is handled by the
       appropriate status writer.
    ================================================ */

    context.nextSeasonStatus = {

        season:
            nextSeason,

        currentWeek:
            0,

        foundation:
            false,

        matchmaking:
            false,

        weeks: {

            w0:
                false,

            w1:
                false,

            w2:
                false,

            w3:
                false,

            w4:
                false,

            w5:
                false,

            w6:
                false

        },

        readyForNextSeason:
            true

    };


    /* ================================================
       RESET SEASON-SPECIFIC RESULT STATE
    ================================================ */

    context.activeAverageResult =
        null;

    context.seasonInfoResult =
        null;

    context.homeResult =
        null;


    /* ================================================
       RESET TEMPORARY ARCHIVE STATE
    ================================================ */

    context.archive =
        context.archive ??
        {};

    context.archive.written =
        true;


    /* ================================================
       COMPLETION STATUS
    ================================================ */

    context.status =
        context.status ??
        {};

    context.status.completedModules =
        context.status.completedModules ??
        [];

    context.status.completedModules.push(
        "MODULE 12 — RESET NEXT SEASON"
    );


    context.status.nextSeason =
        nextSeason;


    context.status.readyForNextSeason =
        true;


    /* ================================================
       LOG
    ================================================ */

    log(
        `Season ${currentSeason} finalized.`
    );

    log(
        `System prepared for Season ${nextSeason}.`
    );


    return context;

}

/* =====================================================
   MODULE 13 — SAVE SEASON ORCHESTRATOR
=====================================================

PURPOSE
-------
Runs the complete Save Season finalization cycle.

THIS MODULE DOES NOT CONTAIN DATA LOGIC.

It only controls the order in which the Save Season
modules execute.

FINAL SEASON FLOW
-----------------
MODULE 04
Load final data

MODULE 05
Archive Season Info

MODULE 06
Archive Server vs Server

MODULE 07
Rebuild Active & Average using W6 from Season Info

MODULE 08
Update Archive Index

MODULE 09
Update Old Players

MODULE 10
Update Home

MODULE 11
Write everything to k630-public-data

MODULE 12
Prepare the next season

===================================================== */


/* -----------------------------------------------------
   SAVE SEASON
----------------------------------------------------- */

async function saveSeason(
    options = {}
) {

    /* ================================================
       CREATE CONTEXT
    ================================================ */

    const context =
        createContext(
            options
        );


    log(
        "================================================="
    );

    log(
        "SAVE SEASON STARTED"
    );

    log(
        `Season: ${context.season}`
    );

    log(
        `Engine: ${ENGINE_NAME} ${ENGINE_VERSION}`
    );

    log(
        "================================================="
    );


    try {


        /* ============================================
           MODULE 04
           LOAD FINAL SEASON DATA
        ============================================ */

        context.status.currentModule =
            "MODULE 04 — LOAD FINAL SEASON DATA";

        await loadFinalSeasonData(
            context
        );


        /* ============================================
           MODULE 05
           ARCHIVE SEASON INFO
        ============================================ */

        context.status.currentModule =
            "MODULE 05 — ARCHIVE SEASON INFO";

        await archiveSeasonInfo(
            context
        );


        /* ============================================
           MODULE 06
           ARCHIVE SERVER VS SERVER
        ============================================ */

        context.status.currentModule =
            "MODULE 06 — ARCHIVE SERVER VS SERVER";

        await archiveServerVsServer(
            context
        );


        /* ============================================
           MODULE 07
           REBUILD ACTIVE & AVERAGE
        ============================================ */

        context.status.currentModule =
            "MODULE 07 — REBUILD ACTIVE & AVERAGE";

        await rebuildActiveAverage(
            context
        );


        /* ============================================
           MODULE 08
           UPDATE ARCHIVE INDEX
        ============================================ */

        context.status.currentModule =
            "MODULE 08 — UPDATE ARCHIVE INDEX";

        await updateArchiveIndex(
            context
        );


        /* ============================================
           MODULE 09
           UPDATE OLD PLAYERS
        ============================================ */

        context.status.currentModule =
            "MODULE 09 — UPDATE OLD PLAYERS";

        await updateOldPlayers(
            context
        );


        /* ============================================
           MODULE 10
           UPDATE HOME
        ============================================ */

        context.status.currentModule =
            "MODULE 10 — UPDATE HOME";

        await updateHome(
            context
        );


        /* ============================================
           MODULE 11
           WRITE GENERATED FILES
           
           This is the actual write to
           k630-public-data.
        ============================================ */

        context.status.currentModule =
            "MODULE 11 — WRITE GENERATED FILES";

        await writeGeneratedFiles(
            context
        );


        /* ============================================
           MODULE 12
           RESET NEXT SEASON
           
           This happens AFTER the completed season
           has been written successfully.
        ============================================ */

        context.status.currentModule =
            "MODULE 12 — RESET NEXT SEASON";

        await resetNextSeason(
            context
        );


        /* ============================================
           FINAL STATUS
        ============================================ */

        context.status.currentModule =
            null;

        context.status.finished =
            true;

        context.status.failed =
            false;


        log(
            "================================================="
        );

        log(
            `SAVE SEASON ${context.season} COMPLETED`
        );

        log(
            `NEXT SEASON: ${context.nextSeason}`
        );

        log(
            "================================================="
        );


        return {

            success:
                true,

            season:
                context.season,

            nextSeason:
                context.nextSeason,

            status:
                clone(
                    context.status
                ),

            archive:
                clone(
                    context.archive
                ),

            results:
                clone(
                    context.results
                )

        };

    } catch (
        saveSeasonError
    ) {


        /* ============================================
           ERROR STATUS
        ============================================ */

        context.status.failed =
            true;

        context.status.finished =
            false;


        error(
            "SAVE SEASON FAILED."
        );

        error(
            saveSeasonError
        );


        throw saveSeasonError;

    }

}

/* =====================================================
   MODULE 14 — PUBLIC API
=====================================================

PURPOSE
-------
Expose the Save Season Engine to the website.

PUBLIC OBJECT
-------------
window.K630SaveSeasonEngine

PUBLIC METHODS
--------------
saveSeason(options)

===================================================== */


/* -----------------------------------------------------
   PUBLIC API
----------------------------------------------------- */

window.K630SaveSeasonEngine = {

    /* ================================================
       ENGINE INFORMATION
    ================================================ */

    name:
        ENGINE_NAME,

    version:
        ENGINE_VERSION,


    /* ================================================
       SAVE SEASON
    ================================================ */

    saveSeason:


        saveSeason

};


/* -----------------------------------------------------
   ENGINE LOADED
----------------------------------------------------- */

console.info(

    `${LOG_PREFIX} ${ENGINE_NAME} ${ENGINE_VERSION} Public API ready.`

);


/* =====================================================
   END OF MODULE 14
===================================================== */