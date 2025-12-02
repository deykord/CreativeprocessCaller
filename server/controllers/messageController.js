const dbService = require('../services/databaseService');

// Store messages in memory (for now - could be moved to database later)
let messageStore = [];
let messageId = 1;

exports.sendMessage = async (req, res) => {
  try {
    const { senderId, recipientId, content, type } = req.body;

    if (!senderId || !recipientId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sender = await dbService.getUserById(senderId);
    const recipient = await dbService.getUserById(recipientId);

    if (!sender || !recipient) {
      return res.status(404).json({ error: 'Sender or recipient not found' });
    }

    const message = {
      id: `msg-${messageId++}`,
      senderId,
      senderName: `${sender.firstName} ${sender.lastName}`,
      recipientId,
      recipientName: `${recipient.firstName} ${recipient.lastName}`,
      content,
      timestamp: new Date().toISOString(),
      read: false,
      type: type || 'message',
    };

    messageStore.push(message);
    res.json(message);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

exports.sendBugReport = async (req, res) => {
  try {
    const { senderId, title, description, priority, attachments } = req.body;

    if (!senderId || !title || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sender = await dbService.getUserById(senderId);
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    // Get all admin users
    const allUsers = await dbService.getAllUsers();
    const admins = allUsers.filter(u => u.role === 'admin');
    
    if (admins.length === 0) {
      return res.status(400).json({ error: 'No admin users found' });
    }

    // Create a bug report message for each admin
    const bugReports = [];
    for (const admin of admins) {
      const bugReport = {
        id: `bug-${messageId++}`,
        senderId,
        senderName: `${sender.firstName} ${sender.lastName}`,
        recipientId: admin.id,
        recipientName: `${admin.firstName} ${admin.lastName}`,
        content: `[${priority.toUpperCase()}] ${title}\n\n${description}`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'bug_report',
        bugStatus: 'open',
        priority,
        title,
        description,
        attachments: attachments || [],
      };
      messageStore.push(bugReport);
      bugReports.push(bugReport);
    }

    res.json({ success: true, bugReports });
  } catch (err) {
    console.error('Send bug report error:', err);
    res.status(500).json({ error: 'Failed to send bug report' });
  }
};

exports.updateBugStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    const message = messageStore.find(m => m.id === messageId && m.type === 'bug_report');
    if (!message) {
      return res.status(404).json({ error: 'Bug report not found' });
    }

    message.bugStatus = status;
    res.json(message);
  } catch (err) {
    console.error('Update bug status error:', err);
    res.status(500).json({ error: 'Failed to update bug status' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Return all messages for this user (sent and received)
    const userMessages = messageStore.filter(
      m => m.senderId === userId || m.recipientId === userId
    );

    res.json(userMessages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

exports.markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = messageStore.find(m => m.id === messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    message.read = true;
    res.json(message);
  } catch (err) {
    console.error('Mark message as read error:', err);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
};
