# ADMIN CENTER ARCHITECTURE (Sprint 5)

## Philosophy

The Admin Center becomes the single control point for all data operations.

No other page may:

- upload data
- process data
- archive data
- modify player information

Every operation is executed from the Admin Center.

All other pages are read-only.

---

# Admin Workflow

The workflow is fixed.

Step 1

Foundation

↓

Step 2

Season Upload

↓

Step 3

Save Current Season

↓

Step 4

Migration Day

↓

Repeat Step 2 for the next season.

---

# Step 1 – Foundation

Purpose

Create the permanent Kingdom 630 player database.

Input

630-Foundation.json

Functions

• Upload Foundation

• Replace Foundation (Owner only)

• Validate Foundation

• Rebuild Player Database

Output

Permanent Player Database

---

# Step 2 – Season Upload

Purpose

Load every participating server.

Input

630-1-0.json

631-1-0.json

...

639-1-6.json

Functions

Upload

Validation

Progress Monitor

Week Validation

Server Validation

Output

Season Engine

Season Info

Server vs Server

---

# Step 3 – Save Current Season

Purpose

Freeze the completed season.

Creates

Kingdom Archive

630-S1-SoS4

Server vs Server Archive

SvS-S1-SoS4

Updates

Old Seasons

Active & Average

Records

Strike Status

Season Lifecycle

Output

Archived Season

---

# Step 4 – Migration Day

Purpose

Synchronize Kingdom 630 after Matchmaking.

Input

630-Matchmaking-1.json

Functions

Compare current members

Detect new players

Detect players that left

Detect rejoins

Move old players

Update Active & Average

Output

Updated Foundation Database

Old Players

Ready for next season

---

# Admin Monitor

Every action updates a central monitor.

Example

Foundation

✔ Complete

Season Upload

✔ Complete

Save Current Season

Waiting

Migration Day

Locked

The monitor always displays:

Current step

Completed steps

Required next action

Warnings

Errors

Success messages

No operation can be executed out of order.

---

# Modular Structure

Current admin.js will be replaced by:

admin-core.js

Shared helpers

Storage

Validation

Workflow

admin-foundation.js

Foundation

Baseline

Rebuild

admin-season.js

Season Upload

Season Monitor

Save Current Season

Season Archive

admin-migration.js

Migration Day

Old Players

Player Synchronization

Future modules

admin-records.js

admin-settings.js

admin-users.js

---

# Engine Responsibilities

Engine

Loads JSON

Processes data

Calculates statistics

Archives seasons

Updates player history

Admin Center

Calls Engine

Displays progress

Displays monitor

Controls workflow

Pages

Display information only

No processing

No uploads

No data manipulation

---

# Long-term Goal

A new administrator should be able to manage an entire season without technical knowledge.

Only by following the workflow inside the Admin Center.