# Your Colossus folder

This is the only folder you need to edit. Colossus checks it every time it starts.

## What goes where

| Folder or file | What it holds |
| --- | --- |
| `skills/` | Your skills. One folder per skill, each containing a `SKILL.md`. |
| `command/` | Shortcuts you type, like `/rewrite`. One `.md` file per shortcut. |
| `agent/` | Custom assistants with their own instructions. One `.md` file each. |
| `AGENTS.md` | Standing instructions applied to every session. |
| `kilo.jsonc` | Settings: which model to use, and what Colossus may do without asking. |

## Adding a skill

Make a folder inside `skills/` and put a `SKILL.md` in it:

    skills/
      my-skill/
        SKILL.md

The file starts with a name and a description, then the instructions:

    ---
    name: my-skill
    description: What this skill does, and when to use it.
    ---

    Your instructions here.

The description is how Colossus decides whether a skill fits the task, so make it
specific. Only files named `SKILL.md` are picked up.

## Two levels of skills

Skills here are always available, whatever folder you are working in.

You can also put skills in a `.kilo/skills/` folder inside a project, and those load
only while you are working in that project. If a name exists in both places, the
project one wins.

## Careful with `command/` and `agent/`

Every `.md` file in those two folders becomes a real command or agent. Do not leave
notes or drafts there, or they will show up as things you can run.

`skills/` is not affected, because only `SKILL.md` counts there.
