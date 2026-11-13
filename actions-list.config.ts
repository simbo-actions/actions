import { defineConfig, type WorkspaceMetadata } from '@simbo/monorepo-packages-list-cli';

function filterWorkspaces(workspace: WorkspaceMetadata): boolean {
  return workspace.relativePath.startsWith('actions/');
}

function formatCount(count: number): string {
  return `There ${count === 1 ? 'is' : 'are'} currently _**${count}**_ GitHub Action${count === 1 ? '' : 's'} in this organization.\n\n`;
}

export default defineConfig([
  {
    targetFile: 'organization/profile/README.md',
    filterFn: filterWorkspaces,
    before: (workspaces: WorkspaceMetadata[]): string => formatCount(workspaces.length),

    templateFn: (workspace: WorkspaceMetadata): string => {
      const { name, title, version, description } = workspace;

      const repoName = `simbo-actions/${name}`;
      const repoUrl = `https://github.com/${repoName}`;

      const links: string[] = [
        `[Repository](${repoUrl})`,
        `[README.md](${repoUrl}/blob/main/README.md)`,
        `[CHANGELOG.md](${repoUrl}/blob/main/CHANGELOG.md)`,
        `[Releases](${repoUrl}/releases)`,
      ];

      return [
        `- ### **${title}**`,
        `  > ${description}`,
        `  ⚙️ **\`${repoName}@<SHA> # v${version}\`**`,
        `  Latest Version: \`${version}\``,
        // One link per line; the no-break space keeps the bullet next to its link.
        `  ${links.join('\u00A0•  \n  ')}`,
      ].join('\n\n');
    },
  },
]);
