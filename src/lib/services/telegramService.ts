/**
 * Telegram Notification Service for TexTech CMMS
 * Routes alerts to Unit 1, Unit 2, or Admin Telegram chats.
 */

export interface TelegramAlertPayload {
  companySlug?: string;
  unit?: string;
  category?: 'BREAKDOWN' | 'SLA_BREACH' | 'LOW_STOCK' | 'PPM_OVERDUE' | 'DISPATCH' | 'TEST' | 'RESOLVED' | 'PPM' | 'STARTED' | 'REJECTED';
  title: string;
  ticketId?: string;
  machineId?: string;
  machineName?: string;
  line?: string;
  zone?: string;
  issue?: string;
  actionTaken?: string;
  downtimeMinutes?: number;
  timeSpentMinutes?: number;
  startedAtTime?: string;
  timestamp?: string | Date;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'WARNING';
  assignedTo?: string;
  details?: string;
  targetChatId?: string | number;
}

function escapeHtml(text?: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return 'Few minutes';
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''}`;
  const hrs = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`;
  return `${hrs} hr${hrs > 1 ? 's' : ''} ${remainingMins} min${remainingMins > 1 ? 's' : ''}`;
}

/**
 * Format time strictly in Indian Standard Time (IST, Asia/Kolkata)
 */
export function formatISTTime(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const valid = isNaN(d.getTime()) ? new Date() : d;
  return valid.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date strictly in Indian Standard Time (IST, Asia/Kolkata)
 */
export function formatISTDate(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const valid = isNaN(d.getTime()) ? new Date() : d;
  return valid.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format markdown/HTML payload for Telegram sendMessage API
 */
export function buildTelegramMessage(payload: TelegramAlertPayload): string {
  const time = formatISTTime(payload.timestamp);
  const date = formatISTDate(payload.timestamp);

  let startedDisplay = payload.startedAtTime;
  if (startedDisplay) {
    if (!startedDisplay.toLowerCase().includes('am') && !startedDisplay.toLowerCase().includes('pm')) {
      const parsedStart = new Date(startedDisplay);
      if (!isNaN(parsedStart.getTime())) {
        startedDisplay = formatISTTime(parsedStart);
      }
    }
  }

  const unitTag = payload.unit ? ` [${escapeHtml(payload.unit.toUpperCase())}]` : '';

  if (payload.category === 'TEST') {
    return (
      `🔔 <b>TexTech CMMS • Telegram Notification Active</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 <b>Unit:</b> ${escapeHtml(payload.unit || 'UNIT - 1')}\n` +
      `✅ <b>Status:</b> Bot successfully connected and verified\n` +
      `⏱️ <b>Timestamp:</b> ${date} at ${time}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Real-time machine breakdown & maintenance alerts will be delivered here automatically.</i>`
    );
  }

  if (payload.category === 'REJECTED') {
    return (
      `❌ <b>ISSUE REJECTED / DECLINED${unitTag}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      (payload.ticketId ? `🎫 <b>Ticket ID:</b> <code>#${escapeHtml(payload.ticketId)}</code>\n` : '') +
      `🏷️ <b>Asset ID:</b> <code>${escapeHtml(payload.machineId || 'N/A')}</code>\n` +
      (payload.machineName ? `⚙️ <b>Model:</b> ${escapeHtml(payload.machineName)}\n` : '') +
      `📍 <b>Location:</b> ${escapeHtml(payload.zone || 'Floor')} • ${escapeHtml(payload.line || 'Line')}\n` +
      `👨‍💼 <b>Rejected By:</b> <b>${escapeHtml(payload.assignedTo || 'Supervisor')}</b>\n` +
      `📝 <b>Reason:</b> ${escapeHtml(payload.actionTaken || payload.issue || 'False alarm / cancelled')}\n` +
      `⏱️ <b>Time:</b> ${time} (${date})\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Issue rejected & closed. Machine restored to ACTIVE service.</i>`
    );
  }

  if (payload.category === 'LOW_STOCK') {
    return (
      `📦 <b>SPARE PART STOCK ALERT${unitTag}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏷️ <b>Part:</b> ${escapeHtml(payload.machineName || payload.title)}\n` +
      `⚠️ <b>Alert:</b> ${escapeHtml(payload.issue || payload.details || 'Stock level below safety threshold')}\n` +
      `🏢 <b>Unit:</b> ${escapeHtml(payload.unit || 'UNIT - 1')}\n` +
      `⏱️ <b>Time:</b> ${time} (${date})\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Please generate indent for inventory replenishment.</i>`
    );
  }

  if (payload.category === 'SLA_BREACH') {
    return (
      `🚨 <b>CRITICAL: 5-MIN SLA BREACH${unitTag}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ <b>Alert:</b> Machine Breakdown Unattended > 5 Mins\n` +
      (payload.ticketId ? `🎫 <b>Ticket ID:</b> <code>#${escapeHtml(payload.ticketId)}</code>\n` : '') +
      `🏷️ <b>Machine:</b> <code>${escapeHtml(payload.machineId || 'N/A')}</code> ${payload.machineName ? `(${escapeHtml(payload.machineName)})` : ''}\n` +
      `📍 <b>Location:</b> ${escapeHtml(payload.zone || 'Floor')} • ${escapeHtml(payload.line || 'Line')}\n` +
      `🛠️ <b>Reported Fault:</b> ${escapeHtml(payload.issue || 'Defect reported')}\n` +
      `⏱️ <b>Time Elapsed:</b> > 5 mins without technician assignment\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ <b>Supervisor Action: Immediate technician dispatch required!</b>`
    );
  }

  if (payload.category === 'STARTED') {
    return (
      `🛠️ <b>TECHNICIAN STARTED WORK${unitTag}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      (payload.ticketId ? `🎫 <b>Ticket ID:</b> <code>#${escapeHtml(payload.ticketId)}</code>\n` : '') +
      `🏷️ <b>Asset ID:</b> <code>${escapeHtml(payload.machineId || 'N/A')}</code>\n` +
      (payload.machineName ? `⚙️ <b>Model:</b> ${escapeHtml(payload.machineName)}\n` : '') +
      `📍 <b>Location:</b> ${escapeHtml(payload.zone || 'Floor')} • ${escapeHtml(payload.line || 'Line')}\n` +
      `👨‍🔧 <b>Attender / Technician:</b> <b>${escapeHtml(payload.assignedTo || 'Technician')}</b>\n` +
      `⏱️ <b>Started At:</b> ${time} (${date})\n` +
      (payload.issue ? `⚠️ <b>Defect:</b> ${escapeHtml(payload.issue)}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Technician has commenced active maintenance on this machine.</i>`
    );
  }

  if (payload.category === 'RESOLVED') {
    const timeSpentMins = payload.timeSpentMinutes !== undefined ? payload.timeSpentMinutes : payload.downtimeMinutes;
    const timeSpentFormatted = formatDuration(timeSpentMins);
    const totalDowntimeFormatted = payload.downtimeMinutes ? formatDuration(payload.downtimeMinutes) : null;

    return (
      `✅ <b>ISSUE COMPLETED • RESTORED TO SERVICE${unitTag}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      (payload.ticketId ? `🎫 <b>Ticket ID:</b> <code>#${escapeHtml(payload.ticketId)}</code>\n` : '') +
      `🏷️ <b>Asset ID:</b> <code>${escapeHtml(payload.machineId || 'N/A')}</code>\n` +
      (payload.machineName ? `⚙️ <b>Model:</b> ${escapeHtml(payload.machineName)}\n` : '') +
      `📍 <b>Location:</b> ${escapeHtml(payload.zone || 'Floor')} • ${escapeHtml(payload.line || 'Line')}\n` +
      `👨‍🔧 <b>Completed By:</b> <b>${escapeHtml(payload.assignedTo || 'Technician')}</b>\n` +
      `🔧 <b>Action Taken:</b> ${escapeHtml(payload.actionTaken || payload.issue || 'Repair completed successfully')}\n` +
      `⏳ <b>Time Spent (Work Duration):</b> <b>${timeSpentFormatted}</b>\n` +
      (totalDowntimeFormatted && totalDowntimeFormatted !== timeSpentFormatted ? `⏱️ <b>Total Machine Downtime:</b> ${totalDowntimeFormatted}\n` : '') +
      (startedDisplay ? `🕒 <b>Started:</b> ${escapeHtml(startedDisplay)} ➔ <b>Completed:</b> ${time}\n` : `🏁 <b>Completed At:</b> ${time} (${date})\n`) +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Machine is verified active and returned to production floor.</i>`
    );
  }

  if (payload.category === 'PPM') {
    return (
      `🛠️ <b>PREVENTIVE MAINTENANCE (PPM) ALERT${unitTag}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏷️ <b>Asset ID:</b> <code>${escapeHtml(payload.machineId || 'N/A')}</code>\n` +
      `⚙️ <b>Task:</b> ${escapeHtml(payload.title || 'Scheduled Service')}\n` +
      `📍 <b>Location:</b> ${escapeHtml(payload.zone || 'Floor')} • ${escapeHtml(payload.line || 'Line')}\n` +
      (payload.assignedTo ? `👨‍🔧 <b>Assigned Staff:</b> ${escapeHtml(payload.assignedTo)}\n` : '') +
      `⏱️ <b>Scheduled Time:</b> ${time} (${date})\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>PPM checklist available on technician workstation.</i>`
    );
  }

  // Default: BREAKDOWN or DISPATCH alert (Issue created)
  const headerIcon = payload.severity === 'CRITICAL' ? '🚨' : '⚠️';
  const attenderDisplay = payload.assignedTo
    ? `<b>${escapeHtml(payload.assignedTo)}</b>`
    : `<i>Awaiting Attender Assignment</i>`;

  return (
    `${headerIcon} <b>NEW ISSUE REPORTED${unitTag}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    (payload.ticketId ? `🎫 <b>Ticket ID:</b> <code>#${escapeHtml(payload.ticketId)}</code>\n` : '') +
    `🏷️ <b>Asset ID:</b> <code>${escapeHtml(payload.machineId || 'N/A')}</code>\n` +
    (payload.machineName ? `⚙️ <b>Model:</b> ${escapeHtml(payload.machineName)}\n` : '') +
    `📍 <b>Floor Location:</b> ${escapeHtml(payload.zone || 'Floor')} • ${escapeHtml(payload.line || 'Line')}\n` +
    `⚠️ <b>Problem:</b> ${escapeHtml(payload.issue || payload.title)}\n` +
    `⚡ <b>Urgency:</b> ${escapeHtml(payload.severity || 'HIGH')}\n` +
    `👨‍🔧 <b>Attender:</b> ${attenderDisplay}\n` +
    `⏱️ <b>Reported At:</b> ${time} (${date})\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Broadcast to ${escapeHtml(payload.unit || 'Unit')} maintenance team.</i>`
  );
}

/**
 * Dispatch Telegram message via Bot API with automatic chat ID resolution, dual delivery (Unit + Admin) & HTML fallback.
 */
export async function sendTelegramAlert(
  payload: TelegramAlertPayload,
  customBotToken?: string
): Promise<{ success: boolean; error?: string; messageId?: number }> {
  if (!payload.companySlug) return { success: false, error: 'Company configuration is required.' };
  const { getCompanyDatabase } = await import('@/lib/mongodb');
  const { db } = await getCompanyDatabase(payload.companySlug);
  const config = await db.collection('settings').findOne({ key: 'telegram' });
  const prefix = payload.companySlug.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const botToken = customBotToken || config?.botToken || process.env[`${prefix}_TELEGRAM_BOT_TOKEN`];
  if (!botToken) return { success: false, error: 'Configure Telegram for this company in Settings.' };
  const unit = (payload.unit || '').replace(/[^0-9]/g, '');
  const group = unit === '2' ? config?.unit2ChatId || process.env[`${prefix}_TELEGRAM_CHAT_ID_UNIT2`]
    : config?.unit1ChatId || process.env[`${prefix}_TELEGRAM_CHAT_ID_UNIT1`];
  const admin = config?.adminChatId || process.env[`${prefix}_TELEGRAM_ADMIN_CHAT_ID`];
  const targetChatIds = payload.targetChatId ? [payload.targetChatId] : [...new Set([group, admin].filter(Boolean))];
  if (!targetChatIds.length) return { success: false, error: 'No Telegram destination configured for this company.' };

  const messageText = buildTelegramMessage(payload);
  let lastError = '';
  let deliveredMessageId: number | undefined;

  for (const chatId of targetChatIds) {
    try {
      let res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      let data = await res.json();

      // If Telegram fails to parse entities, automatically retry as plain text (strip tags)
      if (!data.ok && data.description && data.description.includes('parse entities')) {
        const plainText = messageText.replace(/<[^>]+>/g, '');
        res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: plainText,
            disable_web_page_preview: true,
          }),
        });
        data = await res.json();
      }

      if (data.ok) {
        deliveredMessageId = data.result?.message_id;
      } else {
        lastError = data.description || 'Unknown Telegram API error';
        console.warn(`[Telegram Alert] Failed to send to ${chatId}:`, data.description);
      }
    } catch (err: any) {
      lastError = err.message || 'Network request to Telegram failed';
      console.warn(`[Telegram Alert] Network error for ${chatId}:`, lastError);
    }
  }

  if (deliveredMessageId !== undefined) {
    return { success: true, messageId: deliveredMessageId };
  }

  return { success: false, error: lastError };
}
