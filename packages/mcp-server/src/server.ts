import { stdin, stdout } from "node:process";

import {
  DEFAULT_COMMIT_MESSAGE,
  DEFAULT_PR_BASE_BRANCH,
  DEFAULT_PR_TITLE,
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_REPO_MAP_OUTPUT_PATH,
  DEFAULT_REVIEW_AUDIT_LOG_PATH,
  DEFAULT_STATUS_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  DYKNOW_CONFIG_FILE_NAME,
  createAuditLogReport,
  createCommitResult,
  createPrResult,
  createRepoDiff,
  createRepoMapSnapshot,
  createReviewUpdateBatch,
  createStatusReport,
  createUpdateDraftBatch,
  getProposal,
  listProposals,
} from "@dyknow/app";

const JSON_RPC_VERSION = "2.0";
const MCP_PROTOCOL_VERSION = "2024-11-05";

type JsonRpcId = number | string | null;

type JsonRpcRequest = {
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type ToolCallRequest = {
  name: string;
  arguments?: Record<string, unknown>;
};

export type DyknowMcpContext = {
  cwd: string;
};

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "dyknow_scan",
    description:
      "Scan the current repository and write the repo map snapshot artifact.",
    inputSchema: {
      type: "object",
      properties: {
        configPath: { type: "string", default: DYKNOW_CONFIG_FILE_NAME },
        outputPath: {
          type: "string",
          default: DEFAULT_REPO_MAP_OUTPUT_PATH,
        },
        failOn: {
          type: "array",
          items: {
            type: "string",
            enum: ["dependency-policy", "parse-error", "secret-pattern"],
          },
          default: [],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "dyknow_diff",
    description:
      "Compare the current repository to the saved repo map snapshot and write the repo diff artifact.",
    inputSchema: {
      type: "object",
      properties: {
        configPath: { type: "string", default: DYKNOW_CONFIG_FILE_NAME },
        snapshotPath: {
          type: "string",
          default: DEFAULT_REPO_MAP_OUTPUT_PATH,
        },
        outputPath: {
          type: "string",
          default: DEFAULT_REPO_DIFF_OUTPUT_PATH,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "dyknow_update",
    description:
      "Draft update proposals for affected pages and write the update batch artifact.",
    inputSchema: {
      type: "object",
      properties: {
        configPath: { type: "string", default: DYKNOW_CONFIG_FILE_NAME },
        diffPath: {
          type: "string",
          default: DEFAULT_REPO_DIFF_OUTPUT_PATH,
        },
        outputPath: {
          type: "string",
          default: DEFAULT_UPDATE_OUTPUT_PATH,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "dyknow_list_proposals",
    description:
      "Return a lightweight list view of update proposals from the current proposal batch.",
    inputSchema: {
      type: "object",
      properties: {
        inputPath: {
          type: "string",
          default: DEFAULT_UPDATE_OUTPUT_PATH,
        },
        states: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "Drafted",
              "Needs review",
              "Approved",
              "Rejected",
              "Edited",
              "Published",
              "Archived",
              "Escalated",
            ],
          },
          default: [],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "dyknow_get_proposal",
    description:
      "Return the full proposal, exact proposed text, and affected page details for one page id.",
    inputSchema: {
      type: "object",
      required: ["pageId"],
      properties: {
        inputPath: {
          type: "string",
          default: DEFAULT_UPDATE_OUTPUT_PATH,
        },
        pageId: {
          type: "string",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "dyknow_review_proposal",
    description:
      "Persist a review decision for one proposal, including approve, reject, escalate, edit, skip, and regenerate.",
    inputSchema: {
      type: "object",
      required: ["pageId", "decision"],
      properties: {
        inputPath: {
          type: "string",
          default: DEFAULT_UPDATE_OUTPUT_PATH,
        },
        outputPath: {
          type: "string",
          default: DEFAULT_UPDATE_OUTPUT_PATH,
        },
        pageId: {
          type: "string",
        },
        decision: {
          type: "string",
          enum: [
            "Approved",
            "Rejected",
            "Escalated",
            "Edited",
            "Skipped",
            "Regenerated",
          ],
        },
        proposedText: {
          type: "string",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "dyknow_log",
    description:
      "Read committed and runtime DyKnow audit logs and return the filtered report plus entry counts.",
    inputSchema: {
      type: "object",
      properties: {
        inputPath: {
          type: "string",
          default: DEFAULT_REVIEW_AUDIT_LOG_PATH,
        },
        limit: {
          type: "integer",
          default: 10,
          minimum: 1,
        },
        source: {
          type: "string",
          enum: ["all", "committed", "runtime"],
          default: "all",
        },
        action: {
          type: "string",
          enum: ["all", "review", "publish"],
          default: "all",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "dyknow_status",
    description:
      "Generate the HTML DyKnow progress status report from live repository state and current artifacts.",
    inputSchema: {
      type: "object",
      properties: {
        outputPath: {
          type: "string",
          default: DEFAULT_STATUS_OUTPUT_PATH,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "dyknow_commit",
    description:
      "Apply approved proposals, mark them published, append publish audit entries, and create one git commit.",
    inputSchema: {
      type: "object",
      properties: {
        inputPath: {
          type: "string",
          default: DEFAULT_UPDATE_OUTPUT_PATH,
        },
        message: {
          type: "string",
          default: DEFAULT_COMMIT_MESSAGE,
        },
        allowHighRisk: {
          type: "boolean",
          default: false,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "dyknow_open_pr",
    description:
      "Create a review branch, apply approved proposals, push it, open a GitHub pull request, and append runtime audit evidence.",
    inputSchema: {
      type: "object",
      properties: {
        inputPath: {
          type: "string",
          default: DEFAULT_UPDATE_OUTPUT_PATH,
        },
        base: {
          type: "string",
          default: DEFAULT_PR_BASE_BRANCH,
        },
        branch: {
          type: "string",
        },
        message: {
          type: "string",
          default: DEFAULT_COMMIT_MESSAGE,
        },
        title: {
          type: "string",
          default: DEFAULT_PR_TITLE,
        },
        allowHighRisk: {
          type: "boolean",
          default: false,
        },
      },
      additionalProperties: false,
    },
  },
];

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asFailOn(
  value: unknown,
): Array<"dependency-policy" | "parse-error" | "secret-pattern"> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is "dependency-policy" | "parse-error" | "secret-pattern" =>
      item === "dependency-policy" ||
      item === "parse-error" ||
      item === "secret-pattern",
  );
}

function asReviewStates(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item,
    ): item is
      | "Drafted"
      | "Needs review"
      | "Approved"
      | "Rejected"
      | "Edited"
      | "Published"
      | "Archived"
      | "Escalated" =>
      item === "Drafted" ||
      item === "Needs review" ||
      item === "Approved" ||
      item === "Rejected" ||
      item === "Edited" ||
      item === "Published" ||
      item === "Archived" ||
      item === "Escalated",
  );
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asPositiveInt(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function asLogSource(value: unknown) {
  if (value === "all" || value === "committed" || value === "runtime") {
    return value;
  }

  return "all";
}

function asLogAction(value: unknown) {
  if (value === "all" || value === "review" || value === "publish") {
    return value;
  }

  return "all";
}

function asReviewDecision(value: unknown) {
  if (
    value === "Approved" ||
    value === "Rejected" ||
    value === "Escalated" ||
    value === "Edited" ||
    value === "Skipped" ||
    value === "Regenerated"
  ) {
    return value;
  }

  return undefined;
}

function createTextResult(text: string, structuredContent: unknown) {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
    structuredContent,
  };
}

export function createToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

export async function handleToolCall(
  request: ToolCallRequest,
  context: DyknowMcpContext,
) {
  const args = request.arguments ?? {};

  if (request.name === "dyknow_scan") {
    const result = await createRepoMapSnapshot({
      cwd: context.cwd,
      configPath: asString(args.configPath, DYKNOW_CONFIG_FILE_NAME),
      outputPath: asString(args.outputPath, DEFAULT_REPO_MAP_OUTPUT_PATH),
      failOn: asFailOn(args.failOn),
    });

    return createTextResult(
      `Scanned ${result.repoMap.files.length} files and wrote ${result.outputPath}.`,
      {
        outputPath: result.outputPath,
        filesScanned: result.repoMap.files.length,
        warnings: result.repoMap.warnings.length,
      },
    );
  }

  if (request.name === "dyknow_diff") {
    const result = await createRepoDiff({
      cwd: context.cwd,
      configPath: asString(args.configPath, DYKNOW_CONFIG_FILE_NAME),
      snapshotPath: asString(args.snapshotPath, DEFAULT_REPO_MAP_OUTPUT_PATH),
      outputPath: asString(args.outputPath, DEFAULT_REPO_DIFF_OUTPUT_PATH),
    });

    return createTextResult(
      `Compared ${result.baseSnapshotPath} and wrote ${result.outputPath}.`,
      {
        outputPath: result.outputPath,
        baseSnapshotPath: result.baseSnapshotPath,
        summary: result.summary,
        affectedPages: result.affectedPages.map((page) => page.pageId),
      },
    );
  }

  if (request.name === "dyknow_update") {
    const result = await createUpdateDraftBatch({
      cwd: context.cwd,
      configPath: asString(args.configPath, DYKNOW_CONFIG_FILE_NAME),
      diffPath: asString(args.diffPath, DEFAULT_REPO_DIFF_OUTPUT_PATH),
      outputPath: asString(args.outputPath, DEFAULT_UPDATE_OUTPUT_PATH),
    });

    return createTextResult(
      `Drafted ${result.summary.draftedProposals} proposals and wrote ${result.outputPath}.`,
      {
        outputPath: result.outputPath,
        providerId: result.providerId,
        summary: result.summary,
        proposalStates: result.drafts.map((draft) => ({
          pageId: draft.proposal.pageId,
          reviewState: draft.proposal.reviewState,
          risk: draft.proposal.risk,
          confidence: draft.proposal.confidence,
        })),
      },
    );
  }

  if (request.name === "dyknow_list_proposals") {
    const result = await listProposals({
      cwd: context.cwd,
      inputPath: asString(args.inputPath, DEFAULT_UPDATE_OUTPUT_PATH),
      states: asReviewStates(args.states),
    });

    return createTextResult(
      `Loaded ${result.drafts.length} proposal summaries from ${result.inputPath}.`,
      {
        inputPath: result.inputPath,
        summary: {
          total: result.batch.drafts.length,
          matching: result.drafts.length,
        },
        proposals: result.drafts.map((draft) => ({
          pageId: draft.proposal.pageId,
          summary: draft.proposal.summary,
          reviewState: draft.proposal.reviewState,
          risk: draft.proposal.risk,
          confidence: draft.proposal.confidence,
          sources: draft.proposal.sources,
        })),
      },
    );
  }

  if (request.name === "dyknow_get_proposal") {
    const pageId = asString(args.pageId, "");

    if (pageId.length === 0) {
      throw new Error("dyknow_get_proposal requires a pageId.");
    }

    const result = await getProposal({
      cwd: context.cwd,
      inputPath: asString(args.inputPath, DEFAULT_UPDATE_OUTPUT_PATH),
      pageId,
    });

    return createTextResult(
      `Loaded the full proposal for ${result.draft.proposal.pageId}.`,
      {
        inputPath: result.inputPath,
        affectedPage: result.draft.affectedPage,
        proposal: result.draft.proposal,
      },
    );
  }

  if (request.name === "dyknow_review_proposal") {
    const pageId = asString(args.pageId, "");
    const decision = asReviewDecision(args.decision);

    if (pageId.length === 0) {
      throw new Error("dyknow_review_proposal requires a pageId.");
    }

    if (!decision) {
      throw new Error("dyknow_review_proposal requires a valid decision.");
    }

    const proposedText = asString(args.proposedText, "");

    if (decision === "Edited" && proposedText.length === 0) {
      throw new Error(
        "dyknow_review_proposal requires proposedText when decision is Edited.",
      );
    }

    const result = await createReviewUpdateBatch({
      all: false,
      cwd: context.cwd,
      decision,
      ...(decision === "Edited" ? { editText: proposedText } : {}),
      launchEditor: false,
      inputPath: asString(args.inputPath, DEFAULT_UPDATE_OUTPUT_PATH),
      outputPath: asString(args.outputPath, DEFAULT_UPDATE_OUTPUT_PATH),
      pageIds: [pageId],
    });

    return createTextResult(`Applied ${decision} to ${pageId}.`, {
      outputPath: result.outputPath,
      decision,
      updatedProposals: result.updatedProposals,
      summary: result.summary,
    });
  }

  if (request.name === "dyknow_log") {
    const result = await createAuditLogReport({
      cwd: context.cwd,
      inputPath: asString(args.inputPath, DEFAULT_REVIEW_AUDIT_LOG_PATH),
      limit: asPositiveInt(args.limit, 10),
      source: asLogSource(args.source),
      action: asLogAction(args.action),
    });

    return createTextResult(result.report, {
      inputPath: result.inputPath,
      shownEntries: result.shownEntries,
      totalEntries: result.totalEntries,
      report: result.report,
    });
  }

  if (request.name === "dyknow_status") {
    const result = await createStatusReport({
      cwd: context.cwd,
      outputPath: asString(args.outputPath, DEFAULT_STATUS_OUTPUT_PATH),
    });

    return createTextResult(
      `Generated status report at ${result.outputPath}.`,
      {
        outputPath: result.outputPath,
      },
    );
  }

  if (request.name === "dyknow_commit") {
    const result = await createCommitResult({
      cwd: context.cwd,
      inputPath: asString(args.inputPath, DEFAULT_UPDATE_OUTPUT_PATH),
      message: asString(args.message, DEFAULT_COMMIT_MESSAGE),
      allowHighRisk: asBoolean(args.allowHighRisk, false),
    });

    return createTextResult(
      `Created commit ${result.commitHash} from approved proposals.`,
      {
        inputPath: result.inputPath,
        commitHash: result.commitHash,
        publishedProposals: result.publishedProposals,
      },
    );
  }

  if (request.name === "dyknow_open_pr") {
    const branch = asString(args.branch, "");
    const result = await createPrResult({
      cwd: context.cwd,
      inputPath: asString(args.inputPath, DEFAULT_UPDATE_OUTPUT_PATH),
      base: asString(args.base, DEFAULT_PR_BASE_BRANCH),
      ...(branch.length > 0 ? { branch } : {}),
      message: asString(args.message, DEFAULT_COMMIT_MESSAGE),
      title: asString(args.title, DEFAULT_PR_TITLE),
      allowHighRisk: asBoolean(args.allowHighRisk, false),
    });

    return createTextResult(
      `Opened PR ${result.url} from branch ${result.branch}.`,
      {
        base: result.base,
        branch: result.branch,
        commitHash: result.commitHash,
        publishedProposals: result.publishedProposals,
        url: result.url,
      },
    );
  }

  throw new Error(`Unknown tool: ${request.name}`);
}

function createSuccessResponse(
  id: JsonRpcId,
  result: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    result,
  };
}

function createErrorResponse(
  id: JsonRpcId,
  code: number,
  message: string,
): JsonRpcResponse {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    error: {
      code,
      message,
    },
  };
}

export async function handleJsonRpcRequest(
  request: JsonRpcRequest,
  context: DyknowMcpContext,
): Promise<JsonRpcResponse | null> {
  if (request.method === "notifications/initialized") {
    return null;
  }

  const id = request.id ?? null;

  try {
    if (request.method === "initialize") {
      return createSuccessResponse(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "dyknow-mcp",
          version: "0.1.0",
        },
      });
    }

    if (request.method === "tools/list") {
      return createSuccessResponse(id, {
        tools: createToolDefinitions(),
      });
    }

    if (request.method === "tools/call") {
      const toolName = request.params?.name;

      if (typeof toolName !== "string") {
        return createErrorResponse(id, -32602, "Missing tool name.");
      }

      const result = await handleToolCall(
        {
          name: toolName,
          ...((request.params?.arguments &&
          typeof request.params.arguments === "object"
            ? {
                arguments: request.params.arguments as Record<string, unknown>,
              }
            : {}) as Partial<ToolCallRequest>),
        },
        context,
      );

      return createSuccessResponse(id, result);
    }

    return createErrorResponse(id, -32601, `Unknown method: ${request.method}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown MCP server error.";
    return createErrorResponse(id, -32000, message);
  }
}

function writeMessage(message: JsonRpcResponse) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  stdout.write(`Content-Length: ${body.byteLength}\r\n\r\n`);
  stdout.write(body);
}

function parseMessages(buffer: string) {
  const messages: Array<{ request: JsonRpcRequest; bytesConsumed: number }> =
    [];
  let offset = 0;

  while (offset < buffer.length) {
    const headerEnd = buffer.indexOf("\r\n\r\n", offset);

    if (headerEnd === -1) {
      break;
    }

    const header = buffer.slice(offset, headerEnd);
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/iu);

    if (!lengthMatch) {
      throw new Error("Missing Content-Length header.");
    }

    const contentLength = Number.parseInt(lengthMatch[1] ?? "0", 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + contentLength;

    if (buffer.length < bodyEnd) {
      break;
    }

    const rawBody = buffer.slice(bodyStart, bodyEnd);
    const request = JSON.parse(rawBody) as JsonRpcRequest;

    messages.push({
      request,
      bytesConsumed: bodyEnd - offset,
    });
    offset = bodyEnd;
  }

  return { messages, remainder: buffer.slice(offset) };
}

export function startStdioServer(context: DyknowMcpContext) {
  stdin.setEncoding("utf8");
  let buffer = "";

  stdin.on("data", async (chunk: string) => {
    buffer += chunk;

    try {
      const parsed = parseMessages(buffer);
      buffer = parsed.remainder;

      for (const message of parsed.messages) {
        const response = await handleJsonRpcRequest(message.request, context);

        if (response) {
          writeMessage(response);
        }
      }
    } catch (error) {
      const response = createErrorResponse(
        null,
        -32700,
        error instanceof Error ? error.message : "Failed to parse request.",
      );
      writeMessage(response);
      buffer = "";
    }
  });
}

export {
  DEFAULT_COMMIT_MESSAGE,
  DEFAULT_PR_BASE_BRANCH,
  DEFAULT_PR_TITLE,
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_REPO_MAP_OUTPUT_PATH,
  DEFAULT_STATUS_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  DYKNOW_CONFIG_FILE_NAME,
};
