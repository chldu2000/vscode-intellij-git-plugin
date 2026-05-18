import type { DiffHunk, DiffLine, DiffLineType } from '../git/diffParser';

export type SplitDiffRowKind = 'context' | 'add' | 'delete' | 'modify';

export interface SplitDiffCell {
  lineIndex: number;
  lineNumber?: number;
  content: string;
  type: DiffLineType;
}

export interface SplitDiffRow {
  kind: SplitDiffRowKind;
  old?: SplitDiffCell;
  new?: SplitDiffCell;
}

export function buildSplitDiffRows(hunk: DiffHunk): SplitDiffRow[] {
  const rows: SplitDiffRow[] = [];
  let index = 0;

  while (index < hunk.lines.length) {
    const line = hunk.lines[index];

    if (line.type === 'context') {
      rows.push({
        kind: 'context',
        old: toOldCell(line, index),
        new: toNewCell(line, index)
      });
      index += 1;
      continue;
    }

    if (line.type === 'delete') {
      const deleted = collectRun(hunk.lines, index, 'delete');
      const addedStart = index + deleted.length;
      const added = collectRun(hunk.lines, addedStart, 'add');
      const pairedCount = Math.max(deleted.length, added.length);

      for (let offset = 0; offset < pairedCount; offset += 1) {
        const oldLine = deleted[offset];
        const newLine = added[offset];

        rows.push({
          kind: oldLine !== undefined && newLine !== undefined ? 'modify' : oldLine !== undefined ? 'delete' : 'add',
          old: oldLine === undefined ? undefined : toOldCell(oldLine.line, oldLine.index),
          new: newLine === undefined ? undefined : toNewCell(newLine.line, newLine.index)
        });
      }

      index += deleted.length + added.length;
      continue;
    }

    const added = collectRun(hunk.lines, index, 'add');

    for (const addedLine of added) {
      rows.push({
        kind: 'add',
        new: toNewCell(addedLine.line, addedLine.index)
      });
    }

    index += added.length;
  }

  return rows;
}

function collectRun(
  lines: DiffLine[],
  start: number,
  type: DiffLineType
): Array<{ line: DiffLine; index: number }> {
  const run: Array<{ line: DiffLine; index: number }> = [];

  for (let index = start; index < lines.length && lines[index].type === type; index += 1) {
    run.push({
      line: lines[index],
      index
    });
  }

  return run;
}

function toOldCell(line: DiffLine, lineIndex: number): SplitDiffCell {
  return {
    lineIndex,
    lineNumber: line.oldLine,
    content: line.content,
    type: line.type
  };
}

function toNewCell(line: DiffLine, lineIndex: number): SplitDiffCell {
  return {
    lineIndex,
    lineNumber: line.newLine,
    content: line.content,
    type: line.type
  };
}
