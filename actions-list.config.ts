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
      const { name, version, description } = workspace;
      // The title is the first heading of the README; the suffix belongs there only.
      const title = workspace.title.replace(/\s*_\(GitHub Action\)_$/, '');

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
        // No-break spaces around the bullet: Prettier wraps only after it, and
        // GitHub renders the links on one line.
        `  ${links.join('\u00A0\u00A0•\u00A0 ')}`,
      ].join('\n\n');
    },
  },
]);
