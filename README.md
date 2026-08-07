# Colossus

Colossus is a local creative-agent runtime with the built-in coding personas and model-specific coding prompts removed.

Run it from the folder you want to work in:

```bash
cd /path/to/your/content-workspace
colossus
```

The launcher isolates its sessions, logs, cache, configuration, and skill discovery inside `.runtime/`. It does not alter the installed `kilo` command or read its global configuration. During source development it deliberately disables the fork repository's own project instructions and skills, so only your Colossus profile is loaded.

## Prompt transparency

Run `colossus prompt show` to view the complete built-in operating prompt. The runtime adds only the selected model, current workspace, date, enabled tools, available skill metadata, connected MCP instructions, explicit agent prompt, and request-specific system context.

## Customization

Settings live in `~/.config/colossus/`, mirroring Kilo's `~/.config/kilo/`. The launcher
creates it on first run. Set `COLOSSUS_CONFIG_DIR` to use a different location.

    ~/.config/colossus/
    ├── skills/<skill-name>/SKILL.md   always available
    ├── command/<name>.md              slash commands
    ├── agent/<name>.md                custom agents
    ├── AGENTS.md                      standing instructions
    └── kilo.jsonc                     model, permissions, MCP servers

- Add workspace skills under `<your-workspace>/.kilo/skills/<skill-name>/SKILL.md`; they
  load only in that workspace and override global skills of the same name.
- Every `.md` file in `command/` and `agent/` is loaded as a command or agent, so keep
  notes and drafts out of those two directories. `skills/` reads only `SKILL.md`.
- Keep tokens in environment variables or the provider login flow; never put secrets into
  this repository.

Run `colossus doctor` to safely check the OpenRouter connection; it never prints your API key.

The starter profile asks before any action other than reading, searching local files, listing files, and loading skills.
