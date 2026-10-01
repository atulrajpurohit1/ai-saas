import { BadRequestException } from '@nestjs/common';
import { assertPublicHttpUrl, isBlockedAddress } from './ssrf-guard';

describe('isBlockedAddress', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['10.1.2.3', 'private 10/8'],
    ['172.16.0.1', 'private 172.16/12'],
    ['172.31.255.254', 'private 172.31'],
    ['192.168.1.1', 'private 192.168/16'],
    ['169.254.169.254', 'cloud metadata'],
    ['100.64.0.1', 'carrier-grade NAT'],
    ['0.0.0.0', 'unspecified'],
    ['224.0.0.1', 'multicast'],
    ['::1', 'IPv6 loopback'],
    ['fe80::1', 'IPv6 link-local'],
    ['fd00::1', 'IPv6 unique local'],
    ['::ffff:169.254.169.254', 'IPv4-mapped metadata address'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['not-an-ip', 'unparseable'],
  ])('blocks %s (%s)', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each([
    ['8.8.8.8'],
    ['1.1.1.1'],
    ['93.184.216.34'],
    ['172.32.0.1'], // just outside the private 172.16/12 range
    ['172.15.255.255'], // just below it
    ['2606:4700:4700::1111'],
  ])('allows public address %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });
});

describe('assertPublicHttpUrl', () => {
  it.each([
    'http://localhost/hook',
    'http://LOCALHOST/hook',
    'http://sub.localhost/hook',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://127.0.0.1:5432/hook',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/hook',
    'http://192.168.0.5/hook',
  ])('rejects %s', async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([
    'ftp://example.com/hook',
    'file:///etc/passwd',
    'gopher://example.com/',
  ])('rejects non-http scheme %s', async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a malformed URL', async () => {
    await expect(assertPublicHttpUrl('not a url')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows a public literal IP', async () => {
    await expect(assertPublicHttpUrl('https://8.8.8.8/hook')).resolves.toBeInstanceOf(
      URL,
    );
  });
});
