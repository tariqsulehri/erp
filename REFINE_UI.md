# Role

Act as a **Principal Product Designer, Senior UI/UX Engineer, and Frontend Architect** specializing in modern SaaS, enterprise applications, and production-grade web interfaces.

You are working on an existing application built with:

* Next.js
* React
* TypeScript
* Node.js
* Existing application components/styles
* **Impeccable is already installed and available in the solution**

Your task is to **professionally modernize and polish the application's frontend UI/UX** while preserving all existing functionality and business logic.

---

# Primary Objective

Transform the existing frontend into a **premium, modern, cohesive, professional, state-of-the-art product experience**.

The redesign should feel comparable to a high-quality modern SaaS/enterprise product rather than a generic template.

Focus especially on:

* Page titles
* Top/title bars
* Navigation
* Side menu
* Buttons
* Badges
* Cards
* Tables
* Forms
* Inputs
* Dropdowns
* Tabs
* Modals
* Alerts
* Notifications
* Breadcrumbs
* Toolbars
* Search areas
* Filters
* Pagination
* Empty states
* Loading states
* Error states
* Status indicators
* Icons
* Typography
* Spacing
* Borders
* Shadows
* Hover states
* Focus states
* Active states
* Disabled states
* Responsive behavior
* Dark/light theme consistency
* Overall visual hierarchy

---

# IMPORTANT: Work Autonomously

**Do NOT repeatedly ask me for permission to make UI changes.**

You have authorization to:

* Inspect the existing codebase
* Inspect existing components
* Inspect the current design system
* Inspect the application's routes/pages
* Inspect existing CSS/Tailwind/theme configuration
* Inspect installed dependencies
* Use Impeccable
* Refactor UI components where necessary
* Create reusable design tokens
* Create or modify shared UI components
* Improve styling
* Improve layouts
* Improve responsive behavior
* Fix obvious visual inconsistencies
* Remove outdated visual patterns
* Apply the redesigned system consistently across the application

Make reasonable design and implementation decisions yourself.

Only stop and ask me a question when there is a **genuine blocking ambiguity that cannot reasonably be resolved from the existing codebase**.

Do NOT ask confirmation for ordinary design decisions.

Do NOT ask:

> "Should I update this button?"

> "Would you like me to improve this page?"

> "Can I change the colors?"

> "Should I proceed with the sidebar?"

Instead, inspect the application, make the appropriate professional decision, and implement it.

---

# FIRST: Analyze Before Modifying

Before making changes, inspect the existing application thoroughly.

Understand:

1. Project structure
2. Next.js architecture
3. App Router / Pages Router usage
4. Existing layout system
5. Existing shared components
6. Existing design system
7. Tailwind/CSS/styling approach
8. Theme implementation
9. Color variables/tokens
10. Typography
11. Icon library
12. Navigation/sidebar implementation
13. Header/topbar implementation
14. Tables and data-heavy screens
15. Forms
16. Dialogs/modals
17. Existing responsive behavior
18. Existing dark mode, if present
19. Existing accessibility patterns
20. Reusable components that should be preserved
21. Duplicate or inconsistent UI implementations
22. Existing Impeccable configuration/capabilities

Do not blindly rewrite working components.

Prefer **incremental architectural improvement over unnecessary rewrites**.

---

# DESIGN DIRECTION

Create a visual language that is:

* Modern
* Premium
* Clean
* Professional
* Sophisticated
* Minimal but not empty
* High information density where appropriate
* Excellent visual hierarchy
* Consistent
* Accessible
* Responsive
* Enterprise-ready
* Production-ready

Avoid designs that feel:

* Generic
* Dated
* Overly colorful
* Excessively rounded
* Excessively glassmorphic
* Overly shadow-heavy
* Like a Bootstrap/template dashboard
* Like an AI-generated UI
* Visually noisy
* Inconsistent

Do not add decorative elements merely for visual effect.

Every visual element should have a purpose.

---

# COLOR SYSTEM

Create a coherent, state-of-the-art color system.

Do not randomly change individual colors.

Instead, establish semantic design tokens such as:

* Background
* Surface
* Surface elevated
* Surface muted
* Primary
* Primary hover
* Primary active
* Secondary
* Accent
* Success
* Warning
* Error
* Info
* Text primary
* Text secondary
* Text muted
* Border
* Border subtle
* Focus ring

Use semantic colors rather than hardcoded colors throughout components.

Ensure sufficient contrast and accessibility.

The palette should look appropriate for a serious professional application.

Prefer a restrained neutral foundation with a carefully selected accent/brand color.

If the existing application already has meaningful brand colors, preserve their identity while modernizing their implementation.

---

# THEME SYSTEM

If the application supports themes, improve the theme architecture.

If light and dark themes exist:

* Make both feel intentionally designed.
* Do not simply invert colors.
* Ensure readable text.
* Ensure proper contrast.
* Ensure borders remain visible but subtle.
* Ensure cards/surfaces have appropriate elevation.
* Ensure buttons remain distinguishable.
* Ensure badges remain readable.
* Ensure charts/data visualizations remain accessible.
* Ensure hover/focus/active states work correctly.

If the application does not have a theme system but introducing one can be done cleanly without disrupting functionality, establish a maintainable semantic token system.

---

# TYPOGRAPHY

Improve typography hierarchy.

Establish clear levels for:

* Page title
* Section title
* Card title
* Subheading
* Body text
* Supporting text
* Labels
* Captions
* Navigation text
* Table headers
* Table values
* Buttons
* Badges

Use appropriate:

* Font sizes
* Font weights
* Line heights
* Letter spacing
* Text colors

Avoid excessive font-weight variations.

Typography should create hierarchy naturally.

---

# PAGE TITLE / TITLE BAR

Modernize page headers.

A page title area should clearly communicate:

* Current location
* Page purpose
* Supporting context where useful
* Primary action
* Secondary actions when appropriate

Use a consistent structure across pages.

Do not make every page header visually identical if the information architecture requires variation, but establish a common design language.

---

# SIDEBAR / SIDE MENU

Professionally redesign the side navigation.

Improve:

* Navigation hierarchy
* Active state
* Hover state
* Selected item
* Icons
* Spacing
* Section grouping
* Labels
* Collapsed behavior
* Responsive behavior
* Tooltips where appropriate

The active navigation item should be immediately recognizable without being visually aggressive.

Avoid excessive pills and oversized navigation elements.

Make the sidebar feel like a premium enterprise application.

---

# BUTTONS

Create a consistent button hierarchy.

Define appropriate styles for:

* Primary
* Secondary
* Outline
* Ghost
* Destructive
* Success
* Icon-only
* Link-style

Each button must have clear:

* Default state
* Hover state
* Active state
* Focus state
* Disabled state
* Loading state where applicable

Avoid excessive use of primary-colored buttons.

Use visual hierarchy to communicate importance.

---

# BADGES / STATUS INDICATORS

Modernize badges and status indicators.

Create semantic variants such as:

* Success
* Warning
* Error
* Info
* Neutral
* Pending
* Active
* Inactive

Keep badges compact and readable.

Do not use color alone to communicate critical status where an accessible text/icon treatment is appropriate.

---

# CARDS

Improve card design without making everything look like a floating rounded rectangle.

Use:

* Consistent padding
* Subtle borders
* Controlled radius
* Appropriate surface contrast
* Minimal shadows
* Clear hierarchy

Cards should support grouping and hierarchy, not simply decorate the page.

---

# TABLES

For data-heavy screens, prioritize readability.

Improve:

* Header hierarchy
* Row spacing
* Column alignment
* Status indicators
* Hover behavior
* Selected rows
* Pagination
* Filters
* Search
* Sorting indicators
* Empty states
* Responsive behavior

Do not sacrifice information density merely to make tables look spacious.

---

# FORMS

Modernize forms with strong UX.

Improve:

* Label hierarchy
* Input styling
* Placeholder usage
* Validation
* Error states
* Help text
* Required indicators
* Focus states
* Disabled states
* Field spacing
* Button placement

Avoid overly large inputs unless the application context requires them.

---

# ICONS

Use the application's existing icon system where possible.

Maintain:

* Consistent icon family
* Consistent stroke weight
* Consistent sizing
* Proper alignment
* Appropriate semantic meaning

Do not introduce multiple unrelated icon styles.

---

# SPACING

Establish a consistent spacing scale.

Avoid arbitrary values scattered throughout the UI.

Use a predictable spacing rhythm for:

* Page sections
* Cards
* Forms
* Navigation
* Tables
* Buttons
* Toolbars
* Headers

The interface should feel intentionally designed because spacing is consistent.

---

# BORDER RADIUS

Establish a restrained radius system.

Use different levels where appropriate:

* Small radius for controls
* Medium radius for cards
* Larger radius only where visually justified

Do not make every element extremely rounded.

---

# SHADOWS / ELEVATION

Use shadows sparingly.

Prefer:

1. Borders
2. Surface contrast
3. Subtle elevation

over large, blurry shadows.

Create a small elevation scale rather than arbitrary shadows.

---

# RESPONSIVE DESIGN

The redesign must work professionally across:

* Desktop
* Laptop
* Tablet
* Mobile

Pay particular attention to:

* Sidebar behavior
* Header behavior
* Tables
* Forms
* Dialogs
* Toolbars
* Page titles
* Buttons
* Cards
* Navigation

Do not simply shrink desktop layouts.

Adapt layouts intelligently.

---

# ACCESSIBILITY

Preserve and improve accessibility.

Check:

* Color contrast
* Keyboard navigation
* Focus indicators
* Button labels
* Form labels
* Semantic HTML
* ARIA usage where appropriate
* Disabled states
* Error messaging
* Screen-reader clarity

Never remove visible focus indicators just for aesthetics.

---

# MICRO-INTERACTIONS

Introduce subtle, purposeful interaction design.

Examples:

* Button hover transitions
* Navigation transitions
* Card hover where useful
* Modal transitions
* Dropdown transitions
* Loading states
* Skeleton states
* Success/error feedback

Keep animations subtle and professional.

Avoid excessive animation.

Respect `prefers-reduced-motion`.

---

# IMPECCABLE

Since **Impeccable is already installed**, actively use its capabilities where appropriate for:

* UI consistency
* Visual refinement
* Design-system improvements
* Accessibility checks
* Responsive improvements
* Component refinement
* Typography
* Color systems
* Spacing
* Visual hierarchy

Before manually implementing a solution that Impeccable can help analyze or improve, consider using the available Impeccable capabilities.

Do not use Impeccable blindly.

Use it as a professional design-engineering assistant.

---

# COMPONENT ARCHITECTURE

Do not solve every problem with page-specific CSS.

Identify repeated patterns and create/reuse shared components.

For example:

* `PageHeader`
* `SectionHeader`
* `AppSidebar`
* `AppHeader`
* `Button`
* `Badge`
* `StatusBadge`
* `Card`
* `DataTable`
* `SearchInput`
* `FilterBar`
* `EmptyState`
* `LoadingState`
* `ConfirmDialog`
* `FormField`

Use the project's existing component architecture when one already exists.

Do not introduce duplicate components if equivalent reusable components already exist.

---

# DESIGN TOKENS

Where appropriate, centralize:

* Colors
* Typography
* Spacing
* Radius
* Shadows
* Transitions
* Z-index layers
* Component states

The goal is to make future UI development consistent.

Avoid scattering magic numbers and hardcoded colors throughout the code.

---

# PRESERVE FUNCTIONALITY

This is a UI/UX modernization task.

Do NOT unnecessarily change:

* API behavior
* Business logic
* Database logic
* Authentication
* Authorization
* Routing behavior
* Data fetching
* State management
* Validation logic
* Existing user workflows

Unless a frontend implementation change is required to support the improved UI.

The application must continue functioning as before.

---

# CODE QUALITY

Follow production-quality TypeScript and React practices.

Ensure:

* No unnecessary `any`
* No duplicated logic
* No dead components
* No unused imports
* No unnecessary dependencies
* No console errors
* No broken routes
* No obvious hydration issues
* No React warnings
* No TypeScript errors
* No lint errors where practical

Keep the implementation maintainable.

---

# VISUAL CONSISTENCY AUDIT

After implementing the redesign, inspect the application again.

Look for:

* Inconsistent button styles
* Different border radii
* Random colors
* Different typography styles
* Misaligned icons
* Inconsistent spacing
* Inconsistent badges
* Inconsistent page headers
* Inconsistent table styles
* Inconsistent form controls
* Inconsistent hover states
* Poor mobile layouts

Fix these inconsistencies.

The final product should feel like **one cohesive design system**, not a collection of independently styled pages.

---

# PRIORITIZATION

When deciding what to improve first, prioritize:

1. Global design system
2. Application shell
3. Sidebar
4. Header/top navigation
5. Page headers
6. Buttons and controls
7. Forms
8. Tables/data views
9. Cards
10. Badges/statuses
11. Modals/dialogs
12. Empty/loading/error states
13. Responsive behavior
14. Micro-interactions
15. Final visual polish

---

# DO NOT OVER-DESIGN

Avoid:

* Excessive gradients
* Excessive glassmorphism
* Excessive blur
* Excessive shadows
* Excessive rounded corners
* Excessive animations
* Giant typography
* Unnecessary illustrations
* Decorative UI that does not improve usability
* Too many accent colors
* Random component variations

The result should communicate:

**Professional + Modern + Calm + Premium + Functional**

---

# EXECUTION MODE

Work through the repository systematically.

### Phase 1 — Audit

Inspect the existing frontend and identify the major UI patterns and inconsistencies.

### Phase 2 — Design System

Establish or refine the global visual system.

### Phase 3 — Application Shell

Modernize:

* Sidebar
* Header
* Navigation
* Global layout
* Theme behavior

### Phase 4 — Shared Components

Modernize reusable UI primitives.

### Phase 5 — Pages

Apply the system consistently throughout the application's existing pages.

### Phase 6 — Responsive

Test and refine desktop, tablet, and mobile layouts.

### Phase 7 — Accessibility

Review keyboard navigation, focus, contrast, semantics, and states.

### Phase 8 — Quality Check

Run appropriate:

* TypeScript checks
* Linting
* Build checks
* Existing tests
* UI validation where available

Fix issues introduced by the redesign.

---

# DECISION-MAKING RULE

When there are multiple reasonable design choices:

**Choose the option that is most consistent, accessible, maintainable, professional, and appropriate for a modern enterprise/SaaS application.**

Do not stop to ask for approval for normal design decisions.

Use the existing application context to infer the appropriate solution.

---

# IMPORTANT FINAL REQUIREMENT

Do not merely tell me what should be changed.

**Actually inspect the codebase and implement the improvements.**

At the end, provide a concise summary containing:

1. What was redesigned
2. Major design-system changes
3. Components created/refactored
4. Pages/screens updated
5. Theme/color improvements
6. Responsive improvements
7. Accessibility improvements
8. Validation/checks performed
9. Any remaining issues that genuinely require my attention

Keep the final summary concise.

Your primary objective is to leave the repository with a **cohesive, polished, production-quality frontend that looks intentionally designed by a senior product/design engineering team.**
