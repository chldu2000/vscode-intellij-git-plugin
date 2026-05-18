# MVP Completion Gap Spec

Date: 2026-05-18

## Decision

The MVP is not complete yet.

The repository has a strong implementation base: Git discovery, changelist persistence, a changelist tree, diff parsing, webview-based hunk/line selection, temporary-index partial commits, commit options, stale-selection handling, Git Log, Branches, Stash, and Shelf primitives. Current verification passes with:

- `npm test`: 17 files, 40 tests passing.
- `npm run compile`: TypeScript and webview production build passing.
- `npm run lint`: ESLint passing.

However, several MVP requirements are either missing from the user-facing extension surface or only partially implemented. Because `base-requirements.md` says to write Post-MVP planning only if MVP is complete, this spec defines the remaining MVP completion work instead of promoting the project to Post-MVP execution.

## Verified MVP Status

### Changelist View

Status: partial.

Implemented:

- IntelliJ Git activity/sidebar view is contributed.
- Git repositories are discovered from workspace folders.
- Local changes are grouped through `ChangelistService`.
- Default `Changes`, user-created changelists, `Unversioned Files`, and `Merge Conflicts` are represented in the domain model.
- Changelist assignment is persisted in workspace storage.
- Tree items display checkbox controls.

Gaps:

- Tree checkbox state is always rendered as unchecked and is not connected to a persisted selected-file model.
- User-facing commands for create, rename, delete, and set-active changelist are missing.
- User-facing command or menu flow for moving files between changelists is missing.
- Tree view menus do not expose the full changelist workflow.

Acceptance criteria:

- Users can create, rename, delete, and set active changelists from commands and context menus.
- Users can move one or more changed files to a chosen changelist.
- File and changelist checkbox states participate in commit selection and survive refresh when the diff identity is still valid.
- A checked changelist selects all eligible file changes in that changelist.

### IntelliJ-Style Diff View

Status: partial.

Implemented:

- Custom webview review view exists.
- Changed-file navigation and selected-count summary exist.
- File, hunk, and changed-line checkboxes exist.
- Selection state is maintained outside the real Git index.
- Stale diff selections are invalidated when files change.
- VS Code theme tokens are used.

Gaps:

- Modified files currently render as a unified-style diff, not a side-by-side IntelliJ-style diff.
- Added, deleted, renamed, and binary states need clearer, mode-specific rendering.
- The UI does not provide an explicit unified/split view toggle.

Acceptance criteria:

- Modified files default to a side-by-side layout with old and new columns.
- Unified mode remains available as a fallback or toggle.
- Hunk and line checkboxes work in both modes.
- Added, deleted, renamed, and binary files render readable states with correct selection behavior.

### Partial Commit Engine

Status: partial.

Implemented:

- Selected files, hunks, and lines can be converted to patches.
- Patch application is checked before applying to the temporary index.
- A temporary index is used.
- Unselected working-tree changes are preserved in tests.
- Unresolved conflicts are blocked.

Gaps:

- Ongoing merge, rebase, cherry-pick, revert, and bisect states are not fully detected before commit.
- Binary partial selection is not explicitly blocked at the commit safety boundary.
- Overlapping staged changes are not gated while staging-area support is absent.
- Detached HEAD behavior is not handled as an explicit MVP decision.

Acceptance criteria:

- Commit is blocked with a clear message during merge/rebase/cherry-pick/revert/bisect states.
- Commit is blocked when selected binary files would require partial selection.
- Commit is blocked when staged changes overlap selected working-tree changes, unless a future staging workflow intentionally handles the case.
- Detached HEAD either commits through a documented path or is blocked with a clear message.

### Commit UX

Status: partial.

Implemented:

- Commit message validation exists.
- Commit selected changes exists.
- Commit and push exists.
- Amend, sign-off, and author override exist.
- Command failures are surfaced through extension flow and output logging exists elsewhere in the extension.

Gaps:

- The current `commit-tree` implementation bypasses Git's normal hook runner.
- Hook output is not captured or displayed as required by MVP.
- Commit menus and review UI should make selected scope obvious before mutation.

Acceptance criteria:

- Pre-commit and commit-msg hook output is shown in the IntelliJ Git output channel.
- Hook failure blocks commit and leaves the working tree and real index recoverable.
- Hook behavior is documented as MVP-compatible even though the temporary-index commit path cannot use `git commit` directly without careful index isolation.

### Safety and Observability

Status: partial.

Implemented:

- `git apply --cached --check` verifies synthetic patches.
- Force checkout asks for confirmation.
- Output channel exists.
- Diff refresh invalidates stale selections.

Gaps:

- Mutating operations do not consistently have preflight checks.
- Destructive operations do not have a shared confirmation policy.
- Command logs need a consistent redaction boundary.

Acceptance criteria:

- Every mutating command added for MVP has a preflight or explicit reason why Git lacks one.
- Destructive operations require confirmation.
- Output logs redact environment values and avoid leaking full hook inputs unless explicitly useful.

## Deferred Post-MVP Scope

The following features are already partially started, but should be treated as Post-MVP until the MVP gaps above are closed:

- Git Log graph, filters, changed-files pane, compare, cherry-pick, revert.
- Branch checkout-and-update, branch creation/deletion, compare with working tree, Smart Checkout.
- Shelf/stash manager beyond basic create/list flows.
- Merge conflict center with three-pane resolution.
- Blame/annotate view.
- Commit checks such as tasks, tests, lint/format selected files, TODO detection, and CRLF warnings.
- Multi-root and multi-repository coordination beyond basic repository discovery.

## Release Gate

MVP can be marked complete only after:

- All acceptance criteria in this spec pass through automated tests or manual smoke tests.
- `npm test`, `npm run compile`, and `npm run lint` pass.
- A packaged VSIX is installed into a clean VS Code Extension Development Host or local VS Code profile.
- The smoke test covers selecting a changelist/file/hunk/line, committing selected changes, verifying unselected changes remain, and observing hook output.
