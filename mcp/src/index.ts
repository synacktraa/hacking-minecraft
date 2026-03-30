import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import mineflayer, { Bot } from "mineflayer";
import mineflayerPathfinder from "mineflayer-pathfinder";

const { pathfinder, Movements, goals } = mineflayerPathfinder;
const { GoalNear } = goals;

// Bot state
let bot: Bot | null = null;
let botReady = false;
let followInterval: ReturnType<typeof setInterval> | null = null;

// Helper to check bot is connected
function requireBot(): Bot {
  if (!bot || !botReady) {
    throw new Error("Bot is not connected. Use the connect tool first.");
  }
  return bot;
}

// Create the MCP server
const server = new McpServer({
  name: "minecraft-mcp",
  version: "1.0.0",
});

// --- Connection tools ---

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

// --- Movement tools ---

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

    const mode = protect ? `following and protecting from hostiles within ${attackRange} blocks` : "following";
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
