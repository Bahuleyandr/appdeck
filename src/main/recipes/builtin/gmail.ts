import type { Recipe } from '../types.js';

export const gmailRecipe: Recipe = {
  id: 'gmail',
  name: 'Gmail',
  category: 'Email',
  startUrl: 'https://mail.google.com',
  allowedDomains: ['mail.google.com', 'accounts.google.com', 'google.com'],
  pollIntervalMs: 5000,
  getUnread(doc) {
    const titleMatch = /Inbox \((\d+)\)/.exec(doc.title) ?? /^\((\d+)\)/.exec(doc.title);
    return { direct: titleMatch ? Number(titleMatch[1]) : 0, indirect: 0 };
  }
};
