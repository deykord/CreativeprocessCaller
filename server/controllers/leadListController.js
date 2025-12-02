const databaseService = require('../services/databaseService');

// --- Lead List Management ---

exports.createLeadList = async (req, res) => {
  try {
    const { name, description, prospects } = req.body;
    const userId = req.userId; // Set by auth middleware

    if (!name) {
      return res.status(400).json({ error: 'List name is required' });
    }

    const newList = await databaseService.createLeadList(
      name,
      description || '',
      prospects || [],
      userId
    );

    res.json(newList);
  } catch (error) {
    console.error('Create lead list error:', error);
    res.status(500).json({ error: 'Failed to create lead list' });
  }
};

exports.getLeadLists = async (req, res) => {
  try {
    const userId = req.userId; // Set by auth middleware
    
    const lists = await databaseService.getLeadLists(userId);
    
    // Transform to frontend format
    const formatted = lists.map(list => ({
      id: list.id,
      name: list.name,
      description: list.description,
      createdBy: list.created_by || list.createdBy,
      creatorName: list.creatorName,
      isOwner: list.isOwner,
      createdAt: list.created_at || list.createdAt,
      updatedAt: list.updated_at || list.updatedAt,
      prospectIds: list.prospectIds || [],
      prospectCount: parseInt(list.prospect_count) || list.prospectCount || 0
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get lead lists error:', error);
    res.status(500).json({ error: 'Failed to fetch lead lists' });
  }
};

exports.getLeadList = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const list = await databaseService.getLeadList(id);

    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    // Check permission
    if (list.createdBy !== userId) {
      const canAccess = await databaseService.checkUserListAccess(userId, id);
      
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(list);
  } catch (error) {
    console.error('Get lead list error:', error);
    res.status(500).json({ error: 'Failed to fetch lead list' });
  }
};

exports.updateLeadList = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { name, description, prospects } = req.body;

    const list = await databaseService.getLeadList(id);

    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    // Only creator can update
    if (list.createdBy !== userId) {
      return res.status(403).json({ error: 'Only list creator can update' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (prospects) updates.prospectIds = prospects;

    const updated = await databaseService.updateLeadList(id, updates, userId);

    res.json(updated);
  } catch (error) {
    console.error('Update lead list error:', error);
    res.status(500).json({ error: 'Failed to update lead list' });
  }
};

exports.deleteLeadList = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const list = await databaseService.getLeadList(id);

    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    // Only creator can delete
    if (list.createdBy !== userId) {
      return res.status(403).json({ error: 'Only list creator can delete' });
    }

    await databaseService.deleteLeadList(id);

    res.json({ success: true, message: 'Lead list deleted' });
  } catch (error) {
    console.error('Delete lead list error:', error);
    res.status(500).json({ error: 'Failed to delete lead list' });
  }
};

/**
 * Get lead list audit log
 */
exports.getAuditLog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const limit = req.query.limit || 50;

    const list = await databaseService.getLeadList(id);

    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    if (list.createdBy !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const auditLog = await databaseService.getLeadListAuditLog(id, limit);

    res.json(auditLog);
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
};

// --- Lead List Permissions ---

exports.addPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { targetUserId, canView, canEdit } = req.body;

    // Get user role to check if admin
    const user = await databaseService.getUserById(userId);
    const isAdmin = user?.role === 'admin';

    const list = await databaseService.getLeadList(id);

    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    // Only admins or list creators can manage permissions
    if (!isAdmin && list.createdBy !== userId) {
      return res.status(403).json({ error: 'Only admins can share lists' });
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    // Cannot share with yourself
    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Cannot share a list with yourself' });
    }

    const share = await databaseService.shareLeadList(
      id, 
      targetUserId, 
      userId, 
      canView !== false, 
      canEdit === true
    );

    res.json({ success: true, share });
  } catch (error) {
    console.error('Add permission error:', error);
    res.status(500).json({ error: 'Failed to add permission' });
  }
};

exports.getPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Get user role to check if admin
    const user = await databaseService.getUserById(userId);
    const isAdmin = user?.role === 'admin';

    const list = await databaseService.getLeadList(id);

    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    // Only admins or list creators can view permissions
    if (!isAdmin && list.createdBy !== userId) {
      return res.status(403).json({ error: 'Only admins can view list permissions' });
    }

    const shares = await databaseService.getLeadListShares(id);
    res.json(shares);
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
};

exports.removePermission = async (req, res) => {
  try {
    const { id, permissionId } = req.params;
    const userId = req.userId;

    // Get user role to check if admin
    const user = await databaseService.getUserById(userId);
    const isAdmin = user?.role === 'admin';

    const list = await databaseService.getLeadList(id);

    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    // Only admins or list creators can remove permissions
    if (!isAdmin && list.createdBy !== userId) {
      return res.status(403).json({ error: 'Only admins can remove list permissions' });
    }

    // permissionId is actually the user_id in the shares table
    await databaseService.unshareLeadList(id, permissionId, userId);

    res.json({ success: true, message: 'Permission removed' });
  } catch (error) {
    console.error('Remove permission error:', error);
    res.status(500).json({ error: 'Failed to remove permission' });
  }
};

/**
 * Remove multiple prospects from a lead list (bulk delete)
 */
exports.removeProspects = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { prospectIds } = req.body;

    if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
      return res.status(400).json({ error: 'prospectIds array is required' });
    }

    const list = await databaseService.getLeadList(id);

    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    // Check if user can edit this list
    const access = await databaseService.checkUserListAccess(userId, id);
    if (!access.canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this list' });
    }

    const removedCount = await databaseService.removeProspectsFromList(id, prospectIds, userId);

    res.json({ 
      success: true, 
      message: `Removed ${removedCount} leads from list`,
      removedCount 
    });
  } catch (error) {
    console.error('Remove prospects error:', error);
    res.status(500).json({ error: 'Failed to remove prospects from list' });
  }
};
