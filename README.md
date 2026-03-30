# Hacking Minecraft

Learn AI and LLMs the fun way — by building intelligent bots in Minecraft!

## Getting Started

1. Follow the [Setup Guide](SETUP.md) to install Node.js, PaperMC, TLauncher, and Claude Desktop/Code
2. Head to the [Curriculum](CURRICULUM.md) for the tutorials

## Project Structure

```
examples/
  bot-follow-a-player/          # Tutorial 1: Bot that follows a player
  bot-protect-a-player-from-hostile/  # Tutorial 2: Bot that protects from hostiles
mcp/                            # Tutorial 3: MCP server for Claude-controlled bot
```

## Quick Start

### Tutorial 1 — Bot Basics

```bash
cd examples/bot-follow-a-player
npx tsx src/index.ts -- --player <name>
```

### Tutorial 2 — Smart Bot

```bash
cd examples/bot-protect-a-player-from-hostile
npx tsx src/index.ts -- --player <name>
```

### Tutorial 3 — MCP Server

```bash
cd mcp
npm install
npm run build
npm start
```

See [CURRICULUM.md](CURRICULUM.md) for setup instructions with Claude Desktop and Claude Code.
