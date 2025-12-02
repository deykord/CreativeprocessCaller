/**
 * Team Member Management Tests
 * 
 * Comprehensive tests for team member CRUD operations:
 * - Admin can create team members
 * - Admin can view all team members
 * - Admin can update team members (name, email, role)
 * - Admin can delete team members
 * - Team members are stored in the users table
 * - Non-admin users cannot manage team members
 * 
 * Run with: npx vitest run tests/team-management.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api';

// Test data storage
let adminToken: string;
let adminUserId: string;
let regularUserToken: string;
let regularUserId: string;
const createdUserIds: string[] = [];

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

// Generate unique test data
const timestamp = Date.now();
const uniqueEmail = (prefix: string) => `${prefix}_${timestamp}@test.com`;

// ============================================
// SETUP
// ============================================
describe('Setup', () => {
  it('should login as admin', async () => {
    const { status, data } = await apiRequest('/auth/login', 'POST', {
      email: 'admin@creativeprocess.io',
      password: 'admin123',
    });

    expect(status).toBe(200);
    expect(data.token).toBeDefined();
    expect(data.user.role).toBe('admin');
    adminToken = data.token;
    adminUserId = data.user.id;
  });

  it('should create a regular user for permission tests', async () => {
    const { status, data } = await apiRequest('/auth/register', 'POST', {
      email: uniqueEmail('regularuser'),
      password: 'testpass123',
      firstName: 'Regular',
      lastName: 'User',
    });

    expect([200, 201]).toContain(status);
    if (data.token) {
      regularUserToken = data.token;
    }
    if (data.user?.id) {
      regularUserId = data.user.id;
      createdUserIds.push(regularUserId);
    }
  });
});

// ============================================
// TEAM MEMBER CREATION (Admin Only)
// ============================================
describe('Team Member Creation', () => {
  it('should create a team member with all fields', async () => {
    const teamMember = {
      email: uniqueEmail('teammember1'),
      firstName: 'John',
      lastName: 'Smith',
      role: 'agent',
      password: 'testpass123',
    };

    const { status, data } = await apiRequest('/auth/users', 'POST', teamMember, adminToken);

    expect([200, 201]).toContain(status);
    const userId = data.id || data.user?.id;
    expect(userId).toBeDefined();
    createdUserIds.push(userId);

    // Verify the data
    const user = data.user || data;
    expect(user.email).toBe(teamMember.email);
    expect(user.firstName || user.first_name).toBe('John');
    expect(user.lastName || user.last_name).toBe('Smith');
  });

  it('should create a team member with minimal fields', async () => {
    const teamMember = {
      email: uniqueEmail('teammember2'),
      firstName: 'Jane',
      lastName: 'Doe',
    };

    const { status, data } = await apiRequest('/auth/users', 'POST', teamMember, adminToken);

    expect([200, 201]).toContain(status);
    const userId = data.id || data.user?.id;
    expect(userId).toBeDefined();
    createdUserIds.push(userId);
  });

  it('should create a team member with manager role', async () => {
    const teamMember = {
      email: uniqueEmail('manager1'),
      firstName: 'Manager',
      lastName: 'Test',
      role: 'manager',
    };

    const { status, data } = await apiRequest('/auth/users', 'POST', teamMember, adminToken);

    expect([200, 201]).toContain(status);
    const userId = data.id || data.user?.id;
    expect(userId).toBeDefined();
    createdUserIds.push(userId);

    const user = data.user || data;
    expect(user.role).toBe('manager');
  });

  it('should create a team member with admin role', async () => {
    const teamMember = {
      email: uniqueEmail('admin2'),
      firstName: 'Admin',
      lastName: 'Two',
      role: 'admin',
    };

    const { status, data } = await apiRequest('/auth/users', 'POST', teamMember, adminToken);

    expect([200, 201]).toContain(status);
    const userId = data.id || data.user?.id;
    expect(userId).toBeDefined();
    createdUserIds.push(userId);
  });

  it('should reject creating team member without admin token', async () => {
    const teamMember = {
      email: uniqueEmail('unauthorized'),
      firstName: 'Unauthorized',
      lastName: 'User',
    };

    const { status } = await apiRequest('/auth/users', 'POST', teamMember, regularUserToken);

    expect([401, 403]).toContain(status);
  });

  it('should reject creating team member without any token', async () => {
    const teamMember = {
      email: uniqueEmail('notoken'),
      firstName: 'NoToken',
      lastName: 'User',
    };

    const { status } = await apiRequest('/auth/users', 'POST', teamMember);

    expect([401, 403]).toContain(status);
  });

  it('should reject creating team member with duplicate email', async () => {
    // First create a user
    const email = uniqueEmail('duplicate');
    await apiRequest('/auth/users', 'POST', {
      email,
      firstName: 'First',
      lastName: 'User',
    }, adminToken);

    // Try to create another with same email
    const { status } = await apiRequest('/auth/users', 'POST', {
      email, // Same email
      firstName: 'Second',
      lastName: 'User',
    }, adminToken);

    expect([400, 409, 500]).toContain(status);
  });

  it('should reject creating team member without required fields', async () => {
    const { status } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('norequired'),
      // Missing firstName and lastName
    }, adminToken);

    expect([400, 500]).toContain(status);
  });

  it('should handle special characters in team member names', async () => {
    const teamMember = {
      email: uniqueEmail('specialchars'),
      firstName: "O'Brien",
      lastName: 'Müller-Schmidt',
    };

    const { status, data } = await apiRequest('/auth/users', 'POST', teamMember, adminToken);

    expect([200, 201]).toContain(status);
    if (status === 200 || status === 201) {
      const userId = data.id || data.user?.id;
      createdUserIds.push(userId);
      
      const user = data.user || data;
      expect(user.firstName || user.first_name).toBe("O'Brien");
    }
  });
});

// ============================================
// TEAM MEMBER LISTING
// ============================================
describe('Team Member Listing', () => {
  it('should list all team members', async () => {
    const { status, data } = await apiRequest('/auth/users', 'GET', undefined, adminToken);

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Verify structure
    const user = data[0];
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
  });

  it('should list team members via team-members endpoint', async () => {
    const { status, data } = await apiRequest('/auth/team-members', 'GET', undefined, adminToken);

    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should not expose password in team member list', async () => {
    const { status, data } = await apiRequest('/auth/users', 'GET', undefined, adminToken);

    expect(status).toBe(200);
    data.forEach((user: any) => {
      expect(user.password).toBeUndefined();
      expect(user.passwordHash).toBeUndefined();
    });
  });

  it('should reject listing team members without admin token', async () => {
    const { status } = await apiRequest('/auth/users', 'GET', undefined, regularUserToken);

    expect([401, 403]).toContain(status);
  });

  it('should reject listing team members without any token', async () => {
    const { status } = await apiRequest('/auth/users', 'GET');

    expect([401, 403]).toContain(status);
  });
});

// ============================================
// TEAM MEMBER RETRIEVAL BY ID
// ============================================
describe('Team Member Retrieval by ID', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a user to retrieve
    const { data } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('retrievetest'),
      firstName: 'Retrieve',
      lastName: 'Test',
    }, adminToken);
    testUserId = data.id || data.user?.id;
    if (testUserId) createdUserIds.push(testUserId);
  });

  it('should get team member by ID', async () => {
    if (!testUserId) {
      console.log('Skipping: no test user ID');
      return;
    }

    const { status, data } = await apiRequest(`/auth/users/${testUserId}`, 'GET', undefined, adminToken);

    expect(status).toBe(200);
    expect(data.id).toBe(testUserId);
    expect(data.firstName || data.first_name).toBe('Retrieve');
  });

  it('should return 404 for non-existent user ID', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const { status } = await apiRequest(`/auth/users/${fakeId}`, 'GET', undefined, adminToken);

    expect([404, 500]).toContain(status);
  });

  it('should reject getting user without admin token', async () => {
    if (!testUserId) return;

    const { status } = await apiRequest(`/auth/users/${testUserId}`, 'GET', undefined, regularUserToken);

    expect([401, 403]).toContain(status);
  });
});

// ============================================
// TEAM MEMBER UPDATES (Admin Only)
// ============================================
describe('Team Member Updates', () => {
  let updateTestUserId: string;

  beforeAll(async () => {
    // Create a user to update
    const { data } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('updatetest'),
      firstName: 'Update',
      lastName: 'Test',
      role: 'agent',
    }, adminToken);
    updateTestUserId = data.id || data.user?.id;
    if (updateTestUserId) createdUserIds.push(updateTestUserId);
  });

  it('should update team member first name', async () => {
    if (!updateTestUserId) {
      console.log('Skipping: no update test user ID');
      return;
    }

    const { status, data } = await apiRequest(
      `/auth/users/${updateTestUserId}`,
      'PATCH',
      { firstName: 'UpdatedFirstName' },
      adminToken
    );

    expect(status).toBe(200);
    expect(data.firstName || data.first_name).toBe('UpdatedFirstName');
  });

  it('should update team member last name', async () => {
    if (!updateTestUserId) return;

    const { status, data } = await apiRequest(
      `/auth/users/${updateTestUserId}`,
      'PATCH',
      { lastName: 'UpdatedLastName' },
      adminToken
    );

    expect(status).toBe(200);
    expect(data.lastName || data.last_name).toBe('UpdatedLastName');
  });

  it('should update team member role', async () => {
    if (!updateTestUserId) return;

    const { status, data } = await apiRequest(
      `/auth/users/${updateTestUserId}`,
      'PATCH',
      { role: 'manager' },
      adminToken
    );

    expect(status).toBe(200);
    expect(data.role).toBe('manager');
  });

  it('should update multiple fields at once', async () => {
    if (!updateTestUserId) return;

    const { status, data } = await apiRequest(
      `/auth/users/${updateTestUserId}`,
      'PATCH',
      {
        firstName: 'MultiUpdate',
        lastName: 'MultiTest',
        role: 'agent',
      },
      adminToken
    );

    expect(status).toBe(200);
    expect(data.firstName || data.first_name).toBe('MultiUpdate');
    expect(data.lastName || data.last_name).toBe('MultiTest');
    expect(data.role).toBe('agent');
  });

  it('should update team member email', async () => {
    if (!updateTestUserId) return;

    const newEmail = uniqueEmail('newemail');
    const { status, data } = await apiRequest(
      `/auth/users/${updateTestUserId}`,
      'PATCH',
      { email: newEmail },
      adminToken
    );

    expect(status).toBe(200);
    expect(data.email).toBe(newEmail);
  });

  it('should reject update without admin token', async () => {
    if (!updateTestUserId) return;

    const { status } = await apiRequest(
      `/auth/users/${updateTestUserId}`,
      'PATCH',
      { firstName: 'Unauthorized' },
      regularUserToken
    );

    expect([401, 403]).toContain(status);
  });

  it('should return 404 when updating non-existent user', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const { status } = await apiRequest(
      `/auth/users/${fakeId}`,
      'PATCH',
      { firstName: 'Ghost' },
      adminToken
    );

    expect([404, 500]).toContain(status);
  });
});

// ============================================
// TEAM MEMBER DELETION (Admin Only)
// ============================================
describe('Team Member Deletion', () => {
  let deleteTestUserId: string;

  beforeAll(async () => {
    // Create a user to delete
    const { data } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('deletetest'),
      firstName: 'Delete',
      lastName: 'Test',
    }, adminToken);
    deleteTestUserId = data.id || data.user?.id;
    // Don't add to createdUserIds since we'll delete it
  });

  it('should delete team member', async () => {
    if (!deleteTestUserId) {
      console.log('Skipping: no delete test user ID');
      return;
    }

    const { status, data } = await apiRequest(
      `/auth/users/${deleteTestUserId}`,
      'DELETE',
      undefined,
      adminToken
    );

    expect([200, 204]).toContain(status);
    if (data) {
      expect(data.success).toBe(true);
    }
  });

  it('should verify deleted team member no longer exists', async () => {
    if (!deleteTestUserId) return;

    const { status } = await apiRequest(
      `/auth/users/${deleteTestUserId}`,
      'GET',
      undefined,
      adminToken
    );

    expect([404, 500]).toContain(status);
  });

  it('should reject deletion without admin token', async () => {
    // Create a user first
    const { data } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('nodelete'),
      firstName: 'NoDelete',
      lastName: 'Test',
    }, adminToken);
    const userId = data.id || data.user?.id;
    if (userId) createdUserIds.push(userId);

    const { status } = await apiRequest(
      `/auth/users/${userId}`,
      'DELETE',
      undefined,
      regularUserToken
    );

    expect([401, 403]).toContain(status);
  });

  it('should return 404 when deleting non-existent user', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const { status } = await apiRequest(
      `/auth/users/${fakeId}`,
      'DELETE',
      undefined,
      adminToken
    );

    expect([404, 500]).toContain(status);
  });

  it('should handle deleting already deleted user', async () => {
    // Create and delete a user
    const { data } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('doubledelete'),
      firstName: 'Double',
      lastName: 'Delete',
    }, adminToken);
    const userId = data.id || data.user?.id;

    // Delete first time
    await apiRequest(`/auth/users/${userId}`, 'DELETE', undefined, adminToken);

    // Try to delete again
    const { status } = await apiRequest(
      `/auth/users/${userId}`,
      'DELETE',
      undefined,
      adminToken
    );

    expect([404, 500]).toContain(status);
  });
});

// ============================================
// DATABASE STORAGE VERIFICATION
// ============================================
describe('Database Storage Verification', () => {
  let verifyUserId: string;
  let verifyUserEmail: string;

  it('should store team member in users table', async () => {
    verifyUserEmail = uniqueEmail('dbverify');
    const { status, data } = await apiRequest('/auth/users', 'POST', {
      email: verifyUserEmail,
      firstName: 'Database',
      lastName: 'Verify',
      role: 'agent',
    }, adminToken);

    expect([200, 201]).toContain(status);
    verifyUserId = data.id || data.user?.id;
    if (verifyUserId) createdUserIds.push(verifyUserId);

    // Verify user appears in list
    const { data: users } = await apiRequest('/auth/users', 'GET', undefined, adminToken);
    const found = users.find((u: any) => u.id === verifyUserId);
    expect(found).toBeDefined();
    expect(found.email).toBe(verifyUserEmail);
  });

  it('should persist team member data after creation', async () => {
    if (!verifyUserId) return;

    // Fetch the user again
    const { status, data } = await apiRequest(
      `/auth/users/${verifyUserId}`,
      'GET',
      undefined,
      adminToken
    );

    expect(status).toBe(200);
    expect(data.email).toBe(verifyUserEmail);
    expect(data.firstName || data.first_name).toBe('Database');
    expect(data.lastName || data.last_name).toBe('Verify');
    expect(data.role).toBe('agent');
  });

  it('should persist team member updates', async () => {
    if (!verifyUserId) return;

    // Update the user
    await apiRequest(
      `/auth/users/${verifyUserId}`,
      'PATCH',
      { firstName: 'PersistUpdate', role: 'manager' },
      adminToken
    );

    // Fetch again to verify persistence
    const { status, data } = await apiRequest(
      `/auth/users/${verifyUserId}`,
      'GET',
      undefined,
      adminToken
    );

    expect(status).toBe(200);
    expect(data.firstName || data.first_name).toBe('PersistUpdate');
    expect(data.role).toBe('manager');
  });

  it('should allow created team member to login', async () => {
    // Create user with known password
    const email = uniqueEmail('logintest');
    const password = 'testlogin123';
    
    const { data: createData } = await apiRequest('/auth/users', 'POST', {
      email,
      firstName: 'Login',
      lastName: 'Test',
      password,
    }, adminToken);
    
    const userId = createData.id || createData.user?.id;
    if (userId) createdUserIds.push(userId);

    // Try to login
    const { status, data } = await apiRequest('/auth/login', 'POST', {
      email,
      password,
    });

    expect(status).toBe(200);
    expect(data.token).toBeDefined();
    expect(data.user.email).toBe(email);
  });
});

// ============================================
// ROLE-BASED ACCESS CONTROL
// ============================================
describe('Role-Based Access Control', () => {
  it('should only allow admin to create users', async () => {
    // Admin can create
    const { status: adminStatus } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('rbac1'),
      firstName: 'RBAC',
      lastName: 'Test1',
    }, adminToken);
    expect([200, 201]).toContain(adminStatus);

    // Regular user cannot
    const { status: userStatus } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('rbac2'),
      firstName: 'RBAC',
      lastName: 'Test2',
    }, regularUserToken);
    expect([401, 403]).toContain(userStatus);
  });

  it('should only allow admin to delete users', async () => {
    // Create user to delete
    const { data } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('rbacdelete'),
      firstName: 'RBAC',
      lastName: 'Delete',
    }, adminToken);
    const userId = data.id || data.user?.id;

    // Regular user cannot delete
    const { status: userStatus } = await apiRequest(
      `/auth/users/${userId}`,
      'DELETE',
      undefined,
      regularUserToken
    );
    expect([401, 403]).toContain(userStatus);

    // Admin can delete
    const { status: adminStatus } = await apiRequest(
      `/auth/users/${userId}`,
      'DELETE',
      undefined,
      adminToken
    );
    expect([200, 204]).toContain(adminStatus);
  });

  it('should only allow admin to update other users', async () => {
    // Create user to update
    const { data } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('rbacupdate'),
      firstName: 'RBAC',
      lastName: 'Update',
    }, adminToken);
    const userId = data.id || data.user?.id;
    if (userId) createdUserIds.push(userId);

    // Regular user cannot update others
    const { status: userStatus } = await apiRequest(
      `/auth/users/${userId}`,
      'PATCH',
      { firstName: 'Hacked' },
      regularUserToken
    );
    expect([401, 403]).toContain(userStatus);

    // Admin can update
    const { status: adminStatus } = await apiRequest(
      `/auth/users/${userId}`,
      'PATCH',
      { firstName: 'AdminUpdated' },
      adminToken
    );
    expect(adminStatus).toBe(200);
  });
});

// ============================================
// EDGE CASES
// ============================================
describe('Edge Cases', () => {
  it('should handle very long names', async () => {
    const longName = 'A'.repeat(200);
    const { status } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('longname'),
      firstName: longName,
      lastName: longName,
    }, adminToken);

    // Should either truncate or reject
    expect([200, 201, 400, 500]).toContain(status);
  });

  it('should handle Unicode characters in names', async () => {
    const { status, data } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('unicode'),
      firstName: '田中',
      lastName: '太郎',
    }, adminToken);

    expect([200, 201]).toContain(status);
    if (status === 200 || status === 201) {
      const userId = data.id || data.user?.id;
      if (userId) createdUserIds.push(userId);
    }
  });

  it('should handle empty update body', async () => {
    // Create user
    const { data } = await apiRequest('/auth/users', 'POST', {
      email: uniqueEmail('emptyupdate'),
      firstName: 'Empty',
      lastName: 'Update',
    }, adminToken);
    const userId = data.id || data.user?.id;
    if (userId) createdUserIds.push(userId);

    // Update with empty body
    const { status } = await apiRequest(
      `/auth/users/${userId}`,
      'PATCH',
      {},
      adminToken
    );

    // Should succeed with no changes or return error
    expect([200, 400]).toContain(status);
  });

  it('should handle malformed UUID', async () => {
    const { status } = await apiRequest(
      '/auth/users/not-a-valid-uuid',
      'GET',
      undefined,
      adminToken
    );

    expect([400, 404, 500]).toContain(status);
  });

  it('should handle concurrent user creation', async () => {
    const emails = Array.from({ length: 5 }, (_, i) => uniqueEmail(`concurrent${i}`));
    
    const results = await Promise.all(
      emails.map(email =>
        apiRequest('/auth/users', 'POST', {
          email,
          firstName: 'Concurrent',
          lastName: 'Test',
        }, adminToken)
      )
    );

    const successCount = results.filter(r => [200, 201].includes(r.status)).length;
    expect(successCount).toBe(5);

    // Track created users for cleanup
    results.forEach(r => {
      const userId = r.data?.id || r.data?.user?.id;
      if (userId) createdUserIds.push(userId);
    });
  });
});

// ============================================
// CLEANUP - Delete ALL test data created during tests
// ============================================
describe('Cleanup', () => {
  it('should delete all test users', async () => {
    console.log(`Cleaning up ${createdUserIds.length} test users...`);
    for (const userId of createdUserIds) {
      try {
        await apiRequest(`/auth/users/${userId}`, 'DELETE', undefined, adminToken);
      } catch (err) {
        // Ignore errors during cleanup
      }
    }
    console.log('Cleanup complete.');
  });
});
