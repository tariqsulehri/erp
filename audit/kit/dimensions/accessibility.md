# Accessibility
**Finding ID prefix:** A11
**Applies when:** there is a user interface (web, mobile, desktop, generated documents or email). Skip for pure back-end or command-line projects.

## Goal
Judge whether people using a keyboard, screen reader, magnification, voice control or reduced motion can complete the same tasks as everyone else. Use WCAG 2.2 level AA as the yardstick and report each failure with the criterion it breaks.

## What to check

### Keyboard and focus
- [ ] Can every interactive element be reached and operated with the keyboard alone?
- [ ] Is the focus order logical, matching the visual and reading order?
- [ ] Is the focus indicator always visible and not hidden behind other content?
- [ ] Are there keyboard traps, or custom widgets that ignore expected keys?
- [ ] Is there a way to skip repeated navigation, and do single-key shortcuts avoid conflicts?
- [ ] Do pointer actions that need dragging or small targets have a simple alternative and adequate target size?

### Semantics and structure
- [ ] Are native elements used for buttons, links, lists, tables and headings instead of generic containers made to look like them?
- [ ] Is there a sensible heading outline and page landmarks?
- [ ] Does each page or view have a unique, meaningful title?
- [ ] Are data tables marked up with headers, and layout not done with tables?
- [ ] Is the language of the page and of foreign passages declared?

### Names, labels and ARIA
- [ ] Does every control have an accessible name that matches its visible label?
- [ ] Is ARIA used only where native semantics are insufficient, and used correctly?
- [ ] Do icon-only controls and images have text alternatives, and decorative ones are hidden from assistive tools?
- [ ] Are roles, states and properties (expanded, selected, current) kept in sync with what is shown?
- [ ] Are dynamic updates (toasts, errors, loading, results) announced without stealing focus?

### Dialogs and overlays
- [ ] Do dialogs move focus in, trap it while open, close with the escape key and return focus afterwards?
- [ ] Is the background inert while a modal is open?
- [ ] Do menus, tooltips and popovers work with keyboard, and remain visible on focus as well as hover?

### Colour, contrast and visuals
- [ ] Does text meet the minimum contrast ratio, in every theme and state?
- [ ] Do icons, borders and chart marks that carry meaning meet non-text contrast?
- [ ] Is meaning ever conveyed by colour alone?
- [ ] Do charts and graphics have a text or table alternative?

### Zoom, reflow and motion
- [ ] Does the interface work at 200 percent zoom and at narrow width without loss of content or two-direction scrolling?
- [ ] Does it respect text spacing changes and user font size?
- [ ] Is movement avoidable or reduced when the user asks for reduced motion?
- [ ] Are time limits adjustable and are auto-updating regions pausable?

### Forms and errors
- [ ] Does every input have a programmatically linked label, and are required fields and formats stated?
- [ ] Are errors identified in text, tied to the field, and announced?
- [ ] Do helpful hints and autocomplete support common personal data fields?
- [ ] Is redundant entry avoided, and are authentication steps usable without memory or puzzle tests?

## How to gather evidence
- Read component code for native element use, labels, roles and keyboard handlers.
- Run an automated accessibility scanner on key screens and record its limits; it finds only a minority of issues.
- Tab through the main journeys in a real browser and record any element unreachable, invisible or trapped.
- Use a screen reader on the three most important journeys where possible; otherwise record "not verified".
- Check contrast from design tokens and rendered colours in each theme.
- Test at high zoom, narrow viewport and with reduced motion enabled.
- Review any accessibility statement or earlier audit.

## Severity guidance
| Situation | Severity |
|---|---|
| A core task (sign in, submit, pay) cannot be completed by keyboard or screen reader | High |
| Modal dialog without focus management on a frequently used screen | Medium |
| Form errors not linked to fields | Medium |
| Decorative image with a redundant text alternative | Low |

## Common false positives
- Scanner warnings on hidden or off-screen content that is intentionally removed from the accessibility tree.
- Custom elements that look wrong in code but expose correct semantics through a trusted library.
- Contrast flags on disabled controls or decorative text, which are exempt.
- Missing skip links on very small single-purpose pages.

## Strengths to look for
- Native elements and a tested shared component library.
- Visible, consistent focus styling.
- Automated checks in CI plus periodic manual assistive technology testing.
- Contrast ensured at design-token level.
- Respect for reduced motion and zoom.

## Scorecard hints
- **1:** Core journeys unusable without a mouse or sight; no labels; poor contrast.
- **3:** Mostly keyboard operable and labelled; gaps in dialogs, dynamic announcements, contrast or forms; checks are occasional.
- **5:** WCAG 2.2 AA met on main journeys, verified with assistive technology, with automated checks and a shared accessible component base.
