import { defineConfig, type WorkspaceMetadata } from '@simbo/monorepo-packages-list-cli';

function filterWorkspaces(workspace: WorkspaceMetadata): boolean {
  return workspace.relativePath.startsWith('actions/');
}

function getActionRepository(workspace: WorkspaceMetadata): string {
  return `simbo-actions/${workspace.name}`;
}

export default defineConfig([
  {
    targetFile: 'organization/profile/README.md',
    filterFn: filterWorkspaces,
    before: () => '',
    delimiter: '\n',
    templateFn: (workspace: WorkspaceMetadata): string =>
      `- [**${workspace.name}**](https://github.com/${getActionRepository(workspace)}): ${workspace.description}`,
  },
]);
