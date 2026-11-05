import { NextResponse } from 'next/server';
import { getMongoClient, normalizeCompanySlug } from '@/lib/mongodb';
import { getAllCompanies, getCompanyBySlug } from '@/lib/registry';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const client = await getMongoClient();
    const url = new URL(req.url);
    const slugParam = url.searchParams.get('slug');

    if (slugParam) {
      const company = await getCompanyBySlug(client, slugParam);
      if (!company) {
        return NextResponse.json(
          { found: false, error: `Workspace "${slugParam}" not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        found: true,
        company: {
          slug: company.slug,
          name: company.name,
          active: company.active,
          description: company.description,
        },
      });
    }

    const all = await getAllCompanies(client);
    const safeList = all.map((c) => ({
      slug: c.slug,
      name: c.name,
      active: c.active,
      description: c.description,
    }));

    return NextResponse.json({ success: true, companies: safeList });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as any)?.message || 'Failed to query companies registry' },
      { status: 500 }
    );
  }
}
