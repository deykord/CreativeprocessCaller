import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { DashboardStats } from './components/DashboardStats';
import { ProspectTable } from './components/ProspectTable';
import { ActiveCallInterface } from './components/ActiveCallInterface';
import { ManualDialer } from './components/ManualDialer';
import PowerDialer from './components/PowerDialer';
import { Settings } from './components/Settings';
import { CallHistory } from './components/CallHistory';
import { Header } from './components/Header';
import { Login } from './components/Login';
import UserProfile from './components/UserProfile';
import { SalesFloor } from './components/SalesFloor';
import { Prospect, CallState, AgentStats, CallLog, User, TwilioPhoneNumber } from './types';
import { INITIAL_PROSPECTS, INITIAL_STATS } from './constants';
import { LayoutGrid, Users, Phone, Settings as SettingsIcon, LogOut, Bell, History, Zap, Keyboard, Sun, Moon, List, Activity } from 'lucide-react';

// SERVICES
import { liveTwilioService } from './services/LiveTwilioService';
import { backendAPI } from './services/BackendAPI';

// Lazy load heavy components
const LeadListManager = React.lazy(() => import('./components/LeadListManager').then(m => ({ default: m.LeadListManager })));
const TeamManagement = React.lazy(() => import('./components/TeamManagement').then(m => ({ default: m.TeamManagement })));

// Loading fallback component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
  </div>
);

// --- CONFIGURATION ---
const USE_BACKEND = true;
const activeTwilioService = liveTwilioService;


type View = 'dashboard' | 'prospects' | 'power-dialer' | 'manual-dialer' | 'history' | 'settings' | 'team-management' | 'profile' | 'lead-lists' | 'sales-floor';

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
  const [isTwilioReady, setIsTwilioReady] = useState(false);
  const [twilioError, setTwilioError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [twilioNumbers, setTwilioNumbers] = useState<TwilioPhoneNumber[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

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
          activeTwilioService.registerTokenRefresh(async () => {
            const token = await backendAPI.getToken('agent_1');
            return token;
          });

          const token = await backendAPI.getToken('agent_1');
          await activeTwilioService.initialize(token);
        } else {
          activeTwilioService.initialize('mock-token');
        }

        activeTwilioService.registerStatusCallback((stateInfo) => {
          setCurrentCall((prev) => prev ? { ...prev, state: stateInfo.state } : null);
        });
        setIsTwilioReady(true);
        setTwilioError(null);
      } catch (err) {
        console.error("Initialization Failed:", err);
        setIsTwilioReady(false);
        setTwilioError("Twilio initialization failed. Please refresh or contact support.");
      }
    };
    initSystem();
  }, []);

  const handleCall = async (prospect: Prospect) => {
    if (!isTwilioReady) {
      alert("Twilio is not ready. Please wait for initialization.");
      return;
    }
    try {
      setCurrentCall({ prospect, state: CallState.DIALING, startTime: Date.now() });
      await activeTwilioService.connect(prospect.phone, callerId || undefined);
      setStats(prev => ({ ...prev, callsMade: prev.callsMade + 1 }));
    } catch (err: any) {
      console.error("Call failed", err);
      
      // Check for specific error types and provide user-friendly messages
      let errorMessage = "Call failed to connect. Please try again.";
      
      // Check for duplicate call / already connected errors
      if (err?.message?.toLowerCase().includes('pending') || 
          err?.message?.toLowerCase().includes('already') ||
          err?.code === 31002 || // Device is currently disconnecting
          err?.code === 31003) { // Device is currently connecting to a call
        errorMessage = "⚠️ Please wait - a call is already in progress. Complete the current call before dialing again.";
      } else if (err?.code === 31204) { // Invalid phone number
        errorMessage = "❌ Invalid phone number format. Please check the number and try again.";
      } else if (err?.code === 20003) { // Auth error
        errorMessage = "❌ Authentication error. Please refresh the page and try again.";
      } else if (err?.message) {
        errorMessage = `Call failed: ${err.message}`;
      }
      
      alert(errorMessage);
      setCurrentCall(null);
      // Only set dispositionSaved, let PowerDialer handle advance
      setPowerDialerDispositionSaved(true);
    }
  };

  const handleManualCall = async (phoneNumber: string) => {
    if (!isTwilioReady) {
      alert("Twilio is not ready. Please wait for initialization.");
      return;
    }
    const manualProspect: Prospect = {
      id: `manual-${Date.now()}`,
      firstName: 'Manual',
      lastName: 'Dial',
      company: 'Unknown',
      title: 'Unknown',
      phone: phoneNumber,
      email: '',
      status: 'New',
      timezone: 'Unknown'
    };
    handleCall(manualProspect);
  };

  const handleHangup = () => {
    activeTwilioService.disconnect();
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
            if (header.includes('first')) data.firstName = values[i];
            else if (header.includes('last')) data.lastName = values[i];
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

  const powerDialerQueue = prospects.filter(p => p.status === 'New');

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
            queue={powerDialerQueue} 
            onCall={handleCall} 
            disabled={!isTwilioReady} 
            dispositionSaved={powerDialerDispositionSaved}
            setDispositionSaved={setPowerDialerDispositionSaved}
            onDeleteProspect={handleDeleteProspect}
            onUpdateProspect={handleUpdateProspect}
            powerDialerPaused={powerDialerPausedByWrapUp}
            setPowerDialerPaused={setPowerDialerPausedByWrapUp}
          />;
      case 'manual-dialer':
        return <ManualDialer onCall={handleManualCall} disabled={!isTwilioReady} />;
      case 'history':
        return <CallHistory history={callHistory} />;
      case 'settings':
        return (
          <Settings 
            currentCallerId={callerId} 
            onSetCallerId={setCallerId} 
          />
        );
      case 'team-management':
        return <Suspense fallback={<LoadingSpinner />}><TeamManagement /></Suspense>;
      case 'profile':
        return user ? (
          <UserProfile 
            user={user}
            onBack={() => setCurrentView('dashboard')}
            onUpdate={setUser}
          />
        ) : null;
      case 'lead-lists':
        return <Suspense fallback={<LoadingSpinner />}><LeadListManager prospects={prospects} teamMembers={teamMembers} /></Suspense>;
      case 'sales-floor':
        return <SalesFloor teamMembers={teamMembers} />;
      default:
        return <div>View not found</div>;
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-full`}>
      {twilioError && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-center py-2 z-50">
          {twilioError}
        </div>
      )}
      <div className="flex h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
        <aside className="w-20 lg:w-64 bg-slate-900 dark:bg-slate-950 text-white flex flex-col flex-shrink-0 border-r border-slate-800 dark:border-slate-800 transition-all duration-300">
          <div className="p-6 flex items-center justify-center lg:justify-start border-b border-slate-800">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl text-white">C</div>
            <span className="ml-3 font-bold text-lg hidden lg:block tracking-tight">Creativeprocess.io</span>
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
              label="Prospects" 
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
              icon={<SettingsIcon size={20} />} 
              label="Settings" 
              active={currentView === 'settings'} 
              onClick={() => setCurrentView('settings')} 
            />
            {user?.role === 'admin' && (
              <>
                <div className="my-2 border-t border-slate-700"></div>
                <NavItem 
                  icon={<Users size={20} />} 
                  label="Team Management" 
                  active={currentView === 'team-management'} 
                  onClick={() => setCurrentView('team-management')} 
                />
              </>
            )}
          </nav>

          <div className="p-4 border-t border-slate-800">
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
            title={currentView.replace('-', ' ')}
            user={user}
            isDarkMode={isDarkMode}
            onDarkModeToggle={() => setIsDarkMode(!isDarkMode)}
            callerId={callerId}
            onCallerIdChange={setCallerId}
            twilioNumbers={twilioNumbers}
            onViewProfile={() => setCurrentView('profile')}
            onStartSession={() => setCurrentView('power-dialer')}
            showStartSession={currentView !== 'power-dialer'}
          />

          {/* Active Call Bar - Only show outside Power Dialer view (Power Dialer has inline call UI like Orum) */}
          {currentCall && currentView !== 'power-dialer' && (
            <ActiveCallInterface 
              prospect={currentCall.prospect}
              callState={currentCall.state}
              onHangup={handleHangup}
              onSaveDisposition={handleSaveDisposition}
              powerDialerPaused={powerDialerPausedByWrapUp}
              setPowerDialerPaused={setPowerDialerPausedByWrapUp}
            />
          )}

          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
            <div className="max-w-7xl mx-auto h-full">
              {renderContent()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = backendAPI.getAuthToken();
      if (token) {
        const user = await backendAPI.getCurrentUser();
        setIsAuthenticated(!!user);
      } else {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
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
