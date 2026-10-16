// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import type { ExperimentalSidebarNavigationItem } from "@get-bb/plugin-sdk/app";
import { installTestMatchMedia } from "./test-match-media";

let app: Awaited<ReturnType<typeof loadPluginApp>>;
beforeAll(async () => {
  installTestMatchMedia();
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  app = await loadPluginApp(() => import("./app"));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
const items: ExperimentalSidebarNavigationItem[] = [
  {
    id: "__bb__/new-thread",
    label: "New thread",
    icon: { kind: "host", name: "new-thread" },
    action: { kind: "new-thread" },
    isDisabled: false,
    isVisible: true,
    isLoading: false,
    pluginId: null,
    shortcut: null,
    experimental_Accessory: null,
  },
  {
    id: "__bb__/extensions",
    label: "Plugins",
    icon: { kind: "host", name: "extensions" },
    action: { kind: "open-extensions" },
    isDisabled: false,
    isVisible: true,
    isLoading: false,
    pluginId: null,
    shortcut: null,
    experimental_Accessory: null,
  },
  ...["Zeus", "Athena", "Hidden"].map((label) => ({
    id: `${label.toLowerCase()}/panel`,
    label,
    icon: {
      kind: "plugin",
      pluginId: label.toLowerCase(),
      icon: "Zap",
    } as const,
    action: {
      kind: "open-plugin-panel",
      pluginId: label.toLowerCase(),
      panelId: "panel",
    } as const,
    isDisabled: false,
    isVisible: label !== "Hidden",
    isLoading: false,
    pluginId: label.toLowerCase(),
    shortcut: null,
    experimental_Accessory: null,
  })),
];
function mount(isCompactViewport = false) {
  return renderSlot(
    app.experimentalSidebarNavigations[0]!,
    { isCompactViewport, experimental_Original: () => null },
    { sidebarNavigation: { items, activeItemId: "zeus/panel" } },
  );
}
it("collapses plugin rows by default while keeping New thread and Plugins reachable", () => {
  const view = mount();
  expect(view.queryByRole("button", { name: "Zeus" })).toBeNull();
  expect(view.queryByRole("button", { name: "Athena" })).toBeNull();
  const toggle = view.getByRole("button", { name: "Show plugins (2)" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(view.getByRole("button", { name: "New thread" }));
  fireEvent.click(view.getByRole("button", { name: "Plugins" }));
  expect(view.inspection.sidebarNavigationCalls).toEqual([
    { method: "activate", itemId: "__bb__/new-thread", openInSplit: false },
    { method: "activate", itemId: "__bb__/extensions", openInSplit: false },
  ]);
});
it("restores the original visible items and host activation after expanding, and remembers the toggle", () => {
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Show plugins (2)" }));
  expect(
    view
      .getByRole("button", { name: "Hide plugins (2)" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  const zeus = view.getByRole("button", { name: "Zeus" });
  expect(zeus.getAttribute("aria-current")).toBe("page");
  expect(view.queryByRole("button", { name: "Hidden" })).toBeNull();
  fireEvent.click(zeus, { metaKey: true });
  expect(view.inspection.sidebarNavigationCalls).toEqual([
    { method: "activate", itemId: "zeus/panel", openInSplit: true },
  ]);
  view.lifecycle.unmount();
  const reopened = mount(true);
  expect(reopened.getByRole("button", { name: "Athena" })).toBeTruthy();
  fireEvent.click(reopened.getByRole("button", { name: "Hide plugins (2)" }));
  expect(reopened.inspection.sidebarNavigationCalls).toEqual([]);
  reopened.lifecycle.unmount();
  const collapsed = mount();
  expect(collapsed.queryByRole("button", { name: "Athena" })).toBeNull();
});
it("keeps hidden items and the native customization editor accessible when collapsed", async () => {
  const view = mount();
  fireEvent.pointerDown(view.getByRole("button", { name: "More plugins" }), {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(await view.findByRole("menuitem", { name: "Hidden" }));
  fireEvent.pointerDown(view.getByRole("button", { name: "More plugins" }), {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(
    await view.findByRole("menuitem", { name: "Customize menu" }),
  );
  expect(view.inspection.sidebarNavigationCalls).toEqual([
    { method: "activate", itemId: "hidden/panel", openInSplit: false },
    { method: "openCustomize" },
  ]);
});
it("still toggles when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Show plugins (2)" }));
  expect(view.getByRole("button", { name: "Zeus" })).toBeTruthy();
});
