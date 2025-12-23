import React, { useState, useEffect } from 'react';
import { User, WorkHours, Message } from '../types';
import { ArrowLeft, Upload, Send, MessageSquare, Clock, Mail, User as UserIcon, Palette, Check, Save, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { backendAPI } from '../services/BackendAPI';
import { themeColors, loadTheme, saveTheme, ThemeColor, applyTheme } from '../utils/themeColors';

interface UserProfileProps {
  user: User;
  onBack: () => void;
  onUpdate: (updatedUser: User) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onBack, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'messages' | 'work-hours' | 'appearance'>('profile');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<ThemeColor>(loadTheme());
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    bio: user.bio || '',
    profilePicture: user.profilePicture || '',
  });

  const [workHours, setWorkHours] = useState<WorkHours>(
    user.workHours || {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      saturday: undefined,
      sunday: undefined,
    }
  );

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

  // Show notification
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    if (activeTab === 'messages') {
      loadMessages();
      loadTeamMembers();
    }
  }, [activeTab]);

  const loadMessages = async () => {
    try {
      const fetchedMessages = await backendAPI.getMessages(user.id);
      setMessages(fetchedMessages);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const members = await backendAPI.getTeamMembers();
      setTeamMembers(members.filter(m => m.id !== user.id));
    } catch (err) {
      console.error('Failed to load team members:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleWorkHoursChange = (day: typeof days[number], field: 'start' | 'end', value: string) => {
    setWorkHours(prev => ({
      ...prev,
      [day]: prev[day] ? { ...prev[day], [field]: value } : { start: value, end: value }
    }));
  };

  const handleToggleWorkDay = (day: typeof days[number]) => {
    setWorkHours(prev => ({
      ...prev,
      [day]: prev[day] ? undefined : { start: '09:00', end: '17:00' }
    }));
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData(prev => ({ ...prev, profilePicture: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const updatedUser = await backendAPI.updateProfile({
        ...user,
        ...formData,
        workHours,
        updatedAt: new Date().toISOString(),
      });
      onUpdate(updatedUser);
      setIsEditing(false);
      showNotification('success', 'Profile updated successfully!');
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      showNotification('error', err.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedRecipient) return;

    setLoading(true);
    try {
      const message = await backendAPI.sendMessage(user.id, selectedRecipient, newMessage);
      setMessages(prev => [...prev, message]);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message.');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const handleThemeChange = (theme: ThemeColor) => {
    setSelectedTheme(theme);
    saveTheme(theme);
    applyTheme(theme);
    showNotification('success', `Theme changed to ${theme.name}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transition-all animate-in slide-in-from-top-5 ${
          notification.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-80">
            <X size={18} />
          </button>
        </div>
      )}
      
      {/* Back Button - Enhanced */}
      <button 
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition mb-6"
      >
        <ArrowLeft size={18} /> Back to Dashboard
      </button>

      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {/* Header Section - Enhanced */}
        <div 
          className="p-8 text-white"
          style={{ background: `linear-gradient(135deg, ${selectedTheme.primary} 0%, ${selectedTheme.primaryDark} 100%)` }}
        >
          <div className="flex items-end gap-6">
            <div className="relative">
              <div className="w-28 h-28 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-bold text-white overflow-hidden border-4 border-white/30 shadow-xl">
                {formData.profilePicture ? (
                  <img src={formData.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  getInitials(formData.firstName, formData.lastName)
                )}
              </div>
              {isEditing && (
                <label 
                  className="absolute bottom-0 right-0 p-2.5 rounded-full cursor-pointer hover:scale-110 transition shadow-lg"
                  style={{ backgroundColor: selectedTheme.primary }}
                >
                  <Upload size={16} className="text-white" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleProfilePictureChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{formData.firstName} {formData.lastName}</h1>
              <p className="text-white/80 flex items-center gap-2 mt-2">
                <Mail size={16} /> {formData.email}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium capitalize">
                  {user.role || 'agent'}
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                  Theme: {selectedTheme.name}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-slate-700 flex gap-0">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-4 px-6 font-medium transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'profile'
                ? 'border-current bg-gray-50 dark:bg-slate-700/50'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/30'
            }`}
            style={activeTab === 'profile' ? { borderColor: selectedTheme.primary, color: selectedTheme.primary } : {}}
          >
            <UserIcon size={16} /> Profile Info
          </button>
          <button
            onClick={() => setActiveTab('work-hours')}
            className={`flex-1 py-4 px-6 font-medium transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'work-hours'
                ? 'border-current bg-gray-50 dark:bg-slate-700/50'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/30'
            }`}
            style={activeTab === 'work-hours' ? { borderColor: selectedTheme.primary, color: selectedTheme.primary } : {}}
          >
            <Clock size={16} /> Work Hours
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex-1 py-4 px-6 font-medium transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'messages'
                ? 'border-current bg-gray-50 dark:bg-slate-700/50'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/30'
            }`}
            style={activeTab === 'messages' ? { borderColor: selectedTheme.primary, color: selectedTheme.primary } : {}}
          >
            <MessageSquare size={16} /> Messages
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 py-4 px-6 font-medium transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'appearance'
                ? 'border-current bg-gray-50 dark:bg-slate-700/50'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/30'
            }`}
            style={activeTab === 'appearance' ? { borderColor: selectedTheme.primary, color: selectedTheme.primary } : {}}
          >
            <Palette size={16} /> Appearance
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Profile Information</h2>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-5 py-2.5 text-white rounded-xl hover:opacity-90 transition shadow-lg font-medium flex items-center gap-2"
                    style={{ backgroundColor: selectedTheme.primary }}
                  >
                    <UserIcon size={16} /> Edit Profile
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 transition"
                        style={{ '--tw-ring-color': selectedTheme.primary } as React.CSSProperties}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 transition"
                        style={{ '--tw-ring-color': selectedTheme.primary } as React.CSSProperties}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bio / About You
                    </label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      placeholder="Tell us about yourself..."
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 transition"
                    />
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="px-6 py-2.5 text-white rounded-xl hover:opacity-90 transition shadow-lg font-medium flex items-center gap-2 disabled:opacity-50"
                      style={{ backgroundColor: selectedTheme.primary }}
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          firstName: user.firstName,
                          lastName: user.lastName,
                          email: user.email,
                          bio: user.bio || '',
                          profilePicture: user.profilePicture || '',
                        });
                      }}
                      className="px-6 py-2.5 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-slate-500 transition font-medium flex items-center gap-2"
                    >
                      <X size={16} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">First Name</p>
                      <p className="text-lg font-medium text-gray-900 dark:text-white">{user.firstName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Last Name</p>
                      <p className="text-lg font-medium text-gray-900 dark:text-white">{user.lastName}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">{user.email}</p>
                  </div>
                  {user.bio && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Bio</p>
                      <p className="text-lg font-medium text-gray-900 dark:text-white">{user.bio}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Work Hours Tab */}
          {activeTab === 'work-hours' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Work Hours</h2>
                {isEditing && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="px-5 py-2.5 text-white rounded-xl hover:opacity-90 transition shadow-lg font-medium flex items-center gap-2 disabled:opacity-50"
                      style={{ backgroundColor: selectedTheme.primary }}
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Save Changes
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-5 py-2.5 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-slate-500 transition font-medium flex items-center gap-2"
                    >
                      <X size={16} /> Cancel
                    </button>
                  </div>
                )}
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-5 py-2.5 text-white rounded-xl hover:opacity-90 transition shadow-lg font-medium flex items-center gap-2"
                    style={{ backgroundColor: selectedTheme.primary }}
                  >
                    <Clock size={16} /> Edit Work Hours
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {days.map(day => (
                  <div key={day} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600">
                    <div className="w-28">
                      <p className="font-semibold text-gray-900 dark:text-white capitalize">{day}</p>
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-4 flex-1">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={workHours[day] !== undefined}
                            onChange={() => handleToggleWorkDay(day)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600"
                          style={workHours[day] !== undefined ? { backgroundColor: selectedTheme.primary } : {}}
                          ></div>
                        </label>
                        {workHours[day] && (
                          <>
                            <input
                              type="time"
                              value={workHours[day]?.start || '09:00'}
                              onChange={(e) => handleWorkHoursChange(day, 'start', e.target.value)}
                              className="px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-600 dark:text-white rounded-xl"
                            />
                            <span className="text-gray-500 dark:text-gray-400 font-medium">to</span>
                            <input
                              type="time"
                              value={workHours[day]?.end || '17:00'}
                              onChange={(e) => handleWorkHoursChange(day, 'end', e.target.value)}
                              className="px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-600 dark:text-white rounded-xl"
                            />
                          </>
                        )}
                        {!workHours[day] && (
                          <span className="text-gray-400 dark:text-gray-500 text-sm">Day off</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center gap-2">
                        {workHours[day] ? (
                          <>
                            <span 
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: selectedTheme.primary }}
                            ></span>
                            <p className="text-gray-700 dark:text-gray-300 font-medium">
                              {workHours[day]?.start} - {workHours[day]?.end}
                            </p>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                            <p className="text-gray-400 dark:text-gray-500">Not working</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Messages</h2>

              <div className="grid grid-cols-3 gap-4 h-96">
                {/* Team Members List */}
                <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">Team Members</p>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {teamMembers.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No team members</p>
                    ) : (
                      teamMembers.map(member => (
                        <button
                          key={member.id}
                          onClick={() => setSelectedRecipient(member.id)}
                          className={`w-full p-3 border-b border-gray-100 dark:border-slate-700 text-left transition ${
                            selectedRecipient === member.id
                              ? 'bg-blue-50 dark:bg-blue-900'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{member.role}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Messages List */}
                <div className="col-span-2 border border-gray-200 dark:border-slate-700 rounded-lg flex flex-col">
                  <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {selectedRecipient
                        ? teamMembers.find(m => m.id === selectedRecipient)?.firstName +
                          ' ' +
                          teamMembers.find(m => m.id === selectedRecipient)?.lastName
                        : 'Select a member'}
                    </p>
                  </div>

                  <div className="overflow-y-auto flex-1 p-4 space-y-3">
                    {messages
                      .filter(
                        m =>
                          (m.senderId === user.id && m.recipientId === selectedRecipient) ||
                          (m.senderId === selectedRecipient && m.recipientId === user.id)
                      )
                      .map(message => (
                        <div
                          key={message.id}
                          className={`flex ${message.senderId === user.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg ${
                              message.senderId === user.id
                                ? 'bg-blue-500 text-white rounded-br-none'
                                : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white rounded-bl-none'
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            <p className="text-xs opacity-75 mt-1">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message..."
                      disabled={!selectedRecipient}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!selectedRecipient || !newMessage.trim() || loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Appearance Settings</h2>
              
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Theme Color</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Choose a theme color for the interface. This applies to buttons, accents, and highlights throughout the app.
                </p>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {themeColors.map((theme) => (
                    <button
                      key={theme.name}
                      onClick={() => handleThemeChange(theme)}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        selectedTheme.name === theme.name
                          ? 'border-gray-900 dark:border-white shadow-lg scale-105'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-500'
                      }`}
                    >
                      {/* Color Preview */}
                      <div 
                        className={`w-full h-16 rounded-lg mb-3 bg-gradient-to-r ${theme.gradient} shadow-md`}
                      />
                      
                      {/* Theme Name */}
                      <p className="text-sm font-medium text-gray-800 dark:text-white text-center">
                        {theme.name}
                      </p>
                      
                      {/* Selected Indicator */}
                      {selectedTheme.name === theme.name && (
                        <div 
                          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: theme.primary }}
                        >
                          <Check size={14} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Section */}
              <div className="mt-8 p-6 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Preview</h3>
                <div className="flex flex-wrap gap-3">
                  <button 
                    className="px-4 py-2 text-white rounded-lg shadow-md transition hover:opacity-90"
                    style={{ backgroundColor: selectedTheme.primary }}
                  >
                    Primary Button
                  </button>
                  <button 
                    className="px-4 py-2 rounded-lg shadow-md transition"
                    style={{ backgroundColor: selectedTheme.primaryLight, color: selectedTheme.primary }}
                  >
                    Secondary Button
                  </button>
                  <span 
                    className="px-3 py-1 text-sm font-medium rounded-full"
                    style={{ backgroundColor: selectedTheme.primaryLight, color: selectedTheme.primary }}
                  >
                    Badge
                  </span>
                </div>
                <div 
                  className={`mt-4 h-2 w-full rounded-full bg-gradient-to-r ${selectedTheme.gradient}`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
