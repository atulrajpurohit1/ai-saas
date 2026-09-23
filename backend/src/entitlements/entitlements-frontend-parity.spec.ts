import { readFileSync } from 'fs';
import { join } from 'path';
import { PERMISSION_MODULE_TO_SERVICE } from './entitlements.constants';

const FRONTEND_ENTITLEMENTS = join(
  __dirname,
  '..',
  '..',
  '..',
  'frontend',
  'src',
  'lib',
  'entitlements.ts',
);

/**
 * The frontend keeps its own copy of the permission-module -> service map so it
 * can label a locked page without a round trip. Two copies drift, and a drift
 * here is user-visible: nav that renders a link ModuleGuard then refuses, or a
 * page hidden that the tenant actually paid for.
 *
 * The backend is the source of truth; this asserts the copy still matches.
 */
describe('frontend entitlement map parity', () => {
  const source = readFileSync(FRONTEND_ENTITLEMENTS, 'utf8');

  const frontendMap = (): Record<string, string> => {
    const block = source.match(
      /PERMISSION_PREFIX_TO_SERVICE: Record<string, ServiceModuleKey> = \{([\s\S]*?)\n\};/,
    );

    if (!block) throw new Error('Could not find the frontend permission map.');

    return Object.fromEntries(
      [...block[1].matchAll(/^\s*(\w+):\s*'(\w+)',$/gm)].map(
        ([, permissionModule, service]) => [permissionModule, service],
      ),
    );
  };

  it('mirrors the backend permission-module to service map exactly', () => {
    expect(frontendMap()).toEqual(PERMISSION_MODULE_TO_SERVICE);
  });
});
