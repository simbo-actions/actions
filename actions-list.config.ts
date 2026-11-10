import { defineConfig, type WorkspaceMetadata } from '@simbo/monorepo-packages-list-cli';

function filterWorkspaces(workspace: WorkspaceMetadata): boolean {
  return workspace.relativePath !== 'changelog';
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
    delimiter: '',
    templateFn: () => '',
  },
  {
    targetFile: 'ACTIONS.md',
    filterFn: filterWorkspaces,
    before: beforeTemplate,

    templateFn: async (workspace: WorkspaceMetadata): Promise<string> => {
      const { name, title, version, description } = workspace;

      const repoName = `simbo-actions/${name}`;
      const repoUrl = `https://github.com/${repoName}`;
      const readmeUrl = `${repoUrl}/blob/main/README.md`;
      const changelogUrl = `${repoUrl}/blob/main/CHANGELOG.md`;
      const tagsUrl = `${repoUrl}/tags`;

      const links: string[] = [
        `[Repository](${repoUrl})`,
        `[README.md](${readmeUrl})`,
        `[CHANGELOG.md](${changelogUrl})`,
        `[Tags](${tagsUrl})`,
      ];

      return [
        `- ### **${title}**`,
        `  > ${description}`,
        `  ⚙️ **\`${repoName}@<SHA> # v${version}\`**`,
        `  Latest Version: \`${version}\``,
        `  ${links.join('  •  ')}`,
      ].join('\n\n');
    },
  },
]);
