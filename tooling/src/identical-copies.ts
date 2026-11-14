/**
 * Checks that all copies of a file are identical.
 *
 * @param name - The file name, for the problem message.
 * @param copies - The contents of every copy, by path.
 * @returns The problems found, empty if all copies match the first one.
 */
export function checkIdenticalCopies(name: string, copies: Record<string, string>): string[] {
  const [first, ...others] = Object.entries(copies);
  return others
    .filter(([, content]) => content !== first[1])
    .map(([path]) => `${path}: differs from ${first[0]}; keep all copies of ${name} identical.`);
}
