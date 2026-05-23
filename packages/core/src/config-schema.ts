import {
  DEFAULT_IGNORED_SOURCE_PATTERNS,
  DYKNOW_CONFIG_FILE_NAME,
  DYKNOW_CONFIG_SCHEMA_FILE_NAME,
  LlmProviderSchema,
} from "./config.js";
import { AudienceSchema } from "./contracts.js";

function buildPageDefinitionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "id",
      "title",
      "outputPath",
      "audience",
      "sources",
      "reviewRules",
    ],
    properties: {
      id: {
        type: "string",
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      },
      title: {
        type: "string",
        minLength: 1,
      },
      outputPath: {
        type: "string",
        minLength: 1,
      },
      audience: {
        type: "string",
        enum: [...AudienceSchema.options],
      },
      sources: {
        type: "array",
        minItems: 1,
        items: {
          type: "string",
          minLength: 1,
        },
      },
      reviewRules: {
        type: "object",
        additionalProperties: false,
        required: ["approvalRequired"],
        properties: {
          approvalRequired: {
            type: "boolean",
          },
        },
      },
    },
  };
}

export function buildDyknowConfigJsonSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "DyKnow Config",
    description: "Configuration for DyKnow Local repositories.",
    type: "object",
    additionalProperties: false,
    required: [
      "projectName",
      "mode",
      "allowedSources",
      "pages",
      "approvalRequired",
      "llmProvider",
      "publishTargets",
    ],
    properties: {
      $schema: {
        type: "string",
        description: `Path to the local ${DYKNOW_CONFIG_SCHEMA_FILE_NAME} file.`,
      },
      projectName: {
        type: "string",
        minLength: 1,
      },
      mode: {
        type: "string",
        enum: ["local-only", "connected"],
      },
      allowedSources: {
        type: "array",
        minItems: 1,
        items: {
          type: "string",
          minLength: 1,
        },
      },
      ignoredSources: {
        type: "array",
        default: [...DEFAULT_IGNORED_SOURCE_PATTERNS],
        items: {
          type: "string",
          minLength: 1,
        },
      },
      pages: {
        type: "array",
        minItems: 1,
        items: buildPageDefinitionSchema(),
      },
      approvalRequired: {
        type: "boolean",
        default: true,
      },
      llmProvider: {
        type: "string",
        enum: [...LlmProviderSchema.options],
      },
      publishTargets: {
        type: "array",
        default: [],
        items: {
          type: "string",
          minLength: 1,
        },
      },
    },
    allOf: [
      {
        if: {
          required: ["mode"],
          properties: {
            mode: {
              const: "local-only",
            },
          },
        },
        // biome-ignore lint/suspicious/noThenProperty: JSON Schema uses then/if keywords.
        then: {
          properties: {
            llmProvider: {
              const: "local",
            },
            publishTargets: {
              maxItems: 0,
            },
          },
        },
      },
    ],
    examples: [
      {
        $schema: `./${DYKNOW_CONFIG_SCHEMA_FILE_NAME}`,
        projectName: "DyKnow",
        mode: "local-only",
        allowedSources: ["README.md", "docs/**", "packages/**", ".github/**"],
        ignoredSources: [...DEFAULT_IGNORED_SOURCE_PATTERNS],
        pages: [
          {
            id: "agent-context",
            title: "AI Agent Context",
            outputPath: "AGENTS.md",
            audience: "agent",
            sources: ["README.md", "docs/**", "packages/**"],
            reviewRules: {
              approvalRequired: true,
            },
          },
        ],
        approvalRequired: true,
        llmProvider: "local",
        publishTargets: [],
      },
    ],
    $comment: `${DYKNOW_CONFIG_FILE_NAME} should reference this schema via its $schema property.`,
  };
}

export function renderDyknowConfigJsonSchema(): string {
  return `${JSON.stringify(buildDyknowConfigJsonSchema(), null, 2)}\n`;
}
