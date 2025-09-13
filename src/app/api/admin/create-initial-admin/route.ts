// /app/api/admin/create-initial-admin/route.ts
// Corrected version for creating initial admin

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminApp } from '../../../lib/firebase/admin-server';
import * as admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { userEmail, setupKey } = await request.json();

    console.log('[API] Processing initial admin creation for:', userEmail);

    // Basic validation
    if (!userEmail || !setupKey) {
      return NextResponse.json(
        { error: 'Missing required parameters: userEmail or setupKey' },
        { status: 400 }
      );
    }

    // Simple setup key validation
    const expectedSetupKey = process.env.INITIAL_ADMIN_SETUP_KEY || 'your-secure-setup-key-here';
    if (setupKey !== expectedSetupKey) {
      console.error('[API] Invalid setup key provided');
      return NextResponse.json(
        { error: 'Invalid setup key' },
        { status: 403 }
      );
    }

    // Get Firebase Admin SDK instances
    const { auth, firestore } = getFirebaseAdminApp();

    // Find the user by email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(userEmail);
      console.log('[API] User found:', userRecord.uid);
    } catch (error) {
      console.error('[API] User not found:', userEmail);
      return NextResponse.json(
        { error: `User with email ${userEmail} not found in Firebase Auth` },
        { status: 404 }
      );
    }

    // Set admin claims on the user
    await auth.setCustomUserClaims(userRecord.uid, {
      isAdmin: true,
      admin: true,
      role: 'admin',
      roleLabel: 'Administrador',
      modules: { '*': 'admin' },
      assignedAt: Date.now()
    });

    console.log('[API] Admin claims set for user:', userRecord.uid);

    // Store admin record in Firestore
    await firestore.collection('user_roles').doc(userRecord.uid).set({
      userId: userRecord.uid,
      roleId: 'admin',
      assignedBy: 'system',
      assignedAt: admin.firestore.Timestamp.now(),
      userEmail: userEmail
    });

    console.log('[API] Initial admin created successfully');

    return NextResponse.json({
      success: true,
      message: 'Initial admin created successfully',
      adminUser: {
        uid: userRecord.uid,
        email: userEmail
      }
    });

  } catch (error) {
    console.error('[API] Error creating initial admin:', error);
    return NextResponse.json(
      { error: 'Internal server error during initial admin creation' },
      { status: 500 }
    );
  }
}