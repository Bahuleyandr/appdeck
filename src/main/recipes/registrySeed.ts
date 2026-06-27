import type { RecipeRegistryEntry, ServiceCategory } from '../../shared/types.js';

interface SeedBase {
  name: string;
  category: ServiceCategory;
  url: string;
  aliases?: string[];
}

const BASE_APPS: SeedBase[] = [
  { name: 'Gmail', category: 'Email', url: 'https://mail.google.com', aliases: ['Google Mail'] },
  {
    name: 'Outlook',
    category: 'Email',
    url: 'https://outlook.live.com/mail/',
    aliases: ['Hotmail', 'Microsoft Mail']
  },
  { name: 'Proton Mail', category: 'Email', url: 'https://mail.proton.me/' },
  { name: 'Yahoo Mail', category: 'Email', url: 'https://mail.yahoo.com/' },
  { name: 'iCloud Mail', category: 'Email', url: 'https://www.icloud.com/mail/' },
  { name: 'Fastmail', category: 'Email', url: 'https://app.fastmail.com/' },
  { name: 'Hey', category: 'Email', url: 'https://app.hey.com/' },
  { name: 'Slack', category: 'Chat', url: 'https://app.slack.com/' },
  { name: 'Discord', category: 'Chat', url: 'https://discord.com/app' },
  { name: 'Telegram Web', category: 'Chat', url: 'https://web.telegram.org/' },
  { name: 'WhatsApp Web', category: 'Chat', url: 'https://web.whatsapp.com/' },
  { name: 'Messenger', category: 'Chat', url: 'https://www.messenger.com/' },
  { name: 'Microsoft Teams', category: 'Chat', url: 'https://teams.microsoft.com/' },
  { name: 'Google Chat', category: 'Chat', url: 'https://chat.google.com/' },
  { name: 'Zoom', category: 'Productivity', url: 'https://app.zoom.us/wc/' },
  { name: 'Google Meet', category: 'Productivity', url: 'https://meet.google.com/' },
  { name: 'Notion', category: 'Productivity', url: 'https://www.notion.so/' },
  { name: 'Coda', category: 'Productivity', url: 'https://coda.io/' },
  { name: 'Airtable', category: 'Productivity', url: 'https://airtable.com/' },
  { name: 'Trello', category: 'Productivity', url: 'https://trello.com/' },
  { name: 'Asana', category: 'Productivity', url: 'https://app.asana.com/' },
  { name: 'ClickUp', category: 'Productivity', url: 'https://app.clickup.com/' },
  { name: 'Linear', category: 'Dev', url: 'https://linear.app/' },
  { name: 'Jira', category: 'Dev', url: 'https://jira.atlassian.com/' },
  {
    name: 'Confluence',
    category: 'Productivity',
    url: 'https://www.atlassian.com/software/confluence'
  },
  { name: 'Monday', category: 'Productivity', url: 'https://monday.com/' },
  { name: 'Todoist', category: 'Productivity', url: 'https://app.todoist.com/app' },
  { name: 'TickTick', category: 'Productivity', url: 'https://ticktick.com/webapp/' },
  { name: 'Google Calendar', category: 'Productivity', url: 'https://calendar.google.com/' },
  { name: 'Google Drive', category: 'Productivity', url: 'https://drive.google.com/' },
  { name: 'Google Docs', category: 'Productivity', url: 'https://docs.google.com/document/' },
  { name: 'Google Sheets', category: 'Productivity', url: 'https://docs.google.com/spreadsheets/' },
  { name: 'Google Keep', category: 'Productivity', url: 'https://keep.google.com/' },
  { name: 'Dropbox', category: 'Productivity', url: 'https://www.dropbox.com/' },
  { name: 'Box', category: 'Productivity', url: 'https://app.box.com/' },
  { name: 'OneDrive', category: 'Productivity', url: 'https://onedrive.live.com/' },
  { name: 'GitHub', category: 'Dev', url: 'https://github.com/' },
  { name: 'GitLab', category: 'Dev', url: 'https://gitlab.com/' },
  { name: 'Bitbucket', category: 'Dev', url: 'https://bitbucket.org/' },
  { name: 'Vercel', category: 'Dev', url: 'https://vercel.com/dashboard' },
  { name: 'Netlify', category: 'Dev', url: 'https://app.netlify.com/' },
  { name: 'Cloudflare', category: 'Dev', url: 'https://dash.cloudflare.com/' },
  { name: 'AWS Console', category: 'Dev', url: 'https://console.aws.amazon.com/' },
  { name: 'Azure Portal', category: 'Dev', url: 'https://portal.azure.com/' },
  { name: 'Google Cloud Console', category: 'Dev', url: 'https://console.cloud.google.com/' },
  { name: 'Sentry', category: 'Dev', url: 'https://sentry.io/' },
  { name: 'Datadog', category: 'Dev', url: 'https://app.datadoghq.com/' },
  { name: 'Grafana Cloud', category: 'Dev', url: 'https://grafana.com/' },
  { name: 'Stack Overflow', category: 'Dev', url: 'https://stackoverflow.com/' },
  { name: 'ChatGPT', category: 'AI', url: 'https://chatgpt.com/' },
  { name: 'Claude', category: 'AI', url: 'https://claude.ai/' },
  { name: 'Gemini', category: 'AI', url: 'https://gemini.google.com/' },
  { name: 'Perplexity', category: 'AI', url: 'https://www.perplexity.ai/' },
  { name: 'Microsoft Copilot', category: 'AI', url: 'https://copilot.microsoft.com/' },
  { name: 'Poe', category: 'AI', url: 'https://poe.com/' },
  { name: 'Hugging Face', category: 'AI', url: 'https://huggingface.co/' },
  { name: 'X', category: 'Social', url: 'https://x.com/', aliases: ['Twitter'] },
  { name: 'LinkedIn', category: 'Social', url: 'https://www.linkedin.com/feed/' },
  { name: 'Facebook', category: 'Social', url: 'https://www.facebook.com/' },
  { name: 'Instagram', category: 'Social', url: 'https://www.instagram.com/' },
  { name: 'Threads', category: 'Social', url: 'https://www.threads.net/' },
  { name: 'Reddit', category: 'Social', url: 'https://www.reddit.com/' },
  { name: 'Bluesky', category: 'Social', url: 'https://bsky.app/' },
  { name: 'Mastodon', category: 'Social', url: 'https://mastodon.social/' },
  { name: 'YouTube', category: 'Media', url: 'https://www.youtube.com/' },
  { name: 'YouTube Music', category: 'Media', url: 'https://music.youtube.com/' },
  { name: 'Spotify', category: 'Media', url: 'https://open.spotify.com/' },
  { name: 'Apple Music', category: 'Media', url: 'https://music.apple.com/' },
  { name: 'Twitch', category: 'Media', url: 'https://www.twitch.tv/' },
  { name: 'Figma', category: 'Productivity', url: 'https://www.figma.com/files/' },
  { name: 'Canva', category: 'Productivity', url: 'https://www.canva.com/' },
  { name: 'Miro', category: 'Productivity', url: 'https://miro.com/app/' },
  { name: 'Loom', category: 'Productivity', url: 'https://www.loom.com/' },
  { name: 'Intercom', category: 'Productivity', url: 'https://app.intercom.com/' },
  { name: 'Zendesk', category: 'Productivity', url: 'https://www.zendesk.com/' },
  { name: 'HubSpot', category: 'Productivity', url: 'https://app.hubspot.com/' },
  { name: 'Salesforce', category: 'Productivity', url: 'https://login.salesforce.com/' },
  { name: 'Stripe', category: 'Productivity', url: 'https://dashboard.stripe.com/' },
  { name: 'Shopify', category: 'Productivity', url: 'https://admin.shopify.com/' },
  { name: 'WordPress', category: 'Productivity', url: 'https://wordpress.com/' },
  { name: 'Webflow', category: 'Productivity', url: 'https://webflow.com/dashboard' },
  { name: 'Mailchimp', category: 'Productivity', url: 'https://login.mailchimp.com/' },
  { name: 'Brevo', category: 'Productivity', url: 'https://app.brevo.com/' },
  { name: 'Zapier', category: 'Productivity', url: 'https://zapier.com/app/home' },
  { name: 'Make', category: 'Productivity', url: 'https://www.make.com/' },
  { name: 'Calendly', category: 'Productivity', url: 'https://calendly.com/app' },
  { name: '1Password', category: 'Productivity', url: 'https://my.1password.com/' },
  { name: 'Bitwarden', category: 'Productivity', url: 'https://vault.bitwarden.com/' }
];

const VARIANTS = [
  '',
  'Inbox',
  'Admin',
  'Dashboard',
  'Console',
  'Workspace',
  'Personal',
  'Business',
  'Team',
  'Support',
  'Docs',
  'Calendar',
  'Tasks',
  'Reports',
  'Analytics',
  'Mobile',
  'Lite',
  'Portal'
];

export function generateSeedRegistryEntries(now = Date.now()): RecipeRegistryEntry[] {
  const entries: RecipeRegistryEntry[] = [];
  for (const app of BASE_APPS) {
    for (const variant of VARIANTS) {
      const displayName = variant ? `${app.name} ${variant}` : app.name;
      entries.push({
        id: `seed-${slug(displayName)}`,
        name: displayName,
        category: app.category,
        start_url: app.url,
        allowed_domains: domainsFor(app.url),
        aliases: [...(app.aliases ?? []), app.name, variant].filter(Boolean),
        icon: null,
        icon_path: null,
        default_user_agent: null,
        unread_spec: { titleRegex: '\\((\\d+)\\)' },
        mobile_mode: variant === 'Mobile',
        source: 'seed',
        created_at: now,
        updated_at: now
      });
    }
  }
  return entries;
}

function domainsFor(url: string): string[] {
  try {
    const host = new URL(url).hostname;
    return [host, host.replace(/^www\./, '')];
  } catch {
    return [];
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
