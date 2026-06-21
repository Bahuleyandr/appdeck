import type { DeclarativeUnreadSpec } from '../../../shared/types.js';
import type { Recipe } from '../types.js';

// Many web apps put the unread count at the start of the document title, e.g. "(3) Inbox".
const TITLE_COUNT: DeclarativeUnreadSpec = { titleRegex: '^\\((\\d+)\\)' };

// Broad built-in catalog beyond messaging. Auth/login domains are allow-listed so OAuth and
// sign-in redirects stay inside the service pane instead of bouncing to the system browser.
export const extraRecipes: Recipe[] = [
  // --- Email ---
  { id: 'outlook', name: 'Outlook', category: 'Email', startUrl: 'https://outlook.live.com/mail/', allowedDomains: ['outlook.live.com', 'outlook.office.com', 'outlook.office365.com', 'login.live.com', 'login.microsoftonline.com', 'live.com', 'office.com'], unread: TITLE_COUNT },
  { id: 'protonmail', name: 'Proton Mail', category: 'Email', startUrl: 'https://mail.proton.me/u/0/', allowedDomains: ['mail.proton.me', 'account.proton.me', 'proton.me'], unread: TITLE_COUNT },
  { id: 'yahoomail', name: 'Yahoo Mail', category: 'Email', startUrl: 'https://mail.yahoo.com/', allowedDomains: ['mail.yahoo.com', 'login.yahoo.com', 'yahoo.com'], unread: TITLE_COUNT },
  { id: 'icloudmail', name: 'iCloud Mail', category: 'Email', startUrl: 'https://www.icloud.com/mail/', allowedDomains: ['icloud.com', 'www.icloud.com', 'apple.com', 'idmsa.apple.com'] },

  // --- Chat ---
  { id: 'teams', name: 'Microsoft Teams', category: 'Chat', startUrl: 'https://teams.microsoft.com/', allowedDomains: ['teams.microsoft.com', 'teams.live.com', 'login.microsoftonline.com', 'microsoft.com', 'office.com', 'live.com'], unread: TITLE_COUNT },
  { id: 'googlechat', name: 'Google Chat', category: 'Chat', startUrl: 'https://chat.google.com/', allowedDomains: ['chat.google.com', 'mail.google.com', 'accounts.google.com', 'google.com'], unread: TITLE_COUNT },

  // --- Social ---
  { id: 'x', name: 'X', category: 'Social', startUrl: 'https://x.com/', allowedDomains: ['x.com', 'twitter.com', 'mobile.twitter.com', 't.co'], unread: TITLE_COUNT },
  { id: 'linkedin', name: 'LinkedIn', category: 'Social', startUrl: 'https://www.linkedin.com/feed/', allowedDomains: ['linkedin.com', 'www.linkedin.com'], unread: TITLE_COUNT },
  { id: 'facebook', name: 'Facebook', category: 'Social', startUrl: 'https://www.facebook.com/', allowedDomains: ['facebook.com', 'www.facebook.com'], unread: TITLE_COUNT },
  { id: 'instagram', name: 'Instagram', category: 'Social', startUrl: 'https://www.instagram.com/', allowedDomains: ['instagram.com', 'www.instagram.com'], unread: TITLE_COUNT },
  { id: 'reddit', name: 'Reddit', category: 'Social', startUrl: 'https://www.reddit.com/', allowedDomains: ['reddit.com', 'www.reddit.com'] },
  { id: 'bluesky', name: 'Bluesky', category: 'Social', startUrl: 'https://bsky.app/', allowedDomains: ['bsky.app'], unread: TITLE_COUNT },

  // --- Dev ---
  { id: 'github', name: 'GitHub', category: 'Dev', startUrl: 'https://github.com/', allowedDomains: ['github.com', 'www.github.com'] },
  { id: 'gitlab', name: 'GitLab', category: 'Dev', startUrl: 'https://gitlab.com/', allowedDomains: ['gitlab.com'] },
  { id: 'linear', name: 'Linear', category: 'Dev', startUrl: 'https://linear.app/', allowedDomains: ['linear.app'] },
  { id: 'stackoverflow', name: 'Stack Overflow', category: 'Dev', startUrl: 'https://stackoverflow.com/', allowedDomains: ['stackoverflow.com', 'stackexchange.com'] },

  // --- AI ---
  { id: 'chatgpt', name: 'ChatGPT', category: 'AI', startUrl: 'https://chatgpt.com/', allowedDomains: ['chatgpt.com', 'chat.openai.com', 'auth.openai.com', 'openai.com'] },
  { id: 'claude', name: 'Claude', category: 'AI', startUrl: 'https://claude.ai/', allowedDomains: ['claude.ai', 'anthropic.com'] },
  { id: 'gemini', name: 'Gemini', category: 'AI', startUrl: 'https://gemini.google.com/', allowedDomains: ['gemini.google.com', 'accounts.google.com', 'google.com'] },
  { id: 'perplexity', name: 'Perplexity', category: 'AI', startUrl: 'https://www.perplexity.ai/', allowedDomains: ['perplexity.ai', 'www.perplexity.ai'] },
  { id: 'copilot', name: 'Microsoft Copilot', category: 'AI', startUrl: 'https://copilot.microsoft.com/', allowedDomains: ['copilot.microsoft.com', 'login.microsoftonline.com', 'microsoft.com'] },
  { id: 'grok', name: 'Grok', category: 'AI', startUrl: 'https://grok.com/', allowedDomains: ['grok.com'] },

  // --- Productivity ---
  { id: 'notion', name: 'Notion', category: 'Productivity', startUrl: 'https://www.notion.so/', allowedDomains: ['notion.so', 'www.notion.so'] },
  { id: 'trello', name: 'Trello', category: 'Productivity', startUrl: 'https://trello.com/', allowedDomains: ['trello.com', 'atlassian.com', 'id.atlassian.com'] },
  { id: 'todoist', name: 'Todoist', category: 'Productivity', startUrl: 'https://app.todoist.com/app', allowedDomains: ['todoist.com', 'app.todoist.com'] },
  { id: 'asana', name: 'Asana', category: 'Productivity', startUrl: 'https://app.asana.com/', allowedDomains: ['asana.com', 'app.asana.com'] },
  { id: 'clickup', name: 'ClickUp', category: 'Productivity', startUrl: 'https://app.clickup.com/', allowedDomains: ['clickup.com', 'app.clickup.com'] },
  { id: 'gcalendar', name: 'Google Calendar', category: 'Productivity', startUrl: 'https://calendar.google.com/', allowedDomains: ['calendar.google.com', 'accounts.google.com', 'google.com'] },
  { id: 'gkeep', name: 'Google Keep', category: 'Productivity', startUrl: 'https://keep.google.com/', allowedDomains: ['keep.google.com', 'accounts.google.com', 'google.com'] },
  { id: 'gdrive', name: 'Google Drive', category: 'Productivity', startUrl: 'https://drive.google.com/', allowedDomains: ['drive.google.com', 'docs.google.com', 'accounts.google.com', 'google.com'] },

  // --- Media ---
  { id: 'spotify', name: 'Spotify', category: 'Media', startUrl: 'https://open.spotify.com/', allowedDomains: ['open.spotify.com', 'accounts.spotify.com', 'spotify.com'] },
  { id: 'ytmusic', name: 'YouTube Music', category: 'Media', startUrl: 'https://music.youtube.com/', allowedDomains: ['music.youtube.com', 'youtube.com', 'accounts.google.com', 'google.com'] },
  { id: 'youtube', name: 'YouTube', category: 'Media', startUrl: 'https://www.youtube.com/', allowedDomains: ['youtube.com', 'www.youtube.com', 'accounts.google.com', 'google.com'] }
];
