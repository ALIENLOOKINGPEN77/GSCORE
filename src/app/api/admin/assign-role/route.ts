// /app/api/admin/assign-role/route.ts
// Corrected version with proper imports to avoid TypeScript conflicts

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminApp } from '../../../lib/firebase/admin-server';

// Import Firebase Admin SDK components with proper syntax
import * as admin from 'firebase-admin';

// Types for our role system
interface Role {
  label: string;
  modules: Record<string, 'r' | 'rw' | 'admin'>;
  description?: string;
}

interface UserRoleAssignment {
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: admin.firestore.Timestamp;
}

/**
 * POST /app/api/admin/assign-role
 * Assigns a role to a user by updating their custom claims
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const { targetUserId, roleId, adminToken } = await request.json();

    console.log('[API] Processing role assignment:', { targetUserId, roleId });

    // Validate required parameters
    if (!targetUserId || !roleId || !adminToken) {
      console.error('[API] Missing required parameters');
      return NextResponse.json(
        { error: 'Missing required parameters: targetUserId, roleId, or adminToken' },
        { status: 400 }
      );
    }

    // Get Firebase Admin SDK instances
    const { auth, firestore } = getFirebaseAdminApp();

    // Verify the admin token and check permissions
    let adminUser;
    try {
      adminUser = await auth.verifyIdToken(adminToken);
      console.log('[API] Admin user verified:', adminUser.uid);
    } catch (error) {
      console.error('[API] Invalid admin token:', error);
      return NextResponse.json(
        { error: 'Invalid or expired admin token' },
        { status: 401 }
      );
    }

    // Check if the requesting user has admin privileges
    if (!adminUser.isAdmin && !adminUser.admin) {
      console.error('[API] User lacks admin privileges:', adminUser.uid);
      return NextResponse.json(
        { error: 'Insufficient permissions - admin access required' },
        { status: 403 }
      );
    }

    // Fetch the role definition from Firestore
    const roleDocRef = firestore.collection('roles').doc(roleId);
    const roleDoc = await roleDocRef.get();
    
    if (!roleDoc.exists) {
      console.error('[API] Role not found:', roleId);
      return NextResponse.json(
        { error: `Role ${roleId} does not exist` },
        { status: 404 }
      );
    }

    const roleData = roleDoc.data() as Role;
    console.log('[API] Role data retrieved:', { roleId, label: roleData.label });

    // Set custom claims on the target user's authentication token
    await auth.setCustomUserClaims(targetUserId, {
      role: roleId,
      roleLabel: roleData.label,
      modules: roleData.modules,
      assignedAt: Date.now(),
      isAdmin: roleId === 'admin'
    });

    console.log('[API] Custom claims set successfully for user:', targetUserId);

    // Store the assignment record in Firestore for audit purposes
    const assignmentData: UserRoleAssignment = {
      userId: targetUserId,
      roleId,
      assignedBy: adminUser.uid,
      assignedAt: admin.firestore.Timestamp.now()
    };

    await firestore.collection('user_roles').doc(targetUserId).set(assignmentData);
    console.log('[API] Assignment record stored in Firestore');

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Role assigned successfully',
      assignment: {
        userId: targetUserId,
        roleId,
        roleLabel: roleData.label,
        assignedBy: adminUser.uid
      }
    });

  } catch (error) {
    console.error('[API] Error in role assignment:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error during role assignment',
        message: 'Please try again or contact support if the problem persists'
      },
      { status: 500 }
    );
  }
}


