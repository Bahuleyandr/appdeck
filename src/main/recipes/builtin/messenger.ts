import type { Recipe } from '../types.js';

export const messengerRecipe: Recipe = {
  id: 'messenger',
  name: 'Messenger',
  category: 'Chat',
  startUrl: 'https://www.messenger.com',
  allowedDomains: ['www.messenger.com', 'messenger.com', 'facebook.com'],
  pollIntervalMs: 4000,
  getUnread(doc) {
    const titleMatch = /^\((\d+)\)/.exec(doc.title);
    return { direct: titleMatch ? Number(titleMatch[1]) : 0, indirect: 0 };
  }
};
