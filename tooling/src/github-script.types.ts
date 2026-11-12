/**
 * The parts of `@actions/core` the scripts use, as provided by `actions/github-script`.
 */
export interface Core {
  info: (message: string) => void;
  warning: (message: string) => void;
  setOutput: (name: string, value: unknown) => void;
}

/**
 * A response of the GitHub API.
 */
export interface ApiResponse<T> {
  data: T;
}

/**
 * The parts of the Octokit client the scripts use, as provided by `actions/github-script`.
 */
export interface GitHub {
  request: <T = unknown>(
    route: string | Record<string, unknown>,
    parameters?: Record<string, unknown>,
  ) => Promise<ApiResponse<T>>;
  paginate: <T = unknown>(route: string, parameters?: Record<string, unknown>) => Promise<T[]>;
}
