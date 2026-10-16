import { useEffect, useId, useState } from "react";
import {
  experimental_SidebarNavigationIcon as NavigationIcon,
  experimental_useSidebarNavigation,
  experimental_useSidebarNavigationSplit,
  type ExperimentalSidebarNavigationItem,
} from "@get-bb/plugin-sdk/app";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { Icon } from "./components/ui/icon";
import { direction, t, useLanguage } from "./i18n";

const collapseKey = "project-folders:plugins-collapsed";
function readCollapsed() {
  try {
    return localStorage.getItem(collapseKey) !== "false";
  } catch {
    return true;
  }
}

function NavigationRow({ item }: { item: ExperimentalSidebarNavigationItem }) {
  const { actions, activeItemId, isShortcutModifierHeld } =
    experimental_useSidebarNavigation();
  const { splitProps } = experimental_useSidebarNavigationSplit(item.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const Accessory = item.experimental_Accessory;
  return (
    <div
      className={
        "pf-navigation-row" +
        (activeItemId === item.id ? " pf-navigation-active" : "")
      }
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
    >
      <button
        type="button"
        className="pf-navigation-link"
        disabled={item.isDisabled || item.isLoading}
        aria-current={activeItemId === item.id ? "page" : undefined}
        aria-keyshortcuts={item.shortcut?.ariaKeyShortcuts}
        title={item.label}
        {...splitProps}
        onClick={(event) =>
          actions.activate(item.id, {
            openInSplit: event.metaKey || event.ctrlKey,
          })
        }
      >
        <NavigationIcon icon={item.icon} className="pf-navigation-icon" />
        <span className="pf-navigation-label">{item.label}</span>
        {isShortcutModifierHeld && item.shortcut && (
          <kbd>{item.shortcut.label}</kbd>
        )}
      </button>
      {Accessory && (
        <span className="pf-navigation-accessory">
          <Accessory />
        </span>
      )}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="pf-icon pf-navigation-options"
            aria-label={`${t("Действия")}: ${item.label}`}
          >
            <Icon name="MoreHorizontal" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => actions.setVisible(item.id, false)}>
            {t("Скрыть")}
          </DropdownMenuItem>
          {item.pluginId && (
            <DropdownMenuItem onSelect={() => actions.openDetails(item.id)}>
              {t("Настройки плагина")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => actions.openCustomize()}>
            {t("Настроить меню")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Collapse presentation only; BB's saved item visibility and order stay intact. */
export function CompactSidebarNavigation() {
  useLanguage();
  const { items, actions } = experimental_useSidebarNavigation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const listId = useId();
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === collapseKey || event.key === null) {
        setCollapsed(readCollapsed());
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const visible = items.filter((item) => item.isVisible);
  const plugins = visible.filter(
    (item) => item.action.kind === "open-plugin-panel",
  );
  const builtins = visible.filter(
    (item) => item.action.kind !== "open-plugin-panel",
  );
  const hidden = items.filter((item) => !item.isVisible);
  const label = collapsed ? t("Показать плагины") : t("Скрыть плагины");
  return (
    <nav className="pf pf-navigation" dir={direction()} data-bb-ru-skip="">
      {builtins.map((item) => (
        <NavigationRow key={item.id} item={item} />
      ))}
      <div className="pf-navigation-row">
        <button
          type="button"
          className="pf-navigation-link pf-navigation-toggle"
          aria-label={`${label} (${plugins.length})`}
          aria-expanded={!collapsed}
          aria-controls={listId}
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            try {
              localStorage.setItem(collapseKey, String(next));
            } catch {
              // The toggle still works when browser storage is unavailable.
            }
          }}
        >
          <Icon name={collapsed ? "ChevronRight" : "ChevronDown"} />
          <span className="pf-navigation-label">{label}</span>
          <span className="pf-navigation-count">{plugins.length}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="pf-icon"
              aria-label={t("Другие плагины")}
            >
              <Icon name="MoreHorizontal" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hidden.map((item) => (
              <DropdownMenuItem
                key={item.id}
                disabled={item.isDisabled || item.isLoading}
                onSelect={(event) =>
                  actions.activate(item.id, {
                    openInSplit: "metaKey" in event && Boolean(event.metaKey),
                  })
                }
              >
                <NavigationIcon icon={item.icon} />
                {item.label}
              </DropdownMenuItem>
            ))}
            {hidden.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={() => actions.openCustomize()}>
              <Icon name="Settings" />
              {t("Настроить меню")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div id={listId} hidden={collapsed}>
        {!collapsed &&
          plugins.map((item) => <NavigationRow key={item.id} item={item} />)}
      </div>
    </nav>
  );
}
