import * as bcrypt from 'bcrypt';
import {
  BCRYPT_PASSWORD_ROUNDS,
  BCRYPT_TOKEN_ROUNDS,
  DUMMY_PASSWORD_HASH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './password-policy';

describe('password policy', () => {
  it('caps password length at bcrypt truncation point', () => {
    // Above 72 bytes bcrypt silently ignores the rest of the input, so a
    // longer limit would hand users a password weaker than the one they set.
    expect(PASSWORD_MAX_LENGTH).toBe(72);
    expect(PASSWORD_MIN_LENGTH).toBeLessThan(PASSWORD_MAX_LENGTH);
  });

  it('hashes passwords with more work than tokens', () => {
    expect(BCRYPT_PASSWORD_ROUNDS).toBeGreaterThan(BCRYPT_TOKEN_ROUNDS);
  });

  /**
   * The dummy hash defends login against timing-based account enumeration by
   * making the "no such account" path do the same bcrypt work as a real
   * comparison. A malformed string would make bcrypt.compare return
   * immediately, silently restoring the very timing gap it exists to close --
   * and nothing else in the system would fail. Hence this test.
   */
  describe('DUMMY_PASSWORD_HASH', () => {
    it('is a well-formed bcrypt hash at the password cost factor', () => {
      expect(DUMMY_PASSWORD_HASH).toMatch(
        new RegExp(`^\\$2[aby]\\$${BCRYPT_PASSWORD_ROUNDS}\\$[./A-Za-z0-9]{53}$`),
      );
    });

    it('compares false without throwing, so login stays constant-time', async () => {
      await expect(
        bcrypt.compare('any-attacker-supplied-password', DUMMY_PASSWORD_HASH),
      ).resolves.toBe(false);
    });

    it('costs roughly as much as comparing against a real hash', async () => {
      const realHash = await bcrypt.hash('a-real-password', BCRYPT_PASSWORD_ROUNDS);

      const dummyStart = Date.now();
      await bcrypt.compare('wrong', DUMMY_PASSWORD_HASH);
      const dummyMs = Date.now() - dummyStart;

      const realStart = Date.now();
      await bcrypt.compare('wrong', realHash);
      const realMs = Date.now() - realStart;

      // Generous bounds -- this is asserting "same order of magnitude", not a
      // precise timing, so it does not turn into a flaky test on a loaded CI
      // box. A malformed dummy hash would return in ~0ms and fail this.
      expect(dummyMs).toBeGreaterThan(realMs / 4);
      expect(dummyMs).toBeLessThan(realMs * 4);
    });
  });
});
