import type { Recipe } from '../types.js';

export const signalRecipe: Recipe = {
  id: 'signal',
  name: 'Signal',
  category: 'Chat',
  startUrl: 'sgnl://',
  allowedDomains: [],
  isLauncherOnly: true,
  launcherHint:
    'Signal does not provide a web client. Install Signal Desktop, link it with your phone, then use this tile as a launcher.'
};
