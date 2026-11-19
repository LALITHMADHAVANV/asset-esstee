// Import the 14 machines from the supplied image.
// Run: node scripts/import-image-machines.cjs --company=esstee
// Preview: node scripts/import-image-machines.cjs --company=esstee --dry-run
// Reads MONGODB_URI and REGISTRY_DB_NAME from the environment / .env.local.
// Blank source values stay blank. Dates are assigned within the supplied years.
// M/C numbers are text, preserving leading zeros. Verify 0/O/I against the source.
const machines = [
  {
    "id": "A-323",
    "type": "SINGER",
    "brand": "SUPREME",
    "model": "SP-H5-M",
    "serialNo": "DML250725",
    "unit": "",
    "purchaseDate": "2026-05-05"
  },
  {
    "id": "A-324",
    "type": "SINGER",
    "brand": "SUPREME",
    "model": "SP-H7SE-M",
    "serialNo": "D0I270009",
    "unit": "",
    "purchaseDate": "2026-06-21"
  },
  {
    "id": "A-325",
    "type": "SINGER",
    "brand": "SUPREME",
    "model": "SP-H7SE-M",
    "serialNo": "D0I270027",
    "unit": "",
    "purchaseDate": "2026-03-04"
  },
  {
    "id": "A-326",
    "type": "SINGER",
    "brand": "SUPREME",
    "model": "SP-H7SE-M",
    "serialNo": "D0I270041",
    "unit": "",
    "purchaseDate": "2026-08-10"
  },
  {
    "id": "A-327",
    "type": "SINGER",
    "brand": "SUPREME",
    "model": "SP-H7SE-M",
    "serialNo": "D0I270042",
    "unit": "",
    "purchaseDate": "2026-03-02"
  },
  {
    "id": "A-328",
    "type": "SINGER",
    "brand": "SUPREME",
    "model": "SP-H7SE-M",
    "serialNo": "D0I270044",
    "unit": "",
    "purchaseDate": "2026-09-27"
  },
  {
    "id": "A-329",
    "type": "SINGER",
    "brand": "SUPREME",
    "model": "SP-H7SE-M",
    "serialNo": "D0E140316",
    "unit": "",
    "purchaseDate": "2026-09-25"
  },
  {
    "id": "A-330",
    "type": "SINGER",
    "brand": "SUPREME",
    "model": "SP-H7SE-M",
    "serialNo": "D0E140321",
    "unit": "",
    "purchaseDate": "2026-02-02"
  },
  {
    "id": "A-S86",
    "type": "CONE WINDING M/C",
    "brand": "ANGALAMMA MACHINERY",
    "model": "",
    "serialNo": "",
    "unit": "",
    "purchaseDate": "2026-01-10"
  },
  {
    "id": "A-S87",
    "type": "FABRIC RELAXING MACHINE",
    "brand": "OSHIMA",
    "model": "UW-2",
    "serialNo": "2184",
    "unit": "",
    "purchaseDate": "2026-08-07"
  },
  {
    "id": "A-S88",
    "type": "FABRIC INSPECTION MACHINE",
    "brand": "SSKV",
    "model": "",
    "serialNo": "",
    "unit": "",
    "purchaseDate": "2025-08-22"
  },
  {
    "id": "A-S89",
    "type": "FABRIC INSPECTION MACHINE",
    "brand": "UZU",
    "model": "UZ-F9",
    "serialNo": "101150",
    "unit": "",
    "purchaseDate": "2010-04-24"
  },
  {
    "id": "A-S90",
    "type": "FABRIC INSPECTION MACHINE",
    "brand": "UZU",
    "model": "UZ-F3",
    "serialNo": "0099403",
    "unit": "",
    "purchaseDate": "2007-10-01"
  },
  {
    "id": "A-S91",
    "type": "FABRIC INSPECTION MACHINE",
    "brand": "UZU",
    "model": "",
    "serialNo": "",
    "unit": "",
    "purchaseDate": "2007-03-19"
  }
];

async function importMachines(client, companySlug, dryRun = false) {
  const company = await client.db(process.env.REGISTRY_DB_NAME || 'compliance_master')
    .collection('companies').findOne({ slug: companySlug, active: true });
  if (!company?.databaseName) throw new Error('Active company not found in the registry: ' + companySlug);
  company.name = company.name || (company.slug === 'esstee' ? 'Esstee' : company.slug);
  const collection = client.db(company.databaseName).collection('machines');
  let imported = 0, skipped = 0;
  const pending = [];
  // Check all records before writing, including existing serial number conflicts.
  for (const machine of machines) {
    const collation = { locale: 'en', strength: 2 };
    if (await collection.findOne({ id: machine.id }, { collation })) { skipped++; continue; }
    if (machine.serialNo) {
      const conflict = await collection.findOne({ $or: [
        { serialNo: machine.serialNo }, { serialNumber: machine.serialNo }, { mcNo: machine.serialNo },
      ] }, { collation });
      if (conflict) throw new Error('M/C number for ' + machine.id + ' already belongs to ' + conflict.id + '. No new records were imported.');
    }
    pending.push(machine);
  }
  if (!dryRun && pending.length) {
    await collection.createIndex({ id: 1 }, { unique: true, name: 'asset_import_id_ci',
      collation: { locale: 'en', strength: 2 }, partialFilterExpression: { id: { $type: 'string' } } });
    for (const machine of pending) {
      const document = { ...machine, name: machine.type, typeName: machine.type, category: 'MACHINE',
        serialNumber: machine.serialNo, mcNo: machine.serialNo,
        year: Number(machine.purchaseDate.slice(0, 4)), purchaseDateEstimated: true,
        importSource: 'User-provided machine image',
        cost: 0, status: 'ACTIVE', zone: '', area: '', currentLine: '', stationNo: '',
        totalDowntimeMinutes: 0, company: company.name, companySlug: company.slug,
        createdAt: new Date().toISOString() };
      const result = await collection.updateOne({ id: machine.id }, { $setOnInsert: document },
        { upsert: true, collation: { locale: 'en', strength: 2 } });
      if (result.upsertedCount) imported++; else skipped++;
    }
  }
  return { company: company.name, database: company.databaseName, total: machines.length,
    imported, skipped, ...(dryRun ? { dryRun: true, wouldImport: pending.length } : {}) };
}

async function main() {
  require('@next/env').loadEnvConfig(process.cwd());
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--dry-run' && !/^--company=[a-z0-9-]+$/.test(arg))) {
    throw new Error('Usage: node scripts/import-image-machines.cjs --company=esstee [--dry-run]');
  }
  const slug = (args.find(arg => arg.startsWith('--company=')) || '').slice('--company='.length);
  if (!slug) throw new Error('Specify the destination with --company=esstee (or your company slug).');
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env.local or the environment.');
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    console.log(JSON.stringify(await importMachines(client, slug, args.includes('--dry-run')), null, 2));
  } finally {
    await client.close();
  }
}
module.exports = { machines, importMachines };
if (require.main === module) main().catch(error => {
  // Do not print database connection details or credentials.
  console.error(error.name === 'Error' ? error.message : 'Import failed (' + error.name + '). Check database connectivity and permissions; rerun to skip already-imported IDs.');
  process.exitCode = 1;
});

