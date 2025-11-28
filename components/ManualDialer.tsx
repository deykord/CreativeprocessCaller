import React, { useState } from 'react';
import { Phone, Delete } from 'lucide-react';

interface Props {
  onCall: (phoneNumber: string) => void;
}

export const ManualDialer: React.FC<Props> = ({ onCall }) => {
  const [number, setNumber] = useState('');

  const handleDigit = (digit: string) => {
    setNumber(prev => prev + digit);
  };

  const handleBackspace = () => {
    setNumber(prev => prev.slice(0, -1));
  };

  const handleCall = () => {
    if (number.length > 3) {
      onCall(number);
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 w-full max-w-sm transition-colors duration-200">
        <div className="mb-8 relative">
          <input
            type="text"
            value={number}
            readOnly
            placeholder="Enter number..."
            className="w-full text-3xl font-bold text-center text-gray-800 dark:text-white bg-transparent border-b-2 border-gray-100 dark:border-slate-600 pb-2 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {number.length > 0 && (
            <button 
              onClick={handleBackspace}
              className="absolute right-0 top-2 text-gray-400 hover:text-red-500 transition"
            >
              <Delete size={24} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {keys.map((key) => (
            <button
              key={key}
              onClick={() => handleDigit(key)}
              className="w-16 h-16 rounded-full bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 active:bg-blue-50 dark:active:bg-slate-600 text-xl font-semibold text-gray-700 dark:text-white transition flex items-center justify-center shadow-sm"
            >
              {key}
            </button>
          ))}
        </div>

        <button
          onClick={handleCall}
          disabled={number.length < 3}
          className={`w-full py-4 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg transition transform active:scale-95 ${
            number.length < 3 
              ? 'bg-gray-300 dark:bg-slate-600 cursor-not-allowed' 
              : 'bg-green-500 hover:bg-green-600 shadow-green-200 dark:shadow-green-900/20'
          }`}
        >
          <Phone className="mr-2" size={24} fill="white" />
          Call
        </button>
      </div>
    </div>
  );
};