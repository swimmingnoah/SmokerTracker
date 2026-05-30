# Estimated-Finish Timer — Design

**Date:** 2026-05-30
**Component:** `smoker-app-frontend/src/SessionDetail.jsx`
**Status:** Approved (design phase)

## Goal

On an **active** smoke session, show an estimate of when the cook will finish,
based on the average duration of past cooks of the same meat type. The user wants
to glance at the session and know roughly when to plan to pull the meat.

## Scope

- Frontend-only. **No backend changes, no new dependencies.**
- Applies to active sessions only (`isActiveSession()` / `session.endTime === null`).
  On finished sessions the card does not render.
- Placement: a new "Estimated finish" card in `SessionDetail.jsx`, near the
  existing Duration line (~line 1038).

## Decisions (from brainstorming)

| Question | Decision |
|----------|----------|
| Average basis | **Same meat type only** (plain duration average, not weight-scaled) |
| Time basis | **Net cook time** for the current session (pause-adjusted) |
| What to display | All four: estimated finish time, time remaining, progress bar/%, average baseline |
| How to compute historical average | **Approach A** — frontend, reuse `computeEstimate`; accept that past average is wall-clock |

## Data Flow

1. On mount, for active sessions only, fetch `GET /api/sessions` once into new
   state `pastSessions` (via `apiFetch`, consistent with the rest of the file).
2. Compute the average with the existing helper:
   `computeEstimate(pastSessions, session.meatType, null)` from `planUtils.js`.
   - Passing `null` for planned weight forces the **plain** same-meat duration
     average (method `'plain'`), matching the "same meat type only" choice.
   - `computeEstimate` already filters out hidden sessions and any session
     missing `startTime`/`endTime`. The current active session has no `endTime`,
     so it is naturally excluded.
   - Returns `{ sampleCount, estimatedDurationHours, method, ... }`.
3. The existing 30s active-session polling tick (`SessionDetail.jsx:207`) drives
   re-renders, so the readouts refresh without adding a second timer.

## The Four Readouts

Computed in render from `estimatedDurationHours` and the current net cook time.
Net cook time reuses the existing pause-adjusted math (`netCookMsAt(new Date())`
or equivalent to `calculateDuration`'s net value).

1. **Average baseline** — `Avg {meatType}: {formatHoursMinutes(estimatedDurationHours)} · {sampleCount} cook(s)`
2. **Progress bar + %** — `netCookMs / (estimatedDurationHours * 3_600_000)`, clamped 0–100%.
3. **Time remaining** — `avgMs − netCookMs`, clamped ≥ 0, formatted `~{Xh Ym} left`.
4. **Estimated finish clock** — `now + remainingMs`, formatted as a local time
   (e.g. `Est. done ~4:45 PM`).

## Pure Helper (testable)

Extract the math into a pure function in `planUtils.js` so it is unit-testable
and out of JSX:

```
computeFinishEstimate(estimatedDurationHours, netCookMs, now) -> {
  remainingMs,   // clamped >= 0
  finishDate,    // Date = now + remainingMs (only meaningful when !overrun)
  progressPct,   // 0..100
  overrun        // boolean: netCookMs >= avg duration
}
```

When `estimatedDurationHours` is null (no history), the card shows the
no-history message instead of calling this.

## Edge Cases

- **No history** (`sampleCount === 0` / `estimatedDurationHours == null`):
  render a muted message — `Not enough {meatType} cooks yet to estimate` — no bar.
- **Running long** (`netCookMs >= avgMs`, `overrun === true`): bar caps at 100%
  (styled to signal overrun), time remaining shows `running long`, and the finish
  line shows `Est. done — running long` instead of a past time.
- **Missing `meatType` or `startTime`**: card hidden.

## Net-vs-Wall-Clock Approximation

Per Approach A, the historical average uses wall-clock duration of past cooks,
while the current session's elapsed is net (pause-adjusted). This asymmetry is
accepted: pauses are occasional and small relative to total cook time and to the
natural cook-to-cook variance. Documented here so it is a known, intentional
simplification rather than a bug.

## Testing

Using the new Vitest + Testing Library setup:

- Unit-test `computeFinishEstimate` covering:
  - **Normal**: half-done cook → ~50% progress, positive remaining, future finish.
  - **Overrun**: net cook past average → `overrun === true`, remaining clamped 0,
    progress 100%.
  - **Exactly at average**: boundary → overrun/100%.
  - **Zero/invalid duration** input handled without NaN.
- (Optional) a light render test asserting the no-history message appears when
  `pastSessions` has no same-meat finished cooks.

## Out of Scope

- Weight-scaled (h/lb) estimates.
- Net-to-net historical averaging (Approach B/C) — may be a future upgrade.
- Any backend or InfluxDB changes.
