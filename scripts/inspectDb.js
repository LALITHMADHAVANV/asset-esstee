const { MongoClient } = require('mongodb');
const uri = '';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('textech_cmms');
  const cols = await db.listCollections().toArray();
  console.log('Collections in textech_cmms:');
  for (const c of cols) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`- ${c.name}: ${count} docs`);
  }
  await client.close();
}

main().catch(console.error);
