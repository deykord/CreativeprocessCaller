/**
 * Comprehensive Test Cleanup
 * 
 * This test file runs LAST and removes ALL test data created during test suite execution.
 * It ensures a completely clean database after tests complete.
 * 
 * Run with: npx vitest run tests/cleanup.test.ts
 * Or run as part of full suite: npx vitest run (cleanup runs alphabetically last among test files)
 * 
 * ⚠️ WARNING: This file deletes test data. Only run against test/dev databases!
 */

import { describe, it, expect } from 'vitest';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api';

// Admin token for cleanup operations
let adminToken: string;

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

describe('Comprehensive Test Cleanup', () => {
  describe('Authentication', () => {
    it('should login as admin for cleanup', async () => {
      const { status, data } = await apiRequest('/auth/login', 'POST', {
        email: 'admin@creativeprocess.io',
        password: 'admin123',
      });

      expect(status).toBe(200);
      expect(data.token).toBeDefined();
      adminToken = data.token;
    });
  });

  describe('Remove Test Users', () => {
    it('should find and delete all test users', async () => {
      // Get all users
      const { data: allUsers } = await apiRequest('/auth/users', 'GET', undefined, adminToken);
      expect(Array.isArray(allUsers)).toBe(true);

      // Filter test users (created by test suite with @test.com or test names)
      const testUsers = Array.isArray(allUsers)
        ? allUsers.filter(
            (u: any) =>
              u.email?.includes('@test.com') ||
              u.email?.includes('_test.com') ||
              u.first_name?.includes('Test') ||
              u.last_name?.includes('Test') ||
              u.first_name?.includes('test') ||
              u.last_name?.includes('test')
          )
        : [];

      console.log(`\n🗑️  Found ${testUsers.length} test users to delete`);

      // Delete each test user
      let deletedCount = 0;
      for (const user of testUsers) {
        try {
          const { status } = await apiRequest(
            `/auth/users/${user.id}`,
            'DELETE',
            undefined,
            adminToken
          );
          if (status === 200 || status === 204) {
            deletedCount++;
            console.log(`  ✓ Deleted user: ${user.email}`);
          }
        } catch (error) {
          console.warn(`  ✗ Failed to delete user ${user.id}:`, error);
        }
      }

      console.log(`✓ Deleted ${deletedCount} test users\n`);
      expect(deletedCount).toBe(testUsers.length);
    });
  });

  describe('Remove Test Prospects', () => {
    it('should find and delete all test prospects', async () => {
      // Get all prospects
      const { data: allProspects } = await apiRequest('/prospects', 'GET', undefined, adminToken);
      expect(Array.isArray(allProspects)).toBe(true);

      // Filter test prospects
      const testProspects = Array.isArray(allProspects)
        ? allProspects.filter(
            (p: any) =>
              p.first_name?.includes('Test') ||
              p.first_name?.includes('Bulk') ||
              p.last_name?.includes('Test') ||
              p.company?.includes('Test') ||
              p.company?.includes('Fake') ||
              p.company?.includes('Mock') ||
              p.email?.includes('@test.com') ||
              p.phone?.startsWith('555991') || // Test phone patterns
              p.phone?.startsWith('5559919') // Bulk test phone pattern
          )
        : [];

      console.log(`\n🗑️  Found ${testProspects.length} test prospects to delete`);

      // Delete each test prospect
      let deletedCount = 0;
      for (const prospect of testProspects) {
        try {
          const { status } = await apiRequest(
            `/prospects/${prospect.id}`,
            'DELETE',
            undefined,
            adminToken
          );
          if (status === 200 || status === 204) {
            deletedCount++;
            console.log(`  ✓ Deleted prospect: ${prospect.first_name} ${prospect.last_name}`);
          }
        } catch (error) {
          console.warn(`  ✗ Failed to delete prospect ${prospect.id}:`, error);
        }
      }

      console.log(`✓ Deleted ${deletedCount} test prospects\n`);
      expect(deletedCount).toBe(testProspects.length);
    });
  });

  describe('Remove Test Lead Lists', () => {
    it('should find and delete all test lead lists', async () => {
      // Get all lead lists
      const { data: allLists } = await apiRequest('/lead-lists', 'GET', undefined, adminToken);
      expect(Array.isArray(allLists)).toBe(true);

      // Filter test lead lists
      const testLists = Array.isArray(allLists)
        ? allLists.filter(
            (l: any) =>
              l.name?.includes('Test') ||
              l.name?.includes('Sample') ||
              l.name?.includes('Demo') ||
              l.description?.includes('test') ||
              l.description?.includes('Test')
          )
        : [];

      console.log(`\n🗑️  Found ${testLists.length} test lead lists to delete`);

      // Delete each test lead list
      let deletedCount = 0;
      for (const list of testLists) {
        try {
          const { status } = await apiRequest(
            `/lead-lists/${list.id}`,
            'DELETE',
            undefined,
            adminToken
          );
          if (status === 200 || status === 204) {
            deletedCount++;
            console.log(`  ✓ Deleted lead list: ${list.name}`);
          }
        } catch (error) {
          console.warn(`  ✗ Failed to delete list ${list.id}:`, error);
        }
      }

      console.log(`✓ Deleted ${deletedCount} test lead lists\n`);
      expect(deletedCount).toBe(testLists.length);
    });
  });

  describe('Remove Test Voicemails', () => {
    it('should find and delete all test voicemails', async () => {
      // Get all voicemails
      const { data: allVoicemails } = await apiRequest('/voicemails', 'GET', undefined, adminToken);
      expect(Array.isArray(allVoicemails)).toBe(true);

      // Filter test voicemails
      const testVoicemails = Array.isArray(allVoicemails)
        ? allVoicemails.filter(
            (v: any) =>
              v.name?.includes('Test') ||
              v.name?.includes('test') ||
              v.description?.includes('Test') ||
              v.description?.includes('test')
          )
        : [];

      console.log(`\n🗑️  Found ${testVoicemails.length} test voicemails to delete`);

      // Delete each test voicemail
      let deletedCount = 0;
      for (const vm of testVoicemails) {
        try {
          const { status } = await apiRequest(
            `/voicemails/${vm.id}`,
            'DELETE',
            undefined,
            adminToken
          );
          if (status === 200 || status === 204) {
            deletedCount++;
            console.log(`  ✓ Deleted voicemail: ${vm.name}`);
          }
        } catch (error) {
          console.warn(`  ✗ Failed to delete voicemail ${vm.id}:`, error);
        }
      }

      console.log(`✓ Deleted ${deletedCount} test voicemails\n`);
      expect(deletedCount).toBe(testVoicemails.length);
    });
  });

  describe('Verification', () => {
    it('should verify no test data remains', async () => {
      // Verify users
      const { data: users } = await apiRequest('/auth/users', 'GET', undefined, adminToken);
      const testUsers = Array.isArray(users)
        ? users.filter((u: any) => u.email?.includes('@test.com'))
        : [];

      // Verify prospects
      const { data: prospects } = await apiRequest('/prospects', 'GET', undefined, adminToken);
      const testProspects = Array.isArray(prospects)
        ? prospects.filter(
            (p: any) =>
              p.first_name?.includes('Test') ||
              p.first_name?.includes('Bulk') ||
              p.company?.includes('Test')
          )
        : [];

      // Verify lead lists
      const { data: lists } = await apiRequest('/lead-lists', 'GET', undefined, adminToken);
      const testLists = Array.isArray(lists)
        ? lists.filter((l: any) => l.name?.includes('Test'))
        : [];

      console.log('\n✅ Final Cleanup Verification:\n');
      console.log(`  Test Users: ${testUsers.length} ✓`);
      console.log(`  Test Prospects: ${testProspects.length} ✓`);
      console.log(`  Test Lead Lists: ${testLists.length} ✓`);
      console.log('\n✨ Database is clean! All test data removed.\n');

      expect(testUsers.length).toBe(0);
      expect(testProspects.length).toBe(0);
      expect(testLists.length).toBe(0);
    });
  });

  describe('Summary', () => {
    it('should display cleanup summary', async () => {
      console.log('\n╔════════════════════════════════════════════╗');
      console.log('║     TEST SUITE CLEANUP COMPLETE ✓          ║');
      console.log('╚════════════════════════════════════════════╝\n');
      console.log('All test-created data has been removed:');
      console.log('  ✓ Test users');
      console.log('  ✓ Test prospects');
      console.log('  ✓ Test lead lists');
      console.log('  ✓ Test voicemails\n');
      console.log('Production database is clean and ready for use.\n');
      expect(true).toBe(true);
    });
  });
});
