import { describe, expect, it } from 'vitest';

import {
  findAppScriptSrc,
  shouldReloadForNewAppScript,
} from './appUpdateCheck';

describe('appUpdateCheck', () => {
  it('finds the Vite app script from index HTML', () => {
    expect(
      findAppScriptSrc(`
        <html>
          <head>
            <script type="module" crossorigin src="/assets/index-abc123.js"></script>
          </head>
        </html>
      `),
    ).toBe('/assets/index-abc123.js');
  });

  it('requests reload when the deployed app script hash changes', () => {
    expect(
      shouldReloadForNewAppScript(
        '/assets/index-old.js',
        '<script type="module" crossorigin src="/assets/index-new.js"></script>',
      ),
    ).toBe(true);
  });

  it('does not reload when the deployed app script hash is unchanged', () => {
    expect(
      shouldReloadForNewAppScript(
        '/assets/index-current.js',
        '<script type="module" crossorigin src="/assets/index-current.js"></script>',
      ),
    ).toBe(false);
  });
});
