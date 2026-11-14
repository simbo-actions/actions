import { info } from '@actions/core';

import { HTTP_STATUS_NOT_FOUND, ITEMS_PER_PAGE } from './apply-repository-settings-constants.js';
import type { SettingChange } from './apply-repository-settings.types.js';
import type { Octokit } from './create-octokit.js';

export type { Octokit } from './create-octokit.js';

/**
 * Reads and writes the settings of one repository. Every change is recorded;
 * in a dry run, no write request is sent.
 */
export class SettingsClient {
  /**
   * The changes applied, or to apply in a dry run.
   */
  public readonly changes: SettingChange[] = [];

  private readonly octokit: Octokit;
  private readonly parameters: { owner: string; repo: string };
  private readonly dryRun: boolean;

  /**
   * Creates the client.
   *
   * @param octokit - The Octokit client with administration permission.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param dryRun - Whether to only record writes.
   */
  public constructor(octokit: Octokit, owner: string, repo: string, dryRun: boolean) {
    this.octokit = octokit;
    this.parameters = { owner, repo };
    this.dryRun = dryRun;
  }

  /**
   * Reads a setting.
   *
   * @param route - The API route, for example `GET /repos/{owner}/{repo}`.
   * @param options - Additional request parameters.
   * @returns The response data.
   */
  public async read<T>(route: string, options: Record<string, unknown> = {}): Promise<T> {
    const response = await this.octokit.request(route, { ...this.parameters, ...options });
    return response.data as T;
  }

  /**
   * Reads all pages of a list.
   *
   * @param route - The API route, for example `GET /repos/{owner}/{repo}/labels`.
   * @param key - The key of the list in the response, or `undefined` if the response is the list.
   * @param options - Additional request parameters.
   * @returns The items of all pages.
   */
  public async readAll<T>(route: string, key?: string, options: Record<string, unknown> = {}): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; ; page++) {
      const data = await this.read<unknown>(route, { ...options, per_page: ITEMS_PER_PAGE, page });
      const pageItems = (key === undefined ? data : (data as Record<string, unknown>)[key]) as T[];
      items.push(...pageItems);
      if (pageItems.length < ITEMS_PER_PAGE) {
        return items;
      }
    }
  }

  /**
   * Checks whether a setting that responds with 204 (on) or 404 (off) is enabled.
   *
   * @param route - The API route.
   * @returns `true` for 204, `false` for 404.
   * @throws {Error} for other errors.
   */
  public async isEnabled(route: string): Promise<boolean> {
    try {
      await this.read(route);
      return true;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === HTTP_STATUS_NOT_FOUND) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Records a change for the log and the output.
   *
   * @param change - The change.
   */
  public record(change: SettingChange): void {
    this.changes.push(change);
    info(`${this.dryRun ? 'Would change' : 'Changing'} ${change.setting}: ${change.change}`);
  }

  /**
   * Sends a write request, unless this is a dry run.
   *
   * @param route - The API route, for example `PATCH /repos/{owner}/{repo}`.
   * @param options - Additional request parameters.
   */
  public async write(route: string, options: Record<string, unknown> = {}): Promise<void> {
    if (this.dryRun) {
      return;
    }
    await this.octokit.request(route, { ...this.parameters, ...options });
  }
}
