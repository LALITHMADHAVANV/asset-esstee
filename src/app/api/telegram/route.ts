import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { sendTelegramAlert } from '@/lib/services/telegramService';

function failure(error: unknown) {
  return NextResponse.json({ success: false, error: error instanceof TenantError ? error.message : 'Telegram request failed.' }, { status: error instanceof TenantError ? error.statusCode : 500 });
}
export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    if (!['ADMIN','ASSET_MANAGER'].includes(String(db.sessionUser?.role).toUpperCase())) throw new TenantError('Administrator access required.',403);
    const config = await db.collection('settings').findOne({ key: 'telegram' });
    const prefix = db.tenant.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    return NextResponse.json({ success: true, configured: Boolean(config?.botToken || process.env[`${prefix}_TELEGRAM_BOT_TOKEN`]), botToken: '', unit1ChatId: config?.unit1ChatId || process.env[`${prefix}_TELEGRAM_CHAT_ID_UNIT1`] || '', unit2ChatId: config?.unit2ChatId || process.env[`${prefix}_TELEGRAM_CHAT_ID_UNIT2`] || '', adminChatId: config?.adminChatId || process.env[`${prefix}_TELEGRAM_ADMIN_CHAT_ID`] || '' });
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    const db = await getDatabase(req);
    const { action, payload, botToken, unit1ChatId, unit2ChatId, adminChatId } = await req.json();
    const admin = ['ADMIN','ASSET_MANAGER'].includes(String(db.sessionUser?.role).toUpperCase());
    if ((action === 'SAVE' || action === 'TEST' || botToken || payload?.targetChatId) && !admin) throw new TenantError('Administrator access required.',403);
    if (action === 'SAVE') {
      const changes: Record<string,string> = {};
      for (const [key, value] of Object.entries({ unit1ChatId, unit2ChatId, adminChatId })) {
        if (typeof value !== 'string' || value.length > 100) throw new TenantError('Invalid chat configuration.',400);
        changes[key] = value.trim();
      }
      if (typeof botToken === 'string' && botToken.trim()) changes.botToken = botToken.trim();
      await db.collection('settings').updateOne({ key:'telegram' }, { $set: changes }, { upsert:true });
      return NextResponse.json({success:true});
    }
    if (!payload) throw new TenantError('Alert details are required.',400);
    const result = await sendTelegramAlert({ ...payload, companySlug: db.tenant, title: payload.title || 'Telegram notification', category: action === 'TEST' ? 'TEST' : payload.category }, admin ? botToken : undefined);
    return NextResponse.json(result, {status:result.success ? 200 : 400});
  } catch (error) { return failure(error); }
}
