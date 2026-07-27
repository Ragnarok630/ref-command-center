# DECISIONS

Project:
K630-REF

Version:
630.0.7

Sprint:
5 – Active & Average

---

# Definitieve architectuurbeslissingen

## 1. Foundation

Permanent bestand:

630-Foundation.json

De Foundation is de vaste basis van Kingdom 630.

Deze wordt uitsluitend vervangen door de Owner.

De Foundation wordt gebruikt door:

- Active & Average
- Player History
- Old Players
- Kingdom Statistics
- Historische analyses

---

## 2. Season bestanden

Bestandsnaam:

Server-Season-Week.json

Voorbeeld:

630-1-0.json
630-1-1.json
630-1-2.json
...
630-1-6.json

Iedere week blijft permanent beschikbaar.

Er worden geen weekbestanden verwijderd.

---

## 3. Mappenstructuur

Data/

Foundation/
    630-Foundation.json

Seasons/

    Season-1/
        630-1-0.json
        ...
        646-1-6.json

    Season-2/
        ...

Archive/

---

## 4. Archive

Archive bevat uitsluitend seizoenmetadata.

Geen spelergegevens.

Geen Power-data.

Geen Merits.

Geen duplicatie van JSON-data.

Week 6 blijft de officiële eindstand van ieder seizoen.

---

## 5. Start Power

Start Power wordt altijd gelezen uit:

Foundation

Top Power

Deze waarde verandert nooit.

---

## 6. Historical Power

Historical Power wordt berekend als:

Hoogste Top Power

gevonden in alle beschikbare Season Week-bestanden.

Er wordt geen Historical Power opgeslagen.

Deze wordt altijd opnieuw berekend.

---

## 7. Power Growth

Power Growth

=

Historical Power

-

Start Power

---

## 8. T4 / T5

Gebaseerd op Tech Power.

Regel:

Tech Power <= 28.367.786

=

T4

Tech Power > 28.367.786

=

T5

Weergave:

T4

- Paars
- Vetgedrukt

T5

- Goud
- Vetgedrukt

---

## 9. Data Engine

Alle toekomstige modules gebruiken uitsluitend de centrale Data Engine.

Er wordt nergens meer rechtstreeks uit JSON-bestanden gelezen.

Data Engine bevat:

- Foundation Loader
- Season Loader
- Week Loader
- Player Index
- Player Timeline
- Statistics Engine
- Cache Manager

---

## 10. Cache

Cache bevat uitsluitend berekende gegevens.

Originele JSON-bestanden blijven altijd de bron van waarheid.

Wanneer nodig kan de cache volledig opnieuw opgebouwd worden.

---

## 11. Rebuild Cache

Rebuild Cache is uitsluitend beschikbaar voor de Owner.

Deze functie wordt opgenomen in de Admin Module onder Maintenance.

Na een Rebuild worden alle berekeningen opnieuw opgebouwd vanuit:

- Foundation
- Season JSON-bestanden

Er wordt nooit data uit de cache teruggeschreven naar de originele bestanden.

---

## 12. Performance

Active & Average gebruikt:

- Foundation
- Week 6 van ieder seizoen

Player History leest alleen de gegevens van de geselecteerde speler.

Server vs Server leest uitsluitend de gekozen week.

Hierdoor blijft de applicatie snel, ook bij een groot aantal seizoenen en servers.

# DECISION 031
Date: 2026-07-10

Title:
Season Historical Values are Frozen

Status:
Accepted

Description

Historical Power is determined only from Week 0.

Historical Power is never updated during the season.

Reason

Players must not receive different Merit % requirements after reaching T5 during an active season.

Result

Historical Power = Week 0

Tech Power = Week 0

T4/T5 = Week 0

Permanent until next season.

------------------------------------------------------------

# DECISION 032

Title

Season Archive becomes the official historical source

Status

Accepted

Description

Week files are temporary working files.

After Save Current Season the official source becomes the Season Archive.

Reason

Much faster loading.

Smaller datasets.

Future proof.

Pages using Season Archive

Old Seasons

Active & Average

Records

Strike Status

Future Statistics

------------------------------------------------------------

# DECISION 033

Title

Save Current Season creates two archives

Status

Accepted

Description

Every completed season generates:

Kingdom Archive

630-Sx-SoSy

Server vs Server Archive

SvS-Sx-SoSy

Example

630-S1-SoS4

SvS-S1-SoS4

------------------------------------------------------------

# DECISION 034

Title

Admin Center becomes Workflow Manager

Status

Accepted

Description

The Admin Center becomes the only place where processing is executed.

No page may process data.

Pages become read-only.

Workflow

Foundation

↓

Season Upload

↓

Save Current Season

↓

Migration Day

↓

Next Season

------------------------------------------------------------

# DECISION 035

Title

Admin Center becomes modular

Status

Accepted

Description

The current admin.js will be replaced.

Modules

admin-core.js

admin-foundation.js

admin-season.js

admin-migration.js

Advantages

Much smaller files.

Easier maintenance.

Independent development.

Cleaner architecture.

------------------------------------------------------------

# DECISION 036

Title

Migration Day controls Old Players

Status

Accepted

Description

Old Players are NOT determined immediately after Week 6.

Instead

Migration Day compares

630-Matchmaking-x.json

against

Current Foundation

Results

Players no longer on Kingdom 630

↓

Old Players

New players

↓

Active & Average

Foundation

Rejoins

↓

Player History

------------------------------------------------------------

# DECISION 037

Title

Season Info contains only Kingdom 630 players

Status

Accepted

Description

Season Info displays only players that belong to Kingdom 630.

Other participating servers are processed only for

Server vs Server

Season Archive

Statistics

They are never displayed inside Season Info.

------------------------------------------------------------

# DECISION 038

Title

Week files remain temporary

Status

Accepted

Description

Week files remain available during the season.

They are required for

Validation

Rebuild

Season Info

After Save Current Season

Season Archive becomes the primary historical dataset.

Week files remain optional reference data.

------------------------------------------------------------

# DECISION 039

Title

Workflow Monitor

Status

Accepted

Description

The Admin Center shall contain a permanent Workflow Monitor.

The monitor always shows

Current step

Completed steps

Locked steps

Warnings

Errors

Next required action

Goal

Any future administrator can operate the complete website by following the monitor without technical knowledge.