export const QR_FAULT_CATEGORIES = ['Mechanical fault', 'Skipping stitches', 'Thread or needle breakage', 'Motor or electrical fault', 'Oil leakage', 'Other'] as const;

export function qrBookingCompany(pathname: string, queryCompany?: string | null): string {
  return (pathname.match(/^\/([^/]+)\/scan\//)?.[1] || queryCompany || 'esstee').trim().toLowerCase();
}

type BookingBrowser = Pick<Window, 'alert' | 'close' | 'closed'> & { location: Pick<Location, 'replace'> };

/** A phone camera tab may forbid window.close; leave the form either way. */
export function finishQrBooking(ticketId: string, browser: BookingBrowser = window): void {
  try { browser.alert(`Ticket booked successfully.\nReference: ${ticketId}`); } catch { /* The confirmation screen also shows success. */ }
  try { browser.close(); } catch { /* Normal for tabs opened by a phone camera. */ }
  if (!browser.closed) browser.location.replace('/scan/booked?ticket=' + encodeURIComponent(ticketId));
}
