import React, { useState, useEffect } from 'react';
import { LeadList, LeadListPermission, User } from '../types';
import { backendAPI } from '../services/BackendAPI';
import { Plus, Trash2, Share2, Eye, Edit, Lock, Users } from 'lucide-react';

interface Props {
  prospects?: any[];
  teamMembers?: User[];
}

export const LeadListManager: React.FC<Props> = ({ prospects = [], teamMembers = [] }) => {
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [permissions, setPermissions] = useState<Map<string, LeadListPermission[]>>(new Map());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedList, setSelectedList] = useState<LeadList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newListData, setNewListData] = useState({
    name: '',
    description: '',
    selectedProspects: [] as string[],
  });

  const [permissionData, setPermissionData] = useState({
    targetUserId: '',
    canView: true,
    canEdit: false,
  });

  // Load lead lists
  useEffect(() => {
    loadLeadLists();
  }, []);

  const loadLeadLists = async () => {
    try {
      setLoading(true);
      const lists = await backendAPI.getLeadLists();
      setLeadLists(lists);

      // Load permissions for each list
      const permissionsMap = new Map<string, LeadListPermission[]>();
      for (const list of lists) {
        try {
          const perms = await backendAPI.getLeadListPermissions(list.id);
          permissionsMap.set(list.id, perms);
        } catch (err) {
          // List creator may not have permission to view others' permissions
          permissionsMap.set(list.id, []);
        }
      }
      setPermissions(permissionsMap);
      setError(null);
    } catch (err) {
      console.error('Failed to load lead lists:', err);
      setError('Failed to load lead lists');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListData.name.trim()) {
      setError('List name is required');
      return;
    }

    try {
      const prospectIds = newListData.selectedProspects.length > 0 
        ? newListData.selectedProspects 
        : [];
      
      await backendAPI.createLeadList(
        newListData.name,
        newListData.description,
        prospectIds
      );

      setNewListData({ name: '', description: '', selectedProspects: [] });
      setShowCreateModal(false);
      await loadLeadLists();
    } catch (err) {
      console.error('Failed to create lead list:', err);
      setError('Failed to create lead list');
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!window.confirm('Are you sure you want to delete this lead list?')) return;

    try {
      await backendAPI.deleteLeadList(listId);
      await loadLeadLists();
    } catch (err) {
      console.error('Failed to delete lead list:', err);
      setError('Failed to delete lead list');
    }
  };

  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedList || !permissionData.targetUserId) {
      setError('User selection is required');
      return;
    }

    try {
      await backendAPI.addLeadListPermission(
        selectedList.id,
        permissionData.targetUserId,
        permissionData.canView,
        permissionData.canEdit
      );

      setPermissionData({ targetUserId: '', canView: true, canEdit: false });
      setShowPermissionsModal(false);
      await loadLeadLists();
    } catch (err) {
      console.error('Failed to add permission:', err);
      setError('Failed to add permission');
    }
  };

  const handleRemovePermission = async (listId: string, permissionId: string) => {
    if (!window.confirm('Remove this permission?')) return;

    try {
      await backendAPI.removeLeadListPermission(listId, permissionId);
      await loadLeadLists();
    } catch (err) {
      console.error('Failed to remove permission:', err);
      setError('Failed to remove permission');
    }
  };

  const openPermissionsModal = (list: LeadList) => {
    setSelectedList(list);
    setShowPermissionsModal(true);
  };

  return (
    <div className="w-full bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Lead Lists</h2>
            <p className="text-gray-600 dark:text-gray-400">Manage shared lead lists and permissions</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
          >
            <Plus size={20} />
            New List
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : leadLists.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-8 text-center">
            <Users size={48} className="mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">No lead lists yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Create Your First List
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leadLists.map((list) => {
              const listPermissions = permissions.get(list.id) || [];
              return (
                <div
                  key={list.id}
                  className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 hover:shadow-md transition"
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      {list.name}
                    </h3>
                    {list.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {list.description}
                      </p>
                    )}
                  </div>

                  <div className="mb-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Users size={16} />
                      <span>{list.prospectCount} leads</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Lock size={16} />
                      <span>{listPermissions.length} shared with</span>
                    </div>
                  </div>

                  {listPermissions.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">Shared with:</p>
                      <div className="space-y-1">
                        {listPermissions.map((perm) => (
                          <div key={perm.id} className="text-xs text-gray-700 dark:text-gray-300 flex items-center justify-between">
                            <span>
                              User {perm.userId.substring(0, 8)}... 
                              <span className="ml-2">
                                {perm.canEdit ? '(Edit)' : perm.canView ? '(View)' : ''}
                              </span>
                            </span>
                            <button
                              onClick={() => handleRemovePermission(list.id, perm.id)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400"
                              title="Remove permission"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => openPermissionsModal(list)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold rounded-lg transition"
                    >
                      <Share2 size={16} />
                      Share
                    </button>
                    <button
                      onClick={() => handleDeleteList(list.id)}
                      className="px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 font-semibold rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create List Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Lead List</h3>
              </div>

              <form onSubmit={handleCreateList} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    List Name *
                  </label>
                  <input
                    type="text"
                    value={newListData.name}
                    onChange={(e) => setNewListData({ ...newListData, name: e.target.value })}
                    placeholder="e.g., Q4 Sales Prospects"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newListData.description}
                    onChange={(e) => setNewListData({ ...newListData, description: e.target.value })}
                    placeholder="Optional description..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Select Prospects
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-700">
                    {prospects.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No prospects available</p>
                    ) : (
                      <div className="space-y-2">
                        {prospects.map((prospect) => (
                          <label key={prospect.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newListData.selectedProspects.includes(prospect.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewListData({
                                    ...newListData,
                                    selectedProspects: [...newListData.selectedProspects, prospect.id],
                                  });
                                } else {
                                  setNewListData({
                                    ...newListData,
                                    selectedProspects: newListData.selectedProspects.filter(
                                      (id) => id !== prospect.id
                                    ),
                                  });
                                }
                              }}
                              className="w-4 h-4 cursor-pointer"
                            />
                            <span className="text-sm text-gray-900 dark:text-gray-200">
                              {prospect.firstName} {prospect.lastName} ({prospect.company})
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {newListData.selectedProspects.length} selected
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                  >
                    Create List
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Permissions Modal */}
        {showPermissionsModal && selectedList && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Share "{selectedList.name}"
                </h3>
              </div>

              <form onSubmit={handleAddPermission} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Select Team Member *
                  </label>
                  <select
                    value={permissionData.targetUserId}
                    onChange={(e) => setPermissionData({ ...permissionData, targetUserId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a team member...</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName} ({member.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissionData.canView}
                      onChange={(e) =>
                        setPermissionData({ ...permissionData, canView: e.target.checked })
                      }
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-200 font-medium flex items-center gap-2">
                      <Eye size={16} />
                      Can View Leads
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissionData.canEdit}
                      onChange={(e) =>
                        setPermissionData({ ...permissionData, canEdit: e.target.checked })
                      }
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-200 font-medium flex items-center gap-2">
                      <Edit size={16} />
                      Can Edit Leads
                    </span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPermissionsModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                  >
                    Add Permission
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
