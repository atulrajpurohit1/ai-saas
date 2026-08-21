import { findUnresolvedPlaceholders } from './proposal-content.util';

describe('findUnresolvedPlaceholders', () => {
  it('detects unresolved bracket placeholders', () => {
    const content = '# Proposal\n\nPrepared by [Your Company Name] for Acme.';
    expect(findUnresolvedPlaceholders(content)).toEqual(['[Your Company Name]']);
  });

  it('returns no matches for clean content', () => {
    const content = '# Proposal\n\nPrepared by Acme Security Services for Acme Corp.';
    expect(findUnresolvedPlaceholders(content)).toEqual([]);
  });

  it('ignores markdown link syntax', () => {
    const content = 'See our [terms of service](https://example.com/terms) for details.';
    expect(findUnresolvedPlaceholders(content)).toEqual([]);
  });

  it('deduplicates repeated placeholders', () => {
    const content = '[Client Address] ... later again [Client Address]';
    expect(findUnresolvedPlaceholders(content)).toEqual(['[Client Address]']);
  });

  it('returns an empty array for empty content', () => {
    expect(findUnresolvedPlaceholders('')).toEqual([]);
  });
});
