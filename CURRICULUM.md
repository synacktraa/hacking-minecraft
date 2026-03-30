# Hacking Minecraft with AI — Curriculum

Learn AI and LLMs the fun way — by building intelligent bots in Minecraft! This curriculum takes you from creating your first bot to controlling it with Claude through MCP.

## Outline

| # | Tutorial | What You'll Learn |
|---|----------|-------------------|
| 1 | [Bot Basics](#tutorial-1-bot-basics) | Create a bot, connect to a server, follow a player |
| 2 | [Smart Bot](#tutorial-2-smart-bot) | Add combat, coordinate navigation, and state management |
| 3 | [MCP Server](#tutorial-3-mcp-server) | Control your bot with Claude through MCP |

---

## Prerequisites

Make sure you've completed the [Setup Guide](SETUP.md) before starting.

---

## Tutorial 1: Bot Basics

> **Goal:** Create a Minecraft bot that connects to a server and follows a player around.
>
> **Code:** [`examples/bot-follow-a-player/`](examples/bot-follow-a-player/)

### What you'll learn

- How to use [Mineflayer](https://github.com/PrismarineJS/mineflayer) to create a Minecraft bot
- Connecting a bot to a local server
- Using the pathfinder plugin to navigate the world
- Finding nearby entities and tracking a specific player

### Step 1: Set up the project

Create a new directory and initialize a Node.js project:

```bash
mkdir bot-follow-a-player
cd bot-follow-a-player
npm init -y
```

Install the dependencies we'll need:

```bash
npm install mineflayer mineflayer-pathfinder yargs
npm install -D typescript @types/node @types/yargs tsx
```

- **mineflayer** — the library that lets us create Minecraft bots. It handles connecting to a server, reading game state, and performing actions.
- **mineflayer-pathfinder** — a plugin for mineflayer that gives our bot the ability to navigate the world. Without it, the bot would just stand still — it wouldn't know *how* to walk somewhere.
- **yargs** — a helper for parsing command-line arguments, so we can pass in the player name and other options when running the script.
- **tsx** — lets us run TypeScript directly without a compile step. Useful during development.

### Step 2: Parse command-line arguments

Create `src/index.ts`. We'll start with imports and CLI arguments so users can configure the bot without editing code:

```ts
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import mineflayer from 'mineflayer';
import mineflayerPathfinder from 'mineflayer-pathfinder';

const { pathfinder, Movements, goals } = mineflayerPathfinder;
const { GoalNear } = goals;

const argv = yargs(hideBin(process.argv))
  .option('player', {
    alias: 'p',
    description: 'Name of the player to follow',
    type: 'string',
    demandOption: true
  })
  .option('interval', {
    alias: 'i',
    description: 'Interval in ms to check for the player',
    type: 'number',
    default: 500
  })
  .option('range', {
    alias: 'r',
    description: 'Range in blocks to check for the player',
    type: 'number',
    default: 3
  })
  .option('bot', {
    alias: 'b',
    description: 'Name for the bot',
    type: 'string',
    default: 'bot'
  })
  .help()
  .parseSync();

const playerName = argv.player;
const interval = argv.interval;
const range = argv.range;
const botName = argv.bot;
```

The key parameter is `--player` — this is the Minecraft username the bot will follow. The others have sensible defaults: the bot checks every 500ms and tries to stay within 3 blocks.

### Step 3: Create the bot and connect

Now we create a bot that connects to a local Minecraft server:

```ts
const bot = mineflayer.createBot({ host: 'localhost', username: botName });
```

That's it — one line to create a bot and connect. By default it connects to `localhost:25565`. The `username` is what other players will see in-game.

The imports we set up earlier give us three things from pathfinder:
- **pathfinder** — the plugin itself, which we'll load onto the bot
- **Movements** — defines *how* the bot can move (walking, jumping, swimming, etc.)
- **GoalNear** — a goal type that tells pathfinder "get within X blocks of this position"

### Step 4: Follow the player

Once the bot spawns into the world, we load the pathfinder plugin and set up a loop that continuously tracks the target player:

```ts
bot.on('spawn', () => {
  bot.loadPlugin(pathfinder);
  bot.pathfinder.setMovements(new Movements(bot));

  bot.chat(`Hey, ${playerName}, I am here!`);

  setInterval(() => {
    bot.nearestEntity((e) => {
      if (e.type !== 'player' && e.username !== playerName) {
        return false;
      }

      const { x, y, z } = e.position;
      bot.pathfinder.setGoal(new GoalNear(x, y, z, range));
      return true;
    });
  }, interval);
});
```

Here's what's happening:

1. **`bot.on('spawn')`** — this fires once the bot has fully joined the server and is in the world.
2. **`bot.loadPlugin(pathfinder)`** — activates the pathfinder plugin so the bot can navigate.
3. **`new Movements(bot)`** — tells pathfinder what the bot is capable of (it reads the world data to know which blocks are walkable, which are dangerous, etc.).
4. **`setInterval`** — every `interval` ms (default 500), we look for the player.
5. **`bot.nearestEntity()`** — scans nearby entities and calls our filter function. When we find the target player, we grab their position and set it as the pathfinder goal.
6. **`GoalNear(x, y, z, range)`** — "navigate to within `range` blocks of this position." The bot will walk, jump, and swim to get there.

The bot continuously updates the goal because the player is moving — so every 500ms it recalculates where to go.

### Running it

Make sure your Minecraft server is running locally, then:

```bash
cd examples/bot-follow-a-player
npm install
npx tsx src/index.ts -- --player <your-minecraft-username>
```

Join your local server and watch the bot follow you around!

---

## Tutorial 2: Smart Bot

> **Goal:** Upgrade the bot to protect a player by attacking hostile mobs and navigating to coordinates.
>
> **Code:** [`examples/bot-protect-a-player-from-hostile/`](examples/bot-protect-a-player-from-hostile/)

### What you'll learn

- Managing bot state (following vs. navigating to coordinates)
- Detecting and attacking hostile entities
- Parsing player chat messages for coordinates
- Handling edge cases (player out of range, multiple coordinate formats)

### Overview

In Tutorial 1, our bot could only do one thing — follow a player. Now we're going to make it useful. By the end of this tutorial, the bot will:

- Follow you around like before
- Attack hostile mobs that get too close
- Ask for your coordinates if it loses sight of you
- Navigate to coordinates you send in chat

This introduces an important concept: **state management**. The bot now has multiple behaviors and needs to decide what to do based on the current situation.

### Step 1: Set up the project

Same setup as Tutorial 1 — same dependencies:

```bash
mkdir bot-protect-a-player-from-hostile
cd bot-protect-a-player-from-hostile
npm init -y
npm install mineflayer mineflayer-pathfinder yargs
npm install -D typescript @types/node @types/yargs tsx
```

Use the same `tsconfig.json` and `package.json` scripts from Tutorial 1. Create `src/index.ts` with the same imports and CLI argument parsing. One new thing — we derive a `hostileRange` from the player range:

```ts
const playerRange = argv.range;
const hostileRange = argv.range * 1.5;
```

The hostile detection range is 1.5x the follow range. This means the bot starts attacking mobs *before* they reach the player — it acts like a perimeter guard.

### Step 2: Add state tracking

Our bot now has multiple modes of operation, so we need state flags:

```ts
let needsPlayerCoords = false;
let isNavigatingToCoords = false;
```

- **`needsPlayerCoords`** — `true` when the bot can't find the player and has already asked for coordinates. This prevents the bot from spamming "where are you?" every 500ms.
- **`isNavigatingToCoords`** — `true` when the bot is walking toward coordinates the player sent. While navigating, it skips the normal "find and follow player" loop.

This is a simple state machine with two flags. In more complex bots you might use an enum or a proper state machine library, but for two states this works fine.

### Step 3: Follow and protect

The main loop runs on spawn, just like Tutorial 1, but now it does more:

```ts
bot.on('spawn', () => {
  bot.loadPlugin(pathfinder);
  bot.pathfinder.setMovements(new Movements(bot));

  bot.chat(`Hey, ${playerName}, I am here!`);

  setInterval(() => {
    // Skip if we're navigating to coordinates
    if (isNavigatingToCoords) return;

    const player = bot.nearestEntity((e) => e.type === 'player' && e.username === playerName);

    if (player) {
      needsPlayerCoords = false;
      const { x, y, z } = player.position;
      bot.pathfinder.setGoal(new GoalNear(x, y, z, playerRange));

      // Check for hostile entities and attack them
      bot.nearestEntity((e) => {
        if (e.type !== 'hostile') return false;
        if (bot.entity.position.distanceTo(e.position) <= hostileRange) {
          bot.lookAt(e.position, true).then(() => {
            bot.attack(e);
          });
        }
        return true;
      });
    } else if (!needsPlayerCoords) {
      needsPlayerCoords = true;
      bot.chat(`${playerName}, I can't find you! Please share your coordinates.`);
    }
  }, interval);
});
```

Let's break down what's new compared to Tutorial 1:

1. **`if (isNavigatingToCoords) return`** — if the player sent coordinates and the bot is walking there, don't override the goal by trying to find the player visually.
2. **Player found → attack hostiles** — after setting the follow goal, we scan for hostile entities. If any are within `hostileRange`, the bot looks at the mob (for aiming) and then attacks.
3. **`bot.lookAt(e.position, true)`** — the `true` parameter forces the bot's head to snap to the target. The bot needs to face a mob to attack it. This returns a Promise, so we chain `.then(() => bot.attack(e))`.
4. **`distanceTo()`** — mineflayer provides euclidean distance calculation on position vectors. We use it to check if a hostile is close enough to engage.
5. **Player not found** — if the player isn't nearby and we haven't already asked, set the flag and ask in chat. The `needsPlayerCoords` flag ensures we only ask once.

### Step 4: Parse coordinates from chat

We need a helper to understand coordinates in different formats, since players might type them differently:

```ts
function parseCoordinates(message: string) {
  const coordPatterns = [
    /(-?\d+)\s+(-?\d+)\s+(-?\d+)/,       // "100 64 -200"
    /(-?\d+),\s*(-?\d+),\s*(-?\d+)/,      // "100,64,-200" or "100, 64, -200"
    /(-?\d+)\/(-?\d+)\/(-?\d+)/           // "100/64/-200"
  ];

  for (const pattern of coordPatterns) {
    const match = message.match(pattern);
    if (match) {
      const [_, x, y, z] = match;
      return { x: parseInt(x), y: parseInt(y), z: parseInt(z) };
    }
  }
  return null;
}
```

Each regex captures three groups of digits (including negative numbers with `-?`). We try each pattern in order and return the first match. If nothing matches, we return `null`.

This is a small but important UX detail — the player shouldn't have to remember a specific format. Minecraft's F3 screen shows coordinates with slashes, the chat shows them with spaces, and some people naturally use commas.

### Step 5: Handle coordinate navigation

Now we listen for chat messages and navigate when the player sends coordinates:

```ts
bot.on('chat', (username, message) => {
  if (username === playerName) {
    const coords = parseCoordinates(message);
    if (coords) {
      const { x, y, z } = coords;
      bot.chat(`Thanks! I'm coming to coordinates: ${x}, ${y}, ${z}`);
      isNavigatingToCoords = true;
      needsPlayerCoords = false;

      bot.pathfinder.setGoal(new GoalNear(x, y, z, playerRange));

      // Still attack hostiles while navigating
      bot.nearestEntity((e) => {
        if (e.type !== 'hostile') return false;
        bot.attack(e);
        return true;
      });

      // Check progress and reset when we arrive
      const checkInterval = setInterval(() => {
        const botPos = bot.entity.position;
        if (isNavigatingToCoords) {
          bot.chat(`Current position: ${Math.floor(botPos.x)}, ${Math.floor(botPos.y)}, ${Math.floor(botPos.z)}`);
        }

        if (bot.entity.position.distanceTo({ x, y, z }) <= playerRange) {
          isNavigatingToCoords = false;
          clearInterval(checkInterval);
          bot.chat('I have reached the target location!');
        }
      }, 4000);
    }
  }
});
```

Here's the flow:

1. **Filter messages** — we only care about chat from the target player.
2. **Parse coordinates** — try to extract x, y, z from the message. If the message isn't coordinates, `parseCoordinates` returns `null` and we ignore it.
3. **Set navigation state** — flip `isNavigatingToCoords` to `true` so the main loop stops trying to visually find the player.
4. **Navigate** — set a pathfinder goal to the coordinates.
5. **Progress updates** — a separate interval (every 4 seconds, slower than the main loop) reports the bot's current position in chat so the player can see it approaching.
6. **Arrival detection** — when the bot is within `playerRange` of the target, clear the interval and reset `isNavigatingToCoords`. The main loop takes over again and resumes normal follow/protect behavior.

### Running it

```bash
cd examples/bot-protect-a-player-from-hostile
npm install
npx tsx src/index.ts -- --player <your-minecraft-username>
```

The bot will follow you and attack any hostile mobs that get close. If it loses sight of you, send your coordinates in chat (e.g. `100 64 -200`) and it'll navigate to you.

### What's next?

At this point we have a bot with hardcoded behaviors — it always follows, always attacks hostiles, and responds to a fixed set of chat patterns. In Tutorial 3, we'll break these behaviors out into MCP tools so that Claude can decide *when* and *how* to use them. Instead of rigid if/else logic, an LLM will be making the decisions.

---

## Tutorial 3: MCP Server

> **Goal:** Build an MCP server that exposes bot actions as tools, so Claude can control your Minecraft bot.
>
> **Code:** [`mcp/`](mcp/)

### What you'll learn

- What MCP (Model Context Protocol) is and why it matters
- Designing good MCP tools — specific, well-named actions
- Connecting Claude to your Minecraft bot through MCP
- The difference between hardcoded bot behavior and LLM-driven control

### Tools we'll build

| Tool | Description |
|------|-------------|
| `connect` | Connect the bot to a Minecraft server |
| `disconnect` | Disconnect the bot from the server |
| `status` | Get the bot's connection status, position, health, and food |
| `moveToCoordinates` | Navigate the bot to specific x, y, z coordinates |
| `followPlayer` | Follow a player, optionally protecting them from hostiles |
| `stopMovement` | Stop the bot's current movement and protection |

### Overview

In the first two tutorials, we wrote bots with hardcoded behavior — the bot *always* follows, *always* attacks, and responds to a fixed set of chat patterns. What if instead of writing all that if/else logic ourselves, we let an LLM decide what to do?

That's what [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) enables. MCP lets you expose **tools** — well-defined actions with names, descriptions, and parameters — that an LLM like Claude can call. Instead of writing behavior logic, we write tools and let Claude figure out when to use them.

Here's the mental shift:
- **Tutorials 1 & 2:** We write the brain (if player nearby → follow, if hostile nearby → attack)
- **Tutorial 3:** We write the hands (tools the bot can use) and let Claude be the brain

### Step 1: Set up the project

```bash
mkdir mcp && cd mcp
npm init -y
npm install @modelcontextprotocol/sdk mineflayer mineflayer-pathfinder zod
npm install -D typescript @types/node tsx
```

New dependencies compared to the previous tutorials:
- **@modelcontextprotocol/sdk** — the official MCP SDK. It handles the protocol communication between Claude and our server.
- **zod** — a schema validation library. MCP uses it to define the shape of each tool's input parameters. When Claude calls a tool, zod validates that the arguments are correct.
- **tsx** — lets us run TypeScript directly without a compile step. Useful during development.

Set up `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

And update `package.json` to add `"type": "module"` and scripts:

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  }
}
```

### Step 2: Create the MCP server and bot state

Create `src/index.ts`. We start with imports and global bot state:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import mineflayer, { Bot } from "mineflayer";
import mineflayerPathfinder from "mineflayer-pathfinder";

const { pathfinder, Movements, goals } = mineflayerPathfinder;
const { GoalNear } = goals;
```

A few things to note:
- **StdioServerTransport** — MCP servers communicate over stdin/stdout. Claude Desktop and Claude Code both launch the server as a subprocess and talk to it through these pipes. This is why you never see an HTTP server or port — it's all stdio.
- We only need **GoalNear** from pathfinder — same as Tutorials 1 and 2.

Next, the bot state and a helper:

```ts
let bot: Bot | null = null;
let botReady = false;
let followInterval: ReturnType<typeof setInterval> | null = null;

function requireBot(): Bot {
  if (!bot || !botReady) {
    throw new Error("Bot is not connected. Use the connect tool first.");
  }
  return bot;
}
```

The bot starts as `null` — unlike Tutorials 1 and 2 where the bot connects immediately on startup, here the MCP server starts first and Claude decides *when* to connect (the `connect` tool's parameters have sensible defaults). The `requireBot()` helper is used by every tool that needs an active bot, giving Claude a clear error message if it tries to act before connecting. The `followInterval` tracks the active follow/protect loop so we can clean it up when stopping.

Now create the MCP server:

```ts
const server = new McpServer({
  name: "minecraft-mcp",
  version: "1.0.0",
});
```

### Step 3: Connection tools

The `connect` tool creates a mineflayer bot — similar to Tutorials 1 and 2, but now Claude provides the parameters:

```ts
server.tool(
  "connect",
  "Connect the bot to a Minecraft server",
  {
    host: z.string().optional().describe("Server host (default: localhost)"),
    port: z.number().optional().describe("Server port (default: 25565)"),
    username: z.string().optional().describe("Bot username (default: mcp-bot)"),
    auth: z
      .enum(["offline", "microsoft"])
      .optional()
      .describe("Auth mode (default: offline)"),
  },
  async ({ host, port, username, auth }) => {
    if (bot && botReady) {
      return {
        content: [
          { type: "text", text: "Bot is already connected. Use disconnect first." },
        ],
      };
    }

    const connectHost = host || "localhost";
    const connectPort = port || 25565;
    const connectUsername = username || "mcp-bot";
    const connectAuth = auth || "offline";

    return new Promise((resolve) => {
      bot = mineflayer.createBot({
        host: connectHost,
        port: connectPort,
        username: connectUsername,
        auth: connectAuth as "offline" | "microsoft",
      });

      bot.on("spawn", async () => {
        try {
          bot!.loadPlugin(pathfinder);
          bot!.pathfinder.setMovements(new Movements(bot!));
          await bot!.waitForChunksToLoad();
          botReady = true;
          resolve({
            content: [
              {
                type: "text",
                text: `Connected to ${connectHost}:${connectPort} as ${connectUsername}. Bot is ready.`,
              },
            ],
          });
        } catch (err: unknown) {
          const error = err as Error;
          resolve({
            content: [
              { type: "text", text: `Spawn error: ${error.message}` },
            ],
            isError: true,
          });
        }
      });

      bot.on("error", (err) => {
        botReady = false;
        resolve({
          content: [
            { type: "text", text: `Connection error: ${err.message}` },
          ],
          isError: true,
        });
      });

      bot.on("kicked", (reason) => {
        botReady = false;
        resolve({
          content: [
            { type: "text", text: `Kicked from server: ${reason}` },
          ],
          isError: true,
        });
      });

      setTimeout(() => {
        if (!botReady) {
          resolve({
            content: [
              { type: "text", text: "Connection timeout after 30 seconds." },
            ],
            isError: true,
          });
        }
      }, 30000);
    });
  }
);
```

Let's break down the `server.tool()` pattern — you'll see it for every tool:

1. **Name** (`"connect"`) — what Claude sees and calls.
2. **Description** (`"Connect the bot to a Minecraft server"`) — Claude reads this to understand *when* to use the tool. Write these like you're explaining to a person.
3. **Parameters** (the zod schema) — defines what arguments the tool accepts. The `.describe()` strings help Claude understand what to pass. Optional parameters have defaults.
4. **Handler** (the async function) — runs when Claude calls the tool. Returns `content` with the result text.

The handler itself is mostly the same as `mineflayer.createBot()` from Tutorial 1, wrapped in a Promise so the tool waits for the bot to spawn before responding. We also handle errors and kicks so Claude gets useful feedback instead of a silent failure.

The `disconnect` tool is simpler:

```ts
server.tool(
  "disconnect",
  "Disconnect the bot from the Minecraft server",
  {},
  async () => {
    if (!bot) {
      return {
        content: [{ type: "text", text: "Bot is not connected." }],
      };
    }

    bot.end();
    bot = null;
    botReady = false;

    return {
      content: [{ type: "text", text: "Disconnected from server." }],
    };
  }
);
```

And a `status` tool so Claude can check on the bot:

```ts
server.tool(
  "status",
  "Get the bot's current connection status and basic info",
  {},
  async () => {
    if (!bot || !botReady) {
      return {
        content: [{ type: "text", text: "Bot is not connected." }],
      };
    }

    const pos = bot.entity.position;
    const health = bot.health;
    const food = bot.food;

    return {
      content: [
        {
          type: "text",
          text: [
            `Username: ${bot.username}`,
            `Position: ${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}`,
            `Health: ${health}/20`,
            `Food: ${food}/20`,
          ].join("\n"),
        },
      ],
    };
  }
);
```

This gives Claude awareness of the bot's state — position, health, food level. Without this, Claude would be flying blind.

### Step 4: Movement tools

Now we build the tools that map to the behaviors we hardcoded in Tutorials 1 and 2. An important design decision: **movement tools should be non-blocking**. If `followPlayer` blocked until it was done, Claude couldn't call any other tools while the bot was following. Instead, we start the action and return immediately — the bot continues in the background.

**moveToCoordinates** — the pathfinder navigation from Tutorial 2's coordinate handling, but now Claude provides the coordinates directly:

```ts
server.tool(
  "moveToCoordinates",
  "Navigate the bot to specific x, y, z coordinates. Returns immediately — use status to check progress.",
  {
    x: z.number().describe("X coordinate"),
    y: z.number().describe("Y coordinate"),
    z: z.number().describe("Z coordinate"),
    range: z
      .number()
      .optional()
      .describe("How close to get to the target (default: 2 blocks)"),
  },
  async ({ x, y, z: zCoord, range }) => {
    const currentBot = requireBot();
    const goalRange = range ?? 2;

    currentBot.pathfinder.setGoal(new GoalNear(x, y, zCoord, goalRange));

    const pos = currentBot.entity.position;
    return {
      content: [
        {
          type: "text",
          text: `Navigating to ${x}, ${y}, ${zCoord} (within ${goalRange} blocks). Current position: ${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}`,
        },
      ],
    };
  }
);
```

We set the pathfinder goal and return immediately. The bot walks there in the background — Claude can use `status` to check progress or call other tools while the bot is moving. Note `z: zCoord` in the destructuring — we rename the parameter because `z` is already imported from zod.

**followPlayer** — combines the follow logic from Tutorial 1 with the hostile protection from Tutorial 2, using the same proven `setInterval` + `GoalNear` pattern:

```ts
server.tool(
  "followPlayer",
  "Follow a player by their username. Stops any active movement before following. Returns immediately — the bot keeps following in the background. Use stopMovement to stop.",
  {
    name: z.string().describe("Username of the player to follow"),
    range: z
      .number()
      .optional()
      .describe("How close to stay to the player (default: 3 blocks)"),
    protectFromHostiles: z
      .boolean()
      .optional()
      .describe("Attack nearby hostile mobs while following (default: false)"),
    hostileRange: z
      .number()
      .optional()
      .describe("Range in blocks to scan for hostiles (default: 6). Only used when protectFromHostiles is true."),
  },
  async ({ name, range, protectFromHostiles, hostileRange }) => {
    const currentBot = requireBot();
    const followRange = range ?? 3;
    const protect = protectFromHostiles ?? false;
    const attackRange = hostileRange ?? 6;

    // Stop any active movement
    currentBot.pathfinder.stop();
    if (followInterval) {
      clearInterval(followInterval);
      followInterval = null;
    }

    const player = currentBot.players[name];
    if (!player?.entity) {
      return {
        content: [
          {
            type: "text",
            text: `Player "${name}" is not nearby or not visible.`,
          },
        ],
        isError: true,
      };
    }

    followInterval = setInterval(() => {
      const target = currentBot.nearestEntity(
        (e) => e.type === "player" && e.username === name
      );
      if (target) {
        const { x, y, z } = target.position;
        currentBot.pathfinder.setGoal(new GoalNear(x, y, z, followRange));
      }

      if (protect) {
        for (const entityId of Object.keys(currentBot.entities)) {
          const entity = currentBot.entities[entityId];
          if (
            entity.type === "hostile" &&
            currentBot.entity.position.distanceTo(entity.position) <= attackRange
          ) {
            currentBot.lookAt(entity.position, true).then(() => {
              currentBot.attack(entity);
            }).catch(() => {
              // Entity may have died or moved out of range
            });
          }
        }
      }
    }, 500);

    const mode = protect
      ? `following and protecting from hostiles within ${attackRange} blocks`
      : "following";
    return {
      content: [
        {
          type: "text",
          text: `Now ${mode} ${name} (staying within ${followRange} blocks). Use stopMovement to stop.`,
        },
      ],
    };
  }
);
```

A few things to notice:

1. **Stops existing movement first** — if the bot was already following someone or navigating, we clean that up before starting. This prevents multiple intervals from stacking up.
2. **Same pattern as Tutorial 1** — a `setInterval` that runs every 500ms, finds the player with `nearestEntity`, and sets a `GoalNear` goal. We use this instead of pathfinder's `GoalFollow` because it's the pattern we've already proven works.
3. **Protection is built-in** — when `protectFromHostiles` is `true`, the same interval loop also scans for hostiles and attacks them. This mirrors Tutorial 2's behavior, but now Claude decides whether to enable it via a parameter.
4. **Non-blocking** — the tool sets up the interval and returns immediately. Claude can call other tools while the bot follows.

**stopMovement** — a simple tool to cancel everything:

```ts
server.tool(
  "stopMovement",
  "Stop the bot's current movement (following, navigating, etc.) and hostile protection.",
  {},
  async () => {
    const currentBot = requireBot();
    currentBot.pathfinder.stop();
    if (followInterval) {
      clearInterval(followInterval);
      followInterval = null;
    }
    const pos = currentBot.entity.position;
    return {
      content: [
        {
          type: "text",
          text: `Stopped. Position: ${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}`,
        },
      ],
    };
  }
);
```

This clears the pathfinder goal and the follow/protect interval. Without this, the only way to stop the bot would be to disconnect it.

### Step 5: Start the server

```ts
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

That's the entire server startup. `StdioServerTransport` hooks up stdin/stdout, and `server.connect()` starts listening for tool calls from Claude.

### Building and running

Build the project:

```bash
cd mcp
npm install
npm run build
```

For development, you can use `npm run dev` to run directly without compiling.

### Setup with Claude Desktop

Add the following to your Claude Desktop MCP config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "node",
      "args": ["path/to/mcp/dist/index.js"]
    }
  }
}
```

### Setup with Claude Code

```bash
claude mcp add minecraft node <path-to-repo>/mcp/dist/index.js
```

### Try it out

Once configured, you can ask Claude things like:
- *"Connect the bot to my Minecraft server"*
- *"What's the bot's status?"*
- *"Move the bot to coordinates 100, 64, -200"*
- *"Follow the player Synacktra and protect him from hostiles"*
- *"Stop the bot from following me"*

The key difference from Tutorials 1 and 2: you're not writing behavior logic anymore. Claude reads the tool descriptions, understands the game context from your messages, and decides which tools to call. You could ask it *"follow me and protect me from mobs"* and it would call `followPlayer` with `protectFromHostiles: true` — the same behavior we hardcoded in Tutorial 2, but now driven by an LLM.
