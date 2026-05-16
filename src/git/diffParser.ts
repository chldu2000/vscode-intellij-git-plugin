export type DiffChangeType = 'modified' | 'added' | 'deleted' | 'renamed';
export type DiffLineType = 'context' | 'add' | 'delete';

export interface DiffFile {
  oldPath?: string;
  newPath?: string;
  indexLine?: string;
  changeType: DiffChangeType;
  binary: boolean;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLine?: number;
  newLine?: number;
}

export function parseUnifiedDiff(diff: string): DiffFile[] {
  const lines = diff.split('\n');
  const files: DiffFile[] = [];
  let currentFile: DiffFile | undefined;
  let currentHunk: DiffHunk | undefined;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      currentFile = createFileFromHeader(line);
      currentHunk = undefined;
      files.push(currentFile);
      continue;
    }

    if (currentFile === undefined) {
      continue;
    }

    if (line === 'new file mode 100644' || line.startsWith('new file mode ')) {
      currentFile.changeType = 'added';
      currentFile.oldPath = undefined;
      continue;
    }

    if (line.startsWith('index ')) {
      currentFile.indexLine = line;
      continue;
    }

    if (line === 'deleted file mode 100644' || line.startsWith('deleted file mode ')) {
      currentFile.changeType = 'deleted';
      currentFile.newPath = undefined;
      continue;
    }

    if (line.startsWith('rename from ')) {
      currentFile.oldPath = line.slice('rename from '.length);
      currentFile.changeType = 'renamed';
      continue;
    }

    if (line.startsWith('rename to ')) {
      currentFile.newPath = line.slice('rename to '.length);
      currentFile.changeType = 'renamed';
      continue;
    }

    if (line.startsWith('--- ')) {
      currentFile.oldPath = parseDiffPath(line.slice(4));
      continue;
    }

    if (line.startsWith('+++ ')) {
      currentFile.newPath = parseDiffPath(line.slice(4));
      continue;
    }

    if (line.startsWith('Binary files ')) {
      currentFile.binary = true;
      continue;
    }

    if (line.startsWith('@@ ')) {
      currentHunk = parseHunkHeader(line);
      currentFile.hunks.push(currentHunk);
      oldLine = currentHunk.oldStart;
      newLine = currentHunk.newStart;
      continue;
    }

    if (currentHunk === undefined) {
      continue;
    }

    if (line.startsWith(' ')) {
      currentHunk.lines.push({
        type: 'context',
        content: line,
        oldLine,
        newLine
      });
      oldLine += 1;
      newLine += 1;
      continue;
    }

    if (line.startsWith('-')) {
      currentHunk.lines.push({
        type: 'delete',
        content: line,
        oldLine
      });
      oldLine += 1;
      continue;
    }

    if (line.startsWith('+')) {
      currentHunk.lines.push({
        type: 'add',
        content: line,
        newLine
      });
      newLine += 1;
    }
  }

  return files;
}

function createFileFromHeader(header: string): DiffFile {
  const match = /^diff --git a\/(.+) b\/(.+)$/.exec(header);
  const oldPath = match?.[1] === 'dev/null' ? undefined : match?.[1];
  const newPath = match?.[2] === 'dev/null' ? undefined : match?.[2];

  return {
    oldPath,
    newPath,
    changeType: 'modified',
    binary: false,
    hunks: []
  };
}

function parseDiffPath(rawPath: string): string | undefined {
  if (rawPath === '/dev/null') {
    return undefined;
  }

  if (rawPath.startsWith('a/') || rawPath.startsWith('b/')) {
    return rawPath.slice(2);
  }

  return rawPath;
}

function parseHunkHeader(header: string): DiffHunk {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(header);

  if (match === null) {
    throw new Error(`Invalid hunk header: ${header}`);
  }

  return {
    header,
    oldStart: Number(match[1]),
    oldLines: match[2] === undefined ? 1 : Number(match[2]),
    newStart: Number(match[3]),
    newLines: match[4] === undefined ? 1 : Number(match[4]),
    lines: []
  };
}
