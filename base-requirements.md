# VS Code IntelliJ-Style Git Client: Requirements Baseline

Date: 2026-05-16

## Product Goal

Build a VS Code extension that brings the high-signal parts of IntelliJ IDEs' Git client into VS Code: task-oriented changelists, file-level and hunk/line-level commit selection, an IntelliJ-style diff review workflow, and a richer Git workbench for history, branches, shelves/stashes, conflict resolution, and commit safety checks.

The extension should not replace Git itself. It should provide a focused, IDE-native interaction layer over Git commands, with predictable behavior, strong validation before destructive operations, and no hidden mutation of a user's working tree.

## Primary User Value

- Review local changes in task-based changelists instead of one flat Git status list.
- Commit selected files from a changelist.
- Open a diff view that resembles IntelliJ's Commit/Diff workflow: file tree on the side, side-by-side or unified diff, toolbar actions, gutter markers, and checkboxes for included hunks or lines.
- Commit selected hunks or specific lines while leaving unselected changes in the working tree.
- Preserve the existing VS Code editor flow: commands, context menus, theming, accessibility, and keyboard navigation should feel native.

## IntelliJ Git Client Research Summary

Sources were checked on 2026-05-16.

### Core Local Changes and Commit Workflow

IntelliJ's changelist model groups uncommitted local changes by task. A project starts with a default `Changes` changelist plus an `Unversioned Files` group, and users can create more changelists, set one as active, move changes between them, or drag files between changelists. Source: JetBrains "Group changes into changelists" docs: https://www.jetbrains.com/help/idea/managing-changelists.html

The Commit tool window lets users select files or entire changelists, edit the commit message, amend an existing commit, commit and push, choose author/sign-off options, and run commit checks such as reformat, optimize imports, code analysis, TODO checks, and run configurations. It also integrates with Git hooks and supports both changelist and staging-area workflows. Source: https://www.jetbrains.com/help/idea/commit-and-push-changes.html

### Partial Commit

IntelliJ supports partial commits directly in the commit diff. Users can select checkboxes next to code chunks, leave other chunks unselected, move a chunk to another changelist, and commit only a specific line by splitting chunks or toggling line checkboxes in the gutter. Unselected changes remain pending after the commit. Source: https://www.jetbrains.com/help/idea/commit-and-push-changes.html

For users who prefer staging, IntelliJ can enable Git's staging area. It can stage files, chunks from editor gutter markers, and granular changes through a three-way view of `HEAD`, staged, and local versions. Source: https://www.jetbrains.com/help/idea/commit-and-push-changes.html

### Diff and Review Style

The IntelliJ review flow is built around a list of changed files, a diff viewer opened from the Commit tool window, next/previous file navigation, toolbar actions, gutter change markers, and configurable behavior for whether double-click opens source or diff. The practical design target for this project is: keep the user in a review-first screen where selection state is visible next to both files and hunks.

### Git Log, History, and Investigation

The Git Log tab includes a branch graph, commits pane, changed-files pane, branch/user/date/path filters, graph options such as first-parent or no-merges, refresh, and actions such as cherry-pick. Source: https://www.jetbrains.com/help/idea/log-tab.html

IntelliJ can show history for a file, a selected code fragment or current line, directories, and compare committed file revisions with the local version. Its annotate/blame view shows per-line commit metadata and lets users jump to commits, diffs, GitHub, or linked issues. Source: https://www.jetbrains.com/help/idea/investigate-changes.html

### Branches, Shelves, Stashes, and Conflicts

The branch UI supports checkout, checkout-and-update, multi-repository grouping, and "Smart Checkout", which shelves local changes, switches branches, and unshelves them when local changes would otherwise be overwritten. Source: https://www.jetbrains.com/help/idea/manage-branches.html

IntelliJ distinguishes Git stashes from IDE shelves: stashes are Git-native; shelves are IDE-generated patches and can be created from selected files or changelists. Source: https://www.jetbrains.com/help/idea/shelving-and-unshelving-changes.html

Conflict resolution is surfaced as a Merge Conflicts node and a three-pane merge tool with local, result, and repository versions. It supports applying all non-conflicting changes and accepting/ignoring either side per conflict. Source: https://www.jetbrains.com/help/idea/resolve-conflicts.html

## VS Code Extension API Constraints

- VS Code's Source Control API can create SCM providers, resource groups, resource states, menus, commit input boxes, and quick-diff providers. This is useful for native integration but does not by itself provide IntelliJ-style hunk checkboxes. Source: https://code.visualstudio.com/api/extension-guides/scm-provider
- VS Code webviews can render richer UI, but official UX guidance says to use them only when needed, theme them, support accessibility, and avoid duplicating unrelated native UI. Source: https://code.visualstudio.com/api/ux-guidelines/webviews
- Webviews require careful security: restrictive `localResourceRoots`, content security policy, no inline scripts where possible, and sanitization of file paths/content. Source: https://code.visualstudio.com/api/extension-guides/webview
- `TextDocumentContentProvider` can expose read-only virtual documents for diff baselines and generated file versions. Source: https://code.visualstudio.com/api/extension-guides/virtual-documents

## MVP Requirements

### Changelist View

- Provide an "IntelliJ Git" activity/sidebar view.
- Detect Git repositories in the workspace.
- Show local changes grouped into:
  - Default changelist, initially named `Changes`.
  - User-created changelists.
  - `Unversioned Files`.
  - `Merge Conflicts` when relevant.
- Support checkboxes at changelist and file level.
- Support create, rename, delete, and set-active changelist.
- Support moving files between changelists.
- Persist changelist assignment in extension workspace storage, not in Git metadata.

### IntelliJ-Style Diff View

- Open a custom review view for a file or changelist.
- Show changed-file navigation and selected-count summary.
- Render side-by-side diff for modified files and readable views for added, deleted, renamed, and binary files.
- Show hunk-level checkboxes.
- Show line-level checkboxes after a hunk is split or when the user toggles line mode.
- Maintain selection state independently from Git index until commit.
- Theme with VS Code color tokens while using IntelliJ-inspired structure.

### Partial Commit Engine

- Commit selected files, hunks, or lines.
- Leave unselected changes in the working tree after commit.
- Validate selected patches with Git before committing.
- Disallow or clearly gate risky states in MVP:
  - ongoing merge/rebase/cherry-pick,
  - binary partial selection,
  - unresolved conflicts,
  - overlapping staged changes until staging support is implemented.
- Use a temporary Git index for partial commits so the real index and working tree are not mutated during patch construction.

### Commit UX

- Commit message input with validation.
- Commit selected changes.
- Commit and push.
- Amend last commit.
- Optional sign-off.
- Optional author override.
- Show Git hook output and command failures in an output channel.

### Safety and Observability

- Every mutating command should have a dry-run/check step where Git supports it.
- Destructive commands require confirmation.
- Provide an "IntelliJ Git" output channel with redacted command logs.
- Recover cleanly when files change on disk while a diff view is open.

## Post-MVP Requirements

- Git Log with graph, filters, changed-files pane, commit detail, compare, cherry-pick, revert.
- Branches pane with checkout, checkout-and-update, create branch, delete branch, compare with working tree, and Smart Checkout.
- Shelf and stash manager.
- Merge conflict center with three-pane resolution.
- Blame/annotate view with per-line metadata and jump-to-commit.
- Commit checks:
  - run configured VS Code tasks,
  - run tests,
  - lint/format selected files,
  - detect TODOs,
  - warn on CRLF if configured.
- Multi-root and multi-repository coordination.

## Non-Goals for the First Release

- Full replacement of VS Code's built-in Git extension.
- Hosting-provider workflows such as pull requests, code reviews, or issue linking.
- Semantic or AST-aware diff.
- Reimplementing all IntelliJ UI exactly pixel-for-pixel.
- Partial selection for binary files.

## Proposed Architecture

### Extension Host

- TypeScript VS Code extension.
- Owns Git process execution, repository discovery, workspace storage, command registration, and webview message handling.
- Uses stable VS Code APIs first: Tree View, Source Control API, commands, output channels, webviews, and virtual documents.

### Git Core

- `GitService`: typed wrapper around Git CLI.
- `RepositoryService`: repository discovery, current branch, status refresh, operation state detection.
- `StatusParser`: parse porcelain v2 status and map it into normalized file states.
- `DiffService`: fetch and parse diffs for working tree, index, `HEAD`, and selected commits.
- `PatchSelectionService`: maintain selected files/hunks/lines and build apply-able patches.
- `CommitService`: create commits from selected changes through a temporary index.

### Changelist Domain

- `ChangelistStore`: persisted mapping of repo + path + diff identity to changelist id.
- `ChangelistService`: create/rename/delete/set active/move changes.
- File changes default into the active changelist.
- If a change's patch identity no longer matches after edits, keep the file assignment but clear stale hunk selections.

### Webview UI

- Use a bundled webview app for the rich diff surface.
- Prefer Preact + Vite for small bundle size and componentized diff rendering.
- Use VS Code CSS variables and product icons.
- Webview is stateless enough to rebuild from extension-host state; transient UI state is saved via message passing and `getState`/`setState`.

## Partial Commit Strategy

1. Refresh repository status and ensure no unsupported operation is in progress.
2. Recompute selected diffs from current file contents.
3. Build a synthetic patch containing only selected files/hunks/lines.
4. Create a temporary index from `HEAD`.
5. Apply selected patch to the temporary index with `git apply --cached --check`, then `git apply --cached`.
6. Write the temporary tree.
7. Create a commit object with `git commit-tree`, preserving author/sign-off/amend options.
8. Move the current branch ref to the new commit.
9. Run `git reset --mixed HEAD` to align the real index with the new `HEAD` while leaving working-tree files untouched.
10. Refresh all views and clear committed selections.

This approach keeps partial commit construction isolated. The implementation must test the behavior heavily because the user-visible promise is simple: selected changes disappear from local changes after commit; unselected changes remain.

## Milestones

### M0: Project Skeleton

- VS Code extension scaffold.
- TypeScript build/test/lint.
- Command and output channel.
- Minimal webview shell.

### M1: Git Model and Changelists

- Repository discovery.
- Status parsing.
- Changelist persistence.
- Tree view with file checkboxes and move/create/rename/delete operations.

### M2: Diff Review

- Diff parsing and normalized hunk model.
- Webview side-by-side diff renderer.
- File and hunk checkboxes.
- Selection persistence across refresh.

### M3: Partial Commit MVP

- File-level commit.
- Hunk-level commit.
- Line-level commit for simple changed ranges.
- Temporary-index commit path.
- Integration tests in temporary Git repositories.

### M4: Commit Polish

- Commit and push.
- Amend/sign-off/author.
- Git hook output.
- Refresh/race handling.
- Keyboard navigation and accessibility pass.

### M5: IntelliJ Parity Expansion

- Git Log.
- Branches pane.
- Shelf/stash manager.
- Conflict center.
- Blame/annotate.
- Configurable commit checks.

## Acceptance Criteria

- A user can select two files from a changelist, commit them, and leave other files untouched.
- A user can select one hunk from a modified file, commit it, and leave other hunks pending.
- A user can select specific lines from a hunk, commit them, and leave adjacent unselected lines pending for simple non-overlapping cases.
- The diff view clearly shows selected and unselected content.
- Changelist assignments survive VS Code reload.
- The extension handles file edits during review by invalidating stale selections and asking the user to refresh.
- All Git mutations are covered by integration tests against real temporary repositories.
