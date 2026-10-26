# UX and Design
**Finding ID prefix:** UXD
**Applies when:** there is a user interface. Skip for pure back-end or command-line projects. Accessibility has its own dimension; do not repeat it here.

## Goal
Judge whether users can find what they need, understand what they see, and trust it. Find confusing structure, missing states, inconsistent patterns and visuals or data displays that mislead.

## What to check

### Information architecture and navigation
- [ ] Can a new user tell where they are, what they can do here and how to get elsewhere?
- [ ] Is the navigation grouped by user tasks, and does labelling match the words users use?
- [ ] Do important views have stable, shareable addresses (deep links) that survive reload and back navigation?
- [ ] Do users without permission see only what they can use, or a clear explanation when blocked?
- [ ] Are the most common tasks reachable in few steps?

### States
- [ ] Does every data view have a designed loading state?
- [ ] Does every list and chart have a helpful empty state that says what to do next?
- [ ] Does every failure have an error state that explains what happened and offers a way forward?
- [ ] Are partial, stale and offline conditions shown honestly?
- [ ] Is the result of an action confirmed (saved, sent, failed), and are destructive actions confirmed or undoable?

### Consistency and design system
- [ ] Are the same things named, styled and placed the same way across screens?
- [ ] Is there a shared component set, and do screens use it instead of near-duplicates?
- [ ] Are colours, spacing, type sizes and radii taken from design tokens rather than hard-coded values?
- [ ] Do themes (light, dark, others) apply to every screen without broken areas?
- [ ] Do similar screens (lists, detail views, forms) share one layout pattern?

### Responsive behaviour
- [ ] Do the main screens work at phone, tablet and wide desktop sizes?
- [ ] Do tables, charts and long text adapt rather than being cut off?
- [ ] Are touch targets and spacing suitable for touch where the interface is used on touch devices?

### Copy
- [ ] Are labels, buttons and messages in plain language that states the action or outcome?
- [ ] Do error messages say what is wrong and how to fix it, without internal codes or blame?
- [ ] Are terms, units and date and number formats consistent and suited to the audience?
- [ ] Is text ready for translation if more than one language is a goal?

### Forms and input
- [ ] Are forms short, grouped logically and ordered naturally?
- [ ] Is validation shown at a helpful moment, next to the field, without losing entered data?
- [ ] Are defaults, input types and formats chosen to reduce effort?
- [ ] Can users review before a consequential submit?

### Honest data display
- [ ] Do charts use scales, baselines and units that do not exaggerate or hide differences?
- [ ] Is missing data shown as missing, never as zero or a plausible invented number?
- [ ] Do totals, percentages and labels on screen agree with each other and with their source?
- [ ] Is it clear what a metric means, how it is calculated and when it was last updated?
- [ ] Are internal identifiers hidden in favour of names or business codes people recognise?

## How to gather evidence
- Walk the main journeys in a real browser as each role and capture screenshots of key screens and states.
- Trigger loading, empty and error conditions deliberately in a safe environment.
- Search styles and components for hard-coded colours, sizes and spacing that bypass tokens.
- Compare similar screens side by side for layout and wording differences.
- Check displayed figures against the underlying data or the calculation.
- Resize the viewport through common widths and test with long and short content.
- Read user research, feedback or support requests if available.

## Severity guidance
| Situation | Severity |
|---|---|
| A chart or figure shows an invented or misleading value that drives decisions | High |
| Core journey has no error state and leaves the user stuck | Medium |
| Screens ignore design tokens and break in a theme | Medium |
| Inconsistent button wording between two secondary screens | Low |

## Common false positives
- Deliberate differences between an internal admin tool and a customer-facing product.
- Hard-coded values inside the token definitions themselves.
- Dense layouts chosen on purpose for expert users.
- Empty states for data that cannot be empty by design.

## Strengths to look for
- A shared component and token system actually used everywhere.
- Designed loading, empty and error states.
- Plain, consistent copy and units.
- Honest charts with defined metrics.
- Shareable deep links and predictable navigation.

## Scorecard hints
- **1:** Confusing navigation, missing states, inconsistent styling, misleading or invented figures.
- **3:** Understandable structure with a partial design system; some missing states or token bypasses; mostly honest displays.
- **5:** Task-based navigation, complete states, enforced tokens, consistent patterns, responsive layouts and trustworthy data displays.
