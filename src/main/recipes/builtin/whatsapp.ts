import type { Recipe } from '../types.js';

export const whatsappRecipe: Recipe = {
  id: 'whatsapp',
  name: 'WhatsApp Web',
  category: 'Chat',
  startUrl: 'https://web.whatsapp.com',
  allowedDomains: ['web.whatsapp.com', 'whatsapp.com'],
  pollIntervalMs: 4000,
  getUnread(doc) {
    const titleMatch = /^\((\d+)\)/.exec(doc.title);
    return { direct: titleMatch ? Number(titleMatch[1]) : 0, indirect: 0 };
  }
};
