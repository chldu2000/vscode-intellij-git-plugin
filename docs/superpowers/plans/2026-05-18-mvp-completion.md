# MVP Completion Implementation Plan

> For agentic workers: execute task-by-task. After each completed task or phase, run the listed verification and create a Git commit so the implementation stays easy to trace.

**Goal:** Close the remaining MVP gaps from `base-requirements.md` before writing the Post-MVP execution plan.

**Current baseline:** Tests, compile, and lint pass on 2026-05-18. The working tree has an unrelated untracked `README.md`; leave it untouched unless the user explicitly asks otherwise.

## Milestone M6: Changelist User Workflows

### Task 1: Wire Changelist Commands and Menus

Files:

- `package.json`
- `src/extension.ts`
- `src/views/changelistTreeProvider.ts`
- `src/views/changelistTreeModel.ts`
- `src/test/changelistTreeModel.test.ts`

Steps:

- [x] Add commands:
  - `intellijGit.createChangelist`
  - `intellijGit.renameChangelist`
  - `intellijGit.deleteChangelist`
  - `intellijGit.setActiveChangelist`
  - `intellijGit.moveFilesToChangelist`
- [x] Add `view/item/context` menu entries for repository, changelist group, and file nodes.
- [x] Prompt for changelist names with `showInputBox`; validate empty names and duplicate names.
- [x] Prompt for destination changelist with `showQuickPick`.
- [x] Refresh changelists after each successful operation.
- [x] Block deletion of the default changelist and move deleted assignments back to `Changes`.

Verification:

- [x] Add or update unit tests for tree node context values and changelist operations.
- [x] Run `npm test -- changelist`.
- [x] Run `npm run compile`.
- [x] Commit: `feat: add changelist management commands`.

### Task 2: Make Tree Checkboxes Drive Commit Selection

Files:

- `src/views/changelistTreeProvider.ts`
- `src/views/changelistSelectionStore.ts`
- `src/extension.ts`
- `src/shared/selection.ts`
- `src/test/changelistSelectionStore.test.ts`
- `src/test/changelistTreeModel.test.ts`

Steps:

- [x] Add a selection store keyed by repository root and normalized path.
- [x] Register `TreeView.onDidChangeCheckboxState` instead of only using `registerTreeDataProvider`.
- [x] When a file checkbox changes, update file selection.
- [x] When a changelist checkbox changes, apply the state to all eligible child files.
- [x] Render checked, unchecked, and partial states for changelist groups.
- [x] Feed tree-selected files into `openDiffReview` and `commitSelected`.
- [x] Clear stale file selections when status no longer contains the path.

Verification:

- [x] Add tests for file selection, group selection, partial group state, and stale cleanup.
- [x] Run `npm test -- changelist`.
- [x] Run `npm run compile`.
- [x] Commit: `feat: connect changelist checkboxes to selection`.

## Milestone M7: IntelliJ-Style Split Diff

### Task 3: Normalize Split Diff Rows

Files:

- `src/git/diffParser.ts`
- `src/webview/diffRows.ts`
- `src/test/diffRows.test.ts`

Steps:

- [x] Build a `DiffRow` projection that pairs removed and added lines where possible.
- [x] Preserve original hunk and line indexes so selection still maps to `DiffSelection`.
- [x] Represent context, add-only, delete-only, and modified-pair rows.
- [x] Keep binary files outside the split row path.

Verification:

- [x] Add tests for simple replacements, multi-line replacements, add-only hunks, delete-only hunks, and context boundaries.
- [x] Run `npm test -- diffRows diffParser`.
- [x] Commit: `feat: model side by side diff rows`.

### Task 4: Render Split Diff UI

Files:

- `src/webview/components/DiffPane.tsx`
- `src/webview/components/DiffReviewApp.tsx`
- `src/webview/styles.css`
- `src/shared/selection.ts`
- `src/test/diffReviewSelection.test.ts`

Steps:

- [ ] Add a toolbar toggle for `Side-by-side` and `Unified`.
- [ ] Default modified files to side-by-side mode.
- [ ] Render old and new columns with stable line-number gutters and selectable changed lines.
- [ ] Keep hunk checkboxes visible above each hunk.
- [ ] Render added, deleted, renamed, and binary files with clear mode-specific empty states.
- [ ] Ensure keyboard focus and labels remain accessible.

Verification:

- [ ] Run `npm test -- diffReviewSelection`.
- [ ] Run `npm run compile`.
- [ ] Manually open the webview in Extension Development Host and verify no overlapping text at narrow and wide widths.
- [ ] Commit: `feat: render side by side diff review`.

## Milestone M8: Commit Safety Gates

### Task 5: Detect Unsupported Repository States

Files:

- `src/git/repositoryState.ts`
- `src/git/repositoryService.ts`
- `src/git/commitService.ts`
- `src/test/repositoryState.test.ts`
- `src/test/commitService.test.ts`

Steps:

- [ ] Detect merge, rebase, cherry-pick, revert, and bisect state using `.git` metadata and Git commands where needed.
- [ ] Return a typed state object with user-facing reason strings.
- [ ] Block selected commits when unsupported operation states are active.
- [ ] Decide MVP detached-HEAD behavior and encode it as either blocked or explicitly supported.

Verification:

- [ ] Add fixture tests for each state marker.
- [ ] Run `npm test -- repositoryState commitService`.
- [ ] Commit: `feat: gate commits during risky repository states`.

### Task 6: Gate Binary and Staged Overlap Cases

Files:

- `src/git/commitService.ts`
- `src/git/diffParser.ts`
- `src/git/patchBuilder.ts`
- `src/test/commitService.test.ts`
- `src/test/patchBuilder.test.ts`

Steps:

- [ ] Block partial selection for binary files before patch building.
- [ ] Detect staged files with `git diff --cached --name-only`.
- [ ] Detect overlap between staged paths and selected paths.
- [ ] Block overlapping staged changes with a clear message until staging-area support exists.
- [ ] Add output-channel guidance telling users how to recover or retry.

Verification:

- [ ] Add tests for binary selection and staged overlap.
- [ ] Run `npm test -- commitService patchBuilder`.
- [ ] Commit: `feat: block unsupported partial commit states`.

## Milestone M9: Hook-Aware Commit UX

### Task 7: Add Hook Runner Around Temporary-Index Commits

Files:

- `src/git/hookService.ts`
- `src/git/commitService.ts`
- `src/git/gitService.ts`
- `src/test/hookService.test.ts`
- `src/test/commitService.test.ts`

Steps:

- [ ] Locate hooks through `git rev-parse --git-path hooks/<hook>`.
- [ ] Run executable `pre-commit` with the temporary index environment before writing the tree.
- [ ] Run executable `commit-msg` against a temporary message file before `commit-tree`.
- [ ] Capture stdout and stderr into the IntelliJ Git output channel.
- [ ] Block commit when a hook exits non-zero.
- [ ] Document unsupported hook nuances if any hook relies on `git commit` internals that the temporary-index path cannot reproduce.

Verification:

- [ ] Add tests for passing hooks, failing hooks, and hook output capture.
- [ ] Run `npm test -- hookService commitService`.
- [ ] Run `npm run compile`.
- [ ] Commit: `feat: run git hooks for selected commits`.

### Task 8: Clarify Commit Scope Before Mutation

Files:

- `src/views/diffReviewPanel.ts`
- `src/webview/components/DiffReviewApp.tsx`
- `src/extension.ts`
- `src/test/diffReviewSelection.test.ts`

Steps:

- [ ] Show selected file/hunk/line count in the commit prompt flow.
- [ ] Confirm commit when the selected scope is empty, stale, binary-blocked, or contains unsupported staged overlap.
- [ ] Send hook and command failures to the output channel and surface a concise error notification.
- [ ] Keep unselected changes visible after refresh.

Verification:

- [ ] Add selection summary tests.
- [ ] Run `npm test`.
- [ ] Run `npm run compile`.
- [ ] Commit: `feat: improve selected commit confirmation`.

## Milestone M10: MVP Release Verification

### Task 9: Package and Smoke Test

Files:

- `README.md` if the user asks to document local installation.
- `docs/superpowers/specs/2026-05-18-mvp-completion-gap-spec.md`
- `docs/superpowers/plans/2026-05-18-mvp-completion.md`

Steps:

- [ ] Run `npm test`.
- [ ] Run `npm run compile`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run package`.
- [ ] Install the generated VSIX into a clean VS Code profile or Extension Development Host.
- [ ] Smoke test:
  - create two changelists,
  - move files between them,
  - select a file from the tree,
  - select one hunk and one line in split diff,
  - commit selected changes,
  - verify unselected changes remain,
  - verify hook output is visible,
  - verify refresh after file modification clears stale selections.
- [ ] Mark MVP complete in a new implementation status document.
- [ ] Commit: `docs: mark mvp completion status`.

## Post-MVP Planning Trigger

Only after M6-M10 are complete and the release gate in the MVP completion spec passes, write the Post-MVP project spec and implementation plan for:

- Git Log graph, filters, changed-files pane, compare, cherry-pick, revert.
- Branch management including checkout-and-update, create/delete, compare, and Smart Checkout.
- Shelf/stash manager.
- Merge conflict center.
- Blame/annotate.
- Commit checks.
- Multi-root and multi-repository coordination.
