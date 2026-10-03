export type RedirectedPage = {
  from: string;
  pageId: string;
  to: string;
};

/**
 * Where a page is written instead when its default output file already
 * exists. A path inside DyKnow's own namespace, so scaffolding a page never
 * targets a file somebody else wrote.
 */
export function getProtectedOutputPath(pageId: string): string {
  return `docs/dyknow/${pageId}.md`;
}

/**
 * `dyknow init` scaffolds pages whose default output paths (for example
 * `AGENTS.md` or `docs/architecture.md`) may already hold hand-written files.
 * Approving such a page and running `dyknow commit` replaces the whole file,
 * so redirect any page whose output file exists to a DyKnow-owned path and
 * report it. A user who wants DyKnow to maintain the existing file can point
 * `outputPath` back at it in `dyknow.config.json`.
 */
export async function redirectExistingPageOutputs<
  Page extends { id: string; outputPath: string },
>(
  pages: readonly Page[],
  exists: (path: string) => Promise<boolean>,
): Promise<{ pages: Page[]; redirected: RedirectedPage[] }> {
  const redirected: RedirectedPage[] = [];
  const safePages: Page[] = [];

  for (const page of pages) {
    const to = getProtectedOutputPath(page.id);
    if (page.outputPath !== to && (await exists(page.outputPath))) {
      redirected.push({ from: page.outputPath, pageId: page.id, to });
      safePages.push({ ...page, outputPath: to });
    } else {
      safePages.push(page);
    }
  }

  return { pages: safePages, redirected };
}

export function formatRedirectNotice(redirect: RedirectedPage): string {
  return `Kept existing ${redirect.from}: the "${redirect.pageId}" page will write to ${redirect.to} instead. To let DyKnow maintain ${redirect.from}, set that page's outputPath back to it in dyknow.config.json.`;
}
