import { describe, expect, it } from "vitest";

import {
  createInitialDyknowConfig,
  getDefaultUpdatePromptTemplate,
  getMissingDefaultUpdatePromptTemplates,
  listDefaultUpdatePromptTemplates,
} from "../src/index.js";

describe("update prompt templates", () => {
  it("covers every default maintained page", () => {
    const config = createInitialDyknowConfig();

    expect(getMissingDefaultUpdatePromptTemplates(config.pages)).toEqual([]);
    expect(listDefaultUpdatePromptTemplates()).toHaveLength(5);

    for (const page of config.pages) {
      expect(getDefaultUpdatePromptTemplate(page.id)?.pageId).toBe(page.id);
    }
  });
});
