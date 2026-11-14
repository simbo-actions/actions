import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * A temporary Git repository for tests.
 */
export interface GitFixture {
  dir: string;
  git: (...args: string[]) => string;
  write: (path: string, contents: string) => Promise<void>;
  cleanup: () => Promise<void>;
}

/**
 * Runs Git with a neutral configuration.
 *
 * @param cwd - The working directory.
 * @param args - The Git arguments.
 * @returns The trimmed standard output.
 */
export function runGit(cwd: string, ...args: string[]): string {
  return execFileSync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'tag.gpgsign=false',
      ...args,
    ],
    { cwd, encoding: 'utf8' },
  ).trim();
}

/**
 * Creates a temporary directory.
 *
 * @returns The absolute path.
 */
export async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'signed-commit-'));
}

/**
 * Creates the fixture helpers for a directory.
 *
 * @param dir - The directory.
 * @returns The fixture.
 */
function toFixture(dir: string): GitFixture {
  return {
    dir,
    git: (...args: string[]): string => runGit(dir, ...args),
    write: async (path: string, contents: string): Promise<void> => {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), contents);
    },
    cleanup: async () => rm(dir, { recursive: true, force: true }),
  };
}

/**
 * Creates a temporary Git repository, optionally with an initial commit.
 *
 * @param files - Files of the initial commit; no commit if omitted.
 * @returns The fixture.
 */
export async function createGitFixture(files?: Record<string, string>): Promise<GitFixture> {
  const fixture = toFixture(await createTempDir());
  const { git, write } = fixture;

  git('init', '--quiet', '--initial-branch=main');

  if (files) {
    for (const [path, contents] of Object.entries(files)) {
      await write(path, contents);
    }
    git('add', '--all');
    git('commit', '--quiet', '--allow-empty', '-m', 'initial');
  }

  return fixture;
}

/**
 * Clones a repository into a temporary directory.
 *
 * @param source - The path or URL of the repository to clone.
 * @param options - Additional `git clone` options.
 * @returns The fixture of the clone.
 */
export async function cloneGitFixture(source: string, ...options: string[]): Promise<GitFixture> {
  const fixture = toFixture(await createTempDir());
  fixture.git('clone', '--quiet', ...options, source, '.');
  return fixture;
}
