# CLAUDE.md

Rules for Claude Code (and humans) working in this repository. Keep this file short, because it is loaded into every agent session. The reasons behind the design live in the design doc; this file holds the rules.

## Project

DM Audio Looper is a browser app that lets a tabletop Game Master loop sections of video-game soundtracks and switch between them on cue, the way a game's music engine does. v1 plays music through Spotify (Web Playback SDK); v2 adds local audio files.

- **Source of truth:** `docs/technical-design.md` (the TDD). Read the relevant sections before starting a task, and cite them in plans and PRs, e.g. `TDD §8.2`.
- **Status:** the TDD is under review and there's no code yet. The next milestone is Spike 0 (TDD §16).

## Commands

These are planned. The scaffolding task creates them and must update this table to match.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on `http://127.0.0.1:5173`. Use `127.0.0.1`, because Spotify rejects `localhost` |
| `npm run check` | Typecheck, lint, Prettier format check and unit tests. **Must pass before every push and every PR** |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier: rewrites files in place |
| `npm test` | Vitest unit tests |
| `npm run e2e` | Playwright end-to-end tests against the fake backend |
| `npm run build` | Static production build into `dist/` |

## Layout (planned)

```
src/
  engine/       Conductor, music model, transition resolution. Pure code (see rule 1)
  playback/     Driver, playhead clock, scheduler, PlaybackBackend interface
    spotify/    SpotifyBackend and SDK loader
    fake/       FakeBackend for tests and the ?backend=fake dev mode
  spotify-api/  OAuth PKCE and the Web API client
  storage/      IndexedDB, import/export, zod schemas, migrations
  ui/           React: views/, components/, hooks/
  lib/          Small shared helpers: branded time types, Result, time formatting
tests/e2e/      Playwright tests
docs/           TDD and other docs
```

**Allowed imports:**
- `engine` imports only `lib`.
- `playback` may import `engine`.
- `ui` may import any module, but never the Spotify SDK directly.
- Nothing imports `ui`.

## Architecture rules (ask before breaking any of these)

1. **The engine is pure.** `src/engine` has no timers, no `Date.now()` or `performance.now()`, no DOM, no I/O, no React and no Spotify code. It maps `(state, event)` to `(state, plannedJump)` (TDD §8).
2. **Time units are explicit.** Use the branded types `TrackMs` (position in the song) and `PerfMs` (wall-clock time). Every duration or position name ends in `Ms`. Never mix the two without an explicit conversion. Only the clock module reads `performance.now()`. Tests inject a fake clock.
3. **Spotify policy.** Never overlap, mix, crossfade, process, record or cache Spotify audio (TDD D13, R1). Volume is changed only for the muted preload.
4. **Time-critical commands go through the SDK.** Seek, pause, resume and volume use the Web Playback SDK. The Web API is used only for metadata and loading tracks (TDD §9.2).
5. **No backend and no secrets.** The Spotify Client ID comes from `VITE_SPOTIFY_CLIENT_ID` in `.env.local`, which is gitignored. Never log or commit tokens.
6. **Backends sit behind `PlaybackBackend`.** Nothing outside `playback/spotify` knows Spotify exists. This is justified by `FakeBackend` (needed now, for tests) and v2's `LocalAudioBackend`.

## Design principles

- **Keep it simple (KISS).** Choose the most direct solution that meets the TDD. Fewer layers, files and indirections beat flexibility nobody has asked for.
- **Every abstraction needs a solid, present-day justification.** Abstractions include interfaces, generic type parameters, config options, factories, wrappers and extension points. Valid reasons:
  - two or more real implementations or callers exist now;
  - a test planned now needs the seam (e.g. the fake clock);
  - a TDD requirement calls for it.

  Not valid: "we might need it later", "just in case", or guarding against states the types already rule out. Name the justification for each new abstraction in the plan.
- **Composition over inheritance.** Never `extends` one of our own classes. Combine small functions and objects, and pass dependencies in through constructor or function parameters.
- **DRY applies to knowledge, not text.** Each rule, constant and schema has a single source (e.g. the zod schema also produces the types). Code that merely looks similar may stay duplicated until a third copy appears or the copies must change together. A wrong abstraction costs more than duplication.
- **Validate at the edges, trust the inside.** Check data where it enters the app: imported JSON, Web API responses, SDK events and user input. Inside the app, rely on the types. No defensive checks for impossible cases.
- **Small, single-purpose units.** Each function does one thing. Prefer early returns to deep nesting. No hidden global mutable state.

## TypeScript standards

- **Strict compiler settings:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` and `verbatimModuleSyntax`. Never relax these to get code to compile.
- **No `any`.** Use `unknown` and narrow it. Avoid non-null assertions (`x!`) and type casts (`as`). If one is truly needed, give a one-line reason in a comment. Both are allowed in test code.
- **Model states as tagged unions** (a shared `kind` field) and handle every case in a `switch`, ending with an `assertNever(x)` default.
- **Errors:** return `Result<T, E>` for expected failures such as validation, import and API errors. Throw only for programmer errors and broken invariants.
- **Promises:** every one must be awaited, returned, or explicitly passed to `void`. No unhandled ("floating") promises; lint enforces this.
- **Immutability:** state objects are `readonly` and are replaced, never mutated in place. This applies especially to Conductor state.
- **Functions or classes:**
  - Pure logic is plain functions and plain data.
  - Classes are only for stateful adapters with a lifecycle (backends, driver, clock).
  - Use named exports only, never default exports.
- **Naming:**
  - `camelCase` for values and functions, `PascalCase` for types and components, `UPPER_SNAKE` for constants.
  - Files are `kebab-case.ts`, except React components, which are `PascalCase.tsx`.
  - Unit tests sit next to their file as `*.test.ts`.
- **Prefer readable code over clever types.** Avoid complex conditional or mapped types unless they remove a real class of bugs, and justify them in the PR.
- Formatting is Prettier's job; don't hand-format. Don't disable a lint rule without a one-line reason.

## Comments

- **Code should explain itself.** Use clear names and small functions instead of comments.
- **Comment sparingly**, and only for what the code can't say: a non-obvious reason, a workaround for a platform quirk, or a TDD rule that would otherwise look arbitrary (`// TDD §8.3`).
- **Keep comments short**, ideally one line.
- **What not to write:**
  - comments that restate the code
  - commented-out code
  - JSDoc that only repeats names and types

  Add JSDoc to an export only when its name and types don't make the contract clear (units, side effects, timing).

## React standards

- Use function components and hooks only.
- Components never call backends or the Web API directly. They go through the app's services and store.
- Read Conductor and driver state with `useSyncExternalStore` and selectors, so each component re-renders only when its own data changes.
- **No React state updates on every animation frame.** Progress bars and countdowns use CSS animations or a `requestAnimationFrame` loop writing to a ref (TDD §12.1).
- **Accessibility:** use real `<button>`s and labelled inputs, keep keyboard focus visible, and never rely on colour alone to show state.
- Style with CSS Modules (built into Vite). No runtime CSS-in-JS.

## Testing (tiered)

- **Engine (`src/engine`): write the tests first.** Build table-driven cases from TDD §7.4, §7.6 and §8.2. Add property-based tests (`fast-check`) for invariants.
- **Driver and clock:** test with a fake clock and a `FakeBackend` that simulates seek latency, jitter and noisy position reports. Never use real timers or sleeps in unit tests.
- **Every logic change needs tests.** A bug fix starts with a test that fails without the fix.
- **UI:** a few Playwright end-to-end tests of the main flows (create a sheet, cue, *Jump now*, *End*, import/export) against the fake backend. Don't test layout details.
- **Spotify can't be tested automatically.** DRM and real logins don't work in CI or cloud sessions. For anything touching Spotify, give manual test steps in the PR and **say plainly that it is unverified** until it has been run against real Spotify.
- **Tests must be deterministic:** no network, no wall-clock dependence, no ordering between tests.

## Human–agent workflow

The repo owner is a highly experienced engineer (C#, Go, Python) who is new to TypeScript and JavaScript. They prefer **frequent check-ins**: the agent stops and waits at each checkpoint below.

### Checkpoints (stop and wait for a reply)

1. **Plan:** before writing code, post the following, then wait for a go-ahead:
   - the goal and the TDD sections it relies on
   - the approach, and the justification for any new abstraction
   - the files you expect to touch
   - the test plan
   - the expected PR size
   - any open questions, numbered, with your recommended answer
2. **Spec:**
   - For engine or driver work, write the failing tests first and list the test cases.
   - For other work, show the new interfaces or types, or a UI sketch.
   - Then wait. The tests or interfaces are the agreed contract.
3. **Surprise:** if reality stops matching the plan (the approach changes, the task grows, a TDD assumption turns out false), stop and explain before continuing.
4. **Review:** once the local review is done (next section), open the PR and wait. Address review comments with new commits; don't force-push once review has started.

### Local review (every branch, before opening a PR)

1. **Checks:** `npm run check` passes: typecheck, lint, format check and unit tests. If the UI changed, `npm run e2e` passes too. **Never open a PR with lint or format failures.**
2. **Read the diff yourself:** go through the whole diff against `main` (`git diff main...HEAD`) and check it against this file, especially the design principles and the comments rules.
3. **Automated review:**
   - Run Claude Code's `/code-review` on the branch: at `high` effort for engine, driver, auth or storage changes, `medium` otherwise.
   - Also run `/security-review` if the diff touches auth, tokens or imported files.
   - Review tools only report. Never use options that apply fixes automatically (e.g. `/code-review --fix`). Make each fix deliberately.
   - Optional: `/simplify` for diffs over about 200 lines. It edits files itself, so run it only on a clean working tree, then inspect its changes and keep or discard each one.
4. **Act on findings:** fix each one, or dismiss it with a one-line reason. If the fixes were substantial, review again.
5. **Re-check:** run step 1 again after the fixes, and record the outcome in the PR.

### Always ask first

- Going against the TDD, or making a design decision the TDD doesn't cover
- Adding, removing or upgrading a dependency
- Changing a public interface, the cue sheet schema, or the storage format
- Work outside the agreed task scope, including "while I'm here" refactors
- Anything touching auth or tokens, or anything you cannot verify (for example real Spotify behaviour)
- Any ambiguity. **Ask rather than guess silently.**

### Never

- Push to `main`, merge PRs, or force-push a branch someone else is using.
- Skip, disable or weaken tests, lint rules or compiler settings to get checks passing.
- Commit secrets, `.env.local`, build output or editor files.
- Claim something works without having run it. State what was verified and how.

### Branches, commits and PRs

- **One task = one branch = one PR.** Agent branches are named `claude/<short-topic>`.
- **Commits** use the Conventional Commits format (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`, `build:`, `ci:`). Keep commits small and focused.
- **PR size:** keep each PR under about 400 changed lines, not counting tests and lockfiles. Split bigger work into stacked PRs.
- **Keep the TDD in sync.** If the implementation changes a design decision, update `docs/technical-design.md` (including the decision log) in the same PR.
- **CLAUDE.md:** when a new convention emerges, propose a change to this file in a PR. Don't edit it silently.

### PR description

1. **Summary:** what changed and why, with links to TDD sections.
2. **Decisions:** any choices not already covered by the TDD, including the justification for any new abstraction.
3. **How it was tested:** the commands run and their results, plus manual steps and what is still unverified.
4. **Local review:** the review commands run, findings fixed, and findings dismissed with their reasons.
5. **TS/JS notes for the reviewer:** a few bullets explaining any TypeScript, JavaScript or React habits in the diff, by comparison with C#, Go or Python (see below). Leave this out if there's nothing new.
6. **Risks and follow-ups.**

### Definition of done

- `npm run check` passes, and so does `npm run e2e` if the UI changed.
- Tests have been added under the testing tiers above.
- The local review is complete and recorded in the PR.
- The TDD and this file are updated if behaviour or conventions changed.
- The PR description is complete, including what is still unverified.

## Reviewer context: TypeScript compared with C#, Go and Python

Use these comparisons in PR notes when relevant. Don't explain programming basics.

- **Types are structural, not nominal.** Two types with the same shape are interchangeable, unlike C#. Branded types (`TrackMs`) recreate nominal typing for units.
- **Tagged unions with `switch (x.kind)`** are like C# pattern matching on a sealed record hierarchy, or Go type switches, with an exhaustiveness check.
- **`Promise` works like a C# `Task`.** A floating promise is like an un-awaited `Task` (warning CS4014): its errors disappear silently.
- **Types are erased at runtime.** Unlike C# reflection, nothing checks types at runtime, which is why external data (JSON imports, API responses) goes through zod validation.
- **`readonly` is checked only by the compiler**, like C# `readonly` but with no runtime enforcement. `as const` makes a literal deeply readonly.
- **`undefined` vs `null`:** this codebase uses `undefined` for "absent" (optional fields) and `null` only where the data model says so (e.g. a transition rule's `span: null`).
- **Hooks rules:** React hooks must be called in the same order on every render, so never inside conditions or loops.

## Environment notes

- Use Node.js 24 LTS (pinned via `.nvmrc` and `engines`) and npm.
- In cloud agent sessions, `developer.spotify.com` may be blocked. If Spotify documentation can't be reached, say so; don't guess API behaviour.
