import {
  assertEnvironment,
  checkEnvironment,
  isDevelopmentLike,
} from './environment-check';

describe('isDevelopmentLike', () => {
  it.each(['development', 'test', 'local', 'DEVELOPMENT', ' development '])(
    'treats %p as development',
    (value) => {
      expect(isDevelopmentLike({ NODE_ENV: value } as NodeJS.ProcessEnv)).toBe(
        true,
      );
    },
  );

  /**
   * The point of this helper: an UNSET NODE_ENV must not be mistaken for
   * development. `NODE_ENV !== 'production'` would have said development here
   * and handed a real deployment OTP logging and localhost CORS.
   */
  it.each([undefined, '', 'production', 'staging', 'prod', 'PRODUCTION'])(
    'treats %p as production',
    (value) => {
      expect(isDevelopmentLike({ NODE_ENV: value } as NodeJS.ProcessEnv)).toBe(
        false,
      );
    },
  );
});

const STRONG_A = 'a'.repeat(48);
const STRONG_B = 'b'.repeat(48);

const validProduction = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@host:5432/db',
  JWT_ACCESS_SECRET: STRONG_A,
  JWT_REFRESH_SECRET: STRONG_B,
  CRM_TOKEN_SECRET: 'c'.repeat(48),
  RESEND_API_KEY: 're_test',
  EMAIL_FROM: 'noreply@example.com',
  CORS_ORIGINS: 'https://dashboard.example.com',
} as NodeJS.ProcessEnv;

describe('checkEnvironment', () => {
  it('passes a fully configured production environment', () => {
    const { fatal, warnings } = checkEnvironment(validProduction);
    expect(fatal).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it.each(['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'])(
    'treats a missing %s as fatal',
    (key) => {
      const env = { ...validProduction };
      delete env[key];
      expect(checkEnvironment(env).fatal).toEqual([
        expect.stringContaining(key),
      ]);
    },
  );

  it('is fatal in production when both JWT secrets are the same', () => {
    const env = { ...validProduction, JWT_REFRESH_SECRET: STRONG_A };
    expect(checkEnvironment(env).fatal).toEqual([
      expect.stringContaining('identical'),
    ]);
  });

  it('only warns about identical JWT secrets outside production', () => {
    const env = {
      ...validProduction,
      NODE_ENV: 'development',
      JWT_REFRESH_SECRET: STRONG_A,
    };
    const { fatal, warnings } = checkEnvironment(env);
    expect(fatal).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('identical')]);
  });

  it('rejects a known placeholder secret in production', () => {
    const env = { ...validProduction, JWT_ACCESS_SECRET: 'changeme' };
    expect(checkEnvironment(env).fatal).toEqual([
      expect.stringContaining('JWT_ACCESS_SECRET'),
    ]);
  });

  it('rejects the published CRM fallback literal as a secret value', () => {
    const env = {
      ...validProduction,
      CRM_TOKEN_SECRET: 'local-crm-token-secret',
    };
    expect(checkEnvironment(env).fatal).toEqual([
      expect.stringContaining('CRM_TOKEN_SECRET'),
    ]);
  });

  it('rejects a short secret in production', () => {
    const env = { ...validProduction, JWT_ACCESS_SECRET: 'tooshort' };
    expect(checkEnvironment(env).fatal.length).toBe(1);
  });

  it('warns when NODE_ENV is unset but confirms production is assumed', () => {
    const env = { ...validProduction };
    delete env.NODE_ENV;
    const { fatal, warnings } = checkEnvironment(env);
    expect(fatal).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('NODE_ENV')]);
    expect(warnings[0]).toMatch(/treated as production/);
  });

  it('still applies production checks when NODE_ENV is unset', () => {
    const env = { ...validProduction };
    delete env.NODE_ENV;
    delete env.RESEND_API_KEY;
    // An unset NODE_ENV must not exempt a real deploy from being told its
    // mail provider is missing.
    expect(checkEnvironment(env).warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('No mail provider')]),
    );
  });

  it('is fatal on a weak secret even when NODE_ENV is unset', () => {
    const env: NodeJS.ProcessEnv = {
      ...validProduction,
      JWT_ACCESS_SECRET: 'changeme',
    };
    delete env.NODE_ENV;
    expect(checkEnvironment(env).fatal).toEqual([
      expect.stringContaining('JWT_ACCESS_SECRET'),
    ]);
  });

  it('warns in production when no mail provider is configured', () => {
    const env = { ...validProduction };
    delete env.RESEND_API_KEY;
    expect(checkEnvironment(env).warnings).toEqual([
      expect.stringContaining('No mail provider'),
    ]);
  });

  it('does not warn about mail or CORS outside production', () => {
    const env = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/dev',
      JWT_ACCESS_SECRET: STRONG_A,
      JWT_REFRESH_SECRET: STRONG_B,
    } as NodeJS.ProcessEnv;
    const { fatal, warnings } = checkEnvironment(env);
    expect(fatal).toEqual([]);
    expect(warnings).toEqual([]);
  });
});

describe('assertEnvironment', () => {
  it('throws when configuration is fatally incomplete', () => {
    expect(() => assertEnvironment({} as NodeJS.ProcessEnv)).toThrow(
      /Refusing to start/,
    );
  });

  it('returns quietly for a valid environment', () => {
    expect(() => assertEnvironment(validProduction)).not.toThrow();
  });
});
