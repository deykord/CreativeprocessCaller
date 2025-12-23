console.log('📱 App.tsx loading...');
import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { DashboardStats } from './components/DashboardStats';
import { ProspectTable } from './components/ProspectTable';
import { ManualDialer } from './components/ManualDialer';
import PowerDialer from './components/PowerDialer';
import CallHistoryAdvanced from './components/CallHistoryAdvanced';
import { Header } from './components/Header';
import { Login } from './components/Login';
import UserProfile from './components/UserProfile';
import { SalesFloor } from './components/SalesFloor';
import Messages from './components/Messages';
import { Prospect, CallState, AgentStats, CallLog, User, TwilioPhoneNumber } from './types';
import { INITIAL_PROSPECTS, INITIAL_STATS } from './constants';
import { LayoutGrid, Users, Phone, LogOut, Bell, History, Zap, Keyboard, Sun, Moon, List, Activity, MessageSquare, GraduationCap, Shield, DollarSign, TrendingUp, Brain, PhoneCall, Sparkles } from 'lucide-react';

// SERVICES
console.log('📱 Importing voice services...');
import { voiceService } from './services/VoiceService';
import { telnyxService } from './services/TelnyxService';
import { backendAPI } from './services/BackendAPI';
import { standardizePhoneNumber } from './utils/phoneUtils';
import { initializeTheme } from './utils/themeColors';
console.log('📱 Voice services imported successfully');

// Lazy load heavy components
const LeadListManager = React.lazy(() => import('./components/LeadListManager').then(m => ({ default: m.LeadListManager })));
const TeamManagement = React.lazy(() => import('./components/TeamManagement').then(m => ({ default: m.TeamManagement })));
const Training = React.lazy(() => import('./components/Training'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const AutomationSettings = React.lazy(() => import('./components/AutomationSettings'));
import IncomingCallNotification from './components/IncomingCallNotification';
import { InboundCallActive } from './components/InboundCallActive';

// Loading fallback component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
  </div>
);

// --- CONFIGURATION ---
const USE_BACKEND = true;
const activeVoiceService = voiceService;


type View = 'dashboard' | 'prospects' | 'power-dialer' | 'manual-dialer' | 'history' | 'team-management' | 'profile' | 'lead-lists' | 'sales-floor' | 'messages' | 'training' | 'admin-dashboard' | 'automation';

const Dashboard: React.FC = () => {
    const [powerDialerDispositionSaved, setPowerDialerDispositionSaved] = useState(false);
    // When wrap-up UI toggles 'pause', we store it here so PowerDialer will stop auto-advancing
    const [powerDialerPausedByWrapUp, setPowerDialerPausedByWrapUp] = useState(false);
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [prospects, setProspects] = useState<Prospect[]>(INITIAL_PROSPECTS);
  const [stats, setStats] = useState<AgentStats>(INITIAL_STATS);
  const [currentCall, setCurrentCall] = useState<{ prospect: Prospect; state: CallState; startTime: number } | null>(null);
  const [callerId, setCallerId] = useState<string | null>(null);
  const [callHistory, setCallHistory] = useState<CallLog[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isVoiceReady, setIsVoiceReady] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceProvider, setVoiceProvider] = useState<'twilio' | 'telnyx'>('twilio');
  const [user, setUser] = useState<User | null>(null);
  const [twilioNumbers, setTwilioNumbers] = useState<TwilioPhoneNumber[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [openImportModal, setOpenImportModal] = useState(false);
  const [stuckCallError, setStuckCallError] = useState<string | null>(null);
  const [activeInboundCall, setActiveInboundCall] = useState<{ callControlId: string; fromNumber: string; fromName?: string } | null>(null);
  const [adminSection, setAdminSection] = useState<'home' | 'costs' | 'performance' | 'training-settings' | 'team' | 'telnyx'>('home');

  // Listen for navigation events from PowerDialer
  useEffect(() => {
    // Initialize theme colors on app load
    initializeTheme();
    
    const handleNavigate = (e: CustomEvent) => {
      if (e.detail === 'lead-lists') {
        setCurrentView('lead-lists');
      } else if (e.detail === 'manual-dialer') {
        setCurrentView('manual-dialer');
      }
    };
    const handleOpenImport = () => {
      // Open import modal in current view (stay in PowerDialer, don't navigate)
      setOpenImportModal(true);
    };
    
    window.addEventListener('navigateTo', handleNavigate as EventListener);
    window.addEventListener('openImportModal', handleOpenImport);
    
    return () => {
      window.removeEventListener('navigateTo', handleNavigate as EventListener);
      window.removeEventListener('openImportModal', handleOpenImport);
    };
  }, []);

  useEffect(() => {
    const initSystem = async () => {
      try {
        // Get current user
        const currentUser = await backendAPI.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }

        if (USE_BACKEND) {
          const fetchedProspects = await backendAPI.getProspects();
          setProspects(fetchedProspects);

          const fetchedHistory = await backendAPI.getCallHistory();
          setCallHistory(fetchedHistory);

          // Fetch team members
          try {
            const members = await backendAPI.getTeamMembers();
            setTeamMembers(members);
          } catch (err) {
            console.warn('Failed to fetch team members:', err);
          }

          // Get voice provider configuration
          const voiceConfig = await backendAPI.getVoiceConfig();
          console.log('🔊 Voice provider config received:', voiceConfig);
          console.log('🔊 Provider type:', voiceConfig.provider);
          console.log('🔊 Has Telnyx config:', !!voiceConfig.telnyx);

          if (voiceConfig.provider === 'telnyx' && voiceConfig.telnyx) {
            // Initialize Telnyx with SIP credentials
            console.log('🔊 Initializing TELNYX voice service (not Twilio)...');
            setVoiceProvider('telnyx');
            setCallerId(voiceConfig.telnyx.callerId);
            
            try {
              await activeVoiceService.initialize({
                provider: 'telnyx',
                telnyx: {
                  login: voiceConfig.telnyx.sipUsername,
                  password: voiceConfig.telnyx.sipPassword,
                  callerIdNumber: voiceConfig.telnyx.callerId,
                }
              });
              console.log('✅ TELNYX initialized successfully - Twilio will NOT be used');
              console.log('✅ Telnyx ready for calls');
              setIsVoiceReady(true);
              setVoiceError(null);
            } catch (telnyxErr) {
              console.error('❌ Telnyx initialization failed:', telnyxErr);
              setIsVoiceReady(false);
              setVoiceError(`Telnyx initialization failed: ${telnyxErr instanceof Error ? telnyxErr.message : 'Unknown error'}`);
            }
          } else {
            // Initialize Twilio (default)
            console.warn('⚠️ Falling back to Twilio (this should not happen if Telnyx is configured)');
            setVoiceProvider('twilio');
            // Fetch available Twilio numbers and set first one as default
            try {
              const twilioNumbersList = await backendAPI.getTwilioNumbers();
              if (twilioNumbersList && twilioNumbersList.length > 0) {
                setTwilioNumbers(twilioNumbersList);
                const firstNumber = twilioNumbersList[0].phoneNumber;
                setCallerId(firstNumber);
                console.log('Set default Caller ID to:', firstNumber);
              }
            } catch (err) {
              console.warn('Failed to fetch Twilio numbers:', err);
            }

            // Register token refresh function
            activeVoiceService.registerTokenRefresh(async () => {
              const token = await backendAPI.getToken('agent_1');
              return token;
            });

            const token = await backendAPI.getToken('agent_1');
            await activeVoiceService.initialize({ provider: 'twilio', twilio: { token } });
            setIsVoiceReady(true);
            setVoiceError(null);
          }
        } else {
          activeVoiceService.initialize({ provider: 'twilio', twilio: { token: 'mock-token' } });
        }

        activeVoiceService.registerStatusCallback((stateInfo) => {
          console.log('📱 Call state changed:', stateInfo.state, stateInfo);
          
          // Update the call state
          setCurrentCall((prev) => prev ? { ...prev, state: stateInfo.state } : null);
          
          // When call ends, trigger disposition flow
          if (stateInfo.state === CallState.WRAP_UP) {
            console.log('📱 Call ended, triggering disposition');
            // Don't clear currentCall yet - let the disposition flow handle it
            // Just ensure disposition is triggered
            setPowerDialerDispositionSaved(false);
          }
        });
        console.log('✅ Voice service ready (provider: ' + (await backendAPI.getVoiceConfig()).provider + ')');
        if (!isVoiceReady) {
          setIsVoiceReady(true);
          setVoiceError(null);
        }
      } catch (err) {
        console.error("❌ Voice service initialization failed:", err);
        setIsVoiceReady(false);
        setVoiceError("Voice service initialization failed. Please refresh or contact support.");
      }
    };
    initSystem();
  }, []);

  const handleCall = async (prospect: Prospect) => {
    if (!isVoiceReady) {
      alert(`${voiceProvider === 'telnyx' ? 'Telnyx' : 'Twilio'} is not ready. Please wait for initialization.`);
      return;
    }
    try {
      // Standardize phone number to E.164 format for Telnyx compatibility
      const standardizedPhone = standardizePhoneNumber(prospect.phone);
      console.log(`Standardized phone: ${prospect.phone} -> ${standardizedPhone}`);
      
      setCurrentCall({ prospect, state: CallState.DIALING, startTime: Date.now() });
      await activeVoiceService.connect(standardizedPhone, callerId || undefined);
      setStats(prev => ({ ...prev, callsMade: prev.callsMade + 1 }));
      console.log('✓ Call initiated successfully');
    } catch (err: any) {
      console.error("Call failed", err);
      
      // Ignore browser extension errors (message channel closed) - these are harmless
      if (err?.message?.includes('message channel closed') || 
          err?.message?.includes('asynchronous response')) {
        console.warn('Ignoring browser extension error:', err.message);
        return; // Don't show error, call is likely working
      }

      // Ignore Twilio-specific errors when using Telnyx
      if (err?.message?.includes('n.on is not a function') || 
          err?.message?.includes('.on is not a function')) {
        console.warn('Ignoring Twilio error (system is using Telnyx):', err.message);
        return; // Don't show error, call is working with Telnyx
      }
      
      // Check for specific error types and provide user-friendly messages
      let errorMessage = "Call failed to connect. Please try again.";
      let shouldShowAlert = true;
      
      // Check for duplicate call / already connected errors
      if (err?.message?.toLowerCase().includes('pending') || 
          err?.message?.toLowerCase().includes('already') ||
          err?.code === 31002 || // Device is currently disconnecting
          err?.code === 31003) { // Device is currently connecting to a call
        // Show sticky banner instead of alert - don't repeat
        setStuckCallError("A call is already in progress. End the current call before dialing again.");
        return; // Don't clear currentCall or trigger disposition
      } else if (err?.message?.toLowerCase().includes('not ready')) {
        // Telnyx not ready - log but don't block since it might recover
        console.error('Voice service not ready:', err.message);
        errorMessage = "Voice service is still connecting. Please wait a moment and try again.";
      } else if (err?.code === 31204) { // Invalid phone number
        errorMessage = "❌ Invalid phone number format. Please check the number and try again.";
      } else if (err?.code === 20003) { // Auth error
        errorMessage = "❌ Authentication error. Please refresh the page and try again.";
      } else if (err?.message) {
        errorMessage = `Call failed: ${err.message}`;
      }
      
      // Only show alert for critical errors
      if (shouldShowAlert) {
        alert(errorMessage);
      }
      
      setCurrentCall(null);
      // Only set dispositionSaved, let PowerDialer handle advance
      setPowerDialerDispositionSaved(true);
    }
  };

  const handleManualCall = async (phoneNumber: string) => {
    if (!isVoiceReady) {
      alert(`${voiceProvider === 'telnyx' ? 'Telnyx' : 'Twilio'} is not ready. Please wait for initialization.`);
      return;
    }
    // Standardize phone number to E.164 format
    const standardizedPhone = standardizePhoneNumber(phoneNumber);
    console.log(`Manual call - Standardized phone: ${phoneNumber} -> ${standardizedPhone}`);
    
    const manualProspect: Prospect = {
      id: `manual-${Date.now()}`,
      firstName: 'Manual',
      lastName: 'Dial',
      company: 'Unknown',
      title: 'Unknown',
      phone: standardizedPhone,
      email: '',
      status: 'New',
      timezone: 'Unknown'
    };
    handleCall(manualProspect);
  };

  const handleHangup = () => {
    activeVoiceService.disconnect();
  };

  const handleForceEndCall = () => {
    // Force disconnect any active call and clear states
    try {
      activeVoiceService.disconnect();
    } catch (e) {
      console.error('Error disconnecting:', e);
    }
    setCurrentCall(null);
    setStuckCallError(null);
    setPowerDialerDispositionSaved(true);
  };

  const handleSaveDisposition = async (outcome: any, note: string) => {
    if (!currentCall) return;

    const durationSec = Math.floor((Date.now() - currentCall.startTime) / 1000);
    
    const newLog = {
      prospectId: currentCall.prospect.id,
      prospectName: `${currentCall.prospect.firstName} ${currentCall.prospect.lastName}`,
      outcome,
      duration: durationSec,
      notes: note,
      timestamp: new Date().toISOString()
    };

    if (USE_BACKEND) {
      try {
        const savedLog = await backendAPI.logCall(newLog);
        setCallHistory(prev => [...prev, savedLog]);
        const updatedProspects = await backendAPI.getProspects();
        setProspects(updatedProspects);
      } catch (err) {
        console.error("Failed to save log to backend", err);
      }
    } else {
      // Fill all required CallLog fields for mock
      const mockLog: CallLog = {
        id: `log-${Date.now()}`,
        prospectId: currentCall.prospect.id,
        prospectName: `${currentCall.prospect.firstName} ${currentCall.prospect.lastName}`,
        outcome,
        duration: durationSec,
        timestamp: new Date().toISOString(),
        phoneNumber: currentCall.prospect.phone,
        note,
        fromNumber: user?.email || '',
      };
      setCallHistory(prev => [...prev, mockLog]);
      setProspects(prev => prev.map(p => 
        p.id === currentCall.prospect.id 
          ? { ...p, status: 'Contacted', notes: note, lastCall: new Date().toISOString() } as Prospect
          : p
      ));
    }
    
    setStats(prev => {
      const newStats = { ...prev, talkTime: prev.talkTime + Math.floor(durationSec / 60) };
      if (outcome === 'Connected') newStats.connections += 1;
      if (outcome === 'Meeting Set') {
        newStats.connections += 1;
        newStats.appointmentsSet += 1;
      }
      return newStats;
    });

    setCurrentCall(null);
    // Notify PowerDialer to advance to the next lead and trigger the dial
    setPowerDialerDispositionSaved(true);
  };

  const handleUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (text) {
        const lines = text.split('\n');
        if (lines.length < 2) return;
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        const newProspects = lines.slice(1).map((line) => {
          if (!line.trim()) return null;
          const values = line.split(',').map(v => v.trim());
          const data: any = {};
          headers.forEach((header, i) => {
            // Handle combined "name" or "full name" column
            if (header === 'name' || header === 'full name' || header === 'fullname') {
              const nameParts = (values[i] || '').trim().split(/\s+/);
              if (nameParts.length >= 2) {
                data.firstName = nameParts[0];
                data.lastName = nameParts.slice(1).join(' ');
              } else {
                data.firstName = nameParts[0] || '';
                data.lastName = '';
              }
            }
            else if (header.includes('first') && header.includes('name')) data.firstName = values[i];
            else if (header.includes('last') && header.includes('name')) data.lastName = values[i];
            else if (header === 'first' || header === 'firstname') data.firstName = values[i];
            else if (header === 'last' || header === 'lastname') data.lastName = values[i];
            else if (header.includes('phone')) data.phone = values[i];
            else if (header.includes('email')) data.email = values[i];
            else if (header.includes('company')) data.company = values[i];
            else if (header.includes('title')) data.title = values[i];
            else if (header.includes('status')) data.status = values[i];
            else if (header.includes('zone') || header.includes('time')) data.timezone = values[i];
          });
          if (!data.phone) return null;
          return data;
        }).filter(Boolean);

        if (USE_BACKEND) {
          const prospectIds: string[] = [];
          for (const p of newProspects) {
            const created = await backendAPI.createProspect(p);
            prospectIds.push(created.id);
          }
          
          // Create a lead list for this import
          if (prospectIds.length > 0) {
            try {
              const listName = `${file.name} - ${new Date().toLocaleDateString()}`;
              await backendAPI.createLeadList(listName, `Imported from ${file.name}`, prospectIds);
            } catch (err) {
              console.warn('Failed to create lead list for imported prospects:', err);
            }
          }
          
          const refreshed = await backendAPI.getProspects();
          setProspects(refreshed);
        } else {
          const prospectsWithIds = newProspects.map((p, i) => ({ ...p, id: `csv-${Date.now()}-${i}` }));
          setProspects(prev => [...prev, ...prospectsWithIds]);
        }
      }
    };
    reader.readAsText(file);
  };

  // PowerDialer queue: start empty, will be filled when user selects a list
  const powerDialerQueue: Prospect[] = [];

  const handleDeleteProspect = async (id: string) => {
    try {
      await backendAPI.deleteProspect(id);
      setProspects(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Failed to delete prospect:', err);
      alert('Failed to delete prospect');
    }
  };

  const handleUpdateProspect = async (id: string, updates: Partial<Prospect>) => {
    // Update local state immediately for responsiveness
    setProspects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    // Optionally refetch from backend to ensure consistency
    try {
      const refreshedProspects = await backendAPI.getProspects();
      setProspects(refreshedProspects);
    } catch (err) {
      console.warn('Failed to refresh prospects after update:', err);
    }
  };

  const handleLogout = async () => {
    // Reset all app state before logout
    setCurrentCall(null);
    setProspects([]);
    setCallHistory([]);
    setUser(null);
    setIsVoiceReady(false);
    setPowerDialerDispositionSaved(false);
    setPowerDialerPausedByWrapUp(false);
    
    // Revoke microphone permissions by stopping any active streams
    try {
      const streams = await navigator.mediaDevices.getUserMedia({ audio: true });
      streams.getTracks().forEach(track => track.stop());
    } catch (e) {
      // Ignore errors - user may have already denied permission
    }
    
    await backendAPI.logout();
    navigate('/login');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Good Morning, {user?.firstName || 'Agent'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400">Here is your daily performance overview.</p>
            </div>
            <DashboardStats stats={stats} />
            <div className="mt-8">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Recent Priority Leads</h3>
              <ProspectTable 
                prospects={prospects.slice(0, 5)} 
                onCall={handleCall} 
                onUpload={handleUpload}
                onDelete={handleDeleteProspect}
                onUpdate={handleUpdateProspect}
              />
            </div>
          </>
        );
      case 'prospects':
        return (
          <>
            <div className="mb-6 flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Prospects</h2>
                <p className="text-gray-500 dark:text-gray-400">Manage and organize your lead lists.</p>
              </div>
            </div>
            <ProspectTable 
              prospects={prospects} 
              onCall={handleCall}
              onUpload={handleUpload}
              onDelete={handleDeleteProspect}
              onUpdate={handleUpdateProspect}
            />
          </>
        );
      case 'power-dialer':
          return <PowerDialer 
            key={user?.id || 'no-user'}  // Force remount when user changes
            queue={powerDialerQueue} 
            onCall={handleCall} 
            disabled={!isVoiceReady} 
            dispositionSaved={powerDialerDispositionSaved}
            setDispositionSaved={setPowerDialerDispositionSaved}
            onDeleteProspect={handleDeleteProspect}
            onUpdateProspect={handleUpdateProspect}
            powerDialerPaused={powerDialerPausedByWrapUp}
            setPowerDialerPaused={setPowerDialerPausedByWrapUp}
            openImportModal={openImportModal}
            onImportModalClose={() => setOpenImportModal(false)}
            currentUser={user}
          />;
      case 'manual-dialer':
        return <ManualDialer onCall={handleManualCall} disabled={!isVoiceReady} />;
      case 'history':
        return <CallHistoryAdvanced currentUser={user} />;
      case 'team-management':
        return <Suspense fallback={<LoadingSpinner />}><TeamManagement currentUser={user} /></Suspense>;
      case 'profile':
        return user ? (
          <UserProfile 
            user={user}
            onBack={() => setCurrentView('dashboard')}
            onUpdate={setUser}
          />
        ) : null;
      case 'lead-lists':
        return <Suspense fallback={<LoadingSpinner />}>
          <LeadListManager 
            prospects={prospects} 
            teamMembers={teamMembers} 
            openImportModal={openImportModal}
            onImportModalClose={() => setOpenImportModal(false)}
            currentUser={user}
          />
        </Suspense>;
      case 'sales-floor':
        return <SalesFloor teamMembers={teamMembers} />;
      case 'messages':
        return <Messages currentUser={user} />;
      case 'training':
        return <Suspense fallback={<LoadingSpinner />}><Training /></Suspense>;
      case 'automation':
        return <Suspense fallback={<LoadingSpinner />}><AutomationSettings currentUser={user} /></Suspense>;
      case 'admin-dashboard':
        return <Suspense fallback={<LoadingSpinner />}><AdminDashboard initialSection={adminSection} /></Suspense>;
      default:
        return <div>View not found</div>;
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-full`}>
      {voiceError && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-center py-2 z-50">
          {voiceError}
        </div>
      )}
      {stuckCallError && (
        <div className="fixed top-0 left-0 w-full bg-amber-500 text-white text-center py-3 z-50 flex items-center justify-center gap-4 shadow-lg">
          <span className="font-medium">⚠️ {stuckCallError}</span>
          <button
            onClick={handleForceEndCall}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Phone size={16} className="rotate-[135deg]" />
            End Current Call
          </button>
          <button
            onClick={() => setStuckCallError(null)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm transition-colors"
          >
            ✕ Dismiss
          </button>
        </div>
      )}
      <div className="flex h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
        <aside className="w-20 lg:w-64 bg-slate-900 dark:bg-slate-950 text-white flex flex-col flex-shrink-0 border-r border-slate-800 dark:border-slate-800 transition-all duration-300">
          <div className="p-6 flex items-center justify-center lg:justify-start border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <PhoneCall size={20} className="text-white" />
            </div>
            <span className="ml-3 font-bold text-lg hidden lg:block tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">CreativeCaller</span>
          </div>
          
          <nav className="flex-1 py-6 space-y-2 px-3">
            <NavItem 
              icon={<LayoutGrid size={20} />} 
              label="Dashboard" 
              active={currentView === 'dashboard'} 
              onClick={() => setCurrentView('dashboard')} 
            />
            <NavItem 
              icon={<Users size={20} />} 
              label="Contacts" 
              active={currentView === 'prospects'} 
              onClick={() => setCurrentView('prospects')} 
            />
            <NavItem 
              icon={<Zap size={20} />} 
              label="Power Dialer" 
              active={currentView === 'power-dialer'} 
              onClick={() => setCurrentView('power-dialer')} 
            />
            <NavItem 
              icon={<Keyboard size={20} />} 
              label="Manual Dialer" 
              active={currentView === 'manual-dialer'} 
              onClick={() => setCurrentView('manual-dialer')} 
            />
            <NavItem 
              icon={<History size={20} />} 
              label="Call History" 
              active={currentView === 'history'} 
              onClick={() => setCurrentView('history')} 
            />
            <NavItem 
              icon={<Activity size={20} />} 
              label="Sales Floor" 
              active={currentView === 'sales-floor'} 
              onClick={() => setCurrentView('sales-floor')} 
            />
            <NavItem 
              icon={<List size={20} />} 
              label="Lead Lists" 
              active={currentView === 'lead-lists'} 
              onClick={() => setCurrentView('lead-lists')} 
            />
            <NavItem 
              icon={<MessageSquare size={20} />} 
              label="Messages" 
              active={currentView === 'messages'} 
              onClick={() => setCurrentView('messages')} 
            />
            <NavItem 
              icon={<Sparkles size={20} />} 
              label="Automation" 
              active={currentView === 'automation'} 
              onClick={() => setCurrentView('automation')} 
            />
            <NavItem 
              icon={<GraduationCap size={20} />} 
              label="Training" 
              active={currentView === 'training'} 
              onClick={() => setCurrentView('training')} 
            />
            {user?.role === 'admin' && (
              <>
                <div className="my-2 border-t border-slate-700"></div>
                <NavItem 
                  icon={<Shield size={20} />} 
                  label="Admin Dashboard" 
                  active={currentView === 'admin-dashboard'} 
                  onClick={() => { setCurrentView('admin-dashboard'); setAdminSection('home'); }} 
                />
              </>
            )}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="mb-3 text-center lg:text-left">
              <span className="text-xs text-slate-500">v2.0.0</span>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center justify-center lg:justify-start w-full text-slate-400 hover:text-white transition"
            >
              <LogOut size={20} />
              <span className="ml-3 hidden lg:block">Logout</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative">
          <Header 
            title={currentView === 'prospects' ? 'Contacts' : currentView.replace('-', ' ')}
            user={user}
            isDarkMode={isDarkMode}
            onDarkModeToggle={() => setIsDarkMode(!isDarkMode)}
            onViewProfile={() => setCurrentView('profile')}
            onLogout={handleLogout}
          />

          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
            <div className="max-w-7xl mx-auto h-full">
              {renderContent()}
            </div>
          </div>
        </main>
      </div>

      {/* Global Incoming Call Notification */}
      <IncomingCallNotification 
        onCallAnswered={async (callControlId) => {
          console.log('📞 Incoming call answered, establishing WebRTC audio:', callControlId);
          
          // Give the WebRTC client a moment to receive the transferred call
          // The backend transfer happens first, then the WebRTC client receives the call
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
            // Now answer the call in the WebRTC client to establish audio
            await telnyxService.answerIncomingCall(callControlId);
            console.log('✅ WebRTC audio connection established');
            
            // Set active inbound call and show the active call UI
            setActiveInboundCall({
              callControlId,
              fromNumber: 'Unknown',
              fromName: 'Incoming Call'
            });
          } catch (error) {
            console.error('❌ Failed to establish WebRTC audio:', error);
            alert('Call answered on phone network, but WebRTC audio connection failed: ' + 
                  (error instanceof Error ? error.message : 'Unknown error') + 
                  '\n\nThe call may still be active on the phone network.');
          }
        }}
      />

      {/* Active Inbound Call UI */}
      {activeInboundCall && (
        <InboundCallActive
          callControlId={activeInboundCall.callControlId}
          fromNumber={activeInboundCall.fromNumber}
          fromName={activeInboundCall.fromName}
          onCallEnded={() => {
            setActiveInboundCall(null);
            setCurrentView('dashboard');
          }}
        />
      )}
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authKey, setAuthKey] = useState<string>('');

  useEffect(() => {
    const checkAuth = async () => {
      const token = backendAPI.getAuthToken();
      if (token) {
        const user = await backendAPI.getCurrentUser();
        setIsAuthenticated(!!user);
        // Set a unique key based on token to force remount on re-login
        setAuthKey(token.slice(-10));
      } else {
        setIsAuthenticated(false);
        setAuthKey('');
      }
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Use authKey to force Dashboard remount when user re-authenticates
  return isAuthenticated ? <div key={authKey}>{children}</div> : <Navigate to="/login" />;
};

const App: React.FC = () => {
  // Detect if we're running in /dev subdirectory
  const basename = window.location.pathname.startsWith('/dev') ? '/dev' : '';
  
  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    className={`w-full flex items-center justify-center lg:justify-start px-4 py-3 rounded-lg transition-all duration-200 ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    onClick={onClick}
  >
    {icon}
    <span className="ml-3 font-medium hidden lg:block">{label}</span>
  </button>
);

export default App;
