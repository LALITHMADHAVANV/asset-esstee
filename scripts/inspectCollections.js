const fs = require('fs');
const { MongoClient } = require('mongodb');

async function main() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const uri = env.split(/\r?\n/).find(l => l.startsWith('MONGODB_URI=')).slice(12).trim();
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('maintanence');
    const collections = await db.listCollections().toArray();
    console.log('Collections in maintanence:');
    for (const c of collections.sort((a,b) => a.name.localeCompare(b.name))) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`- ${c.name}: ${count} documents`);
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
