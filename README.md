# Projects & Sections

Projects & Sections is a BB plugin that organizes project chats into sections backed by folders on connected devices. It also provides per-place rules and chat defaults, archives, history exports, appearance controls, optional session-context filtering and opt-in prompt-cache keepalive for pinned Claude chats.

This fork adds a status dot beside every chat: **orange** while working or waiting, **green** when an answer is ready, and **red** on an execution or queued-send error. A chat with no result yet stays neutral. Hover the dot for the status; opening or reading a finished chat keeps it green.

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
