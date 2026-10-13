import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import manifest from "../package.json" with { type: "json" };

const require = createRequire(import.meta.url);
const plugin = require("../dist/server.js").default;
const host = createFakePluginHost({
  pluginId: "project-folders",
  agentSkillIds: ["project-folders"],
});
await plugin(host.bb);
try {
  host.bb.storage
    .database()
    .prepare("INSERT INTO preferences (key, data) VALUES (?, ?)")
    .run("status-build-check", JSON.stringify({ preserved: true }));
  const exported = await host.harness.behavior.callRpc("backup_export", null);
  assert.equal(exported.pluginVersion, manifest.version);
  await host.harness.behavior.callRpc("backup_import", { backup: exported });
  const restored = await host.harness.behavior.callRpc("backup_export", null);
  assert.deepEqual(restored.tables, exported.tables);

  for (const entry of ["app", "server", "host"]) {
    const metadata = JSON.parse(
      readFileSync(
        new URL(`../dist/${entry}.meta.json`, import.meta.url),
        "utf8",
      ),
    );
    assert.equal(metadata.pluginVersion, manifest.version);
  }
  const css = readFileSync(new URL("../dist/app.css", import.meta.url), "utf8");
  for (const color of ["green", "red"]) {
    assert.ok(css.includes(`.bg-${color}-600`));
  }
  assert.ok(css.includes(".text-yellow-600"));
  assert.ok(css.includes(".pf-status-running"));
  assert.ok(css.includes("@keyframes pf-status-spin"));
  assert.ok(css.includes("prefers-reduced-motion"));
  console.log(
    "Build verified: colored dots, version metadata and a lossless backup round-trip.",
  );
} finally {
  await host.harness.lifecycle.dispose();
}
