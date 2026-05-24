import { execFile } from "node:child_process";
import { lstat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

import type {
  AffectedPage,
  DraftedPageUpdate,
  PageDefinition,
} from "@dyknow/core";

const execFileAsync = promisify(execFile);
const SHELL_CONTROL_CHARACTERS = new Set(["&", "|", ";", "<", ">", "`"]);

type ParsedCommand = {
  baseArgs: string[];
  executable: string;
};

type PageTarget = Pick<PageDefinition, "id" | "outputPath">;
type AffectedPageTarget = Pick<AffectedPage, "pageId" | "outputPath">;
type DraftTarget = Pick<DraftedPageUpdate, "affectedPage" | "proposal">;

function isPathInsideDirectory(parentPath: string, childPath: string): boolean {
  const normalizedParent = resolve(parentPath);
  const normalizedChild = resolve(childPath);
  const relativePath = relative(normalizedParent, normalizedChild);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

async function assertNoSymlinkTraversal(
  rootPath: string,
  absolutePath: string,
  label: string,
) {
  const relativePath = relative(rootPath, absolutePath);

  if (relativePath === "") {
    return;
  }

  const segments = relativePath
    .split(/[/\\]+/u)
    .filter((segment) => segment.length > 0);
  let currentPath = rootPath;

  for (const segment of segments) {
    currentPath = resolve(currentPath, segment);

    try {
      const stats = await lstat(currentPath);

      if (stats.isSymbolicLink()) {
        throw new Error(
          `${label} cannot traverse symlinks. Refusing to use ${currentPath}.`,
        );
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }

      throw error;
    }
  }
}

function parseCommand(commandText: string, label: string): ParsedCommand {
  const trimmedCommand = commandText.trim();

  if (trimmedCommand.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }

  const tokens: string[] = [];
  let currentToken = "";
  let quoteCharacter: '"' | "'" | undefined;

  for (const character of trimmedCommand) {
    if (character === "\0" || character === "\n" || character === "\r") {
      throw new Error(`${label} contains unsupported control characters.`);
    }

    if (!quoteCharacter && SHELL_CONTROL_CHARACTERS.has(character)) {
      throw new Error(
        `${label} must not contain shell control operators. Use a single executable plus arguments instead.`,
      );
    }

    if (character === '"' || character === "'") {
      if (quoteCharacter === character) {
        quoteCharacter = undefined;
        continue;
      }

      if (!quoteCharacter) {
        quoteCharacter = character;
        continue;
      }
    }

    if (!quoteCharacter && /\s/u.test(character)) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = "";
      }

      continue;
    }

    currentToken += character;
  }

  if (quoteCharacter) {
    throw new Error(`${label} contains an unterminated quoted argument.`);
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  const [executable, ...baseArgs] = tokens;

  if (!executable) {
    throw new Error(`${label} must include an executable.`);
  }

  return {
    baseArgs,
    executable,
  };
}

async function resolveWindowsExecutable(command: string, cwd: string) {
  if (
    command.includes("/") ||
    command.includes("\\") ||
    /^[A-Za-z]:/u.test(command)
  ) {
    return resolve(cwd, command);
  }

  try {
    const result = await execFileAsync("where.exe", [command], {
      cwd,
      encoding: "utf8",
    });
    const resolvedPath = result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    return resolvedPath ?? command;
  } catch {
    return command;
  }
}

export async function resolveWorkspacePath(
  rootPath: string,
  candidatePath: string,
  label: string,
) {
  const absolutePath = resolve(rootPath, candidatePath);

  if (!isPathInsideDirectory(rootPath, absolutePath)) {
    throw new Error(
      `${label} must stay within the workspace root. Received ${candidatePath}.`,
    );
  }

  await assertNoSymlinkTraversal(rootPath, absolutePath, label);
  return absolutePath;
}

export function assertAffectedPageMatchesConfiguredPage(
  page: PageTarget,
  affectedPage: AffectedPageTarget,
  label: string,
) {
  if (affectedPage.pageId !== page.id) {
    throw new Error(
      `${label} references page "${affectedPage.pageId}" but the current config expects "${page.id}".`,
    );
  }

  if (affectedPage.outputPath !== page.outputPath) {
    throw new Error(
      `${label} for page "${page.id}" does not match the configured output path "${page.outputPath}".`,
    );
  }
}

export function assertDraftMatchesConfiguredPage(
  draft: DraftTarget,
  page: PageTarget,
  label: string,
) {
  if (draft.proposal.pageId !== page.id) {
    throw new Error(
      `${label} references page "${draft.proposal.pageId}" but the current config expects "${page.id}".`,
    );
  }

  assertAffectedPageMatchesConfiguredPage(page, draft.affectedPage, label);
}

export async function assertValidGitBranchName(
  cwd: string,
  branchName: string,
  label: string,
) {
  try {
    await execFileAsync("git", ["check-ref-format", "--branch", branchName], {
      cwd,
      encoding: "utf8",
    });
  } catch {
    throw new Error(
      `Invalid ${label} "${branchName}". Provide a valid git branch name.`,
    );
  }
}

export async function runConfiguredCommand(options: {
  args: readonly string[];
  commandText: string;
  cwd: string;
  label: string;
}) {
  const parsedCommand = parseCommand(options.commandText, options.label);
  let executable = parsedCommand.executable;

  if (process.platform === "win32") {
    executable = await resolveWindowsExecutable(executable, options.cwd);

    if (/\.(cmd|bat)$/iu.test(executable)) {
      throw new Error(
        `${options.label} must point to a native executable on Windows, not a .cmd or .bat wrapper.`,
      );
    }
  }

  const result = await execFileAsync(
    executable,
    [...parsedCommand.baseArgs, ...options.args],
    {
      cwd: options.cwd,
      encoding: "utf8",
    },
  );

  return result.stdout.trim();
}

export { isPathInsideDirectory };
