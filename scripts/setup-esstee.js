const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/';

async function setupEsstee() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri);
  await client.connect();
  console.log('Connected successfully.\n');

  const now = new Date().toISOString();

  // 1. Setup Central Client Registry in compliance_master
  console.log('1. Setting up Central Client Registry in "compliance_master"...');
  const masterDb = client.db(process.env.REGISTRY_DB_NAME || 'compliance_master');
  const companiesCol = masterDb.collection('companies');
  await companiesCol.createIndex({ slug: 1 }, { unique: true }).catch(() => { });

  const essteeCompany = {
    slug: 'esstee',
    name: 'Esstee',
    active: true,
    databaseName: 'compliance_esstee',
    description: 'Esstee Plant Maintenance Operations',
    createdAt: now,
    updatedAt: now,
  };

  await companiesCol.updateOne(
    { slug: 'esstee' },
    { $set: essteeCompany },
    { upsert: true }
  );
  console.log(` - Registered company: ${essteeCompany.name} (slug: "${essteeCompany.slug}", db: "${essteeCompany.databaseName}")`);

  // 2. Setup dedicated database: compliance_esstee
  console.log('\n2. Setting up dedicated database: "compliance_esstee"...');
  const essteeDb = client.db('compliance_esstee');

  // Ensure collections and indexes
  const usersCol = essteeDb.collection('users');
  await usersCol.createIndex({ email: 1 }, { unique: true }).catch(() => { });
  await usersCol.createIndex({ employeeId: 1 }, { sparse: true }).catch(() => { });
  await usersCol.createIndex({ uid: 1 }, { unique: true }).catch(() => { });

  const machinesCol = essteeDb.collection('machines');
  await machinesCol.createIndex({ id: 1 }, { unique: true }).catch(() => { });

  const ticketsCol = essteeDb.collection('repair_tickets');
  await ticketsCol.createIndex({ id: 1 }, { unique: true }).catch(() => { });

  const partsCol = essteeDb.collection('spare_parts');
  await partsCol.createIndex({ partId: 1 }, { unique: true }).catch(() => { });

  // Provision Standard Role Accounts for Esstee
  const hashedAdminPass = await bcrypt.hash('admin123', 10);
  const hashedSeniorPass = await bcrypt.hash('senior123', 10);
  const hashedMechPass = await bcrypt.hash('mechanic123', 10);
  const hashedStorePass = await bcrypt.hash('stores123', 10);
  const hashedCeoPass = await bcrypt.hash('ceo123', 10);

  const essteeUsers = [
    {
      uid: 'ADM-ESSTEE-01',
      name: 'Esstee Plant Administrator',
      email: 'admin@esstee.com',
      username: 'esstee.admin',
      role: 'ADMIN',
      title: 'Plant Administrator & Asset Director',
      phone: '+91 98401 00001',
      department: 'Factory Operations',
      employeeId: 'EMP-ADM-01',
      unit: 'All Units',
      company: 'Esstee',
      companySlug: 'esstee',
      status: 'ACTIVE',
      passwordHash: hashedAdminPass,
      updatedAt: now,
    },
    {
      uid: 'CEO-ESSTEE-01',
      name: 'Chief Executive Officer',
      email: 'ceo@esstee.com',
      username: 'esstee.ceo',
      role: 'CEO',
      title: 'Chief Executive Officer (Managing Director)',
      phone: '+91 98401 00002',
      department: 'Executive Management',
      employeeId: 'EMP-CEO-01',
      unit: 'All Units',
      company: 'Esstee',
      companySlug: 'esstee',
      status: 'ACTIVE',
      passwordHash: hashedCeoPass,
      updatedAt: now,
    },
    {
      uid: 'SNR-ESSTEE-01',
      name: 'Senior Maintenance Engineer',
      email: 'senior@esstee.com',
      username: 'esstee.senior',
      role: 'SENIOR_MECHANIC',
      title: 'Senior Floor Maintenance In-Charge',
      phone: '+91 98401 00003',
      department: 'Plant Maintenance',
      employeeId: 'EMP-SNR-01',
      unit: 'UNIT - 1',
      company: 'Esstee',
      companySlug: 'esstee',
      status: 'ACTIVE',
      passwordHash: hashedSeniorPass,
      updatedAt: now,
    },
    {
      uid: 'MCH-ESSTEE-01',
      name: 'Line Maintenance Mechanic',
      email: 'mechanic@esstee.com',
      username: 'esstee.mechanic',
      role: 'MECHANIC',
      title: 'Floor Duty Mechanic',
      phone: '+91 98401 00004',
      department: 'Sewing Maintenance',
      employeeId: 'EMP-MCH-01',
      unit: 'UNIT - 1',
      company: 'Esstee',
      companySlug: 'esstee',
      status: 'ACTIVE',
      passwordHash: hashedMechPass,
      updatedAt: now,
    },
    {
      uid: 'STR-ESSTEE-01',
      name: 'Central Spare Store In-Charge',
      email: 'stores@esstee.com',
      username: 'esstee.stores',
      role: 'STORE_PERSON',
      title: 'Spares Inventory Controller',
      phone: '+91 98401 00005',
      department: 'Store & Inventory Crib',
      employeeId: 'EMP-STR-01',
      unit: 'UNIT - 1',
      company: 'Esstee',
      companySlug: 'esstee',
      status: 'ACTIVE',
      passwordHash: hashedStorePass,
      updatedAt: now,
    },
  ];

  for (const u of essteeUsers) {
    await usersCol.updateOne(
      { email: u.email },
      { $set: u },
      { upsert: true }
    );
    console.log(` - User provisioned: ${u.name} (${u.email}) [${u.role}]`);
  }

  console.log('\nSetup completed successfully for Esstee.');
  await client.close();
}

setupEsstee().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
