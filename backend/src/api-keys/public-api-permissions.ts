export type PublicApiPermissionDefinition = {
  key: string;
  name: string;
  description: string;
  group: string;
};

export const PUBLIC_API_PERMISSIONS: PublicApiPermissionDefinition[] = [
  { key: 'clients.read', name: 'Read clients', description: 'List and read client records.', group: 'Clients' },
  { key: 'clients.write', name: 'Write clients', description: 'Create client records.', group: 'Clients' },
  { key: 'sites.read', name: 'Read sites', description: 'List and read site records.', group: 'Sites' },
  { key: 'sites.write', name: 'Write sites', description: 'Create site records.', group: 'Sites' },
  { key: 'guards.read', name: 'Read guards', description: 'List and read guard records.', group: 'Guards' },
  { key: 'guards.write', name: 'Write guards', description: 'Create guard records.', group: 'Guards' },
  { key: 'shifts.read', name: 'Read shifts', description: 'List and read shift records.', group: 'Shifts' },
  { key: 'shifts.write', name: 'Write shifts', description: 'Create shifts and assign guards.', group: 'Shifts' },
  { key: 'incidents.read', name: 'Read incidents', description: 'List and read incident records.', group: 'Incidents' },
  { key: 'incidents.write', name: 'Write incidents', description: 'Submit incident records.', group: 'Incidents' },
  { key: 'invoices.read', name: 'Read invoices', description: 'List and read invoices.', group: 'Invoices' },
  { key: 'reports.read', name: 'Read reports', description: 'List and read daily service reports.', group: 'Reports' },
];

export const PUBLIC_API_PERMISSION_KEYS = PUBLIC_API_PERMISSIONS.map((permission) => permission.key);
