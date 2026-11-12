import { defineConfig, type WorkspaceMetadata } from '@simbo/monorepo-packages-list-cli';

function filterWorkspaces(workspace: WorkspaceMetadata): boolean {
  return workspace.relativePath.startsWith('actions/');
}

function getActionRepository(workspace: WorkspaceMetadata): string | undefined {
  return (workspace.packageJson as { actionRepository?: string }).actionRepository;
}

function formatCount(count: number): string {
  return `There ${count === 1 ? 'is' : 'are'} currently _**${count}**_ GitHub Action${count === 1 ? '' : 's'} managed in this repository.\n\n`;
}

function beforeTemplate(workspaces: WorkspaceMetadata[]): string {
  return formatCount(workspaces.length);
}

export default defineConfig([
  {
    targetFile: 'README.md',
    filterFn: filterWorkspaces,
    before: beforeTemplate,
    delimiter: '\n',
    templateFn: (workspace: WorkspaceMetadata): string => {
      const repository = getActionRepository(workspace);
      const url = repository
        ? `https://github.com/${repository}`
        : `https://github.com/simbo-actions/actions/tree/main/actions/${workspace.name}`;
      return `- [**${workspace.name}**](${url}): ${workspace.description}`;
    },
  },
  {
    targetFile: 'ACTIONS.md',
    filterFn: filterWorkspaces,
    before: beforeTemplate,

    templateFn: async (workspace: WorkspaceMetadata): Promise<string> => {
      const { name, title, version, description } = workspace;
      const actionRepository = getActionRepository(workspace);

      if (!actionRepository) {
        const sourceUrl = `https://github.com/simbo-actions/actions/tree/main/actions/${name}`;
        return [
          `- ### **${title}**`,
          `  > ${description}`,
          `  ⚙️ **\`simbo-actions/actions/actions/${name}@<SHA>\`**`,
          `  Not published to a repository of its own; use it from this monorepo.`,
          `  [Source](${sourceUrl})  •  [README.md](${sourceUrl}/README.md)`,
        ].join('\n\n');
      }

      const repoUrl = `https://github.com/${actionRepository}`;
      const links: string[] = [
        `[Repository](${repoUrl})`,
        `[README.md](${repoUrl}/blob/main/README.md)`,
        `[CHANGELOG.md](${repoUrl}/blob/main/CHANGELOG.md)`,
        `[Releases](${repoUrl}/releases)`,
      ];

      return [
        `- ### **${title}**`,
        `  > ${description}`,
        `  ⚙️ **\`${actionRepository}@<SHA> # v${version}\`**`,
        `  Latest Version: \`${version}\``,
        `  ${links.join('  •  ')}`,
      ].join('\n\n');
    },
  },
]);
