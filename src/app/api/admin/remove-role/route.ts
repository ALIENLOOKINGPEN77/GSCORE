
// /app/api/admin/remove-role/route.ts
// Corrected version for removing roles

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminApp } from '../../../lib/firebase/admin-server';

export async function POST(request: NextRequest) {
  try {
    const { targetUserId, adminToken } = await request.json();

    console.log('[API] Processing role removal for user:', targetUserId);

    // Validate required parameters
    if (!targetUserId || !adminToken) {
      return NextResponse.json(
        { error: 'Missing required parameters: targetUserId or adminToken' },
        { status: 400 }
      );
    }

    // Get Firebase Admin SDK instances
    const { auth, firestore } = getFirebaseAdminApp();

    // Verify admin permissions
    let adminUser;
    try {
      adminUser = await auth.verifyIdToken(adminToken);
    } catch (error) {
      console.error('[API] Invalid admin token:', error);
      return NextResponse.json(
        { error: 'Invalid or expired admin token' },
        { status: 401 }
      );
    }

    if (!adminUser.isAdmin && !adminUser.admin) {
      return NextResponse.json(
        { error: 'Insufficient permissions - admin access required' },
        { status: 403 }
      );
    }

    // Clear the user's custom claims
    await auth.setCustomUserClaims(targetUserId, {});
    console.log('[API] Custom claims cleared for user:', targetUserId);

    // Remove the assignment record from Firestore
    await firestore.collection('user_roles').doc(targetUserId).delete();
    console.log('[API] Assignment record removed from Firestore');

    return NextResponse.json({
      success: true,
      message: 'Role removed successfully',
      userId: targetUserId
    });

  } catch (error) {
    console.error('[API] Error in role removal:', error);
    return NextResponse.json(
      { error: 'Internal server error during role removal' },
      { status: 500 }
    );
  }
}