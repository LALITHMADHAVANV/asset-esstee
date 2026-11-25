import { NextResponse } from 'next/server';
import type { Document } from 'mongodb';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { normalizeRole } from '@/lib/constants/roles';
import type { QuotationApprovalRequest } from '@/types/cmms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

type StoredQuotationRequest = QuotationApprovalRequest & Document & {
  company?: string;
  companySlug?: string;
};

function requireRole(
  role: string,
  allowed: Array<'CEO' | 'ADMIN' | 'ASSET_MANAGER' | 'SENIOR_MECHANIC' | 'SENIOR_ELECTRICIAN'>
) {
  if (!allowed.includes(normalizeRole(role) as typeof allowed[number])) {
    throw new TenantError('You do not have permission to access quotation requests.', 403, 'FORBIDDEN');
  }
}

function fileSignatureMatches(mimeType: string, bytes: Uint8Array) {
  if (mimeType === 'application/pdf') {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  }
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
      bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  return false;
}

function cleanRequest(request: StoredQuotationRequest) {
  const safeRequest = { ...request };
  delete safeRequest._id;
  delete safeRequest.quotationData;
  return safeRequest;
}

function errorResponse(error: unknown, action: string) {
  if (error instanceof TenantError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
  }
  console.error(`${action}:`, error);
  return NextResponse.json({ error: 'Quotation request service is unavailable. Please try again.' }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const role = db.sessionUser?.role;
    if (!role) throw new TenantError('Please sign in to view quotation requests.', 401, 'AUTH_REQUIRED');
    requireRole(role, ['CEO', 'ADMIN', 'ASSET_MANAGER', 'SENIOR_MECHANIC', 'SENIOR_ELECTRICIAN']);

    const collection = db.rawCollection<StoredQuotationRequest>('quotation_requests');
    const attachmentId = new URL(req.url).searchParams.get('attachment');
    if (attachmentId) {
      const request = await collection.findOne({ id: attachmentId });
      const currentRole = normalizeRole(role);
      const canReview = ['CEO', 'ADMIN', 'ASSET_MANAGER'].includes(currentRole);
      if (!canReview && request?.requestedById !== db.sessionUser?.uid) {
        throw new TenantError('You can only view quotations you submitted.', 403, 'FORBIDDEN');
      }
      if (!request?.quotationData || !allowedMimeTypes.has(request.quotationMimeType)) {
        return NextResponse.json({ error: 'Quotation file not found.' }, { status: 404 });
      }
      const bytes = new Uint8Array(Buffer.from(request.quotationData, 'base64'));
      const safeName = request.quotationName.replace(/[^\w.-]/g, '_').slice(0, 180) || 'quotation';
      return new NextResponse(bytes, {
        headers: {
          'Content-Type': request.quotationMimeType,
          'Content-Disposition': `inline; filename="${safeName}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const currentRole = normalizeRole(role);
    const canReview = ['CEO', 'ADMIN', 'ASSET_MANAGER'].includes(currentRole);
    const requests = await collection.find(canReview ? {} : { requestedById: db.sessionUser?.uid })
      .sort({ requestedAt: -1 })
      .toArray();
    return NextResponse.json({ success: true, data: requests.map(cleanRequest) });
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to load quotation requests');
  }
}

export async function POST(req: Request) {
  try {
    const db = await getDatabase(req);
    const sessionUser = db.sessionUser;
    if (!sessionUser) throw new TenantError('Please sign in to submit a quotation request.', 401, 'AUTH_REQUIRED');
    requireRole(sessionUser.role, ['ADMIN', 'ASSET_MANAGER', 'SENIOR_MECHANIC', 'SENIOR_ELECTRICIAN']);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Submit the request and quotation using the provided form.' }, { status: 400 });
    }
    const file = form.get('quotation');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a quotation file to submit.' }, { status: 400 });
    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Quotation must be a non-empty PDF or image up to 5 MB.' }, { status: 400 });
    }
    const mimeType = file.type.toLowerCase();
    if (!allowedMimeTypes.has(mimeType)) {
      return NextResponse.json({ error: 'Upload a PDF, JPG, PNG, or WEBP quotation.' }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!fileSignatureMatches(mimeType, bytes)) {
      return NextResponse.json({ error: 'The uploaded file does not match its PDF or image type.' }, { status: 400 });
    }

    const request: StoredQuotationRequest = {
      id: crypto.randomUUID(),
      quotationName: file.name.replace(/[\\/\r\n"]/g, '_').slice(0, 180) || 'quotation',
      quotationMimeType: mimeType,
      quotationData: Buffer.from(bytes).toString('base64'),
      status: 'PENDING_CEO_APPROVAL',
      requestedById: sessionUser.uid,
      requestedBy: sessionUser.name,
      requestedAt: new Date().toISOString(),
      company: db.companyName,
      companySlug: db.tenant,
    };

    const collection = db.rawCollection<StoredQuotationRequest>('quotation_requests');
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.insertOne(request);
    return NextResponse.json({ success: true, data: cleanRequest(request) }, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to submit quotation request');
  }
}

export async function PATCH(req: Request) {
  try {
    const db = await getDatabase(req);
    const sessionUser = db.sessionUser;
    if (!sessionUser) throw new TenantError('Please sign in to review quotation requests.', 401, 'AUTH_REQUIRED');
    requireRole(sessionUser.role, ['CEO', 'ADMIN', 'ASSET_MANAGER']);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'The approval decision must be valid JSON.' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'A valid approval decision is required.' }, { status: 400 });
    }
    const bodyRecord = body as Record<string, unknown>;
    const id = typeof bodyRecord.id === 'string' ? bodyRecord.id.trim() : '';
    const status = bodyRecord.status;
    const reviewNote = typeof bodyRecord.reviewNote === 'string' ? bodyRecord.reviewNote.trim().slice(0, 500) : '';
    if (!id || (status !== 'APPROVED_BY_CEO' && status !== 'REJECTED')) {
      return NextResponse.json({ error: 'A request ID and valid approval decision are required.' }, { status: 400 });
    }
    if (status === 'REJECTED' && !reviewNote) {
      return NextResponse.json({ error: 'Add a reason before rejecting this request.' }, { status: 400 });
    }

    const collection = db.rawCollection<StoredQuotationRequest>('quotation_requests');
    const result = await collection.updateOne(
      { id, status: 'PENDING_CEO_APPROVAL' },
      {
        $set: {
          status,
          reviewNote,
          ...(status === 'APPROVED_BY_CEO'
            ? { approvedBy: sessionUser.name, approvedAt: new Date().toISOString() }
            : { rejectedBy: sessionUser.name, rejectedAt: new Date().toISOString() }),
          company: db.companyName,
          companySlug: db.tenant,
        },
      }
    );
    if (result.matchedCount === 0) {
      const existing = await collection.findOne({ id }, { projection: { _id: 1 } });
      return NextResponse.json(
        { error: existing ? 'This request has already been reviewed.' : 'Quotation request not found.' },
        { status: existing ? 409 : 404 }
      );
    }
    return NextResponse.json({ success: true, message: `Quotation request ${status === 'REJECTED' ? 'rejected' : 'approved'}.` });
  } catch (error: unknown) {
    return errorResponse(error, 'Failed to review quotation request');
  }
}
