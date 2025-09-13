// /app/api/health/route.ts
// Corrected health check endpoint with proper imports

import { NextResponse } from 'next/server';
import { performHealthCheck } from '../../lib/firebase/admin-server';

/**
 * GET /api/health
 * Returns the health status of the Firebase Admin SDK
 */
export async function GET() {
  try {
    console.log('[HealthCheck] Starting health check...');
    
    // Perform comprehensive health check
    const healthResult = await performHealthCheck();
    
    console.log('[HealthCheck] Health check completed:', healthResult.status);
    
    // Return appropriate HTTP status based on health check result
    const httpStatus = healthResult.status === 'healthy' ? 200 : 503;
    
    return NextResponse.json(healthResult, { status: httpStatus });
    
  } catch (error) {
    console.error('[HealthCheck] Health check failed with exception:', error);
    
    // Return error response with details for debugging
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        environment: false,
        adminApp: false,
        auth: false,
        firestore: false
      }
    }, { status: 503 });
  }
}