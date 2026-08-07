# Colossus

A local terminal agent for creative work — writing, captions, scripts, research, drafting.

Colossus is a fork of [Kilo Code](https://github.com/Kilo-Org/kilocode) with the coding
personas and the model-specific coding prompts taken out. What is left is the runtime:
skills, slash commands, custom agents, MCP servers, and a permission system that asks
before it acts. You point it at a folder and it works on the files there.

It runs on your machine and talks to one provider you choose. There is no Colossus
account, no telemetry added by this fork, and no hosted service.

---

## Setup

Three steps on every platform: install Bun, clone and install, add an API key.

### Requirements

| | |
|---|---|
| **Bun** | 1.3.14 or newer — this is the runtime, it is not optional |
| **Git** | to clone |
| **An OpenRouter API key** | or any other provider Kilo supports |
| **Disk space** | about **3 GB** — see [Why it is large](#why-the-install-is-large) |

### 1. Install Bun

**macOS / Linux**

```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell)**

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Close and reopen the terminal, then check it worked:

```bash
bun --version
```

### 2. Clone and install

```bash
git clone https://github.com/riddhimaaan/colossus-agent.git
cd colossus-agent
bun install
```

`bun install` downloads the dependencies. It takes several minutes the first time.

### 3. Add your API key

Get a key from [openrouter.ai/keys](https://openrouter.ai/keys), then save it where
Colossus looks for it.

**macOS / Linux**

```bash
mkdir -p ~/.config/colossus
printf '%s' 'YOUR-KEY-HERE' > ~/.config/colossus/openrouter-api-key
chmod 600 ~/.config/colossus/openrouter-api-key
```

**Windows (PowerShell)**

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.config\colossus"
Set-Content -NoNewline "$env:USERPROFILE\.config\colossus\openrouter-api-key" 'YOUR-KEY-HERE'
```

The key file stays outside this repository. Nothing in the setup ever commits it.

### 4. Put `colossus` on your PATH

**macOS / Linux**

```bash
mkdir -p ~/.local/bin && ln -sf "$PWD/colossus" ~/.local/bin/colossus
```

If `colossus` is still not found afterwards, `~/.local/bin` is not on your PATH. Add it
to your shell config (`~/.zshrc`, `~/.bashrc`, or `~/.config/fish/config.fish`).

**Windows (PowerShell)** — add a function to your profile:

```powershell
Add-Content $PROFILE "`nfunction colossus { & '$PWD\colossus.ps1' @args }"
```

Then reopen PowerShell.

### 5. Check it works

```bash
colossus doctor
```

This confirms the API key is accepted. It never prints the key. Then start it from
whatever folder you want to work in:

```bash
cd ~/my-content
colossus
```

---

## Platform support

| Platform | Status |
|---|---|
| **Linux** | Developed and tested here |
| **macOS** | Same launcher, same shell — expected to work, not yet verified by the maintainer |
| **Windows via WSL2** | **Recommended for Windows.** Follow the Linux instructions inside WSL |
| **Windows native** | `colossus.ps1` is provided but has **not been tested on a Windows machine** |

If you run Colossus on macOS or native Windows, please open an issue saying whether it
worked. That is the fastest way to get those rows above changed to something firmer.

---

## Using it

Start Colossus in a folder and type what you want. It reads and searches that folder
freely; anything else — writing a file, running a command, reaching the network — it
asks about first.

Useful commands:

| Command | What it does |
|---|---|
| `colossus` | Start in the current folder |
| `colossus run "..."` | One-shot: answer and exit, no interactive session |
| `colossus doctor` | Check that the API key works |
| `colossus prompt show` | Print the entire built-in prompt |
| `/help` | List slash commands, inside a session |

### Prompt transparency

`colossus prompt show` prints the complete operating prompt, in full, with no truncation.
On top of it the runtime adds only: the selected model, the current folder, the date, the
enabled tools, your skill descriptions, instructions from connected MCP servers, the
active agent's prompt, and the context for the request you just made. Nothing else is
injected.

---

## Configuration

Your settings live in `~/.config/colossus/`, outside this repository, so updating
Colossus never touches them. The launcher creates the folder and seeds a starter
`kilo.jsonc` and `AGENTS.md` on first run, and never overwrites either afterwards.

```
~/.config/colossus/
├── kilo.jsonc                    model, permissions, MCP servers
├── AGENTS.md                     standing instructions for every session
├── skills/<name>/SKILL.md        always-available skills
├── command/<name>.md             slash commands
└── agent/<name>.md               custom agents
```

Set `COLOSSUS_CONFIG_DIR` to keep it somewhere else.

**Per-folder settings.** Skills under `<your-folder>/.kilo/skills/<name>/SKILL.md` load
only in that folder and override a global skill of the same name. Good for a per-client
or per-project voice.

**Watch out:** every `.md` file in `command/` and `agent/` is loaded, so keep notes and
drafts out of those two folders. `skills/` only ever reads `SKILL.md`.

### Choosing a model

Edit `model` in `~/.config/colossus/kilo.jsonc`. Any OpenRouter model ID works, prefixed
with `openrouter/`:

```jsonc
"model": "openrouter/anthropic/claude-sonnet-4.5"
```

Check a model is available to your key before committing to it:

```bash
colossus doctor model anthropic/claude-sonnet-4.5
```

### MCP servers

MCP servers work exactly as they do in Kilo. Add them to `kilo.jsonc`:

```jsonc
"mcp": {
  "filesystem": {
    "type": "local",
    "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
  }
}
```

Their tools appear in the session and are governed by the same permission rules as
everything else.

### Permissions

The starter profile is deliberately cautious:

```jsonc
"permission": {
  "*": "ask",        // everything asks first
  "read": "allow",   // except reading and searching local files
  "grep": "allow",
  "glob": "allow",
  "list": "allow",
  "skill": "allow"
}
```

Loosen it if the prompts get tiring — but `"*": "allow"` means the agent can run commands
and edit files without asking, so change it knowingly.

---

## Troubleshooting

**`colossus: command not found`** — step 4 did not take. On macOS/Linux check that
`~/.local/bin` is on your PATH.

**`Colossus needs Bun, but it was not found`** — reopen your terminal after installing
Bun, or point the launcher at it directly.

**`OpenRouter: rejected the configured API key`** — the key is wrong, revoked, or out of
credit. An `OPENROUTER_API_KEY` already exported in your shell is ignored when the key
file exists; the file wins.

**The panel says `0 skills`** — that is correct on a fresh install. `~/.config/colossus/skills/`
starts empty. Add a folder with a `SKILL.md` in it and restart.

### Why the install is large

Colossus is a fork of the whole Kilo monorepo, which also contains a VS Code extension, a
JetBrains plugin, and a docs site. `bun install` pulls dependencies for all of it, so
`node_modules` lands around 2.6 GB even though Colossus itself uses a fraction of that.
Trimming this is an open item, not a solved one.

---

## Development

```bash
bun run --cwd packages/opencode test    # each test file in its own process
bun run typecheck                       # from the repository root
```

Do not reach for `bun test` across the suite yourself. The tests share global state and
contaminate each other when run in one process, which produces hundreds of phantom
failures. The `test` script above wraps `script/test-runner.ts`, which isolates each
file; that is the only run whose result means anything.

One test file, `test/session/llm-native-recorded.test.ts`, currently fails. Its recorded
HTTP fixtures contain the pre-fork system prompt and need re-recording against live
provider APIs. Everything else passes.

The inherited Kilo CI workflows are parked in `.github/workflows/disabled/`. They target
Kilo's own infrastructure and secrets and will not work here.

---

## Credits and licence

Colossus is a fork of **[Kilo Code](https://github.com/Kilo-Org/kilocode)**, which is
itself built on **[opencode](https://github.com/sst/opencode)**. Essentially all of the
engineering here is theirs. This fork removes the coding personas, adds a creative
operating prompt, and rebrands the CLI.

MIT licensed — see [LICENSE](LICENSE). The Kilo Code and opencode copyright notices are
retained, as the licence requires.

This project is not affiliated with, endorsed by, or supported by Kilo Code or opencode.
Please do not take Colossus problems to their issue trackers.
