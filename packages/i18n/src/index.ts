// Domovník internationalization — Phase 3
// Czech string catalogue (cs-CZ) with English keys.

export { cs } from './strings-cs.js';
export type { CsStrings } from './strings-cs.js';

/**
 * Returns the current locale string catalogue.
 */
export function greet(): string {
  return 'Domovník — i18n package (cs-CZ catalogue ready)';
}