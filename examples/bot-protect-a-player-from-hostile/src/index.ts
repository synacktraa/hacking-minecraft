/**
 * Script for creating a bot to follow and protect a particular (nearby) player from hostiles
 *
 * Usage:
 * npx tsx src/index.ts --player <name> [--interval <ms>] [--range <blocks>] [--bot <name>]
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import mineflayer from 'mineflayer';
import mineflayerPathfinder from 'mineflayer-pathfinder';

const { pathfinder, Movements, goals } = mineflayerPathfinder;
const { GoalNear } = goals;

// Parse command line arguments
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
  .usage('Usage: $0 --player <name> [--interval <ms>] [--range <blocks>] [--bot <name>]')
  .help()
  .alias('help', 'h')
  .parseSync();

// Extract parameters from parsed arguments
const playerName = argv.player;
const interval = argv.interval;
const playerRange = argv.range;
const hostileRange = argv.range * 1.5;
const botName = argv.bot;

// Add state flags
let needsPlayerCoords = false;
let isNavigatingToCoords = false;

// Helper function to parse coordinates from different formats
function parseCoordinates(message: string) {
  // Try different coordinate formats:
  // Space separated: "100 64 -200"
  // Comma separated: "100,64,-200"
  // Forward slash separated: "100/64/-200"
  const coordPatterns = [
    /(-?\d+)\s+(-?\d+)\s+(-?\d+)/, // space separated
    /(-?\d+),\s*(-?\d+),\s*(-?\d+)/, // comma separated
    /(-?\d+)\/(-?\d+)\/(-?\d+)/ // forward slash separated
  ];

  for (const pattern of coordPatterns) {
    const match = message.match(pattern);
    if (match) {
      const [_, x, y, z] = match;
      return {
        x: parseInt(x),
        y: parseInt(y),
        z: parseInt(z)
      };
    }
  }
  return null;
}

const bot = mineflayer.createBot({ host: 'localhost', username: botName });

bot.on('spawn', () => {
  // Load the pathfinder plugin and set the movements
  bot.loadPlugin(pathfinder);
  bot.pathfinder.setMovements(new Movements(bot));

  bot.chat(`Hey, ${playerName}, I am here!`);

  // Check for the player every {interval} ms
  setInterval(() => {
    // Skip coordinate check if already navigating to coordinates
    if (isNavigatingToCoords) return;

    // Find the nearest entity with the given name
    const player = bot.nearestEntity((e) => e.type === 'player' && e.username === playerName);

    if (player) {
      needsPlayerCoords = false;
      // Player found, set the goal to follow them
      const { x, y, z } = player.position;
      bot.pathfinder.setGoal(new GoalNear(x, y, z, playerRange));

      // Check for hostile entities and attack them
      bot.nearestEntity((e) => {
        if (e.type !== 'hostile') {
          return false;
        }
        if (bot.entity.position.distanceTo(e.position) <= hostileRange) {
          bot.lookAt(e.position, true).then(() => {
            bot.attack(e)
          });
        }
        return true;
      });
    } else if (!needsPlayerCoords) {
      // Only ask for coordinates if we haven't already
      needsPlayerCoords = true;
      bot.chat(`${playerName}, I can't find you! Please share your coordinates (space, comma, or slash separated).`);
    }
  }, interval);
});

// Listen for chat messages to get coordinates
bot.on('chat', (username, message) => {
  if (username === playerName) {
    const coords = parseCoordinates(message);
    if (coords) {
      const { x, y, z } = coords;
      bot.chat(`Thanks! I'm coming to coordinates: ${x}, ${y}, ${z}`);
      isNavigatingToCoords = true;
      needsPlayerCoords = false;

      bot.pathfinder.setGoal(new GoalNear(x, y, z, playerRange));

      bot.nearestEntity((e) => {
        if (e.type !== 'hostile') {
          return false;
        }
        bot.attack(e);
        return true;
      });

      // Reset navigation flag when we get close to the target and print progress
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
      }, 4000); // Print coords less frequently than the main check interval
    }
  }
});
