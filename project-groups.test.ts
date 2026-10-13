import { describe, it, expect, vi } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server";
import { makeProjectGroups, type ProjectGroup } from "./project-groups";
import { parseBackup } from "./backup";

const projects = ["Neptune", "Zeus", "Other"]
  .map((name, i) => ({
    id: `p${i + 1}`,
    name,
    kind: "standard",
    sources: [
      {
        type: "local_path",
        hostId: "h1",
        path: `/work/${name}`,
        isDefault: true,
      },
    ],
  }))
  .concat([
    { id: "personal", name: "Personal", kind: "personal", sources: [] },
  ]);
async function setup() {
  const writes = vi.fn(async () => ({}) as never);
  const update = vi.fn();
  const h = createFakePluginHost({
    pluginId: "project-folders",
    agentSkillIds: ["project-folders"],
    sdk: {
      projects: { list: async () => projects as never, update },
      hosts: {
        list: async () =>
          [{ id: "h1", name: "Mac", status: "connected" }] as never,
      },
      files: { mkdir: writes, write: writes },
      environments: { list: async () => [] },
    },
  });
  await plugin(h.bb);
  return { ...h, writes, update };
}

describe("project groups metadata", () => {
  it("moves membership exclusively, supports rename, and dissolves without touching project records", () => {
    let data: string | undefined;
    let n = 0;
    const groups = makeProjectGroups({
      read: () => data,
      write: (value) => {
        data = value;
      },
      newId: () => `g${++n}`,
    });
    const olympus = groups.save({
      name: " Olympus ",
      projectIds: ["p1", "p2"],
    });
    const other = groups.save({ name: "Other", projectIds: ["p2"] });
    expect(groups.list()).toEqual([{ ...olympus, projectIds: ["p1"] }, other]);
    groups.place({ projectId: "p2", groupId: olympus.id });
    groups.place({ projectId: "p1", groupId: null });
    expect(
      groups.save({ id: olympus.id, name: "Олимп", projectIds: ["p2"] }).name,
    ).toBe("Олимп");
    groups.remove({ id: olympus.id });
    expect(groups.list()).toEqual([{ ...other, projectIds: [] }]);
  });
  it("rejects duplicate names, missing groups and repeated members without writing", () => {
    let data: string | undefined;
    const write = vi.fn((value: string) => {
      data = value;
    });
    const groups = makeProjectGroups({
      read: () => data,
      write,
      newId: () => "g1",
    });
    groups.save({ name: "Olympus", projectIds: ["p1"] });
    write.mockClear();
    expect(() => groups.save({ name: "olympus", projectIds: [] })).toThrow(
      /already exists/,
    );
    expect(() =>
      groups.save({ name: "Other", projectIds: ["p1", "p1"] }),
    ).toThrow(/only once/);
    expect(() =>
      groups.save({ id: "missing", name: "Other", projectIds: [] }),
    ).toThrow(/not found/);
    expect(() => groups.place({ projectId: "p1", groupId: "missing" })).toThrow(
      /not found/,
    );
    expect(write).not.toHaveBeenCalled();
  });
  it("refuses corrupt saved metadata instead of silently replacing it", () => {
    const write = vi.fn();
    const groups = makeProjectGroups({
      read: () => "{invalid",
      write,
      newId: () => "g1",
    });
    expect(() => groups.save({ name: "Olympus", projectIds: [] })).toThrow(
      /invalid/,
    );
    expect(write).not.toHaveBeenCalled();
  });
});

describe("project group RPC and CLI", () => {
  it("persists across reload and backup restore while leaving projects, files and section state intact", async () => {
    const h = await setup();
    try {
      let call = h.harness.behavior.callRpc;
      const before = parseBackup(await call("backup_export", null));
      const group = (await call("project_group_save", {
        name: "Олимп",
        projectIds: ["p1", "p2"],
      })) as ProjectGroup;
      const listed = (await call("list", null)) as {
        projectGroups: ProjectGroup[];
      };
      expect(listed.projectGroups).toEqual([group]);
      const backup = parseBackup(await call("backup_export", null));
      for (const key of Object.keys(
        before.tables,
      ) as (keyof typeof before.tables)[])
        if (key !== "preferences")
          expect(backup.tables[key]).toEqual(before.tables[key]);
      Object.assign(h, await h.harness.lifecycle.reload(plugin));
      call = h.harness.behavior.callRpc;
      expect(await call("project_groups_list", null)).toEqual([group]);
      await call("project_group_remove", { id: group.id });
      expect(await call("project_groups_list", null)).toEqual([]);
      await call("backup_import", { backup, mode: "replace" });
      expect(await call("project_groups_list", null)).toEqual([group]);
      expect(h.writes).not.toHaveBeenCalled();
      expect(h.update).not.toHaveBeenCalled();
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
  it("rejects unknown and personal projects without creating a group", async () => {
    const h = await setup();
    try {
      const call = h.harness.behavior.callRpc;
      await expect(
        call("project_group_save", {
          name: "Olympus",
          projectIds: ["missing"],
        }),
      ).rejects.toThrow(/Project not found/);
      await expect(
        call("project_group_place", { projectId: "missing", groupId: null }),
      ).rejects.toThrow(/Project not found/);
      await expect(
        call("project_group_save", {
          name: "Olympus",
          projectIds: ["personal"],
        }),
      ).rejects.toThrow(/Project not found/);
      expect(await call("project_groups_list", null)).toEqual([]);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
  it("creates and places existing projects using the public CLI", async () => {
    const h = await setup();
    try {
      const run = h.harness.behavior.runCli;
      const result = await run(["project-group-create", "Олимп", "p1"]);
      expect(result.exitCode).toBe(0);
      const group = JSON.parse(result.stdout ?? "{}") as ProjectGroup;
      expect(
        (await run(["project-group-place", "p2", group.id])).exitCode,
      ).toBe(0);
      expect(
        await h.harness.behavior.callRpc("project_groups_list", null),
      ).toEqual([{ ...group, projectIds: ["p1", "p2"] }]);
      expect((await run(["project-group-place", "p1", "-"])).exitCode).toBe(0);
      expect((await run(["project-group-remove", group.id])).exitCode).toBe(0);
      expect(
        await h.harness.behavior.callRpc("project_groups_list", null),
      ).toEqual([]);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
});
