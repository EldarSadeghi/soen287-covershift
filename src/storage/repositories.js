import { randomUUID } from 'node:crypto';
import { collections } from './model.js';

// Trusted server-side code supplies businessId after authorization. Scoping is
// a data access boundary, not a replacement for authenticating the caller.
export function createRepositories(store) {
  const repository = collection => ({
    async list(businessId) {
      if (typeof businessId !== 'string' || !businessId) throw new Error('A business ID is required');
      const db = await store.read();
      return db[collection].filter(record => collection === 'businesses' ? record.id === businessId : record.businessId === businessId);
    },
    async findById(businessId, recordId) {
      return (await this.list(businessId)).find(record => record.id === recordId) ?? null;
    },
  });
  return Object.fromEntries(collections.map(name => [name, repository(name)]));
}

// Services use one store.transaction for related writes (e.g. signup creates
// a business and its manager together). IDs and timestamps are generated here.
export function createRecord(fields) {
  const now = new Date().toISOString();
  return { ...fields, id: randomUUID(), createdAt: now, updatedAt: now };
}
