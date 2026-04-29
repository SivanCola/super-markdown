import * as assert from "node:assert/strict";
import { analyzeMarkdownHealth, countUncheckedTasks } from "../markdown/health";

suite("health", () => {
  const levels = new Set([1, 2, 3, 4, 5, 6]);

  test("counts unchecked tasks", () => {
    assert.equal(countUncheckedTasks("- [ ] todo\n- [x] done\n  - [ ] nested"), 2);
  });

  test("reports structural issues", async () => {
    const issues = await analyzeMarkdownHealth("## First\n#### Jump\n## First\n- [ ] todo", { levels });
    assert.deepEqual(
      issues.map((issue) => issue.code),
      ["missing-h1", "skipped-heading-level", "duplicate-anchor", "unchecked-tasks"]
    );
  });

  test("reports broken local targets", async () => {
    const issues = await analyzeMarkdownHealth("# Title\n![Missing](missing.png)", {
      levels,
      fileExists: async () => false
    });
    assert.equal(issues.some((issue) => issue.code === "broken-image"), true);
  });
});
