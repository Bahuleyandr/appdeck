import type { Recipe } from '../types.js';

export const discordRecipe: Recipe = {
  id: 'discord',
  name: 'Discord',
  category: 'Chat',
  startUrl: 'https://discord.com/app',
  allowedDomains: ['discord.com', 'discordapp.com'],
  pollIntervalMs: 4000,
  getUnread(doc) {
    const titleMatch = /^\((\d+)\)/.exec(doc.title);
    const badges = Array.from(doc.querySelectorAll('[class*="numberBadge"], [class*="mentionsBadge"]'));
    const domTotal = badges.reduce((sum, node) => {
      const parsed = Number((node.textContent ?? '').replace(/\D/g, ''));
      return Number.isFinite(parsed) ? sum + parsed : sum;
    }, 0);
    return { direct: domTotal || (titleMatch ? Number(titleMatch[1]) : 0), indirect: 0 };
  }
};
