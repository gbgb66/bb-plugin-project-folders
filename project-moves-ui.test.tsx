// @vitest-environment jsdom
import { beforeAll, afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  createEvent,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { installTestMatchMedia } from "./test-match-media";
import { makeProjectGroups, type ProjectGroup } from "./project-groups";
import { PROJECT_DRAG_TYPE } from "./project-moves-ui";
import { defaultPrefs } from "./preferences";
let app: Awaited<ReturnType<typeof loadPluginApp>>;
beforeAll(async () => {
  installTestMatchMedia();
  app = await loadPluginApp(() => import("./app"));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const roots = ["ЗЕВС", "NEPTUN", "Other"].map((name, i) => ({
  id: `p${i + 1}`,
  projectId: `p${i + 1}`,
  name,
  hostId: "h1",
  parentId: null,
  path: `/work/${i}`,
}));
function mount(panel = false, fail = false, nested = false) {
  let data = JSON.stringify({
    version: 1,
    groups: [
      { id: "g1", name: "Олимп", projectIds: ["p1", "p2"] },
      { id: "g2", name: "Other group", projectIds: nested ? ["p3"] : [] },
    ],
  });
  const groups = makeProjectGroups({
    read: () => data,
    write: (v) => {
      data = v;
    },
    newId: () => "new",
  });
  const place = vi.fn(
    (input: {
      projectId: string;
      groupId: string | null;
      beforeProjectId?: string | null;
    }) => {
      if (fail) throw new Error("Move failed.");
      groups.place(input);
      return { ok: true };
    },
  );
  const savePrefs = vi.fn(() => ({ ok: true }));
  const view = renderSlot(
    panel ? app.navPanels[0]! : app.threadLists[0]!,
    panel ? { subPath: "" } : { activeThreadId: null, onNavigate() {} },
    {
      sidebarThreads: { threads: [], projects: [] },
      rpc: {
        list: () => ({
          roots,
          folders: nested
            ? [
                {
                  ...roots[2],
                  id: "s3",
                  name: "Nested section",
                  path: "/work/2/nested",
                },
              ]
            : [],
          bindings: {},
          places: {},
          errors: [],
          machines: [],
          projectGroups: groups.list(),
        }),
        prefs_get: () => ({ prefs: defaultPrefs, items: {}, stored: true }),
        prefs_save: savePrefs,
        project_group_place: place,
      },
    },
  );
  return { view, place, savePrefs, groups };
}
function transfer() {
  const data = new Map<string, string>();
  return {
    setData: (t: string, v: string) => data.set(t, v),
    getData: (t: string) => data.get(t) ?? "",
    effectAllowed: "",
    dropEffect: "",
  };
}
async function start(
  view: ReturnType<typeof mount>["view"],
  projectId: string,
) {
  await view.findByText("ЗЕВС");
  const dt = transfer();
  fireEvent.dragStart(
    view.baseElement.querySelector(
      `[data-project-drag-handle="${projectId}"]`,
    )!,
    { dataTransfer: dt },
  );
  expect(dt.getData(PROJECT_DRAG_TYPE)).toBe(projectId);
  return dt;
}
it("drags a god to another collapsed group and opens the destination", async () => {
  const { view, place } = mount();
  fireEvent.click(await view.findByRole("button", { name: "Other group" }));
  const dt = await start(view, "p1");
  const target = view.getByRole("button", { name: "Other group" });
  fireEvent.dragOver(target, { dataTransfer: dt });
  fireEvent.drop(target, { dataTransfer: dt });
  await waitFor(() =>
    expect(place).toHaveBeenCalledWith({ projectId: "p1", groupId: "g2" }),
  );
  await waitFor(() =>
    expect(
      view
        .getByText("ЗЕВС")
        .closest("[data-project-group-id]")
        ?.getAttribute("data-project-group-id"),
    ).toBe("g2"),
  );
  expect(target.getAttribute("aria-expanded")).toBe("true");
  view.lifecycle.unmount();
});
it("reorders gods by dropping above a sibling project heading", async () => {
  const { view, place } = mount();
  const dt = await start(view, "p2");
  const target = view.getByText("ЗЕВС").closest(".pf-heading")!;
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
    top: 10,
    height: 40,
  } as DOMRect);
  const over = createEvent.dragOver(target, { dataTransfer: dt });
  Object.defineProperty(over, "clientY", { value: 15 });
  fireEvent(target, over);
  fireEvent.drop(target, { dataTransfer: dt });
  await waitFor(() =>
    expect(place).toHaveBeenCalledWith({
      projectId: "p2",
      groupId: "g1",
      beforeProjectId: "p1",
    }),
  );
  await waitFor(() =>
    expect(
      [
        ...view.baseElement.querySelectorAll(
          '[data-project-group-id="g1"] [data-tree-project-id]',
        ),
      ].map((e) => e.getAttribute("data-tree-project-id")),
    ).toEqual(["p2", "p1"]),
  );
  view.lifecycle.unmount();
});
it("accepts a project drop over a nested section inside the destination group", async () => {
  const { view, place } = mount(false, false, true);
  const dt = await start(view, "p1");
  const target = (await view.findByText("Nested section")).closest(
    ".pf-heading",
  )!;
  fireEvent.dragOver(target, { dataTransfer: dt });
  fireEvent.drop(target, { dataTransfer: dt });
  await waitFor(() =>
    expect(place).toHaveBeenCalledWith({ projectId: "p1", groupId: "g2" }),
  );
  await waitFor(() =>
    expect(
      view
        .getByText("ЗЕВС")
        .closest("[data-project-group-id]")
        ?.getAttribute("data-project-group-id"),
    ).toBe("g2"),
  );
  view.lifecycle.unmount();
});
it("returns a god to the top level and activates manual ordering", async () => {
  const { view, place, savePrefs } = mount();
  const dt = await start(view, "p1");
  const target = view.baseElement.querySelector(
    "[data-project-root-drop-target]",
  )!;
  fireEvent.dragOver(target, { dataTransfer: dt });
  fireEvent.drop(target, { dataTransfer: dt });
  await waitFor(() =>
    expect(place).toHaveBeenCalledWith({
      projectId: "p1",
      groupId: null,
      beforeProjectId: null,
    }),
  );
  expect(savePrefs).toHaveBeenCalled();
  await waitFor(() =>
    expect(
      view.getByText("ЗЕВС").closest("[data-project-group-id]"),
    ).toBeNull(),
  );
  view.lifecycle.unmount();
});
it("supports keyboard/menu reordering in the management tree", async () => {
  const { view, place } = mount(true);
  fireEvent.pointerDown(
    await view.findByRole("button", { name: "Actions: NEPTUN" }),
    { button: 0, ctrlKey: false, pointerType: "mouse" },
  );
  fireEvent.click(await view.findByRole("menuitem", { name: "Move up" }));
  await waitFor(() =>
    expect(place).toHaveBeenCalledWith({
      projectId: "p2",
      groupId: "g1",
      beforeProjectId: "p1",
    }),
  );
  view.lifecycle.unmount();
});
it("keeps original membership and reports an RPC failure", async () => {
  const { view, groups } = mount(false, true);
  const dt = await start(view, "p1");
  const target = view.getByRole("button", { name: "Other group" });
  fireEvent.dragOver(target, { dataTransfer: dt });
  fireEvent.drop(target, { dataTransfer: dt });
  expect((await view.findByRole("alert")).textContent).toContain("Move failed");
  expect(groups.list()[0].projectIds).toEqual(["p1", "p2"]);
  view.lifecycle.unmount();
});
it("leaves sorting preferences unchanged when returning to the top level fails", async () => {
  const { view, savePrefs } = mount(false, true);
  const dt = await start(view, "p1");
  const target = view.baseElement.querySelector(
    "[data-project-root-drop-target]",
  )!;
  fireEvent.dragOver(target, { dataTransfer: dt });
  fireEvent.drop(target, { dataTransfer: dt });
  expect((await view.findByRole("alert")).textContent).toContain("Move failed");
  expect(savePrefs).not.toHaveBeenCalled();
  expect(
    view
      .getByText("ЗЕВС")
      .closest("[data-project-group-id]")
      ?.getAttribute("data-project-group-id"),
  ).toBe("g1");
  view.lifecycle.unmount();
});
