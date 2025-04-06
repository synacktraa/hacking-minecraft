> Make sure you have [node.js](https://nodejs.org/en/download) installed.

## Bots

### bot-follow-a-player

This bot will follow a (nearby) player with a given name.

```
Usage: index.js --player <name> [--interval <ms>] [--range <blocks>] [--bot
<name>]

Options:
      --version   Show version number                                  [boolean]
  -p, --player    Name of the player to follow               [string] [required]
  -i, --interval  Interval in ms to check for the player [number] [default: 500]
  -r, --range     Range in blocks to check for the player  [number] [default: 3]
  -b, --bot       Name for the bot                     [string] [default: "bot"]
  -h, --help      Show help                                            [boolean]
```

```bash
cd bot-follow-a-player
node index.js --player <name>
```

---

### bot-protect-a-player-from-hostile

This bot will protect a (nearby) player with a given name from hostiles.

```
Usage: index.js --player <name> [--interval <ms>] [--range <blocks>] [--bot
<name>]

Options:
      --version   Show version number                                  [boolean]
  -p, --player    Name of the player to follow               [string] [required]
  -i, --interval  Interval in ms to check for the player [number] [default: 500]
  -r, --range     Range in blocks to check for the player  [number] [default: 3]
  -b, --bot       Name for the bot                     [string] [default: "bot"]
  -h, --help      Show help                                            [boolean]
```

```bash
cd bot-protect-a-player-from-hostile
node index.js --player <name>
```

---