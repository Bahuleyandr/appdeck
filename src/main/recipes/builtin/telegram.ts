import type { Recipe } from '../types.js';

export const telegramRecipe: Recipe = {
  id: 'telegram',
  name: 'Telegram Web',
  category: 'Chat',
  startUrl: 'https://web.telegram.org',
  allowedDomains: ['web.telegram.org', 'telegram.org'],
  pollIntervalMs: 4000,
  getUnread(doc) {
    const badges = Array.from(doc.querySelectorAll('.badge, .counter, [class*="unread"]'));
    const total = badges.reduce((sum, node) => {
      const text = node.textContent?.trim() ?? '';
      const parsed = Number(text.replace(/\D/g, ''));
      return Number.isFinite(parsed) ? sum + parsed : sum;
    }, 0);
    return { direct: total, indirect: 0 };
  }
};
