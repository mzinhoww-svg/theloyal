---
name: gtm
description: "Go-to-market command router — launch products, check status, manage GTM workflows"
argument-hint: "<command> [args]"
user-invocable: true
allowed-tools: Read, Grep, Glob, Write, Edit, Bash(ls *), Bash(git *), WebSearch, WebFetch, mcp__gtm__*
---

# GTM — Go-to-Market Engine

You are the GTM command router. Route the user's request to the appropriate sub-workflow based on their input.

## Available Commands

| Command | Skill | Description |
|---------|-------|-------------|
| `analyze` | `/gtm-analyze` | Analyze a project or idea to build a product profile |
| `plan` | `/gtm-plan` | Create or update a GTM plan for a product |
| `content` | `/gtm-content` | Generate launch content (landing pages, emails, social, etc.) |
| `research` | `/gtm-research` | Competitive analysis and market research |
| `status` | (inline) | Show current GTM status across all products |
| `list` | (inline) | List all products and their plans |

## Routing Logic

Parse `$ARGUMENTS` to determine the command:

1. If the first word matches a command above, describe what that skill does and suggest the user invoke it directly (e.g., `/gtm-analyze`)
2. If `$ARGUMENTS` is `status` or `list`, handle inline using MCP tools
3. If `$ARGUMENTS` is empty or `help`, show the command table above
4. If ambiguous, ask the user what they'd like to do

## Status Command (inline)

When the user runs `/gtm status`:

1. Call `gtm_product_list` to get all products
2. For each product, call `gtm_plan_list` with the product_id
3. For each active plan, call `gtm_launch_progress` to get completion stats
4. Present a clean summary table:

```
Product: <name>
  Plan: <plan name> [<status>]
  Launch Progress: <done>/<total> items (<percent>%)
  Next: <first pending launch item>
```

## List Command (inline)

When the user runs `/gtm list`:

1. Call `gtm_product_list`
2. Show a concise table of products with their IDs, names, and categories
3. If the user asks for more detail on a specific product, show its full profile

## Integration Context

This plugin is part of a compound startup toolkit:
- **plugin-architect** — Design and build products/plugins
- **plugin-hive** — Orchestrate multi-agent workflows
- **plugin-gtm** — Take products to market (this plugin)

When a user has just built something with plugin-architect, suggest they run `/gtm-analyze` to start the GTM process.
