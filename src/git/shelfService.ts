import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GitService } from './gitService';

export interface Shelf {
  id: string;
  name: string;
  repositoryRoot: string;
  patchPath: string;
  createdAt: number;
}

export class ShelfService {
  public constructor(
    private readonly git: GitService,
    private readonly shelfRoot: string
  ) {}

  public async create(repositoryRoot: string, name: string): Promise<Shelf> {
    const patch = (await this.git.exec(repositoryRoot, ['diff', '--binary'])).stdout;

    if (patch.trim().length === 0) {
      throw new Error('No local changes to shelve.');
    }

    const createdAt = Date.now();
    const id = `${slugify(name)}-${createdAt}`;
    const directory = this.repositoryShelfDirectory(repositoryRoot);
    const patchPath = path.join(directory, `${id}.patch`);
    const metadataPath = path.join(directory, `${id}.json`);
    const shelf: Shelf = {
      id,
      name,
      repositoryRoot,
      patchPath,
      createdAt
    };

    await mkdir(directory, { recursive: true });
    await writeFile(patchPath, patch, 'utf8');
    await writeFile(metadataPath, JSON.stringify(shelf, null, 2), 'utf8');

    return shelf;
  }

  public async list(repositoryRoot: string): Promise<Shelf[]> {
    const directory = this.repositoryShelfDirectory(repositoryRoot);

    try {
      const entries = await readdir(directory);
      const shelves = await Promise.all(
        entries
          .filter((entry) => entry.endsWith('.json'))
          .map(async (entry) => JSON.parse(await readFile(path.join(directory, entry), 'utf8')) as Shelf)
      );

      return shelves.sort((left, right) => right.createdAt - left.createdAt);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  public async apply(repositoryRoot: string, shelfId: string): Promise<void> {
    const shelf = (await this.list(repositoryRoot)).find((candidate) => candidate.id === shelfId);

    if (shelf === undefined) {
      throw new Error(`Shelf not found: ${shelfId}`);
    }

    await this.git.exec(repositoryRoot, ['apply'], {
      input: await readFile(shelf.patchPath, 'utf8')
    });
  }

  private repositoryShelfDirectory(repositoryRoot: string): string {
    return path.join(this.shelfRoot, Buffer.from(repositoryRoot).toString('base64url'));
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'shelf';
}
