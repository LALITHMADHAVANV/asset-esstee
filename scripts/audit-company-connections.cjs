// Read-only deployment audit. Does not initialize, seed, or migrate databases.
require('@next/env').loadEnvConfig(process.cwd());
const { MongoClient } = require('mongodb');
(async () => {
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const companies = await client.db(process.env.REGISTRY_DB_NAME || 'compliance_master')
      .collection('companies').find({}, { projection: { slug: 1, databaseName: 1, active: 1, _id: 0 } }).toArray();
    const identifiers = new Map();
    const results = [];
    for (const company of companies) {
      const db = client.db(company.databaseName);
      const users = await db.collection('users').find({}, { projection: { uid: 1, username: 1, email: 1, employeeId: 1 } }).toArray();
      for (const user of users) {
        const owner = `${company.databaseName}:${user._id}`;
        for (const value of [user.uid, user.username, user.email, user.employeeId]) {
          if (typeof value !== 'string' || !value.trim()) continue;
          const key = value.trim().toLowerCase();
          if (!identifiers.has(key)) identifiers.set(key, new Set());
          identifiers.get(key).add(owner);
        }
      }
      results.push({ ...company, users: users.length, machines: await db.collection('machines').countDocuments() });
    }
    console.log(JSON.stringify({ companies: results, conflictingIdentifiers: [...identifiers.values()].filter(owners => owners.size > 1).length }, null, 2));
  } catch (error) {
    console.error(`Database audit failed (${error.name}). Check connectivity and database access.`);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
})();
