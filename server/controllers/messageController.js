const { users, messages } = require('../services/mockDatabase');

// Store messages in memory
let messageStore = [];
let messageId = 1;

exports.sendMessage = async (req, res) => {
  try {
    const { senderId, recipientId, content } = req.body;

    if (!senderId || !recipientId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sender = users.get(senderId);
    const recipient = users.get(recipientId);

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
    };

    messageStore.push(message);
    res.json(message);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
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
