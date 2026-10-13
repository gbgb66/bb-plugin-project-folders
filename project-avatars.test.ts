import { expect, it } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server";
import { parseBackup } from "./backup";

it("sets and clears a project avatar without losing other appearance preferences, and survives reload/backup", async () => {
  const h = createFakePluginHost({
    pluginId: "project-folders",
    agentSkillIds: ["project-folders"],
    sdk: {
      projects: {
        list: async () =>
          [
            { id: "p1", name: "Neptune", kind: "standard", sources: [] },
          ] as never,
      },
    },
  });
  await plugin(h.bb);
  try {
    let call = h.harness.behavior.callRpc;
    await call("item_style_save", {
      key: "p:p1",
      style: { color: "teal", sort: "title", limit: 7, hidden: true },
    });
    await call("project_group_save", { name: "Olympus", projectIds: ["p1"] });
    const group = await call("project_groups_list", null);
    const result = await h.harness.behavior.runCli([
      "project-avatar",
      "p1",
      "neptune",
    ]);
    expect(result.exitCode).toBe(0);
    const read = async () =>
      ((await call("prefs_get", null)) as { items: Record<string, unknown> })
        .items["p:p1"];
    expect(await read()).toEqual({
      icon: "avatar:neptune",
      color: "teal",
      sort: "title",
      limit: 7,
      hidden: true,
    });
    const backup = parseBackup(await call("backup_export", null));
    Object.assign(h, await h.harness.lifecycle.reload(plugin));
    call = h.harness.behavior.callRpc;
    expect(await read()).toEqual({
      icon: "avatar:neptune",
      color: "teal",
      sort: "title",
      limit: 7,
      hidden: true,
    });
    await call("project_avatar_set", { projectId: "p1", avatarId: null });
    expect(await read()).toEqual({
      color: "teal",
      sort: "title",
      limit: 7,
      hidden: true,
    });
    await call("backup_import", { backup, mode: "replace" });
    expect(await read()).toEqual({
      icon: "avatar:neptune",
      color: "teal",
      sort: "title",
      limit: 7,
      hidden: true,
    });
    expect(await call("project_groups_list", null)).toEqual(group);
  } finally {
    await h.harness.lifecycle.dispose();
  }
});

it("refuses unknown avatar ids and projects without replacing saved styles", async () => {
  const h = createFakePluginHost({
    pluginId: "project-folders",
    agentSkillIds: ["project-folders"],
    sdk: {
      projects: {
        list: async () =>
          [{ id: "p1", kind: "standard", name: "Zeus", sources: [] }] as never,
      },
    },
  });
  await plugin(h.bb);
  try {
    const call = h.harness.behavior.callRpc;
    await call("item_style_save", { key: "p:p1", style: { icon: "icon:Zap" } });
    await expect(
      call("project_avatar_set", {
        projectId: "p1",
        avatarId: "https://example.com/picture",
      }),
    ).rejects.toThrow();
    await expect(
      call("project_avatar_set", { projectId: "missing", avatarId: "zeus" }),
    ).rejects.toThrow(/Project not found/);
    expect(
      ((await call("prefs_get", null)) as { items: Record<string, unknown> })
        .items["p:p1"],
    ).toEqual({ icon: "icon:Zap" });
    const result = await h.harness.behavior.runCli([
      "project-avatar",
      "p1",
      "unknown",
    ]);
    expect(result.exitCode).toBe(1);
  } finally {
    await h.harness.lifecycle.dispose();
  }
});
