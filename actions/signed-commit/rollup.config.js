import { getConfig } from '@simbo/rollup-github-actions-config';

export default getConfig({
  knownWarnings: {
    CIRCULAR_DEPENDENCY: [
      '/@actions/core/', // has circular dependencies within its oidc module.
      '/execa/', // has circular dependencies within its ipc module.
    ],
  },
});
