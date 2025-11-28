import React, { useState } from 'react';
import { Prospect } from '../types';
import { Play, SkipForward, Pause, Phone } from 'lucide-react';

interface Props {
  queue: Prospect[];
  onCall: (prospect: Prospect) => void;
}

export const PowerDialer: React.FC<Props> = ({ queue, onCall }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentProspect = queue[currentIndex];

  const handleStart = () => {
    setIsActive(true);
    if (currentProspect) {
      onCall(currentProspect);
    }
  };

  const handleSkip = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
          <Play size={32} className="text-gray-400 dark:text-slate-500 ml-1" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Queue is Empty</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          There are no prospects with "New" status to call. Add more prospects or reset statuses to start a power dialing session.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Power Dialer Session</h2>
          <p className="text-gray-500 dark:text-gray-400">{queue.length} prospects in queue • {currentIndex + 1} of {queue.length}</p>
        </div>
        <div className="flex space-x-3">
          {!isActive ? (
            <button
              onClick={handleStart}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-blue-900/30 transition"
            >
              <Play size={20} className="mr-2 fill-current" />
              Start Session
            </button>
          ) : (
            <button
              onClick={() => setIsActive(false)}
              className="flex items-center px-6 py-3 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 shadow-lg shadow-amber-200 dark:shadow-amber-900/30 transition"
            >
              <Pause size={20} className="mr-2 fill-current" />
              Pause
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row transition-colors duration-200">
        {/* Left: Queue List */}
        <div className="w-full md:w-1/3 border-r border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 overflow-y-auto">
          <div className="p-4 uppercase text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider">Up Next</div>
          {queue.map((p, idx) => (
            <div 
              key={p.id}
              className={`p-4 border-b border-gray-100 dark:border-slate-700 transition ${
                idx === currentIndex 
                  ? 'bg-white dark:bg-slate-800 border-l-4 border-l-blue-500 shadow-sm' 
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <div className="font-semibold text-gray-900 dark:text-white truncate">{p.firstName} {p.lastName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.company}</div>
            </div>
          ))}
        </div>

        {/* Right: Current Focus */}
        <div className="w-full md:w-2/3 p-8 flex flex-col justify-center items-center text-center">
          <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 font-bold text-3xl">
            {currentProspect.firstName[0]}{currentProspect.lastName[0]}
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {currentProspect.firstName} {currentProspect.lastName}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-1">{currentProspect.title}</p>
          <p className="text-blue-600 dark:text-blue-400 font-medium mb-8">{currentProspect.company}</p>

          <div className="grid grid-cols-2 gap-8 w-full max-w-md mb-8">
            <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded-xl">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Phone</div>
              <div className="font-mono text-gray-900 dark:text-white">{currentProspect.phone}</div>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded-xl">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Location</div>
              <div className="text-gray-900 dark:text-white">{currentProspect.timezone}</div>
            </div>
          </div>

          <div className="flex space-x-4 w-full max-w-sm">
            <button
              onClick={() => handleSkip()}
              className="flex-1 py-3 px-4 border border-gray-300 dark:border-slate-600 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition flex items-center justify-center"
            >
              <SkipForward size={18} className="mr-2" />
              Skip
            </button>
            <button
              onClick={() => onCall(currentProspect)}
              className="flex-1 py-3 px-4 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 shadow-lg shadow-green-200 dark:shadow-green-900/30 transition flex items-center justify-center"
            >
              <Phone size={18} className="mr-2 fill-current" />
              Call Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};