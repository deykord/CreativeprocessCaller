const db = require('../services/mockDatabase');

// --- Lead List Management ---

exports.createLeadList = async (req, res) => {
  try {
    const { name, description, prospects } = req.body;
    const userId = req.userId; // Set by auth middleware

    if (!name) {
      return res.status(400).json({ error: 'List name is required' });
    }

    const newList = await db.createLeadList({
      name,
      description: description || '',
      createdBy: userId,
      prospectIds: prospects || [],
      prospectCount: (prospects || []).length,
    });

    res.json(newList);
  } catch (error) {
    console.error('Create lead list error:', error);
    res.status(500).json({ error: 'Failed to create lead list' });
  }
};

exports.getLeadLists = async (req, res) => {
  try {
    const userId = req.userId; // Set by auth middleware
    const allLists = await db.getAllLeadLists();
    
    // Filter lists the user can see
    const accessibleLists = [];
    
    for (const list of allLists) {
      // User can see if they created it or have permission
      const canAccess = await db.canUserAccessList(userId, list.id);
      if (list.createdBy === userId || canAccess) {
        accessibleLists.push(list);
      }
    }

    res.json(accessibleLists);
  } catch (error) {
    console.error('Get lead lists error:', error);
    res.status(500).json({ error: 'Failed to fetch lead lists' });
  }
};

exports.getLeadList = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const list = await db.getLeadList(id);
    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    // Check permission
    const canAccess = await db.canUserAccessList(userId, id);
    if (list.createdBy !== userId && !canAccess) {
      return res.status(403).json({ error: 'Access denied' });
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

    const list = await db.getLeadList(id);
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
    if (prospects) {
      updates.prospectIds = prospects;
      updates.prospectCount = prospects.length;
    }

    const updated = await db.updateLeadList(id, updates);
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

    const list = await db.getLeadList(id);
    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    // Only creator can delete
    if (list.createdBy !== userId) {
      return res.status(403).json({ error: 'Only list creator can delete' });
    }

    await db.deleteLeadList(id);
    res.json({ success: true, message: 'Lead list deleted' });
  } catch (error) {
    console.error('Delete lead list error:', error);
    res.status(500).json({ error: 'Failed to delete lead list' });
  }
};

// --- Lead List Permissions ---

exports.addPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { targetUserId, canView, canEdit } = req.body;

    const list = await db.getLeadList(id);
    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    // Only creator (or admin) can manage permissions
    if (list.createdBy !== userId) {
      return res.status(403).json({ error: 'Only list creator can manage permissions' });
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    // Check if permission already exists
    const existing = await db.getLeadListPermissions(id);
    const alreadyExists = existing.find(p => p.userId === targetUserId);
    
    if (alreadyExists) {
      // Update existing permission
      const updated = await db.updateLeadListPermission(alreadyExists.id, { canView, canEdit });
      return res.json(updated);
    }

    // Add new permission
    const permission = await db.addLeadListPermission({
      listId: id,
      userId: targetUserId,
      canView: canView !== false,
      canEdit: canEdit === true,
    });

    res.json(permission);
  } catch (error) {
    console.error('Add permission error:', error);
    res.status(500).json({ error: 'Failed to add permission' });
  }
};

exports.getPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const list = await db.getLeadList(id);
    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    // Only creator can view permissions
    if (list.createdBy !== userId) {
      return res.status(403).json({ error: 'Only list creator can view permissions' });
    }

    const permissions = await db.getLeadListPermissions(id);
    res.json(permissions);
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
};

exports.removePermission = async (req, res) => {
  try {
    const { id, permissionId } = req.params;
    const userId = req.userId;

    const list = await db.getLeadList(id);
    if (!list) {
      return res.status(404).json({ error: 'Lead list not found' });
    }

    // Only creator can remove permissions
    if (list.createdBy !== userId) {
      return res.status(403).json({ error: 'Only list creator can remove permissions' });
    }

    await db.deleteLeadListPermission(permissionId);
    res.json({ success: true, message: 'Permission removed' });
  } catch (error) {
    console.error('Remove permission error:', error);
    res.status(500).json({ error: 'Failed to remove permission' });
  }
};
