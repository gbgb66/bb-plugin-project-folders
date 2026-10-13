// @vitest-environment jsdom
import { beforeAll, afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { installTestMatchMedia } from "./test-match-media";
import { defaultPrefs } from "./preferences";
import { GOD_AVATAR_IDS } from "./god-avatar-catalog";
let app: Awaited<ReturnType<typeof loadPluginApp>>;
beforeAll(async () => {
  installTestMatchMedia();
  app = await loadPluginApp(() => import("./app"));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const names = ["ЗЕВС", "NEPTUN", "ГЕРМЕС", "АФИНА", "ГЕФЕСТ", "ПРОМЕТЕЙ"];
const roots = GOD_AVATAR_IDS.map((id, i) => ({
  id: `p${i}`,
  projectId: `p${i}`,
  name: names[i],
  hostId: "h1",
  path: `/work/${id}`,
  parentId: null,
}));
const section = {
  ...roots[0],
  id: "s1",
  name: "Section",
  path: "/work/zeus/section",
};
const items = Object.fromEntries(
  GOD_AVATAR_IDS.map((id, i) => [`p:p${i}`, { icon: `avatar:${id}` }]),
);
const rpc = {
  list: () => ({
    folders: [section],
    roots,
    bindings: {},
    places: {},
    errors: [],
    machines: [],
    projectGroups: [
      { id: "g1", name: "Олимп", projectIds: roots.map((r) => r.projectId) },
    ],
  }),
  prefs_get: () => ({ prefs: defaultPrefs, items, stored: true }),
};

it("renders the six distinct embedded portraits instead of folders while keeping ordinary section icons", async () => {
  const view = renderSlot(
    app.threadLists[0]!,
    { activeThreadId: null, onNavigate() {} },
    { sidebarThreads: { threads: [], projects: [] }, rpc },
  );
  await view.findByText("ЗЕВС");
  await waitFor(() =>
    expect(
      view.baseElement.querySelectorAll(".pf-heading .pf-god-avatar"),
    ).toHaveLength(6),
  );
  const sources = new Set<string>();
  for (let i = 0; i < names.length; i++) {
    const heading = view.getByText(names[i]).closest(".pf-heading")!;
    const avatar = heading.querySelector(
      `[data-avatar-id="${GOD_AVATAR_IDS[i]}"] img`,
    )!;
    expect(avatar.getAttribute("src")).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(avatar.getAttribute("alt")).toBe("");
    expect(heading.querySelector("[data-icon=Folder]")).toBeNull();
    sources.add(avatar.getAttribute("src")!);
  }
  expect(sources.size).toBe(6);
  expect(
    view
      .getByText("Section")
      .closest(".pf-heading")!
      .querySelector(".pf-god-avatar"),
  ).toBeNull();
  view.lifecycle.unmount();
});

it("selects a god portrait in the existing appearance dialog and saves it for that project", async () => {
  const save = vi.fn((_input: { key: string; style: unknown }) => ({
    ok: true,
  }));
  const view = renderSlot(
    app.navPanels[0]!,
    { subPath: "" },
    { rpc: { ...rpc, item_style_save: save } },
  );
  const more = await view.findByRole("button", { name: "Actions: ЗЕВС" });
  fireEvent.pointerDown(more, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(await view.findByRole("menuitem", { name: "Appearance" }));
  const dialog = await view.findByRole("dialog", { name: "Appearance" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Choose" }));
  expect(within(dialog).getByText("God avatars")).toBeTruthy();
  const athena = within(dialog).getByRole("button", { name: "Athena" });
  fireEvent.click(athena);
  expect(athena.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0]).toMatchObject({
    key: "p:p0",
    style: { icon: "avatar:athena" },
  });
  view.lifecycle.unmount();
});
