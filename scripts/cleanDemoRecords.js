const fs = require('fs');
const { MongoClient } = require('mongodb');

async function main() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const uri = env.split(/\r?\n/).find(l => l.startsWith('MONGODB_URI=')).slice(12).trim();
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const targetDbName = process.env.MONGODB_DB_NAME || (client.db().databaseName !== 'test' ? client.db().databaseName : 'maintanence');
    const db = client.db(targetDbName);

    // 1. Delete dummy repair tickets (on Qrtt123 or test data)
    const delTickets = await db.collection('repair_tickets').deleteMany({
      $or: [
        { machineId: 'Qrtt123' },
        { faultDetails: /Uenry|Itziyzoyzpux|jcndhdy/i },
      ]
    });
    console.log(`Deleted ${delTickets.deletedCount} dummy repair tickets.`);

    // 2. Delete dummy asset logs (on Qrtt123)
    const delLogs = await db.collection('asset_logs').deleteMany({
      machineId: 'Qrtt123'
    });
    console.log(`Deleted ${delLogs.deletedCount} dummy asset logs.`);

    // 3. Verify counts
    const ticketsCount = await db.collection('repair_tickets').countDocuments();
    const logsCount = await db.collection('asset_logs').countDocuments();
    const machinesCount = await db.collection('machines').countDocuments();
    const usersCount = await db.collection('users').countDocuments();

    console.log(`Remaining in MongoDB:`);
    console.log(`- Machines (plant assets): ${machinesCount}`);
    console.log(`- Users: ${usersCount}`);
    console.log(`- Repair Tickets: ${ticketsCount}`);
    console.log(`- Asset Logs: ${logsCount}`);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
