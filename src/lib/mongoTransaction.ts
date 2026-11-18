import type { ClientSession } from 'mongodb';
import { getMongoClient, TenantError } from './mongodb';

export async function mongoTransaction<T>(action: (session: ClientSession) => Promise<T>): Promise<T> {
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    return await session.withTransaction(() => action(session));
  } catch (error) {
    if ((error as { code?: number }).code === 20) throw new TenantError('This change requires MongoDB Atlas or a replica set to save safely.', 503);
    throw error;
  } finally { await session.endSession(); }
}
