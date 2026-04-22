# Sortoved Soy v2

`v2` is currently running in local-first mode. The goal of this stage is to finish the full screen flow, local state model, creation wizard, variety catalog, task cards, and queue lifecycle before wiring Google sync.

## What Is Implemented Now

- Separate `v2` app entry and navigation
- Independent persisted state namespace
- Local creation wizard for 18 creation steps
- Variety catalog and 29 task entries
- Split local task flows:
  - fusarium overview + infection cards
  - measurement cards
  - placeholder screens for tasks still missing explicit JSON structure
- Local queue with status transitions and retry metadata
- Local workbook mapping based on `v2/template/sort-template.xlsx`
- Clipboard validation for Google Sheets links without cloud sync

## Deferred For Later

- Google OAuth
- Google Sheets API writes
- Google Drive uploads
- Real cloud synchronization and token refresh flows

## Current Behavior

- Existing Google Sheets links can be added to the local catalog after validation.
- New varieties are created locally from the workbook template and stored in app state.
- Task submissions go through the queue and change statuses locally.
- The queue model is kept intentionally close to the future sync model so cloud integration can be added later without rebuilding the UI flow.
