import React, { useEffect, useState } from 'react';
import { twilioService } from '../services/mockTwilio';
import { TwilioPhoneNumber } from '../types';
import { Check, RefreshCw, Smartphone, Server } from 'lucide-react';

interface Props {
  currentCallerId: string | null;
  onSetCallerId: (number: string) => void;
}

export const Settings: React.FC<Props> = ({ currentCallerId, onSetCallerId }) => {
  const [numbers, setNumbers] = useState<TwilioPhoneNumber[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNumbers = async () => {
    setLoading(true);
    try {
      const nums = await twilioService.getIncomingPhoneNumbers();
      setNumbers(nums);
      // Default to first number if none selected
      if (!currentCallerId && nums.length > 0) {
        onSetCallerId(nums[0].phoneNumber);
      }
    } catch (err) {
      console.error("Failed to fetch numbers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNumbers();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h2>
      
      {/* System Status Mock */}
      <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900 rounded-xl flex items-center">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-full mr-3">
          <Server size={18} className="text-emerald-600 dark:text-emerald-300" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">System Operational</h4>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Frontend connected to Mock Service Layer. (Ready for Backend Integration)</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
        <div className="p-6 border-b border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Outbound Caller ID</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select the phone number that appears on the recipient's caller ID.</p>
        </div>
        
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Available Numbers</label>
            <button 
              onClick={fetchNumbers} 
              className="text-blue-600 dark:text-blue-400 text-sm flex items-center hover:underline"
              disabled={loading}
            >
              <RefreshCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh from Twilio
            </button>
          </div>

          {loading && numbers.length === 0 ? (
            <div className="py-8 text-center text-gray-400">Loading numbers...</div>
          ) : (
            <div className="space-y-3">
              {numbers.map((num) => (
                <div 
                  key={num.sid}
                  onClick={() => onSetCallerId(num.phoneNumber)}
                  className={`relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    currentCallerId === num.phoneNumber 
                      ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/30' 
                      : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${
                     currentCallerId === num.phoneNumber ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <div className="font-mono font-medium text-gray-900 dark:text-white">{num.friendlyName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">SID: {num.sid}</div>
                  </div>
                  
                  {currentCallerId === num.phoneNumber && (
                    <div className="absolute right-4 text-blue-600 dark:text-blue-400">
                      <Check size={20} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-gray-50 dark:bg-slate-750 p-4 border-t border-gray-100 dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400 flex items-start">
          <div className="mr-2 mt-0.5">ℹ️</div>
          <p>
            Numbers listed here are fetched directly from your Twilio account via the <code>IncomingPhoneNumbers</code> API. 
            To add more numbers, purchase them in your Twilio Console.
          </p>
        </div>
      </div>
    </div>
  );
};