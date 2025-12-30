import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import { Client, GatewayIntentBits, Partials, EmbedBuilder } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import storage from './storage.js';
import { createWebhookHandler } from './webhook.js';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN in .env');
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error('Missing CLIENT_ID in .env');
  process.exit(1);
}
if (!GUILD_ID) {
  console.warn('GUILD_ID not set — recommended for guild-only command registration');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Define commands
const commands = [
  {
    name: 'set-feed-channel',
    description: 'Set the channel where GitHub feed (commits, PRs, issues, actions) will be posted',
    options: [
      {
        name: 'channel',
        description: 'The channel to use for the feed',
        type: 7, // Channel
        required: true
      }
    ]
  },
  {
    name: 'set-release-channel',
    description: 'Set the channel where GitHub releases (including pre-releases) will be posted',
    options: [
      {
        name: 'channel',
        description: 'The channel to use for release messages',
        type: 7,
        required: true
      }
    ]
  },
  {
    name: 'show-github-channels',
    description: 'Show configured GitHub feed and release channels for this server'
  }
];

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log('Registered guild commands');
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('Registered global commands (may take up to 1 hour to appear)');
    }
  } catch (err) {
    console.error('Error registering commands', err);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;
  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.reply({ content: 'This bot only works inside a server.', ephemeral: true });
  }

  if (commandName === 'set-feed-channel') {
    if (!interaction.memberPermissions || !interaction.memberPermissions.has('ManageGuild')) {
      // fallback check
      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.permissions.has('ManageGuild')) {
          return interaction.reply({ content: 'You need Manage Server permission to run this command.', ephemeral: true });
        }
      } catch (e) {
        // ignore
      }
    }
    const channel = interaction.options.getChannel('channel');
    const settings = storage.get(guildId) || {};
    settings.feedChannel = channel.id;
    storage.set(guildId, settings);
    await interaction.reply({ content: `Feed channel set to ${channel}`, ephemeral: false });
  } else if (commandName === 'set-release-channel') {
    if (!interaction.memberPermissions || !interaction.memberPermissions.has('ManageGuild')) {
      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.permissions.has('ManageGuild')) {
          return interaction.reply({ content: 'You need Manage Server permission to run this command.', ephemeral: true });
        }
      } catch (e) {
      }
    }
    const channel = interaction.options.getChannel('channel');
    const settings = storage.get(guildId) || {};
    settings.releaseChannel = channel.id;
    storage.set(guildId, settings);
    await interaction.reply({ content: `Release channel set to ${channel}`, ephemeral: false });
  } else if (commandName === 'show-github-channels') {
    const settings = storage.get(guildId) || {};
    const feed = settings.feedChannel ? `<#${settings.feedChannel}>` : 'Not set';
    const releases = settings.releaseChannel ? `<#${settings.releaseChannel}>` : 'Not set';
    await interaction.reply({ content: `Feed channel: ${feed}\nRelease channel: ${releases}`, ephemeral: true });
  }
});

// Start webhook server
const app = express();
createWebhookHandler({ app, client, storage });

app.get('/', (req, res) => res.send('Discord GitHub Feed Bot is running'));

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});

client.login(TOKEN).catch(err => {
  console.error('Failed to login', err);
  process.exit(1);
});
