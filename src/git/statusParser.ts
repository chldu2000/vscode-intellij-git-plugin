export type GitFileStatusKind =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'ignored'
  | 'conflicted';

export interface GitFileStatus {
  path: string;
  originalPath?: string;
  kind: GitFileStatusKind;
  indexStatus: string;
  workingTreeStatus: string;
  staged: boolean;
  unstaged: boolean;
}

export function parsePorcelainV2Status(output: string): GitFileStatus[] {
  const records = output.split('\0').filter((record) => record.length > 0);
  const statuses: GitFileStatus[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];

    if (record.startsWith('1 ')) {
      statuses.push(parseOrdinaryRecord(record));
      continue;
    }

    if (record.startsWith('2 ')) {
      const originalPath = records[index + 1];
      statuses.push(parseRenameOrCopyRecord(record, originalPath));
      index += 1;
      continue;
    }

    if (record.startsWith('? ')) {
      statuses.push({
        path: record.slice(2),
        kind: 'untracked',
        indexStatus: '?',
        workingTreeStatus: '?',
        staged: false,
        unstaged: true
      });
      continue;
    }

    if (record.startsWith('! ')) {
      statuses.push({
        path: record.slice(2),
        kind: 'ignored',
        indexStatus: '!',
        workingTreeStatus: '!',
        staged: false,
        unstaged: false
      });
      continue;
    }

    if (record.startsWith('u ')) {
      statuses.push(parseUnmergedRecord(record));
    }
  }

  return statuses;
}

function parseOrdinaryRecord(record: string): GitFileStatus {
  const fields = record.split(' ');
  const xy = fields[1];
  const filePath = fields.slice(8).join(' ');
  const indexStatus = xy[0] ?? '.';
  const workingTreeStatus = xy[1] ?? '.';

  return {
    path: filePath,
    kind: kindFromStatus(indexStatus, workingTreeStatus),
    indexStatus,
    workingTreeStatus,
    staged: indexStatus !== '.',
    unstaged: workingTreeStatus !== '.'
  };
}

function parseRenameOrCopyRecord(record: string, originalPath: string | undefined): GitFileStatus {
  const fields = record.split(' ');
  const xy = fields[1];
  const filePath = fields.slice(9).join(' ');
  const indexStatus = xy[0] ?? '.';
  const workingTreeStatus = xy[1] ?? '.';

  return {
    path: filePath,
    originalPath,
    kind: indexStatus === 'C' ? 'copied' : 'renamed',
    indexStatus,
    workingTreeStatus,
    staged: indexStatus !== '.',
    unstaged: workingTreeStatus !== '.'
  };
}

function parseUnmergedRecord(record: string): GitFileStatus {
  const fields = record.split(' ');

  return {
    path: fields.slice(10).join(' '),
    kind: 'conflicted',
    indexStatus: 'U',
    workingTreeStatus: 'U',
    staged: false,
    unstaged: true
  };
}

function kindFromStatus(indexStatus: string, workingTreeStatus: string): GitFileStatusKind {
  if (indexStatus === 'A' || workingTreeStatus === 'A') {
    return 'added';
  }

  if (indexStatus === 'D' || workingTreeStatus === 'D') {
    return 'deleted';
  }

  if (indexStatus === 'R' || workingTreeStatus === 'R') {
    return 'renamed';
  }

  if (indexStatus === 'C' || workingTreeStatus === 'C') {
    return 'copied';
  }

  return 'modified';
}
