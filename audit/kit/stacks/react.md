# React (Vite / Next.js) front-end stack module

**Detection signals:** `package.json` with `react`, `react-dom`; `vite.config.*`, `next.config.*`, `src/main.tsx`, `src/App.tsx`, `app/` or `pages/` (Next), `index.html` with a root div.

**Loads with dimensions:** security, accessibility-ux, performance, reliability, testing, code-health.

## Vulnerability and defect patterns

### Security
- `dangerouslySetInnerHTML`: any value not sanitised (for example with `DOMPurify`) allows XSS. Check where the HTML string comes from.
- Other XSS sinks: `innerHTML`, `outerHTML`, `document.write`, `insertAdjacentHTML`, `eval`, `new Function`, `setTimeout("string")`, `<a href={userValue}>` or `window.location = userValue` (allows `javascript:` URLs), `target="_blank"` without `rel="noopener"` in old browsers.
- Tokens in `localStorage`/`sessionStorage` (`setItem('token'`, `accessToken`, `jwt`): readable by any XSS. Prefer `httpOnly` cookies; if kept, flag as a risk tied to XSS exposure.
- Secrets in the bundle: any `VITE_*` (Vite) or `NEXT_PUBLIC_*` (Next) variable is public. Grep for API keys, private tokens, service-account values with these prefixes. Also `import.meta.env` and `process.env` used in client code.
- Client-side-only authorization: role checks that hide a button or route in React but the API does not enforce. The real check must be on the server; test the API directly.
- Router guards (`ProtectedRoute`, `PrivateRoute`, Next `middleware.ts`) that read a role from `localStorage` or a decodable token without server verification.
- Source maps shipped to production (`build.sourcemap: true` in Vite, `productionBrowserSourceMaps: true` in Next) expose source code.
- `postMessage` listeners without an `event.origin` check; iframes without `sandbox`.
- Third-party scripts loaded from CDNs without `integrity` (SRI) attributes.
- Next.js: server-only code or secrets imported into client components (`'use client'`); API route handlers or server actions with no auth check.

### Data
- Forms that trust client-side validation only; the same rule must exist on the server.
- Sensitive data cached by `react-query`/`swr` or persisted by `zustand`/`redux-persist` into `localStorage`.
- Personal data sent to analytics or error trackers (`Sentry`, `gtag`) without scrubbing.

### Performance
- Large libraries imported whole (`import _ from 'lodash'`, full icon packs, `moment`); no route-level `React.lazy`/`Suspense` or dynamic `import()`.
- Heavy work in render, inline object/array/function props causing re-renders of memoised children; large lists without virtualisation.
- `useEffect` fetching in a waterfall (child fetches wait for parent); no request de-duplication.
- Images without dimensions, lazy loading, or modern formats (Next: `next/image`).

### Reliability
- `useEffect` missing dependencies (stale closures); no cleanup for timers, listeners, subscriptions, or abort of `fetch` (`AbortController`).
- Setting state after unmount, race conditions where a slower old response overwrites a newer one.
- List `key={index}` on reorderable or editable lists; keys that are not stable.
- No error boundary (`componentDidCatch`, `react-error-boundary`): one render error blanks the page.
- `react-query`: wrong or missing query keys (stale data shared across users), mutations that do not invalidate queries, `staleTime`/`gcTime` too long for sensitive data, cache not cleared on logout.
- `zustand`/`redux`: store not reset on logout, state mutated directly, selectors returning new objects every render.
- Missing loading and error states; unhandled promise rejections in event handlers.

### Testing
- Components tested only by snapshot; no tests for auth guards, forms, and error states.
- Tests using `getByTestId` everywhere instead of roles and labels (`React Testing Library`), hiding accessibility gaps.

### Code health
- Giant components, prop drilling several levels, duplicated fetch logic, `any` types, API types hand-copied instead of shared.
- Custom dialogs, menus, tabs, comboboxes built with `div` and `onClick`: no role, no keyboard handling, no focus trap or restore, no `aria-*` (accessibility-ux).
- Inputs without labels, images without `alt`, colour-only status, no visible focus style.

## Framework misconfigurations

- No Content-Security-Policy header or meta tag; or CSP with `unsafe-inline`/`unsafe-eval` everywhere (check hosting config and `next.config` headers).
- Vite dev server options (`server.host: true`, `server.proxy`, `cors`) assumed to be dev only; confirm they are not used in production.
- `.env` files committed; production env values baked into the build.
- Next.js: `images.domains`/`remotePatterns` set to wildcards; `rewrites` or proxy routes forwarding to internal hosts.
- Router: unknown routes without a 404 page; deep links not handled by the host (SPA fallback).
- React `StrictMode` removed, which hides effect bugs in development.

## Scanner and project commands

All run only if approved at Checkpoint A.
- Dependency audit: `npm audit --json` or `pnpm audit`; or `osv-scanner` on the lockfile.
- Lint: `npx eslint .` (look for `eslint-plugin-react`, `react-hooks`, `jsx-a11y` in config).
- Typecheck: `npx tsc --noEmit`.
- Tests: the `test` script (`vitest run` or `jest`).
- Coverage: `npx vitest run --coverage` or `npx jest --coverage`.
- Build: `npm run build` (Vite `vite build`, Next `next build`); read the script first.
- Bundle size: `npx source-map-explorer` on built files, or `rollup-plugin-visualizer`; Lighthouse and `axe-core` need a browser run.
- Unused code: `npx knip`, `npx depcheck`.

## Where to look first

- Entry: `src/main.tsx`, `src/App.tsx`, `src/router.*`, Next `app/layout.tsx`, `middleware.ts`.
- Auth: `src/auth/`, `AuthContext`, `useAuth`, login page, API client (`src/api/`, `axios` instance, interceptors).
- Config: `vite.config.*`, `next.config.*`, `.env*`, `index.html` (CSP meta), `public/`.
- State: `src/store/`, `src/hooks/`, query client setup.
- Tests: `src/**/*.test.tsx`, `__tests__/`, `vitest.setup.*`.

## Looks wrong but is fine

- `dangerouslySetInnerHTML` with a constant string, or with content passed through `DOMPurify.sanitize`.
- `VITE_`/`NEXT_PUBLIC_` variables holding public values (API base URL, public analytics ID, publishable payment key).
- Hiding UI by role in React, when the API also enforces the role (this is UX, not security).
- `key={index}` on static lists that never reorder or change.
- Missing `useEffect` dependencies that are stable (setState functions, refs, module constants).
- `localStorage` for theme, language, or UI preferences.

## Version notes

- React 18 `StrictMode` double-runs effects in development; this is not a production bug.
- React 19 changes (actions, `use`, ref as prop); older lint rules may misreport.
- Next.js App Router vs Pages Router have different server/client boundaries and auth patterns; identify which is used.
- Vite and Next had dev-server and middleware advisories in some releases; check the installed version against an advisory source.
- Verify against the installed version.
