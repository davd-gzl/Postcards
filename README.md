# place-been

This repository is set up for **Spec-Driven Development (SDD)** using
[GitHub Spec Kit](https://github.com/github/spec-kit), integrated with Claude Code.

## What is Spec-Driven Development?

Instead of jumping straight to code, you first write an executable specification,
turn it into a technical plan, break the plan into tasks, and then implement
those tasks. Spec Kit provides the templates, scripts, and slash-command
workflow that drive this process.

## Getting started

Open this project in Claude Code and use the Spec Kit skills (slash commands),
in roughly this order:

| Command | Purpose |
| --- | --- |
| `/speckit-constitution` | Establish the project's guiding principles |
| `/speckit-specify` | Create a baseline specification from a feature description |
| `/speckit-clarify` *(optional)* | Ask structured questions to de-risk ambiguity (before planning) |
| `/speckit-plan` | Create the technical implementation plan |
| `/speckit-tasks` | Generate an actionable, ordered task list |
| `/speckit-analyze` *(optional)* | Cross-artifact consistency & alignment check |
| `/speckit-checklist` *(optional)* | Generate quality checklists for the requirements |
| `/speckit-implement` | Execute the tasks |
| `/speckit-converge` | Assess the codebase and append remaining work as tasks |

## Repository layout

```
.specify/
├── memory/constitution.md      # Project principles (fill in via /speckit-constitution)
├── scripts/bash/               # Helper scripts used by the workflow
├── templates/                  # Spec, plan, tasks, checklist, constitution templates
├── integrations/               # Integration manifests (Claude Code)
└── workflows/                  # Spec Kit workflow definition
.claude/
└── skills/                     # Spec Kit slash-command skills for Claude Code
```

## Requirements

- [Claude Code](https://claude.com/claude-code)
- The Spec Kit CLI (`specify`) if you want to re-run or update the scaffolding:
  `uv tool install specify-cli`

Spec Kit version: **0.12.2**
