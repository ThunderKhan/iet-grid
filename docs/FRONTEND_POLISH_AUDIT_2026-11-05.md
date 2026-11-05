# Frontend polish audit — IET Grid

**Date:** 5 November 2026  
**Scope:** Current authenticated React/Vite frontend and its CSS, not the stalled Vercel deployment.  
**Baseline:** Repository-root [DESIGN.md](../DESIGN.md).  
**Reference:** Paul Bakaus's [Impeccable](https://github.com/pbakaus/impeccable), particularly its [`polish` guide](https://github.com/pbakaus/impeccable/blob/main/plugin/skills/impeccable/reference/polish.md).

This is a **manual implementation of the Impeccable polish checklist**; the Impeccable CLI was **not installed or executed** in this repository. Treat code scanning and automated tests as evidence of implementation quality, **not evidence of pixel-perfect rendering or an accessibility certification**.

## Initial evidence

1. **Typography drift:** Ten active stylesheets had **193 declarations smaller than 12px** (including some unused legacy CSS). The approved scale in `DESIGN.md` calls for 14px body, 13px labels, and 12px captions.
2. **Orphaned styles:** `src/styles.css` was 23,468 bytes and still shipped styling for the removed left sidebar, overview and demonstration components. These rules overlapped newer component-scoped CSS.
3. **Color drift:** Component CSS repeatedly used hard-coded brand colors and numerous low-contrast slate shades instead of the canonical tokens.
4. **Small controls:** Examples included 34–38px map/view tabs, calendar navigation at 38px, profile buttons at 39px, and 35–36px modal/mobile controls.
5. **Interaction/accessibility:** A report modal and a toast had icon-only dismiss controls without accessible names. Some calendar and administrator buttons omitted `type=\"button\"`.
6. **Resource loading:** `index.html` requested the unused DM Sans font alongside Inter and used a noncanonical theme-color.
7. **Regression found during polish:** Replacing hard-coded colors with tokens briefly produced self-referencing auth CSS custom properties. Fixed and guarded in tests.

## Changes applied

| Dimension | Work completed |
| --- | --- |
| CSS consolidation | Reduced `src/styles.css` from 23,468 to roughly 2,209 bytes of shared foundations; removed legacy sidebar/overview/demo selectors |
| Design tokens | Added canonical CSS custom properties for navy, cobalt, semantic statuses, type-adjacent muted text, borders, spacing and radius; replaced 226 repeated canonical color literals in current component CSS |
| Typography | Adjusted 139 subscale font declarations across the component stylesheets. **Only two under-12px declarations remain**, both for small decorative SVG map annotations (10px) |
| Text contrast | Darkened 88 instances of low-contrast slate text on predominantly light surfaces; this was a static heuristic, not a computed browser contrast test |
| Interaction | Updated approximately 36 touch-control/typography declarations, including navigation, floor selectors, date controls, profile settings and reservation modal; most controls now target 44px or more |
| Accessibility | Named close/dismiss buttons, made toast feedback announce via `role=status`, associated the issue-report dialog with its description, and made 16 calendar/admin button types explicit |
| Resources | Removed the unused DM Sans request; aligned browser theme-color to `#101B2C` |
| Regression protection | Added tests for canonical tokens, retired styles, and absence of circular CSS variable definitions |

## Behavioral and product constraints preserved

- Building/floor geometry, Map/List views and existing navigation controls.
- Real Supabase authentication, role gating, bookings and announcements: no simulated successful saves.
- Source-grounded room occupancy semantics; no "available" state inferred from a network failure.
- Root `DESIGN.md` identity: navy `#101B2C`, cobalt `#315CE5`, canvas `#F6F8FB`.

## Checks and limitations

The frontend GitHub Actions workflow runs linting, a production build and six-page React server-render smoke checks. **These do not visually verify** the logged-in browser at localhost:5123, hover/focus effects, the SVG at every scale, or real transactions.

Before calling the entire product visually finished, manually check:

1. **Desktop 1440/1920px:** map legibility, top navigation fit, calendar density, dialogs and profile side column.
2. **Tablet ~768–1050px:** navigation collapse, map/room-list switching, modal overflow and booking filter tabs.
3. **Mobile 360/390/430px:** text reflow at default browser font size, 44px controls, keyboard focus, accessible scroll within the map, and form layout.
4. **States:** unauthenticated, loading, no rooms/no notices, unavailable backend, occupied/pending/restricted room, long user names, failed uploads, live class title.
5. **Accessibility:** real browser WCAG contrast testing, keyboard-only paths and screen-reader smoke test.
6. **Production:** no Vercel release was requested or initiated here. The current Vercel site is not a valid visual target for this local-first polish.

## Future opportunities (not part of this restrained polish pass)

- Consolidate repeated overrides and responsive blocks inside `BlueprintSitePlan.css` and `WorkspacePages.css` after screenshot-based verification; the effective cascade was preserved for this pass to avoid geometry/layout regressions.
- Add authenticated, browser-based desktop/mobile visual regression tests with safe nonproduction test accounts.
- Audit loading and empty states against real API failures and reduced-motion preferences, without adding decorative animations.

**Interpretation:** This pass addresses structural and consistency defects, not a full visual redesign. If the interface still looks bland after these fixes, the next iteration should be driven by actual desktop/mobile screenshots and a focused critique rather than another global CSS override.
