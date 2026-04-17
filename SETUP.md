# Setup Guide

Everything you need to get started with the Hacking Minecraft with AI tutorials.

## 1. Node.js

We use Node.js to run our bots and MCP server.

1. Download the LTS version from [nodejs.org](https://nodejs.org/en/download)
2. Follow the installer for your platform
3. Verify it's installed:

```bash
node --version
npm --version
```

## 2. Java

PaperMC requires Java 21 or newer to run.

1. Download from [adoptium.net](https://adoptium.net/) (Eclipse Temurin, JDK 21+)
2. Follow the installer for your platform
3. Verify it's installed:

```bash
java --version
```

## 3. Minecraft Server (PaperMC)

We use [PaperMC](https://papermc.io/) — a high-performance Minecraft server that's easy to set up.

1. Download the latest build from [papermc.io/downloads](https://papermc.io/downloads/paper) — note the Minecraft version (e.g. 1.21.4), you'll need it in the next step
2. Create a folder for your server and move the downloaded jar into it
3. Run the server:

```bash
java -Xms3G -Xmx3G -jar path/to/paper-1.21.4-XXX.jar --nogui
```

4. On first run, it will generate files and stop. Open `eula.txt` and change `eula=false` to `eula=true`
5. Run the server again — it will generate the world and start listening on port `25565`

## 4. Minecraft Client (TLauncher)

To join the server yourself and see your bots in action, you'll need a Minecraft client. [TLauncher](https://tlauncher.org/) is a free launcher that works with offline-mode servers.

1. Create an account at [tlauncher.org](https://tlauncher.org/) if you don't already have one
2. Download TLauncher and install it
3. Log in and pick a username (this is what you'll pass as `--player` to your bots)
4. Select **OptiFine** as the version

   > [!NOTE]
   > Make sure the Minecraft version matches your PaperMC server (e.g. if your server is 1.21.4, select OptiFine 1.21.4).

5. Click **Enter the game**
6. Once in the main menu, go to **Multiplayer** → **Add Server**
   - Server Address: `localhost:25565`
   - Click **Done**, then join the server

You should now be in your local server. Leave it running while you work through the tutorials.

## 5. Claude Desktop or Claude Code

For the MCP tutorial, you'll need either Claude Desktop or Claude Code to connect to the MCP server.

### Claude Desktop

1. Download from [claude.ai/download](https://claude.ai/download)
2. Install and sign in with your Anthropic account

### Claude Code

1. Install via npm:

```bash
npm install -g @anthropic-ai/claude-code
```

2. Run `claude` and follow the authentication prompts

## You're all set

Once you have all of these running, head to [CURRICULUM.md](CURRICULUM.md) to start the tutorials.
