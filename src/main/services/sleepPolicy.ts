import type { ServiceInstance } from '../../shared/types.js';

/**
 * Which parking tier an idle service gets. Doze keeps the renderer alive (detached, throttled,
 * muted) so notifications keep flowing; deep sleep destroys it and frees the memory. Auto mode
 * dozes services that can still want your attention and deep-sleeps the rest.
 */
export function sleepTier(
  instance: Pick<ServiceInstance, 'muted' | 'disabled' | 'sleep_policy'>
): 'doze' | 'deep' {
  const mode = instance.sleep_policy.mode ?? 'auto';
  if (mode === 'deep') {
    return 'deep';
  }
  if (mode === 'doze') {
    return 'doze';
  }
  return !instance.muted && !instance.disabled ? 'doze' : 'deep';
}
