import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';

interface TeamMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'agent' | 'manager';
  permissions: {
    viewProspects: boolean;
    makeCalls: boolean;
    viewCallHistory: boolean;
    viewReports: boolean;
    manageTeam: boolean;
    editSettings: boolean;
    canDeleteLeads: boolean;
    canEditLeads: boolean;
  };
  createdAt: string;
}

export const TeamManagement: React.FC = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'agent' as const,
  });

  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    try {
      loadTeamMembers();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load team members.' });
      setTeamMembers([]);
    }
  }, []);

  const loadTeamMembers = async () => {
    try {
      // This would call a backend endpoint to fetch team members
      // For now, we'll use mock data from localStorage
      const stored = localStorage.getItem('teamMembers');
      if (stored) {
        setTeamMembers(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load team members:', error);
    }
  };

  const saveTeamMembers = (members: TeamMember[]) => {
    localStorage.setItem('teamMembers', JSON.stringify(members));
    setTeamMembers(members);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!formData.email || !formData.firstName || !formData.lastName) {
        throw new Error('All fields are required');
      }

      const response = await backendAPI.createUser(
        formData.email,
        formData.firstName,
        formData.lastName,
        formData.role
      );

      if (response.success) {
        const newMember: TeamMember = {
          id: response.user?.id || `user-${Date.now()}`,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          permissions: {
            viewProspects: true,
            makeCalls: true,
            viewCallHistory: true,
            viewReports: formData.role !== 'agent',
            manageTeam: formData.role === 'admin',
            editSettings: formData.role === 'admin' || formData.role === 'manager',
            canDeleteLeads: formData.role === 'admin',
            canEditLeads: formData.role === 'admin' || formData.role === 'manager',
          },
          createdAt: new Date().toISOString(),
        };

        saveTeamMembers([...teamMembers, newMember]);
        setMessage({ type: 'success', text: `User ${formData.email} created successfully! Default password: ${formData.email.split('@')[0]}123` });
        setFormData({ email: '', firstName: '', lastName: '', role: 'agent' });
        setShowCreateForm(false);
      } else {
        throw new Error(response.error || 'Failed to create user');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create user' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePermissions = (member: TeamMember) => {
    const updated = teamMembers.map(m => m.id === member.id ? member : m);
    saveTeamMembers(updated);
    setEditingId(null);
    setMessage({ type: 'success', text: `Permissions updated for ${member.email}` });
  };

  const handleDeleteUser = (memberId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      const updated = teamMembers.filter(m => m.id !== memberId);
      saveTeamMembers(updated);
      setMessage({ type: 'success', text: 'User deleted successfully' });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Team Management</h2>
          <p className="text-gray-500 dark:text-gray-400">Create and manage team members and their permissions</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus size={20} />
          Add Team Member
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
          {message.text}
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Create New Team Member</h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
              >
                <option value="agent">Agent</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="flex-1 bg-gray-300 dark:bg-slate-600 text-gray-900 dark:text-white py-2 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {(teamMembers.length === 0 && !message) ? (
          <div className="text-center py-12">
            <Users className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500 dark:text-gray-400">No team members yet. Create one to get started.</p>
          </div>
        ) : (
          teamMembers.map((member) => (
            <div key={member.id} className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
              {editingId === member.id ? (
                <EditMemberForm member={editingMember!} onSave={handleUpdatePermissions} onCancel={() => setEditingId(null)} />
              ) : (
                <>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            {member.firstName} {member.lastName}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(member.role)}`}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Created {new Date(member.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingMember(member);
                          setEditingId(member.id);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition"
                        title="Edit permissions"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(member.id)}
                        className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition"
                        title="Delete user"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(member.permissions).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${value ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, (str) => str.toUpperCase())
                            .trim()}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface EditMemberFormProps {
  member: TeamMember;
  onSave: (member: TeamMember) => void;
  onCancel: () => void;
}

const EditMemberForm: React.FC<EditMemberFormProps> = ({ member, onSave, onCancel }) => {
  const [editedMember, setEditedMember] = useState(member);

  const handlePermissionChange = (key: keyof TeamMember['permissions']) => {
    setEditedMember({
      ...editedMember,
      permissions: {
        ...editedMember.permissions,
        [key]: !editedMember.permissions[key],
      },
    });
  };

  const handleRoleChange = (newRole: 'admin' | 'agent' | 'manager') => {
    setEditedMember({
      ...editedMember,
      role: newRole,
      permissions: {
        viewProspects: true,
        makeCalls: true,
        viewCallHistory: true,
        viewReports: newRole !== 'agent',
        manageTeam: newRole === 'admin',
        editSettings: newRole === 'admin' || newRole === 'manager',
        canDeleteLeads: newRole === 'admin',
        canEditLeads: newRole === 'admin' || newRole === 'manager',
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
        <select
          value={editedMember.role}
          onChange={(e) => handleRoleChange(e.target.value as any)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
        >
          <option value="agent">Agent</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Permissions</label>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(editedMember.permissions).map(([key, value]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={() => handlePermissionChange(key as keyof TeamMember['permissions'])}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, (str) => str.toUpperCase())
                  .trim()}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(editedMember)}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition"
        >
          <Save size={18} />
          Save Changes
        </button>
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-300 dark:bg-slate-600 text-gray-900 dark:text-white py-2 rounded-lg hover:bg-gray-400 transition"
        >
          <X size={18} />
          Cancel
        </button>
      </div>
    </div>
  );
};
