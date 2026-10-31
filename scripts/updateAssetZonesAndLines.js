// scripts/updateAssetZonesAndLines.js
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const seedPath = path.join(__dirname, '../src/data/plantAssetsSeed.json');
const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

let u1Count = 0;
let u2Count = 0;

const transformed = data.map((item) => {
  const copy = { ...item };
  if (copy.unit === 'UNIT-2' || copy.location === 'PEACOCK' || copy.plant === 'UNIT-2') {
    let lineNum = 1;
    if (copy.zone && copy.zone.match(/\d+/)) {
      lineNum = parseInt(copy.zone.match(/\d+/)[0], 10);
    } else if (copy.area && copy.area.match(/\d+/)) {
      lineNum = parseInt(copy.area.match(/\d+/)[0], 10);
    } else if (copy.currentLine && copy.currentLine.match(/\d+/)) {
      lineNum = parseInt(copy.currentLine.match(/\d+/)[0], 10);
    }

    const lineStr = `Line ${String(lineNum).padStart(2, '0')}`;
    copy.zone = 'PEACOCK';
    copy.location = 'PEACOCK';
    copy.area = `PEACOCK - ${lineStr}`;
    copy.currentLine = lineStr;
    if (copy.specs) {
      copy.specs = copy.specs.replace(/Zone\s+\d+/g, lineStr);
    }
    u2Count++;
  } else if (copy.unit === 'UNIT - 1' || copy.location === '-') {
    copy.zone = '-';
    copy.location = '-';
    if (!copy.area) copy.area = '-';
    u1Count++;
  }
  return copy;
});

fs.writeFileSync(seedPath, JSON.stringify(transformed, null, 2), 'utf8');
console.log(`Updated plantAssetsSeed.json successfully! (Unit 1: ${u1Count}, Unit 2: ${u2Count})`);

// Sample verification
const sample = transformed.find((m) => m.id === 'K9840693');
console.log('Sample Asset K9840693:', {
  id: sample.id,
  unit: sample.unit,
  zone: sample.zone,
  currentLine: sample.currentLine,
  area: sample.area,
  location: sample.location,
  specs: sample.specs,
});

async function syncDb() {
  const uri =
    process.env.MONGODB_URI ||
    '';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('maintanence');
    const collection = db.collection('machines');
    const ops = transformed.map((m) => ({
      updateOne: {
        filter: { id: m.id },
        update: { $set: m },
        upsert: true,
      },
    }));
    const res = await collection.bulkWrite(ops);
    console.log(
      `MongoDB machines sync completed: upserted/modified ${res.upsertedCount + res.modifiedCount}`
    );
  } catch (err) {
    console.warn('MongoDB sync warning:', err.message);
  } finally {
    await client.close();
  }
}

syncDb();
