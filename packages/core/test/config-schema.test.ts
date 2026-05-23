import { describe, expect, it } from "vitest";

import {
  DYKNOW_CONFIG_SCHEMA_FILE_NAME,
  buildDyknowConfigJsonSchema,
  createInitialDyknowConfig,
  renderDyknowConfig,
  renderDyknowConfigJsonSchema,
} from "../src/index.js";

describe("DyKnow config schema helpers", () => {
  it("builds a JSON Schema with local-only safeguards", () => {
    const schema = buildDyknowConfigJsonSchema();

    expect(schema.properties).toHaveProperty("projectName");
    expect(schema.properties).toHaveProperty("pages");
    expect(schema.allOf).toHaveLength(1);
  });

  it("renders a config file that points at the local schema", () => {
    const rendered = renderDyknowConfig(createInitialDyknowConfig());
    const parsed = JSON.parse(rendered) as {
      $schema?: string;
      projectName: string;
    };

    expect(parsed.$schema).toBe(`./${DYKNOW_CONFIG_SCHEMA_FILE_NAME}`);
    expect(parsed.projectName).toBe("DyKnow");
  });

  it("renders the JSON schema as parseable JSON text", () => {
    const rendered = renderDyknowConfigJsonSchema();
    const parsed = JSON.parse(rendered) as { title: string };

    expect(parsed.title).toBe("DyKnow Config");
  });
});
