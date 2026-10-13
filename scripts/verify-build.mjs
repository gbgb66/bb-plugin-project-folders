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
  sdk: {
    projects: {
      list: async () => [
        { id: "p-build", name: "Build project", kind: "standard", sources: [] },
      ],
    },
  },
});
await plugin(host.bb);
try {
  await host.harness.behavior.callRpc("project_avatar_set", {
    projectId: "p-build",
    avatarId: "zeus",
  });
  const group = await host.harness.behavior.callRpc("project_group_save", {
    name: "Build group",
    projectIds: ["p-build"],
  });
  assert.deepEqual(
    await host.harness.behavior.callRpc("project_groups_list", null),
    [group],
  );
  host.bb.storage
    .database()
    .prepare("INSERT INTO preferences (key, data) VALUES (?, ?)")
    .run("status-build-check", JSON.stringify({ preserved: true }));
  const exported = await host.harness.behavior.callRpc("backup_export", null);
  assert.equal(exported.pluginVersion, manifest.version);
  await host.harness.behavior.callRpc("project_group_remove", { id: group.id });
  await host.harness.behavior.callRpc("backup_import", { backup: exported });
  const restored = await host.harness.behavior.callRpc("backup_export", null);
  assert.deepEqual(restored.tables, exported.tables);
  const prefs = await host.harness.behavior.callRpc("prefs_get", null);
  assert.equal(prefs.items["p:p-build"].icon, "avatar:zeus");
  assert.deepEqual(
    await host.harness.behavior.callRpc("project_groups_list", null),
    [group],
  );

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
  assert.ok(css.includes(".pf-project-group"));
  assert.ok(css.includes(".pf-god-avatar"));
  const images = JSON.parse(
    readFileSync(
      new URL("../assets/gods/avatars.json", import.meta.url),
      "utf8",
    ),
  );
  const appJs = readFileSync(
    new URL("../dist/app.js", import.meta.url),
    "utf8",
  );
  assert.equal(Object.keys(images).length, 6);
  for (const [id, src] of Object.entries(images)) {
    const svg = readFileSync(
      new URL(`../assets/gods/${id}.svg`, import.meta.url),
    );
    assert.ok(svg.toString().includes('viewBox="0 0 32 32"'));
    assert.ok(!/<(?:image|script)\b/i.test(svg.toString()));
    assert.equal(src, "data:image/svg+xml;base64," + svg.toString("base64"));
    assert.ok(appJs.includes(src), `Missing bundled avatar ${id}`);
  }
  console.log(
    "Build verified: god avatars, project groups, thread indicators, version metadata and a lossless backup round-trip.",
  );
} finally {
  await host.harness.lifecycle.dispose();
}
