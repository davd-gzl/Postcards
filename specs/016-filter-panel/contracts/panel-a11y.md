# Contract — Filter Panel Accessibility & Interaction

Satisfies FR-005 and Principle VII (keyboard-first, WCAG 2.1 AA).

## Trigger

- A single button labelled **Filter** (with `title`), shown on the Map and Places screens.
- It carries a state hint: when any filter is active, the button reflects it (dot/badge)
  and `aria` conveys "N filters active".

## Panel (dialog)

- `role="dialog"`, `aria-modal="true"`, `aria-label` = "Filters".
- **Focus trap** while open; focus moves to the first control (or the panel heading) on open.
- **Escape** closes the panel; an outside/scrim click closes it; **focus returns** to the
  Filter trigger on close.
- Applied filters **persist** on close (closing is not "cancel").
- Every control has an accessible name; segmented groups use `role="group"` +
  `aria-pressed`; the range inputs are labelled from/to; selects are labelled.
- Controls are operable by keyboard alone (Tab/Shift-Tab, Enter/Space, Arrow within groups).

## Active-filter summary

- Rendered near the trigger (not inside the dialog) so state is visible without opening.
- One chip per non-default dimension; each chip's remove control has
  `aria-label` "Remove {dimension} filter".
- A **Clear all** control resets every dimension; hidden when `isDefault` is true.

## Empty state (no matches)

- When the combined filter matches nothing, the list region shows a labelled empty state
  naming the active filters and offering **Clear all** — announced politely, never a blank.

## Automated gate

- The Map, Places and open-panel states MUST pass the axe-core WCAG 2.1 AA check with no
  serious/critical violations (extends the existing `a11y.spec.ts`).
