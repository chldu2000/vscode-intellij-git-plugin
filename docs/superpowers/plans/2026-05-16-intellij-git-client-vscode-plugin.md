# IntelliJ-Style Git Client VS Code Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VS Code extension that supports IntelliJ-style changelists, review-first diffs, and selected file/hunk/line commits.

**Architecture:** The extension host owns Git execution, repository state, changelist persistence, and commit construction. A webview owns the rich IntelliJ-inspired diff review surface. Partial commits are created through a temporary Git index and then reflected back into the real working copy with a mixed reset.

**Tech Stack:** TypeScript, VS Code Extension API, Git CLI, Preact + Vite for webview UI, Vitest for core unit tests, `@vscode/test-electron` for extension tests.

---

## File Structure

- `package.json`: extension manifest, scripts, commands, views, settings.
- `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`: build and verification config.
- `src/extension.ts`: activation, service wiring, command registration.
- `src/git/gitService.ts`: process wrapper for Git commands.
- `src/git/repositoryService.ts`: repo discovery, status refresh, operation-state detection.
- `src/git/statusParser.ts`: porcelain v2 status parser.
- `src/git/diffParser.ts`: unified diff parser.
- `src/git/patchBuilder.ts`: selected hunk/line patch generation.
- `src/git/commitService.ts`: temporary-index commit workflow.
- `src/changelists/changelistStore.ts`: persisted changelist assignment data.
- `src/changelists/changelistService.ts`: changelist operations.
- `src/views/changelistTreeProvider.ts`: VS Code tree view and checkbox state.
- `src/views/diffReviewPanel.ts`: webview panel lifecycle and message bridge.
- `src/webview/main.tsx`: webview entry.
- `src/webview/components/*`: file navigator, diff panes, hunk rows, toolbar.
- `src/test/*`: unit tests.
- `src/test-fixtures/*`: reusable Git repo fixture helpers.

## Phase 0: Scaffold and Guardrails

### Task 1: Create Extension Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `eslint.config.mjs`
- Create: `src/extension.ts`

- [ ] **Step 1: Add npm scripts and VS Code contributions**

Create `package.json` with activation on workspace folders and commands:

```json
{
  "name": "intellij-git-client",
  "displayName": "IntelliJ Git Client",
  "description": "IntelliJ-style changelists, diffs, and partial commits for VS Code.",
  "version": "0.0.1",
  "publisher": "local",
  "engines": { "vscode": "^1.101.0" },
  "categories": ["Source Control"],
  "activationEvents": ["onStartupFinished", "onView:intellijGit.changelists"],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "intellijGit",
          "title": "IntelliJ Git",
          "icon": "media/activity-icon.svg"
        }
      ]
    },
    "views": {
      "intellijGit": [
        {
          "id": "intellijGit.changelists",
          "name": "Changelists"
        }
      ]
    },
    "commands": [
      { "command": "intellijGit.refresh", "title": "IntelliJ Git: Refresh" },
      { "command": "intellijGit.openDiffReview", "title": "IntelliJ Git: Open Diff Review" },
      { "command": "intellijGit.commitSelected", "title": "IntelliJ Git: Commit Selected Changes" }
    ],
    "configuration": {
      "title": "IntelliJ Git",
      "properties": {
        "intellijGit.gitPath": {
          "type": "string",
          "default": "git",
          "description": "Path to the Git executable."
        }
      }
    }
  },
  "scripts": {
    "compile": "tsc -p .",
    "watch": "tsc -w -p .",
    "test": "vitest run",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/vscode": "^1.101.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@vscode/test-electron": "^2.4.0",
    "eslint": "^8.57.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^1.6.0"
  },
  "dependencies": {
    "@preact/preset-vite": "^2.9.0",
    "preact": "^10.22.0"
  }
}
```

- [ ] **Step 2: Add TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "moduleResolution": "Node16",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Add activation shell**

Create `src/extension.ts`:

```ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('IntelliJ Git');
  context.subscriptions.push(output);

  context.subscriptions.push(
    vscode.commands.registerCommand('intellijGit.refresh', async () => {
      output.appendLine('Refresh requested.');
    }),
    vscode.commands.registerCommand('intellijGit.openDiffReview', async () => {
      vscode.window.showInformationMessage('Diff review is not implemented yet.');
    }),
    vscode.commands.registerCommand('intellijGit.commitSelected', async () => {
      vscode.window.showInformationMessage('Commit selected changes is not implemented yet.');
    })
  );
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions.
}
```

- [ ] **Step 4: Verify compile**

Run: `npm install`

Expected: dependencies install successfully.

Run: `npm run compile`

Expected: TypeScript compilation succeeds.

## Phase 1: Git Model and Changelists

### Task 2: Implement Git Command Wrapper

**Files:**
- Create: `src/git/gitService.ts`
- Test: `src/test/gitService.test.ts`

- [ ] **Step 1: Define typed result and execution method**

`GitService` should run commands with a repository cwd, capture stdout/stderr, support environment overrides such as `GIT_INDEX_FILE`, and throw a typed error on non-zero exit.

- [ ] **Step 2: Add tests**

Test successful commands, failing commands, cwd handling, and environment injection with a temporary Git repository.

- [ ] **Step 3: Commit**

Run: `npm test`

Expected: all `GitService` tests pass.

### Task 3: Parse Repository Status

**Files:**
- Create: `src/git/statusParser.ts`
- Create: `src/git/repositoryService.ts`
- Test: `src/test/statusParser.test.ts`
- Test: `src/test/repositoryService.test.ts`

- [ ] **Step 1: Model file states**

Represent modified, added, deleted, renamed, copied, untracked, ignored, conflicted, staged, and unstaged states.

- [ ] **Step 2: Parse `git status --porcelain=v2 -z`**

Parse ordinary records, rename records, untracked records, ignored records, and conflict records.

- [ ] **Step 3: Discover repos**

Use workspace folders, `git rev-parse --show-toplevel`, and de-duplicate nested paths.

- [ ] **Step 4: Verify**

Run: `npm test -- statusParser repositoryService`

Expected: tests pass for clean, dirty, renamed, untracked, and conflicted repos.

### Task 4: Persist Changelists

**Files:**
- Create: `src/changelists/changelistStore.ts`
- Create: `src/changelists/changelistService.ts`
- Test: `src/test/changelistService.test.ts`

- [ ] **Step 1: Define changelist schema**

Persist:

```ts
export interface Changelist {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChangelistAssignment {
  repositoryRoot: string;
  path: string;
  changelistId: string;
}
```

- [ ] **Step 2: Implement operations**

Create default `Changes`, create named changelist, rename, delete, set active, move file assignments, and return `Unversioned Files` as a derived group.

- [ ] **Step 3: Verify**

Run: `npm test -- changelistService`

Expected: default list is created, active list changes correctly, assignments survive reload simulation.

### Task 5: Render Changelist Tree

**Files:**
- Create: `src/views/changelistTreeProvider.ts`
- Modify: `src/extension.ts`

- [ ] **Step 1: Implement tree provider**

Show repository nodes, changelist nodes, file nodes, and conflict/unversioned derived groups. Use VS Code tree item checkboxes for file and changelist selection where available.

- [ ] **Step 2: Wire commands**

Add refresh, open diff, move to changelist, create changelist, rename changelist, delete changelist, and set active.

- [ ] **Step 3: Verify manually**

Run: `npm run compile`, launch extension host, open a Git repo, and confirm changed files appear grouped.

## Phase 2: Diff Review UI

### Task 6: Parse Diffs into Hunks

**Files:**
- Create: `src/git/diffParser.ts`
- Test: `src/test/diffParser.test.ts`

- [ ] **Step 1: Define normalized diff model**

Represent file metadata, old/new path, binary flag, hunks, lines, line numbers, and change type.

- [ ] **Step 2: Parse unified diffs**

Support modified, added, deleted, renamed, mode changes, and binary placeholders.

- [ ] **Step 3: Verify**

Run: `npm test -- diffParser`

Expected: fixture diffs produce stable file/hunk/line models.

### Task 7: Build Diff Review Webview

**Files:**
- Create: `src/views/diffReviewPanel.ts`
- Create: `src/webview/main.tsx`
- Create: `src/webview/components/DiffReviewApp.tsx`
- Create: `src/webview/components/FileNavigator.tsx`
- Create: `src/webview/components/DiffPane.tsx`
- Create: `src/webview/styles.css`
- Modify: `src/extension.ts`

- [ ] **Step 1: Create message contract**

Define messages for initial state, toggle file, toggle hunk, toggle line, refresh, commit selected, open source, and close.

- [ ] **Step 2: Render review layout**

Use a left file navigator, top toolbar, selected count, commit message area, and main diff pane.

- [ ] **Step 3: Render hunk checkboxes**

Show a checkbox per hunk and mark partially selected hunks when only some lines are selected.

- [ ] **Step 4: Add keyboard and accessibility behavior**

Support focusable rows, ARIA labels, enter/space toggles, and visible focus rings.

- [ ] **Step 5: Verify manually**

Run the extension host and confirm webview opens with a sample diff, uses VS Code theme variables, and does not show script/CSP warnings.

## Phase 3: Partial Commit Engine

### Task 8: Build Selected Patch Generation

**Files:**
- Create: `src/git/patchBuilder.ts`
- Test: `src/test/patchBuilder.test.ts`

- [ ] **Step 1: Generate file-level selected patches**

For whole-file selections, preserve the original file diff.

- [ ] **Step 2: Generate hunk-level selected patches**

For selected hunks, generate valid unified diff with recalculated hunk headers.

- [ ] **Step 3: Generate line-level selected patches**

For selected lines in simple non-overlapping hunks, include required context lines and recalculate hunk headers.

- [ ] **Step 4: Validate with Git**

For each fixture, apply generated patches to a temporary index with `git apply --cached --check`.

- [ ] **Step 5: Verify**

Run: `npm test -- patchBuilder`

Expected: all selected patch fixtures apply cleanly.

### Task 9: Commit Through Temporary Index

**Files:**
- Create: `src/git/commitService.ts`
- Test: `src/test/commitService.test.ts`

- [ ] **Step 1: Implement preflight checks**

Block commits during merge, rebase, cherry-pick, bisect, unresolved conflicts, unsupported binary partials, and stale diff selections.

- [ ] **Step 2: Implement temporary-index commit**

Use:

```text
git read-tree HEAD
git apply --cached --check <selected.patch>
git apply --cached <selected.patch>
git write-tree
git commit-tree <tree> -p HEAD
git update-ref refs/heads/<branch> <newCommit> HEAD
git reset --mixed HEAD
```

Run commands with `GIT_INDEX_FILE=<temp-index-path>` for the temporary-index steps, except the final real-index `git reset --mixed HEAD`.

- [ ] **Step 3: Support commit metadata**

Support message, author, amend mode, and sign-off text.

- [ ] **Step 4: Verify selected behavior**

Integration tests must assert:

- selected file commit removes that file from local changes,
- selected hunk commit leaves other hunks pending,
- selected simple line commit leaves adjacent unselected line changes pending,
- failed patch apply leaves `HEAD`, index, and working tree unchanged.

- [ ] **Step 5: Commit**

Run: `npm test -- commitService`

Expected: all temporary-repo integration tests pass.

### Task 10: Wire Commit UX

**Files:**
- Modify: `src/views/diffReviewPanel.ts`
- Modify: `src/views/changelistTreeProvider.ts`
- Modify: `src/extension.ts`

- [ ] **Step 1: Validate commit message**

Disable commit action until selected changes and non-empty commit message exist.

- [ ] **Step 2: Show preflight failures**

Use VS Code error messages for short summaries and the output channel for command details.

- [ ] **Step 3: Refresh after commit**

Clear committed selections, refresh status, and keep uncommitted diff selections visible.

- [ ] **Step 4: Verify manually**

Create a temporary repo, change two files, commit one selected hunk, and confirm only the selected hunk is committed.

## Phase 4: Commit Polish

### Task 11: Add Commit and Push, Amend, Author, Sign-Off

**Files:**
- Modify: `src/git/commitService.ts`
- Modify: `src/views/diffReviewPanel.ts`
- Modify: `src/webview/components/DiffReviewApp.tsx`

- [ ] **Step 1: Add commit options UI**

Add amend, sign-off, author override, and commit-and-push controls.

- [ ] **Step 2: Implement push after successful commit**

Run `git push` only after commit succeeds. If push fails, keep the local commit and show recovery guidance.

- [ ] **Step 3: Verify**

Run integration tests for amend and sign-off. Manually test push against a local bare remote.

### Task 12: Add Race Handling

**Files:**
- Modify: `src/git/diffParser.ts`
- Modify: `src/git/patchBuilder.ts`
- Modify: `src/views/diffReviewPanel.ts`

- [ ] **Step 1: Add diff identity**

Hash file path, old/new blob ids when available, and hunk headers.

- [ ] **Step 2: Invalidate stale selections**

If file content changes and selected hunk identity no longer matches, clear that selection and show a refresh notice.

- [ ] **Step 3: Verify**

Test editing a file while a diff review is open.

## Phase 5: IntelliJ Parity Expansion

### Task 13: Git Log

**Files:**
- Create: `src/git/logService.ts`
- Create: `src/views/logViewProvider.ts`
- Create: `src/webview/components/GitLogApp.tsx`

- [ ] **Step 1: Parse commits**

Use `git log --graph --date-order --decorate --numstat` or a structured command pair for commit metadata and changed files.

- [ ] **Step 2: Add filters**

Support branch, author, date, path, and search filters.

- [ ] **Step 3: Add actions**

Support show diff, compare with working tree, cherry-pick, revert, and copy hash.

### Task 14: Branches and Smart Checkout

**Files:**
- Create: `src/git/branchService.ts`
- Create: `src/views/branchTreeProvider.ts`

- [ ] **Step 1: List branches**

Show local, remote, current branch, upstream, ahead/behind.

- [ ] **Step 2: Checkout safely**

If local changes would be overwritten, offer cancel, force checkout, or smart checkout.

- [ ] **Step 3: Smart checkout**

Stash or shelf current selected changes, checkout target branch, then re-apply and surface conflicts.

### Task 15: Shelves, Stashes, Conflicts, Blame

**Files:**
- Create: `src/git/stashService.ts`
- Create: `src/git/shelfService.ts`
- Create: `src/git/conflictService.ts`
- Create: `src/git/blameService.ts`
- Create: matching view/webview files.

- [ ] **Step 1: Stash and shelf manager**

Support Git-native stash and extension-owned shelf patches for selected files/changelists.

- [ ] **Step 2: Conflict center**

Surface merge conflicts as a tree node and open a three-pane conflict review.

- [ ] **Step 3: Blame annotations**

Add command to show per-line blame metadata and jump to Git Log commits.

## Verification Strategy

- Unit tests for parsing, changelist assignment, selection state, patch building.
- Integration tests that run real Git commands inside temporary repositories.
- Extension-host smoke tests for activation, tree rendering, commands, and webview creation.
- Manual acceptance scripts for:
  - file-level commit,
  - hunk-level commit,
  - line-level commit,
  - stale diff invalidation,
  - conflict blocking,
  - commit-and-push against a local bare remote.

## Plan Self-Review

- The MVP requirements in `base-requirements.md` are covered by Phases 0-4.
- Post-MVP IntelliJ parity features are covered by Phase 5.
- Risky Git states are explicitly blocked before the commit engine mutates refs.
- The plan intentionally starts with real Git integration tests before wiring the final commit UI, because partial commit correctness is the highest-risk behavior.
