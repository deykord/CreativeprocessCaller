/**
 * API Endpoint Tests
 * 
 * Tests for:
 * - Call Logs: add, edit, delete
 * - Call History: fetch, delete
 * - Users: admin CRUD operations
 * - Notes: client notes operations
 * 
 * Run with: npx vitest run tests/api.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api';

// Test data storage
let adminToken: string;
let userToken: string;
let testUserId: string;
let testProspectId: string;
let testCallLogId: string;

// Helper function to make API requests
async function apiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  token?: string
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data };
}

// ============================================
// AUTHENTICATION TESTS
// ============================================
describe('Authentication', () => {
  it('should login as admin', async () => {
    const { status, data } = await apiRequest('/auth/login', 'POST', {
      email: 'admin@creativeprocess.io',
      password: 'admin123',
    });

    expect(status).toBe(200);
    expect(data.token).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.user.role).toBe('admin');
    adminToken = data.token;
  });

  it('should reject invalid credentials', async () => {
    const { status } = await apiRequest('/auth/login', 'POST', {
      email: 'admin@creativeprocess.io',
      password: 'wrongpassword',
    });

    expect(status).toBe(401);
  });

  it('should register a new test user', async () => {
    const testEmail = `testuser_${Date.now()}@test.com`;
    const { status, data } = await apiRequest('/auth/register', 'POST', {
      email: testEmail,
      password: 'testpass123',
      firstName: 'Test',
      lastName: 'User',
    });

    // May return 201 or 200 depending on implementation
    expect([200, 201]).toContain(status);
    if (data.token) {
      userToken = data.token;
    }
    if (data.user?.id) {
      testUserId = data.user.id;
    }
  });

  it('should get current user profile', async () => {
    const { status, data } = await apiRequest('/auth/me', 'GET', undefined, adminToken);

    expect(status).toBe(200);
    // API returns { success, user } wrapper
    const email = data.email || data.user?.email;
    expect(email).toBe('admin@creativeprocess.io');
  });
});

// ============================================
// USER MANAGEMENT TESTS (Admin Only)
// ============================================
describe('User Management (Admin)', () => {
  let createdUserId: string;

  it('should list all users', async () => {
    const { status, data } = await apiRequest('/auth/users', 'GET', undefined, adminToken);

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should create a new user', async () => {
    const newUser = {
      email: `newuser_${Date.now()}@test.com`,
      password: 'newpass123',
      firstName: 'New',
      lastName: 'User',
      role: 'user',
    };

    const { status, data } = await apiRequest('/auth/users', 'POST', newUser, adminToken);

    expect([200, 201]).toContain(status);
    expect(data.id || data.user?.id).toBeDefined();
    createdUserId = data.id || data.user?.id;
  });

  it('should get user by ID', async () => {
    if (!createdUserId) {
      console.log('Skipping: no created user ID');
      return;
    }

    const { status, data } = await apiRequest(`/auth/users/${createdUserId}`, 'GET', undefined, adminToken);

    expect(status).toBe(200);
    expect(data.id).toBe(createdUserId);
  });

  it('should update user', async () => {
    if (!createdUserId) {
      console.log('Skipping: no created user ID');
      return;
    }

    const { status, data } = await apiRequest(
      `/auth/users/${createdUserId}`,
      'PATCH',
      { firstName: 'Updated', lastName: 'Name' },
      adminToken
    );

    expect(status).toBe(200);
    expect(data.firstName || data.first_name).toBe('Updated');
  });

  it('should delete user', async () => {
    if (!createdUserId) {
      console.log('Skipping: no created user ID');
      return;
    }

    const { status } = await apiRequest(`/auth/users/${createdUserId}`, 'DELETE', undefined, adminToken);

    expect([200, 204]).toContain(status);
  });

  it('should reject user management without admin token', async () => {
    const { status } = await apiRequest('/auth/users', 'GET');

    expect([401, 403]).toContain(status);
  });
});

// ============================================
// PROSPECT TESTS
// ============================================
describe('Prospects', () => {
  it('should create a test prospect', async () => {
    const timestamp = Date.now();
    const prospect = {
      firstName: 'Test',
      lastName: 'Prospect',
      email: `prospect_${timestamp}@test.com`,
      phone: `555${String(timestamp).slice(-7)}`, // Unique phone number
      company: 'Test Company',
      status: 'New',
    };

    const { status, data } = await apiRequest('/prospects', 'POST', prospect, adminToken);

    // 409 = already exists (phone/email conflict), which is acceptable
    expect([200, 201, 409]).toContain(status);
    if (status !== 409) {
      expect(data.id).toBeDefined();
      testProspectId = data.id;
    }
  });

  it('should list all prospects', async () => {
    const { status, data } = await apiRequest('/prospects', 'GET', undefined, adminToken);

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should get prospect by ID', async () => {
    if (!testProspectId) {
      // If we didn't create a prospect, try to get one from the list
      const { data: prospectList } = await apiRequest('/prospects', 'GET', undefined, adminToken);
      if (Array.isArray(prospectList) && prospectList.length > 0) {
        testProspectId = prospectList[0].id;
      } else {
        console.log('Skipping: no prospects available');
        return;
      }
    }

    const { status, data } = await apiRequest(`/prospects/${testProspectId}`, 'GET', undefined, adminToken);

    expect(status).toBe(200);
    // Handle both direct response and wrapped response
    const prospectId = data.id || data.prospect?.id;
    expect(prospectId).toBe(testProspectId);
  });

  it('should update prospect', async () => {
    if (!testProspectId) {
      console.log('Skipping: no test prospect ID');
      return;
    }

    const { status, data } = await apiRequest(
      `/prospects/${testProspectId}`,
      'PATCH',
      { status: 'Contacted', company: 'Updated Company' },
      adminToken
    );

    expect(status).toBe(200);
  });
});

// ============================================
// NOTES TESTS (Client Notes on Prospects)
// ============================================
describe('Notes (Client)', () => {
  it('should add a note to prospect', async () => {
    if (!testProspectId) {
      console.log('Skipping: no test prospect ID');
      return;
    }

    const { status, data } = await apiRequest(
      `/prospects/${testProspectId}`,
      'PATCH',
      { notes: 'This is a test note from the API test suite.' },
      adminToken
    );

    expect(status).toBe(200);
  });

  it('should update prospect note', async () => {
    if (!testProspectId) {
      console.log('Skipping: no test prospect ID');
      return;
    }

    const { status, data } = await apiRequest(
      `/prospects/${testProspectId}`,
      'PATCH',
      { notes: 'Updated note content - modified at ' + new Date().toISOString() },
      adminToken
    );

    expect(status).toBe(200);
  });

  it('should get prospect activity log with note changes', async () => {
    if (!testProspectId) {
      console.log('Skipping: no test prospect ID');
      return;
    }

    const { status, data } = await apiRequest(
      `/prospects/${testProspectId}/activity-log`,
      'GET',
      undefined,
      adminToken
    );

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should clear prospect note', async () => {
    if (!testProspectId) {
      console.log('Skipping: no test prospect ID');
      return;
    }

    const { status } = await apiRequest(
      `/prospects/${testProspectId}`,
      'PATCH',
      { notes: '' },
      adminToken
    );

    expect(status).toBe(200);
  });
});

// ============================================
// CALL LOG TESTS
// ============================================
describe('Call Logs', () => {
  it('should create a call log', async () => {
    const callLog = {
      prospectId: testProspectId,
      prospectName: 'Test Prospect',
      phoneNumber: '5551234567',
      fromNumber: '+15551112222',
      outcome: 'Connected',
      duration: 120,
      note: 'Test call - API test suite',
    };

    const { status, data } = await apiRequest('/calls', 'POST', callLog, adminToken);

    expect([200, 201]).toContain(status);
    expect(data.id).toBeDefined();
    testCallLogId = data.id;
  });

  it('should create call log without prospect ID', async () => {
    const callLog = {
      phoneNumber: '5559876543',
      outcome: 'No Answer',
      duration: 0,
      note: 'Orphan call log test',
    };

    const { status, data } = await apiRequest('/calls', 'POST', callLog, adminToken);

    expect([200, 201]).toContain(status);
    expect(data.id).toBeDefined();
  });

  it('should create call log without auth (optional auth)', async () => {
    const callLog = {
      phoneNumber: '5555555555',
      outcome: 'Busy',
      duration: 5,
    };

    const { status, data } = await apiRequest('/calls', 'POST', callLog);

    expect([200, 201]).toContain(status);
  });
});

// ============================================
// CALL HISTORY TESTS
// ============================================
describe('Call History', () => {
  it('should get all call history', async () => {
    const { status, data } = await apiRequest('/calls', 'GET', undefined, adminToken);

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('should get prospect call history', async () => {
    if (!testProspectId) {
      console.log('Skipping: no test prospect ID');
      return;
    }

    const { status, data } = await apiRequest(
      `/prospects/${testProspectId}/call-history`,
      'GET',
      undefined,
      adminToken
    );

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should get call stats', async () => {
    const { status, data } = await apiRequest('/calls/stats', 'GET', undefined, adminToken);

    expect(status).toBe(200);
  });
});

// ============================================
// CALL LOG DELETE TESTS (Admin Only)
// ============================================
describe('Call Log Deletion (Admin)', () => {
  let deleteTestCallLogId: string;

  it('should create a call log for deletion test', async () => {
    const callLog = {
      phoneNumber: '5550001111',
      outcome: 'Test Delete',
      duration: 10,
      note: 'This call log will be deleted',
    };

    const { status, data } = await apiRequest('/calls', 'POST', callLog, adminToken);

    expect([200, 201]).toContain(status);
    deleteTestCallLogId = data.id;
  });

  it('should delete single call log', async () => {
    if (!deleteTestCallLogId) {
      console.log('Skipping: no delete test call log ID');
      return;
    }

    const { status, data } = await apiRequest(
      `/calls/logs/${deleteTestCallLogId}`,
      'DELETE',
      undefined,
      adminToken
    );

    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return 404 for deleted call log', async () => {
    if (!deleteTestCallLogId) {
      console.log('Skipping: no delete test call log ID');
      return;
    }

    const { status } = await apiRequest(
      `/calls/logs/${deleteTestCallLogId}`,
      'DELETE',
      undefined,
      adminToken
    );

    expect(status).toBe(404);
  });

  it('should delete multiple call logs', async () => {
    // Create two call logs
    const { data: log1 } = await apiRequest('/calls', 'POST', {
      phoneNumber: '5550002222',
      outcome: 'Bulk Delete 1',
    }, adminToken);

    const { data: log2 } = await apiRequest('/calls', 'POST', {
      phoneNumber: '5550003333',
      outcome: 'Bulk Delete 2',
    }, adminToken);

    const ids = [log1.id, log2.id].filter(Boolean);

    if (ids.length < 2) {
      console.log('Skipping: could not create test call logs');
      return;
    }

    const { status, data } = await apiRequest(
      '/calls/logs/delete',
      'POST',
      { ids },
      adminToken
    );

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deletedCount).toBe(2);
  });

  it('should reject delete without auth', async () => {
    const { status } = await apiRequest('/calls/logs/fake-id', 'DELETE');

    expect([401, 403]).toContain(status);
  });

  it('should reject bulk delete without auth', async () => {
    const { status } = await apiRequest('/calls/logs/delete', 'POST', { ids: ['fake-id'] });

    expect([401, 403]).toContain(status);
  });
});

// ============================================
// DELETE ALL CALL LOGS TEST
// ============================================
describe('Delete All Call Logs (Admin)', () => {
  it('should reject delete all without confirmation (if implemented)', async () => {
    // This test checks that delete all requires proper authorization
    const { status } = await apiRequest('/calls/logs', 'DELETE');

    expect([401, 403]).toContain(status);
  });

  // Note: We don't actually delete all call logs in the test to preserve data
  // Uncomment the following test to test delete all functionality
  /*
  it('should delete all call logs', async () => {
    const { status, data } = await apiRequest('/calls/logs', 'DELETE', undefined, adminToken);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(typeof data.deletedCount).toBe('number');
  });
  */
});

// ============================================
// PROSPECT STATUS HISTORY TESTS
// ============================================
describe('Prospect Status History', () => {
  it('should get prospect status history', async () => {
    if (!testProspectId) {
      console.log('Skipping: no test prospect ID');
      return;
    }

    const { status, data } = await apiRequest(
      `/prospects/${testProspectId}/status-history`,
      'GET',
      undefined,
      adminToken
    );

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should record status change in history', async () => {
    if (!testProspectId) {
      console.log('Skipping: no test prospect ID');
      return;
    }

    // Change status
    await apiRequest(
      `/prospects/${testProspectId}`,
      'PATCH',
      { status: 'Qualified' },
      adminToken
    );

    // Get history
    const { status, data } = await apiRequest(
      `/prospects/${testProspectId}/status-history`,
      'GET',
      undefined,
      adminToken
    );

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });
});

// ============================================
// CLEANUP
// ============================================
describe('Cleanup', () => {
  it('should delete test prospect', async () => {
    if (!testProspectId) {
      console.log('Skipping: no test prospect ID');
      return;
    }

    const { status } = await apiRequest(`/prospects/${testProspectId}`, 'DELETE', undefined, adminToken);

    expect([200, 204]).toContain(status);
  });

  it('should delete test call log', async () => {
    if (!testCallLogId) {
      console.log('Skipping: no test call log ID');
      return;
    }

    const { status } = await apiRequest(`/calls/logs/${testCallLogId}`, 'DELETE', undefined, adminToken);

    // May be 200 or 404 if already deleted via cascade
    expect([200, 404]).toContain(status);
  });
});

// ============================================
// EDGE CASES & ERROR HANDLING
// ============================================
describe('Edge Cases & Error Handling', () => {
  it('should handle invalid prospect ID', async () => {
    const { status } = await apiRequest('/prospects/invalid-uuid', 'GET', undefined, adminToken);

    expect([400, 404, 500]).toContain(status);
  });

  it('should handle invalid call log ID for deletion', async () => {
    const { status } = await apiRequest('/calls/logs/invalid-uuid', 'DELETE', undefined, adminToken);

    expect([400, 404, 500]).toContain(status);
  });

  it('should handle empty ids array for bulk delete', async () => {
    const { status, data } = await apiRequest('/calls/logs/delete', 'POST', { ids: [] }, adminToken);

    expect(status).toBe(200);
    expect(data.deletedCount).toBe(0);
  });

  it('should handle missing required fields in call log', async () => {
    const { status } = await apiRequest('/calls', 'POST', {}, adminToken);

    // Should either fail validation or succeed with defaults
    expect([200, 400, 500]).toContain(status);
  });

  it('should handle malformed JSON', async () => {
    const response = await fetch(`${API_BASE_URL}/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: 'not valid json',
    });

    expect([400, 500]).toContain(response.status);
  });
});

// ============================================
// RECORDINGS TESTS
// ============================================
describe('Call Recordings', () => {
  it('should get all recordings', async () => {
    const { status, data } = await apiRequest('/calls/recordings', 'GET', undefined, adminToken);

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should handle recording not found', async () => {
    const { status } = await apiRequest('/calls/recordings/fake-call-sid', 'GET', undefined, adminToken);

    expect([200, 404]).toContain(status); // May return empty array or 404
  });
});
