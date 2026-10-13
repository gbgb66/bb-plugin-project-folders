// @vitest-environment jsdom
import { beforeAll, afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { installTestMatchMedia } from "./test-match-media";
import type { ProjectGroup } from "./project-groups";
let app: Awaited<ReturnType<typeof loadPluginApp>>;
beforeAll(async () => {
  installTestMatchMedia();
  app = await loadPluginApp(() => import("./app"));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const roots = ["NEPTUN", "Other"].map((name, i) => ({
  id: `p${i + 1}`,
  projectId: `p${i + 1}`,
  hostId: "h1",
  parentId: null,
  path: `/work/${name}`,
  name,
}));
const thread: PluginSidebarThread = {
  id: "t1",
  projectId: "p1",
  title: "Ready chat",
  titleFallback: null,
  parentThreadId: null,
  sectionId: null,
  originKind: null,
  originPluginId: null,
  providerId: "codex",
  status: "idle",
  hasPendingInteraction: false,
  activity: {
    workflows: 0,
    backgroundAgents: 0,
    backgroundCommands: 0,
    planMode: 0,
    goals: 0,
  },
  indicator: "none",
  indicatorLabel: null,
  isUnread: true,
  isPinned: false,
  isArchived: false,
  environment: {
    id: "e1",
    name: null,
    branchName: null,
    providerId: null,
    workspaceDisplayKind: null,
  },
  host: { id: "h1", name: "Mac" },
  createdAt: 1,
  updatedAt: 2,
  latestAttentionAt: 2,
  lastReadAt: 1,
};
function mount(initialGroups: ProjectGroup[] = [], fail = false) {
  let groups = initialGroups;
  const save = vi.fn((input: Omit<ProjectGroup, "id"> & { id?: string }) => {
    if (fail) throw new Error("Group save failed.");
    const group = { ...input, id: input.id ?? "g-new" };
    groups = [...groups.filter((g) => g.id !== group.id), group];
    return group;
  });
  const remove = vi.fn(({ id }: { id: string }) => {
    groups = groups.filter((g) => g.id !== id);
    return { ok: true };
  });
  const view = renderSlot(
    app.threadLists[0]!,
    { activeThreadId: null, onNavigate() {} },
    {
      sidebarThreads: { threads: [thread], projects: [] },
      rpc: {
        list: () => ({
          folders: [],
          roots,
          projectGroups: groups,
          bindings: {},
          places: {},
          errors: [],
          machines: [],
        }),
        project_group_save: save,
        project_group_remove: remove,
      },
    },
  );
  return { view, save, remove };
}
it("nests each existing project once, preserves chat indicators, and remembers group collapse", async () => {
  const groups = [{ id: "g1", name: "Олимп", projectIds: ["p1"] }];
  const { view } = mount(groups);
  const neptune = await view.findByText("NEPTUN");
  const parent = neptune.closest(".pf-project-group") as HTMLElement;
  expect(parent.dataset.projectGroupId).toBe("g1");
  expect(
    within(parent).getByRole("img", { name: "Answer ready" }),
  ).toBeTruthy();
  expect(view.getByText("Other").closest(".pf-project-group")).toBeNull();
  expect(view.getAllByText("NEPTUN")).toHaveLength(1);
  const heading = within(parent).getByRole("button", { name: "Олимп" });
  fireEvent.click(heading);
  expect(heading.getAttribute("aria-expanded")).toBe("false");
  expect(view.queryByText("NEPTUN")).toBeNull();
  view.lifecycle.unmount();
  const second = mount(groups).view;
  expect(
    (await second.findByRole("button", { name: "Олимп" })).getAttribute(
      "aria-expanded",
    ),
  ).toBe("false");
  expect(second.queryByText("NEPTUN")).toBeNull();
  fireEvent.click(second.getByRole("button", { name: "Олимп" }));
  expect(await second.findByText("Ready chat")).toBeTruthy();
  second.lifecycle.unmount();
});
it("creates a group from selected existing projects", async () => {
  const { view, save } = mount();
  await view.findByText("NEPTUN");
  fireEvent.click(view.getByRole("button", { name: "New project group" }));
  const dialog = await view.findByRole("dialog", { name: "New project group" });
  fireEvent.change(within(dialog).getByLabelText("Group name"), {
    target: { value: "Олимп" },
  });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "NEPTUN" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({ name: "Олимп", projectIds: ["p1"] }),
  );
  await view.findByRole("button", { name: "Олимп" });
  expect(view.getByText("NEPTUN").closest(".pf-project-group")).toBeTruthy();
  view.lifecycle.unmount();
});
it("keeps the dialog and selection on an RPC error", async () => {
  const { view } = mount([], true);
  await view.findByText("NEPTUN");
  fireEvent.click(view.getByRole("button", { name: "New project group" }));
  const dialog = await view.findByRole("dialog", { name: "New project group" });
  fireEvent.change(within(dialog).getByLabelText("Group name"), {
    target: { value: "Олимп" },
  });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "NEPTUN" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
  expect((await within(dialog).findByRole("alert")).textContent).toContain(
    "Group save failed",
  );
  expect(
    (
      within(dialog).getByRole("checkbox", {
        name: "NEPTUN",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  view.lifecycle.unmount();
});
it("requires confirmation before dissolving and returns projects to the top level", async () => {
  const { view, remove } = mount([
    { id: "g1", name: "Олимп", projectIds: ["p1"] },
  ]);
  fireEvent.pointerDown(
    await view.findByRole("button", { name: "Actions: Олимп" }),
    { button: 0, ctrlKey: false },
  );
  fireEvent.click(
    await view.findByRole("menuitem", { name: "Dissolve group" }),
  );
  const dialog = await view.findByRole("dialog", {
    name: "Dissolve group «Олимп»",
  });
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Dissolve group" }),
  );
  await waitFor(() => expect(remove).toHaveBeenCalledWith({ id: "g1" }));
  await waitFor(() =>
    expect(view.queryByRole("button", { name: "Олимп" })).toBeNull(),
  );
  expect(view.getByText("NEPTUN").closest(".pf-project-group")).toBeNull();
  expect(view.getByText("Ready chat")).toBeTruthy();
  view.lifecycle.unmount();
});
