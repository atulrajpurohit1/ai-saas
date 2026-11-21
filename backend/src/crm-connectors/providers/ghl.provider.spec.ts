import { CrmApiError } from './crm-provider.interface';
import { GhlProvider } from './ghl.provider';

describe('GhlProvider contact sync', () => {
  const originalFetch = global.fetch;
  let provider: GhlProvider;

  beforeEach(() => {
    provider = new GhlProvider();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('upserts the lead and adds the automation tag without replacing tags', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ new: true, contact: { id: 'ghl-contact-1' } }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tags: ['existing', 'aegislead-lead'] }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const result = await provider.upsertContact('token', 'location-1', {
      name: 'Ada Adams',
      email: 'ada@example.com',
      phone: '+15551234567',
      companyName: 'Adams Security',
      source: 'AegisLead Lead',
      tags: ['aegislead-lead', 'aegislead-lead'],
    });

    expect(result).toEqual({ externalId: 'ghl-contact-1', created: true });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://services.leadconnectorhq.com/contacts/upsert',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Version: 'v3' }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        locationId: 'location-1',
        email: 'ada@example.com',
        phone: '+15551234567',
        source: 'AegisLead Lead',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://services.leadconnectorhq.com/contacts/ghl-contact-1/tags',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      tags: ['aegislead-lead'],
    });
  });

  it('reports a tag failure so the lead can be retried', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ new: false, contact: { id: 'ghl-contact-1' } }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Tag permission denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await expect(
      provider.upsertContact('token', 'location-1', {
        email: 'ada@example.com',
        tags: ['aegislead-lead'],
      }),
    ).rejects.toEqual(expect.any(CrmApiError));
  });
});
