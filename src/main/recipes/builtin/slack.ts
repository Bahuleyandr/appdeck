import type { Recipe } from '../types.js';

export const slackRecipe: Recipe = {
  id: 'slack',
  name: 'Slack',
  category: 'Chat',
  startUrl: 'https://app.slack.com',
  allowedDomains: ['app.slack.com', 'slack.com'],
  pollIntervalMs: 4000,
  getUnread(doc) {
    const mentionBadges = Array.from(doc.querySelectorAll('[data-qa*="mention"], [class*="mention"]'));
    const total = mentionBadges.reduce((sum, node) => {
      const text = node.textContent?.trim() ?? '';
      const parsed = Number(text.replace(/\D/g, ''));
      return Number.isFinite(parsed) ? sum + parsed : sum;
    }, 0);
    const titleMatch = /^\((\d+)\)/.exec(doc.title);
    return { direct: total || (titleMatch ? Number(titleMatch[1]) : 0), indirect: 0 };
  }
};
