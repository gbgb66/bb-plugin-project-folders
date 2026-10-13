# Projects & Sections

Projects & Sections is a BB plugin that organizes project chats into sections backed by folders on connected devices. It also provides per-place rules and chat defaults, archives, history exports, appearance controls, optional session-context filtering and opt-in prompt-cache keepalive for pinned Claude chats.

This fork adds a status indicator beside every chat: a **spinning yellow ring** while working or waiting, **green** when an answer is ready, and **red** on an execution or queued-send error. A chat with no result yet stays neutral. Hover the indicator for the status; opening or reading a finished chat keeps it green.

Replace a project's folder icon with a round **god portrait**: Zeus, Neptune, Hermes, Athena, Hephaestus or Prometheus. Select it in **Appearance → Icon → Choose → God avatars**, or run `bb project-folders project-avatar <project-id> <avatar-id> --json`. List avatar IDs with `bb project-folders avatars --json`; pass `-` as the avatar ID to return to the inherited icon. Portrait choices are saved with the project's appearance, including backups. The images are bundled in the plugin and work without an external image host.

Create a **project group** such as “Олимп” above existing BB projects. Click **New project group** in the sidebar or management tree, enter its name and select the projects. The group’s menu lets you rename it or change its members. **Dissolve group** returns its projects to the top level after confirmation. Project IDs, chats, files, working paths and rules stay intact; each project belongs to at most one group. Groups can be collapsed and are included in plugin backups.

```sh
bb project-folders project-groups --json
bb project-folders project-group-create "Олимп" <neptune-project-id> <zeus-project-id> --json
bb project-folders project-group-place <project-id> <group-id> --json
bb project-folders project-group-place <project-id> - --json
```

## Install

```sh
bb plugin install https://github.com/gbgb66/bb-plugin-project-folders.git --yes
```

In BB, choose Projects & Sections as the sidebar thread list if it is not selected automatically. Open the management page to create a project.

This fork keeps the original `project-folders` plugin ID. If the original is already installed, export its full backup with `bb project-folders backup > project-folders-backup.json` before switching installations, then import that file with `bb project-folders restore project-folders-backup.json`. Removing a plugin deletes its stored settings and section metadata; it does not replace the BB chat database. Keep the backup until the restored tree has been checked.

Before removing the original, check that the export includes `pluginVersion`. The original built 0.6.37 can omit this field; keep the raw file and add the confirmed original version to a copy before restoring. This fork fixes subsequent exports by embedding its version in the built server.

Developer checks: `npm run typecheck`, `npm test`, `npm run build`, then `npm run verify:build`. The last command loads the built server, checks its exported version and a full backup round-trip, and checks the compiled indicator colors.

## Documentation

- [Overview](docs/overview.md) — purpose, stack and starting points.
- [Architecture](docs/architecture.md) — runtime parts and BB integration.
- [Features](docs/features/project-tree.md) — user-facing capabilities.
- [Chat list](docs/features/chat-list.md) · [Starting chats in sections](docs/features/section-chats.md) · [Agent rules](docs/features/agent-rules.md)
- [Execution defaults](docs/features/execution-settings.md) · [Session context](docs/features/session-context.md) · [Appearance](docs/features/appearance-settings.md)
- [Prompt cache keepalive](docs/features/cache-keepalive.md)
- [Archive and restore](docs/features/archive-and-restore.md) · [Device copies and moves](docs/features/devices-and-moves.md) · [Chat history export](docs/features/chat-history-export.md) · [Language](docs/features/language.md)
- [API](docs/api.md) — RPC, host operations and CLI commands.
- [Data model](docs/data-model.md) — plugin-owned storage.
- [Deployment](docs/deployment.md) — installation and development commands.
- [Gotchas](docs/gotchas.md) — constraints and failure behavior.
- [Decisions](docs/decisions.md) — implementation choices supported by code and history.

The interface is available in English, Russian, Spanish, French, German, Portuguese, Simplified Chinese, Japanese, Korean, Hindi and Arabic (`i18n.tsx:13-37`).

See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
