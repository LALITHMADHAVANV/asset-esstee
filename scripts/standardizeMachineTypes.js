// scripts/standardizeMachineTypes.js
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const seedPath = path.join(__dirname, '../src/data/plantAssetsSeed.json');
const machines = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

console.log(`Loaded ${machines.length} machines from ${seedPath}`);

let overlockCount = 0;
let flatlockCount = 0;

const updatedMachines = machines.map((m) => {
  const origType = (m.type || '').trim();
  const origMachineType = (m.machineType || '').trim();
  const origName = (m.name || '').trim();
  const origModel = (m.model || '').trim();
  const sNo = m.sNo || 0;
  const brand = m.brand || m.machineMake || 'JUKI';

  // 1. OVERLOCK Categorization: "O/L", "LFC O/L", "RIP OVER LOCK", "OVERLOCK"
  if (
    origType === 'O/L' ||
    origMachineType === 'O/L' ||
    origType === 'LFC O/L' ||
    origMachineType === 'LFC O/L' ||
    origType === 'RIP OVER LOCK' ||
    origMachineType === 'RIP OVER LOCK' ||
    origType.toUpperCase() === 'OVERLOCK' ||
    origMachineType.toUpperCase() === 'OVERLOCK'
  ) {
    overlockCount++;
    let variety = '4-Thread Overlock (O/L)';
    let model = origModel && origModel !== '—' && origModel !== 'OVERLOCK' ? origModel : 'MO-6714DA';

    // Unit 1 Subtypes by serial and original label
    if (sNo >= 226 && sNo <= 228) {
      variety = 'Rib Attacher Overlock (RIP O/L)';
      model = 'RIP OVER LOCK';
    } else if (sNo >= 229 && sNo <= 230) {
      variety = 'LFC Tape Feeder Overlock (LFC O/L)';
      model = 'LFC O/L';
    } else if (sNo >= 136 && sNo <= 225) {
      variety = 'Standard 4-Thread Overlock (O/L)';
      model = '4-Thread (O/L)';
    } else {
      // Unit 2 specific models
      const upperModel = model.toUpperCase();
      if (upperModel.includes('6814')) variety = 'Semi-Dry Head Overlock (MO-6814D)';
      else if (upperModel.includes('6714')) variety = '4-Thread Overlock (MO-6714DA)';
      else if (upperModel.includes('952')) variety = '4-Thread Overlock (M952-52H)';
      else if (upperModel.includes('900')) variety = 'High-Speed Overlock (M900)';
      else if (upperModel.includes('5114')) variety = 'Overlock (MX5114-03)';
      else if (upperModel.includes('6125')) variety = 'Overlock (CZ-6125)';
      else if (upperModel.includes('6914')) variety = 'High-Speed Overlock (MO-6914C)';
      else if (upperModel.includes('762')) variety = 'Overlock (M762-BH)';
      else variety = `Overlock (${model})`;
    }

    return {
      ...m,
      category: 'MACHINE',
      categoryGroup: 'OVERLOCK',
      machineClass: 'OVERLOCK',
      machineCategory: 'OVERLOCK',
      type: 'OVERLOCK',
      typeName: variety,
      variety: variety,
      subType: variety,
      machineType: 'OVERLOCK',
      model: model,
      name: `${brand} ${variety}`,
    };
  }

  // 2. FLATLOCK Categorization: "H.F/L", "FB.F/L", "PULLER. F/L", "F/L", "FLATLOCK"
  if (
    origType.includes('F/L') ||
    origMachineType.includes('F/L') ||
    origType.toUpperCase() === 'FLATLOCK' ||
    origMachineType.toUpperCase() === 'FLATLOCK'
  ) {
    flatlockCount++;
    let variety = 'Flatlock';
    let model = origModel && origModel !== '—' && origModel !== 'FLATLOCK' ? origModel : 'MF-7223D';

    // Unit 1 Subtypes by serial and original label
    if (sNo >= 108 && sNo <= 115) {
      variety = 'Hemming Flatlock (H.F/L)';
      model = 'H.F/L (Hemming)';
    } else if (sNo >= 116 && sNo <= 130) {
      variety = 'Flat Bed Flatlock (FB.F/L)';
      model = 'FB.F/L (Flat Bed)';
    } else if (sNo >= 131 && sNo <= 135) {
      variety = 'Puller Flatlock (PULLER. F/L)';
      model = 'PULLER. F/L';
    } else {
      // Unit 2 specific models
      const upperModel = model.toUpperCase();
      if (upperModel.includes('7223')) variety = 'Cylinder Bed Flatlock (MF-7223D)';
      else if (upperModel.includes('7923')) variety = 'Cylinder Bed Flatlock (MF-7923D)';
      else if (upperModel.includes('7523')) variety = 'Flat Bed Flatlock (MF-7523D)';
      else if (upperModel.includes('W264')) variety = 'Cylinder Bed Flatlock (W264HP)';
      else if (upperModel.includes('W662')) variety = 'Flat Bed Flatlock (W662PCH)';
      else if (upperModel.includes('W562')) variety = 'Flat Bed Flatlock (W562PC)';
      else if (upperModel.includes('W652')) variety = 'Flat Bed Flatlock (W652PC)';
      else if (upperModel.includes('VE2713')) variety = 'Cylinder Bed Flatlock (VE2713)';
      else if (upperModel.includes('CF230')) variety = 'Cylinder Bed Flatlock (CF230UT)';
      else variety = `Flatlock (${model})`;
    }

    return {
      ...m,
      category: 'MACHINE',
      categoryGroup: 'FLATLOCK',
      machineClass: 'FLATLOCK',
      machineCategory: 'FLATLOCK',
      type: 'FLATLOCK',
      typeName: variety,
      variety: variety,
      subType: variety,
      machineType: 'FLATLOCK',
      model: model,
      name: `${brand} ${variety}`,
    };
  }

  // Return unchanged for SNLS, BARTACK, KAJA, etc.
  return m;
});

console.log(`Standardized machines: OVERLOCK=${overlockCount}, FLATLOCK=${flatlockCount}`);

// Save standardized JSON
fs.writeFileSync(seedPath, JSON.stringify(updatedMachines, null, 2), 'utf8');
console.log(`Wrote standardized 495 machines to ${seedPath}`);

// Sync to MongoDB Atlas
async function syncToMongo() {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    try {
      const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
      const match = envContent.match(/MONGODB_URI=(.+)/);
      if (match) uri = match[1].trim();
    } catch (e) {}
  }
  if (!uri) {
    uri = '';
  }

  console.log('Connecting to MongoDB Atlas...');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('textech_cmms');
    const collection = db.collection('machines');
    const ops = updatedMachines.map((m) => ({
      updateOne: {
        filter: { id: m.id },
        update: { $set: m },
        upsert: true,
      },
    }));
    const res = await collection.bulkWrite(ops);
    console.log(`MongoDB sync complete! Modified: ${res.modifiedCount}, Upserted: ${res.upsertedCount}`);
    const finalCount = await collection.countDocuments();
    const mongoOL = await collection.countDocuments({ machineType: 'OVERLOCK' });
    const mongoFL = await collection.countDocuments({ machineType: 'FLATLOCK' });
    console.log(`MongoDB machines count: ${finalCount} (OVERLOCK: ${mongoOL}, FLATLOCK: ${mongoFL})`);
  } catch (err) {
    console.error('Mongo error:', err);
  } finally {
    await client.close();
  }

  // Also sync to local MongoDB if running
  try {
    const localClient = new MongoClient('mongodb://127.0.0.1:27017/textech_cmms', { serverSelectionTimeoutMS: 2000 });
    await localClient.connect();
    const localDb = localClient.db('textech_cmms');
    const localOps = updatedMachines.map((m) => ({
      updateOne: {
        filter: { id: m.id },
        update: { $set: m },
        upsert: true,
      },
    }));
    await localDb.collection('machines').deleteMany({ id: /-U2$/ });
    const localRes = await localDb.collection('machines').bulkWrite(localOps);
    console.log(`Local MongoDB sync complete! Modified: ${localRes.modifiedCount}, total: ${await localDb.collection('machines').countDocuments()}`);
    await localClient.close();
  } catch (e) {
    // Local mongo not running or skipped
  }
}

syncToMongo();
