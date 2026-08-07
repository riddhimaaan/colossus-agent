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

- Add global skills under `profile/skills/<skill-name>/SKILL.md`.
- Add workspace skills under `<your-workspace>/.kilo/skills/<skill-name>/SKILL.md`.
- Add MCP servers under `profile/kilo.jsonc`.
- Keep tokens in environment variables or the provider login flow; never put secrets into this repository.

Run `colossus doctor` to safely check the OpenRouter connection; it never prints your API key.

The starter profile asks before any action other than reading, searching local files, listing files, and loading skills.
