/**
 * Script for creating a bot to follow and protect a particular (nearby) player from hostiles
 * 
 * Usage:
 * node index.js --player <name> [--interval <ms>] [--range <blocks>] [--bot <name>]
 */

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

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
  .argv;

// Extract parameters from parsed arguments
const playerName = argv.player;
const interval = argv.interval;
const range = argv.range;
const botName = argv.bot;

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder');

const bot = mineflayer.createBot({
  host: 'localhost',
  username: botName,
});

bot.on('spawn', () => {
  // Load the pathfinder plugin and set the movements
  bot.loadPlugin(pathfinder);
  bot.pathfinder.setMovements(new Movements(bot));
  
  bot.chat(`Hey, ${playerName}, I am here!`);

  // Check for the player every {interval} ms
  setInterval(() => {
    // Find the nearest entity with the given name
    const entity = bot.nearestEntity((e) => e.username === playerName);
    if (entity !== null) {
      // Set the goal to the player
      const { x, y, z } = entity.position;
      bot.pathfinder.setGoal(new GoalNear(x, y, z, range));

      // Check for hostile entity within bot's range in all directions
      bot.nearestEntity((e) => {
        if (e.type !== 'hostile' || !e.position || !bot.entity?.position) {
          return false;
        }

        const dx = Math.abs(e.position.x - bot.entity.position.x);
        const dy = Math.abs(e.position.y - bot.entity.position.y);
        const dz = Math.abs(e.position.z - bot.entity.position.z);
    
        if (dx <= 5 && dy <= 5 && dz <= 5) {
          bot.attack(e)
        }
        return true
      });
    }
  }, interval);
});