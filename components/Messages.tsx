import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, Users, Bug, Image, X, Check, 
  AlertCircle, Paperclip, Trash2, ChevronDown, User as UserIcon,
  Clock, CheckCheck, Search, Plus
} from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';
import { User } from '../types';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  content: string;
  timestamp: string;
  read: boolean;
  type?: 'message' | 'bug_report';
  attachments?: string[];
  bugStatus?: 'open' | 'in_progress' | 'resolved';
}

interface MessagesProps {
  currentUser: User | null;
}

type TabType = 'inbox' | 'sent' | 'bug_reports';

const Messages: React.FC<MessagesProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  
  // Compose states
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeType, setComposeType] = useState<'message' | 'bug_report'>('message');
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [messageContent, setMessageContent] = useState('');
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugPriority, setBugPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load messages and team members
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;
      
      setIsLoading(true);
      try {
        const [messagesData, membersData] = await Promise.all([
          backendAPI.getMessages(currentUser.id),
          backendAPI.getTeamMembers()
        ]);
        
        setMessages(messagesData || []);
        // Filter out current user from team members
        setTeamMembers(membersData.filter((m: User) => m.id !== currentUser.id));
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  // Handle file selection for screenshots
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        newFiles.push(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newPreviews.push(e.target.result as string);
            setAttachmentPreviews(prev => [...prev, e.target?.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    });

    setAttachments(prev => [...prev, ...newFiles]);
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setAttachmentPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Send message or bug report
  const handleSend = async () => {
    if (!currentUser) return;
    
    setIsSending(true);
    try {
      if (composeType === 'message') {
        if (!selectedRecipient || !messageContent.trim()) {
          alert('Please select a recipient and enter a message');
          setIsSending(false);
          return;
        }

        await backendAPI.sendMessage(
          currentUser.id,
          selectedRecipient,
          messageContent.trim()
        );
      } else {
        // Bug report - send to all admins
        if (!bugTitle.trim() || !bugDescription.trim()) {
          alert('Please fill in the bug title and description');
          setIsSending(false);
          return;
        }

        // Convert attachments to base64
        const attachmentData: string[] = [];
        for (const file of attachments) {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          attachmentData.push(base64);
        }

        // Find admin users
        const admins = teamMembers.filter(m => m.role === 'admin');
        const adminId = admins.length > 0 ? admins[0].id : selectedRecipient;

        await backendAPI.sendBugReport({
          senderId: currentUser.id,
          title: bugTitle.trim(),
          description: bugDescription.trim(),
          priority: bugPriority,
          attachments: attachmentData
        });
      }

      // Refresh messages
      const updatedMessages = await backendAPI.getMessages(currentUser.id);
      setMessages(updatedMessages || []);

      // Reset form
      setShowComposeModal(false);
      setSelectedRecipient('');
      setMessageContent('');
      setBugTitle('');
      setBugDescription('');
      setBugPriority('medium');
      setAttachments([]);
      setAttachmentPreviews([]);
    } catch (error) {
      console.error('Failed to send:', error);
      alert('Failed to send. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Update bug status (admin only)
  const handleUpdateBugStatus = async (messageId: string, status: 'open' | 'in_progress' | 'resolved') => {
    if (!currentUser || !isAdmin) return;
    
    try {
      await backendAPI.updateBugStatus(messageId, status);
      
      // Refresh messages
      const updatedMessages = await backendAPI.getMessages(currentUser.id);
      setMessages(updatedMessages || []);
    } catch (error) {
      console.error('Failed to update bug status:', error);
      alert('Failed to update bug status. Please try again.');
    }
  };

  // Filter messages based on tab
  const filteredMessages = messages.filter(msg => {
    if (activeTab === 'inbox') {
      return msg.recipientId === currentUser?.id && msg.type !== 'bug_report';
    } else if (activeTab === 'sent') {
      return msg.senderId === currentUser?.id && msg.type !== 'bug_report';
    } else {
      // Bug reports tab - admins see all bug reports sent to them, users see their own reports
      if (isAdmin) {
        return msg.type === 'bug_report' && msg.recipientId === currentUser?.id;
      } else {
        return msg.type === 'bug_report' && msg.senderId === currentUser?.id;
      }
    }
  }).filter(msg => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return msg.content.toLowerCase().includes(query) || 
           msg.senderName.toLowerCase().includes(query) ||
           msg.recipientName.toLowerCase().includes(query);
  });

  // Group messages by conversation
  const getConversations = () => {
    const conversationMap = new Map<string, Message[]>();
    
    filteredMessages.forEach(msg => {
      const partnerId = msg.senderId === currentUser?.id ? msg.recipientId : msg.senderId;
      const existing = conversationMap.get(partnerId) || [];
      existing.push(msg);
      conversationMap.set(partnerId, existing);
    });

    return Array.from(conversationMap.entries()).map(([partnerId, msgs]) => ({
      partnerId,
      partnerName: msgs[0].senderId === currentUser?.id ? msgs[0].recipientName : msgs[0].senderName,
      messages: msgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      lastMessage: msgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0],
      unreadCount: msgs.filter(m => !m.read && m.recipientId === currentUser?.id).length
    })).sort((a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime());
  };

  const conversations = getConversations();

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Communicate with your team and report issues
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setComposeType('message');
              setShowComposeModal(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            New Message
          </button>
          <button
            onClick={() => {
              setComposeType('bug_report');
              setShowComposeModal(true);
            }}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 transition"
          >
            <Bug className="w-4 h-4" />
            Report Bug
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'inbox'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4 inline mr-2" />
          Inbox
          {messages.filter(m => !m.read && m.recipientId === currentUser?.id && m.type !== 'bug_report').length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
              {messages.filter(m => !m.read && m.recipientId === currentUser?.id && m.type !== 'bug_report').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'sent'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Send className="w-4 h-4 inline mr-2" />
          Sent
        </button>
        <button
          onClick={() => setActiveTab('bug_reports')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'bug_reports'
              ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Bug className="w-4 h-4 inline mr-2" />
          Bug Reports
          {isAdmin && messages.filter(m => m.type === 'bug_report' && m.bugStatus === 'open').length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-orange-600 text-white text-xs rounded-full">
              {messages.filter(m => m.type === 'bug_report' && m.bugStatus === 'open').length}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Messages List */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">
              {activeTab === 'inbox' ? 'Your inbox is empty' : 
               activeTab === 'sent' ? 'You haven\'t sent any messages' :
               'No bug reports'}
            </p>
          </div>
        ) : activeTab === 'bug_reports' ? (
          // Bug Reports View
          <div className="divide-y divide-gray-200 dark:divide-slate-700">
            {filteredMessages.map(msg => (
              <div key={msg.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      msg.bugStatus === 'resolved' ? 'bg-green-100 dark:bg-green-900/30' :
                      msg.bugStatus === 'in_progress' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                      'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      <Bug className={`w-5 h-5 ${
                        msg.bugStatus === 'resolved' ? 'text-green-600 dark:text-green-400' :
                        msg.bugStatus === 'in_progress' ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-white">{msg.senderName}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          msg.bugStatus === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          msg.bugStatus === 'in_progress' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {msg.bugStatus || 'open'}
                        </span>
                        {/* Admin Status Controls */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 ml-auto">
                            {msg.bugStatus !== 'in_progress' && (
                              <button
                                onClick={() => handleUpdateBugStatus(msg.id, 'in_progress')}
                                className="px-2 py-0.5 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 dark:text-yellow-400 rounded-full transition"
                              >
                                Mark In Progress
                              </button>
                            )}
                            {msg.bugStatus !== 'resolved' && (
                              <button
                                onClick={() => handleUpdateBugStatus(msg.id, 'resolved')}
                                className="px-2 py-0.5 text-xs bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400 rounded-full transition"
                              >
                                Mark Resolved
                              </button>
                            )}
                            {msg.bugStatus !== 'open' && (
                              <button
                                onClick={() => handleUpdateBugStatus(msg.id, 'open')}
                                className="px-2 py-0.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 rounded-full transition"
                              >
                                Reopen
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 mt-1">{msg.content}</p>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {msg.attachments.map((att, i) => (
                            <a 
                              key={i} 
                              href={att} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 hover:opacity-80 transition"
                            >
                              <img src={att} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Conversations View
          <div className="divide-y divide-gray-200 dark:divide-slate-700">
            {conversations.map(conv => (
              <div 
                key={conv.partnerId}
                onClick={() => setSelectedConversation(conv.partnerId)}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition ${
                  conv.unreadCount > 0 ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${conv.unreadCount > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                        {conv.partnerName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(conv.lastMessage.timestamp)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                        {conv.lastMessage.senderId === currentUser?.id && <span className="text-gray-400">You: </span>}
                        {conv.lastMessage.content}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {composeType === 'message' ? 'New Message' : 'Report a Bug'}
                </h3>
                <button 
                  onClick={() => setShowComposeModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {composeType === 'message' ? (
                // Message Form
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      To
                    </label>
                    <select
                      value={selectedRecipient}
                      onChange={(e) => setSelectedRecipient(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select a team member...</option>
                      {teamMembers.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.firstName} {member.lastName} {member.role === 'admin' && '(Admin)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Message
                    </label>
                    <textarea
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      rows={5}
                      placeholder="Type your message..."
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white resize-none"
                    />
                  </div>
                </div>
              ) : (
                // Bug Report Form
                <div className="space-y-4">
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-orange-800 dark:text-orange-300">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">This report will be sent to administrators</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bug Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bugTitle}
                      onChange={(e) => setBugTitle(e.target.value)}
                      placeholder="Brief description of the issue"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Priority
                    </label>
                    <select
                      value={bugPriority}
                      onChange={(e) => setBugPriority(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    >
                      <option value="low">Low - Minor issue</option>
                      <option value="medium">Medium - Affects workflow</option>
                      <option value="high">High - Major impact</option>
                      <option value="critical">Critical - System unusable</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={bugDescription}
                      onChange={(e) => setBugDescription(e.target.value)}
                      rows={4}
                      placeholder="Steps to reproduce, expected behavior, actual behavior..."
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white resize-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Screenshots (optional)
                    </label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition"
                    >
                      <Image className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Click to upload screenshots
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        PNG, JPG up to 5MB each
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {/* Attachment Previews */}
                    {attachmentPreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {attachmentPreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img 
                              src={preview} 
                              alt={`Preview ${index + 1}`}
                              className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-slate-600"
                            />
                            <button
                              onClick={() => removeAttachment(index)}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowComposeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition flex items-center justify-center gap-2 ${
                    composeType === 'message' 
                      ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400' 
                      : 'bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400'
                  }`}
                >
                  {isSending ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {composeType === 'message' ? 'Send Message' : 'Submit Report'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
