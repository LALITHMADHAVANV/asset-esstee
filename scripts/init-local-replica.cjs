// Local-only initialization; preserves the existing databases on port 27017.
const { MongoClient } = require('mongodb');
const client = new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true', { serverSelectionTimeoutMS: 5000 });
(async () => {
  await client.connect();
  const admin = client.db('admin');
  let hello = await admin.command({ hello: 1 });
  if (hello.setName && hello.setName !== 'rs0') throw Error('An existing replica set has a different name. Configuration was not changed.');
  if (!hello.setName) {
    await admin.command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] } });
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    hello = await admin.command({ hello: 1 });
    if (hello.isWritablePrimary && hello.setName === 'rs0') {
      console.log('Local MongoDB rs0 is ready for repair transactions. Existing databases are preserved.');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw Error('The replica set did not elect a primary in time.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => client.close());
