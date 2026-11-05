import { reserveLoginIdentifiers } from '@/lib/loginIdentifiers';
import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { UserProfile, UserRole } from '@/types/cmms';
import { hashPassword } from '@/lib/auth';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getDefaultTitle(role: UserRole, companyName: string): string {
  switch (role) {
    case 'CEO':
      return 'Chief Executive Officer (Managing Director)';
    case 'ADMIN':
    case 'ASSET_MANAGER':
      return 'Plant Administrator & Asset Director';
    case 'SENIOR_MECHANIC':
      return 'Senior Master Technician & PPM Lead';
    case 'MECHANIC':
      return 'Industrial Sewing Machine Mechanic';
    case 'SENIOR_ELECTRICIAN':
      return 'Senior Plant Electrician & Power Specialist';
    case 'ELECTRICIAN':
      return 'Industrial Plant Electrician';
    case 'STORE_PERSON':
      return 'Tool Crib & Inventory Custodian';
    default:
      return `${companyName} Specialist`;
  }
}

// GET /api/users - Fetch all factory users for the authenticated company
export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const collection = db.collection('users');
    const users = await collection.find({}).toArray();

    const fetchedUsers: UserProfile[] = users.map(({ _id, password, passwordHash, ...data }: any) => {
      const rawRole = (data.role || 'MECHANIC').toString().trim().toUpperCase() as UserRole;
      return {
        uid: data.uid || String(_id),
        name: data.name || 'Factory Staff',
        email: data.email || '',
        role: rawRole,
        title: data.title || getDefaultTitle(rawRole, db.companyName),
        phone: data.phone || '',
        department: data.department || 'Floor Maintenance',
        employeeId: data.employeeId || '',
        unit: data.unit || 'All Units',
        zones: Array.isArray(data.zones) ? data.zones : (data.zone ? [data.zone] : []),
        company: db.companyName,
        companySlug: db.tenant,
        status: data.status || 'ACTIVE',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    return NextResponse.json({ success: true, users: fetchedUsers, count: fetchedUsers.length });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error fetching users from MongoDB:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/users - Create a new user with bcrypt password hashing
export async function POST(req: Request) {
  try {
    const db = await getDatabase(req);
    const body = await req.json();
    const { name, email, role, title, password, phone, department, employeeId, unit, zones } = body;

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Name, email, and role are required fields' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRole = role.toString().trim().toUpperCase() as UserRole;
    if (typeof password !== 'string' || password.length < 8 || password.length > 1024) return NextResponse.json({ error: 'A password of at least 8 characters is required.' }, { status: 400 });
    const cleanPass = password;
    const hashedPassword = await hashPassword(cleanPass);

    const collection = db.collection('users');

    const finalTitle = title?.trim() || getDefaultTitle(cleanRole, db.companyName);
    const finalUnit = unit?.trim() || 'All Units';
    const finalZones = Array.isArray(zones) ? zones : (zones ? [zones] : []);
    const finalEmpId = employeeId?.trim() || `EMP-${randomUUID()}`;
    const uid = `USR-${randomUUID()}`;

    // Check if email already exists in this company
    const existing = await collection.findOne({ email: cleanEmail });
    await reserveLoginIdentifiers(db.tenant, existing ? existing.uid || String(existing._id) : uid, [cleanEmail, finalEmpId, ...(existing ? [] : [uid])]);
    if (existing) {
      await collection.updateOne(
        { email: cleanEmail },
        {
          $set: {
            name: name.trim(),
            role: cleanRole,
            title: finalTitle,
            passwordHash: hashedPassword,
            phone: phone?.trim() || '',
            department: department?.trim() || '',
            employeeId: finalEmpId,
            unit: finalUnit,
            zones: finalZones,
            company: db.companyName,
            companySlug: db.tenant,
            updatedAt: new Date().toISOString(),
          },
          $unset: { password: '', defaultPassword: '' },
        }
      );

      return NextResponse.json({
        success: true,
        message: `User ${cleanEmail} profile and password updated in ${db.companyName}!`,
      });
    }

    const newUserDoc = {
      uid,
      name: name.trim(),
      email: cleanEmail,
      role: cleanRole,
      title: finalTitle,
      passwordHash: hashedPassword,
      phone: phone?.trim() || '',
      department: department?.trim() || 'Floor Maintenance',
      employeeId: finalEmpId,
      unit: finalUnit,
      zones: finalZones,
      company: db.companyName,
      companySlug: db.tenant,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await collection.insertOne(newUserDoc);

    return NextResponse.json({
      success: true,
      message: `User ${name} (${cleanEmail}) successfully created in ${db.companyName}!`,
      user: {
        uid,
        name: newUserDoc.name,
        email: newUserDoc.email,
        role: newUserDoc.role,
        title: newUserDoc.title,
        employeeId: newUserDoc.employeeId,
        unit: newUserDoc.unit,
        zones: newUserDoc.zones,
      },
    });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error creating user in MongoDB:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to create user' }, { status: 500 });
  }
}

// PUT /api/users - Update an existing user in MongoDB
export async function PUT(req: Request) {
  try {
    const db = await getDatabase(req);
    const body = await req.json();
    const { uid, email, name, role, title, department, phone, employeeId, unit, zones, status, password } = body;

    if (!uid && !email) {
      return NextResponse.json({ error: 'User UID or email is required to update' }, { status: 400 });
    }

    const collection = db.collection('users');

    const filter: Record<string, any> = {};
    if (uid) filter.uid = uid;
    else if (email) filter.email = email.trim().toLowerCase();

    const existing = await collection.findOne(filter);
    if (!existing) {
      return NextResponse.json({ error: 'User not found in company workspace' }, { status: 404 });
    }

    await reserveLoginIdentifiers(db.tenant, existing.uid || String(existing._id), [existing.email || '', employeeId ?? existing.employeeId ?? '']);
    const updateDoc: Record<string, any> = {
      updatedAt: new Date().toISOString(),
      company: db.companyName,
      companySlug: db.tenant,
    };

    if (name !== undefined) updateDoc.name = name.trim();
    if (role !== undefined) updateDoc.role = (role as string).toUpperCase();
    if (title !== undefined) updateDoc.title = title.trim();
    if (department !== undefined) updateDoc.department = department.trim();
    if (phone !== undefined) updateDoc.phone = phone.trim();
    if (employeeId !== undefined) updateDoc.employeeId = employeeId.trim();
    if (unit !== undefined) updateDoc.unit = unit.trim();
    if (zones !== undefined) updateDoc.zones = Array.isArray(zones) ? zones : [zones];
    if (status !== undefined) updateDoc.status = status;

    if (password !== undefined && password !== '') {
      if (typeof password !== 'string' || password.length < 8 || password.length > 1024) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
      updateDoc.passwordHash = await hashPassword(password);
    }

    await collection.updateOne(
      { _id: existing._id },
      { $set: updateDoc, ...(updateDoc.passwordHash ? { $unset: { password: '', defaultPassword: '' } } : {}) }
    );

    return NextResponse.json({
      success: true,
      message: `User ${updateDoc.name || existing.name} updated successfully in ${db.companyName}`,
    });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error updating user in MongoDB:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/users - Delete a non-admin factory member
export async function DELETE(req: Request) {
  try {
    const db = await getDatabase(req);
    const { searchParams } = new URL(req.url);
    let targetEmail = searchParams.get('email')?.trim().toLowerCase();
    let targetUid = searchParams.get('uid')?.trim();

    if (!targetEmail && !targetUid) {
      try {
        const body = await req.json();
        targetEmail = body.email?.trim().toLowerCase();
        targetUid = body.uid?.trim();
      } catch {}
    }

    if (!targetEmail && !targetUid) {
      return NextResponse.json({ error: 'User email or UID is required to delete' }, { status: 400 });
    }

    const collection = db.collection('users');

    const filter: Record<string, any> = {};
    if (targetEmail) filter.email = targetEmail;
    if (targetUid) filter.uid = targetUid;

    const existing = await collection.findOne(filter);
    if (!existing) {
      return NextResponse.json({ error: 'User not found in company database' }, { status: 404 });
    }

    // Never delete primary admin
    if (existing.role === 'ADMIN' && (existing.email?.startsWith('admin@') || existing.uid?.includes('ADM-01'))) {
      return NextResponse.json({ error: 'Cannot delete the primary System Administrator account' }, { status: 403 });
    }

    await collection.deleteOne({ _id: existing._id });

    return NextResponse.json({
      success: true,
      message: `User ${existing.name || targetEmail} removed from ${db.companyName}`,
    });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error deleting user in MongoDB:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to delete user' }, { status: 500 });
  }
}
