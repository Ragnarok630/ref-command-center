# Kingdom 630 Dragon Command Center — UI-Only Foundation

This copy preserves the existing website frame while removing the old data architecture.

## Preserved

- All page HTML files
- All CSS, page styling, responsive layout and visual effects
- Images, banners, icons and fonts
- SPA navigation, sidebar, top bar and footer
- Supabase login and session restoration
- Role checks for Owner, Admin and Officer
- Protected access to Admin Center
- Protected access to AFK Service
- First-login password change flow

## Removed

- Legacy data engine
- V2 data engine
- Storage engines
- IndexedDB production storage
- GitHub data-writing modules
- Season loaders and processors
- Archive and migration engines
- Player, statistics and cache engines
- Admin data-processing controllers
- Public-page data controllers
- AFK request/player-search controller

The pages intentionally display their existing static HTML structure without loading or writing project data. New engines can now be rebuilt against this stable UI frame without old code running in parallel.
