// Preview: node scripts/remove-nethaji.cjs
// Apply:   node scripts/remove-nethaji.cjs --apply
// Uses MONGODB_URI from the project environment; never prints credentials.
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient, BSON } = require('mongodb');

const LOCATION_FIELDS = ['zone', 'area', 'location', 'specs'];

function cleanText(value) {
  if (typeof value !== 'string' || !/\bnethaji\b/i.test(value)) return value;
  return value
    .replace(/\(\s*nethaji\s*\)|\[\s*nethaji\s*\]/gi, '')
    .replace(/\bnethaji\b/gi, '')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/\s*([•|])\s*(?=[•|]|$)/g, '')
    .replace(/^\s*[-–—•|,]+\s*|\s*[-–—•|,]+\s*$/g, '')
    .replace(/\s*([•|])\s*/g, ' $1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildChanges(machine) {
  const changes = {};
  for (const field of LOCATION_FIELDS) {
    const cleaned = cleanText(machine[field]);
    if (cleaned !== machine[field]) changes[field] = cleaned;
  }
  return changes;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) throw new Error('Usage: node scripts/remove-nethaji.cjs [--apply]');
  const apply = args.includes('--apply');
  const root = path.resolve(__dirname, '..');
  require('@next/env').loadEnvConfig(root);
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Set MONGODB_URI in .env.local to the MongoDB server you want to clean.');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const collection = client.db('compliance_esstee').collection('machines');
    const machines = await collection.find({}).toArray();
    const pending = machines.map(machine => ({ machine, changes: buildChanges(machine) }))
      .filter(item => Object.keys(item.changes).length > 0);
    console.log(`Mode: ${apply ? 'APPLY' : 'PREVIEW (no changes)'}`);
    console.log(`Target: compliance_esstee.machines (${uri.startsWith('mongodb+srv://') ? 'SRV/Atlas URI' : 'standard MongoDB URI'})`);
    console.log(`Machines scanned: ${machines.length}; containing Nethaji in location fields: ${pending.length}`);
    if (machines.length !== 342) console.log('Note: this database currently contains a different number of machines than 342.');
    for (const { machine, changes } of pending.slice(0, 10)) {
      console.log(JSON.stringify({ id: machine.id || String(machine._id), changes }));
    }
    if (!apply) {
      console.log('Check the target and preview, then rerun with --apply to save.');
      return;
    }
    if (!pending.length) return;
    const backupDir = path.join(root, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backup = path.join(backupDir, `machines-before-nethaji-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backup, BSON.EJSON.stringify(pending.map(item => item.machine), null, 2, { relaxed: false }), { flag: 'wx' });
    console.log(`Backup saved: ${backup}`);
    const result = await collection.bulkWrite(pending.map(({ machine, changes }) => ({
      updateOne: {
        // Match original values so a concurrent placement change is not overwritten.
        filter: { _id: machine._id, ...Object.fromEntries(Object.keys(changes).map(field => [field, machine[field]])) },
        update: { $set: changes },
        upsert: false,
      },
    })));
    console.log(`Updated: ${result.modifiedCount}; skipped due to concurrent edits: ${pending.length - result.matchedCount}`);
    const remaining = await collection.countDocuments({ $or: LOCATION_FIELDS.map(field => ({ [field]: /\bnethaji\b/i })) });
    console.log(`Machines still containing Nethaji in location fields: ${remaining}`);
    if (remaining) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

module.exports = { cleanText, buildChanges };
if (require.main === module) {
  main().catch(error => {
    console.error(`Cleanup failed (${error.name}). Check MongoDB access and any saved backup before retrying.`);
    process.exitCode = 1;
  });
}
