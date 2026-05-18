import type { GitService } from './gitService';

const RECORD_SEPARATOR = '\u001e';
const FIELD_SEPARATOR = '\u001f';

export interface GitLogFile {
  path: string;
  additions: number;
  deletions: number;
  binary: boolean;
}

export interface GitLogCommit {
  hash: string;
  authorName: string;
  authorEmail: string;
  authoredAt: Date;
  refs: string[];
  subject: string;
  files: GitLogFile[];
}

export interface GitLogOptions {
  limit?: number;
  branch?: string;
  author?: string;
  path?: string;
  search?: string;
}

export class LogService {
  public constructor(private readonly git: GitService) {}

  public async list(repositoryRoot: string, options: GitLogOptions = {}): Promise<GitLogCommit[]> {
    const args = [
      'log',
      `--max-count=${options.limit ?? 200}`,
      '--date-order',
      '--decorate=short',
      '--numstat',
      `--pretty=format:${RECORD_SEPARATOR}%H${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%ae${FIELD_SEPARATOR}%at${FIELD_SEPARATOR}%D${FIELD_SEPARATOR}%s`
    ];

    if (options.author !== undefined && options.author.trim().length > 0) {
      args.push(`--author=${options.author}`);
    }

    if (options.search !== undefined && options.search.trim().length > 0) {
      args.push(`--grep=${options.search}`);
    }

    if (options.branch !== undefined && options.branch.trim().length > 0) {
      args.push(options.branch);
    }

    if (options.path !== undefined && options.path.trim().length > 0) {
      args.push('--', options.path);
    }

    const result = await this.git.exec(repositoryRoot, args);
    return parseGitLog(result.stdout);
  }
}

export function parseGitLog(output: string): GitLogCommit[] {
  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map(parseCommitRecord);
}

function parseCommitRecord(record: string): GitLogCommit {
  const [headerLine = '', ...fileLines] = record.split('\n').filter((line) => line.length > 0);
  const [hash = '', authorName = '', authorEmail = '', authoredAt = '0', refs = '', subject = ''] =
    headerLine.split(FIELD_SEPARATOR);

  return {
    hash,
    authorName,
    authorEmail,
    authoredAt: new Date(Number(authoredAt) * 1000),
    refs: refs.length === 0 ? [] : refs.split(',').map((ref) => ref.trim()).filter((ref) => ref.length > 0),
    subject,
    files: fileLines.map(parseNumstatLine)
  };
}

function parseNumstatLine(line: string): GitLogFile {
  const [additions, deletions, ...pathParts] = line.split('\t');
  const binary = additions === '-' || deletions === '-';

  return {
    path: pathParts.join('\t'),
    additions: binary ? 0 : Number(additions),
    deletions: binary ? 0 : Number(deletions),
    binary
  };
}
