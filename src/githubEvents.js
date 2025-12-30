import { EmbedBuilder } from 'discord.js';

function formatRepo(repo) {
  return `**${repo.full_name}**`;
}

async function sendToConfiguredChannels({ client, storage, isRelease, message }) {
  // For each guild configured, send to appropriate channel
  const all = await storage.loadAll();
  for (const [guildId, settings] of Object.entries(all || {})) {
    const channelId = isRelease ? settings.releaseChannel : settings.feedChannel;
    if (!channelId) continue;
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) continue;
      await channel.send({ embeds: [message] });
    } catch (e) {
      console.error('Failed to send message to channel', channelId, e);
    }
  }
}

export async function handleGithubEvent({ client, storage, event, payload }) {
  // Ignore pings
  if (event === 'ping') return;

  // Releases are routed to the release channel
  if (event === 'release') {
    const repo = payload.repository;
    const release = payload.release;
    const embed = new EmbedBuilder()
      .setTitle(`Release: ${release.name || release.tag_name}`)
      .setURL(release.html_url)
      .setDescription(release.body ? (release.body.slice(0, 2048)) : '')
      .addFields(
        { name: 'Repository', value: formatRepo(repo) },
        { name: 'Tag', value: release.tag_name || 'unknown', inline: true },
        { name: 'Pre-release', value: release.prerelease ? 'Yes' : 'No', inline: true }
      )
      .setTimestamp(new Date(release.published_at || Date.now()));

    await sendToConfiguredChannels({ client, storage, isRelease: true, message: embed });
    return;
  }

  // All other events go to the feed channel
  if (event === 'push') {
    const repo = payload.repository;
    const commits = payload.commits || [];
    const pusher = payload.pusher ? payload.pusher.name : payload.sender?.login;
    const embed = new EmbedBuilder()
      .setTitle(`Push to ${payload.ref}`)
      .setURL(payload.compare)
      .setDescription(`${commits.length} commit(s) by ${pusher}`)
      .setTimestamp(new Date(payload.head_commit?.timestamp || Date.now()));

    const commitFields = commits.slice(0, 5).map(c => ({ name: c.id.slice(0, 7) + ' - ' + c.message.split('\n')[0], value: `[View commit](${c.url}) by ${c.author?.name || c.author?.username}` }));
    for (const f of commitFields) embed.addFields(f);

    await sendToConfiguredChannels({ client, storage, isRelease: false, message: embed });
    return;
  }

  if (event === 'pull_request') {
    const pr = payload.pull_request;
    const action = payload.action;
    const repo = payload.repository;
    const embed = new EmbedBuilder()
      .setTitle(`PR ${action}: #${pr.number} ${pr.title}`)
      .setURL(pr.html_url)
      .setDescription(pr.body ? pr.body.slice(0, 2048) : '')
      .addFields({ name: 'Author', value: pr.user.login, inline: true }, { name: 'State', value: pr.state, inline: true })
      .setTimestamp(new Date(pr.updated_at));

    await sendToConfiguredChannels({ client, storage, isRelease: false, message: embed });
    return;
  }

  if (event === 'issues') {
    const issue = payload.issue;
    const action = payload.action;
    const embed = new EmbedBuilder()
      .setTitle(`Issue ${action}: #${issue.number} ${issue.title}`)
      .setURL(issue.html_url)
      .setDescription(issue.body ? issue.body.slice(0, 2048) : '')
      .addFields({ name: 'Author', value: issue.user.login, inline: true }, { name: 'State', value: issue.state, inline: true })
      .setTimestamp(new Date(issue.updated_at));

    await sendToConfiguredChannels({ client, storage, isRelease: false, message: embed });
    return;
  }

  if (event === 'workflow_run' || event === 'workflow_job') {
    const run = payload.workflow_run || payload.workflow_job;
    const name = run.name || run.workflow_name || run.job_name || 'Workflow';
    const status = run.conclusion || run.status || 'unknown';
    const html_url = run.html_url || run.workflow_run?.html_url || run.job_url;

    const embed = new EmbedBuilder()
      .setTitle(`Action ${event}: ${name}`)
      .setURL(html_url)
      .setDescription(`Status: ${status}`)
      .setTimestamp(new Date(run.updated_at || Date.now()));

    await sendToConfiguredChannels({ client, storage, isRelease: false, message: embed });
    return;
  }

  // Generic fallback: notify of the event
  const embed = new EmbedBuilder()
    .setTitle(`GitHub event: ${event}`)
    .setDescription('See the webhook payload for details.')
    .setTimestamp(new Date());

  await sendToConfiguredChannels({ client, storage, isRelease: false, message: embed });
}
