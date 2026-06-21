import type { Recipe } from '../types.js';
import { discordRecipe } from './discord.js';
import { gmailRecipe } from './gmail.js';
import { messengerRecipe } from './messenger.js';
import { signalRecipe } from './signal.js';
import { slackRecipe } from './slack.js';
import { telegramRecipe } from './telegram.js';
import { whatsappRecipe } from './whatsapp.js';

export const builtinRecipes: Recipe[] = [
  whatsappRecipe,
  telegramRecipe,
  slackRecipe,
  discordRecipe,
  messengerRecipe,
  gmailRecipe,
  signalRecipe
];
