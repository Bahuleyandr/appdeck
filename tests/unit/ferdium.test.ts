import { describe, expect, it } from 'vitest';
import { parseFerdiumServices } from '../../src/main/services/ferdiumImport.js';

describe('ferdium import parser', () => {
  it('parses the { services: [...] } export shape', () => {
    const raw = JSON.stringify({
      services: [
        { recipeId: 'whatsapp', name: 'WhatsApp' },
        { recipeId: 'custom', name: 'Acme', customUrl: 'https://chat.acme.com' }
      ]
    });
    const services = parseFerdiumServices(raw);
    expect(services).toHaveLength(2);
    expect(services[0]).toMatchObject({ recipeId: 'whatsapp', name: 'WhatsApp' });
    expect(services[1]).toMatchObject({ recipeId: 'custom', url: 'https://chat.acme.com' });
  });

  it('parses a bare array and settings.customUrl', () => {
    const raw = JSON.stringify([{ recipeId: 'x', name: 'X', settings: { customUrl: 'https://x.example.com' } }]);
    const services = parseFerdiumServices(raw);
    expect(services[0]?.url).toBe('https://x.example.com');
  });

  it('drops entries with neither recipeId nor url', () => {
    const raw = JSON.stringify({ services: [{ name: 'Nameless' }] });
    expect(parseFerdiumServices(raw)).toHaveLength(0);
  });
});
