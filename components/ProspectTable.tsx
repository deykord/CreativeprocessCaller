import React, { useRef, useCallback, useMemo } from 'react';
import { Prospect } from '../types';
import { Phone, MoreHorizontal, MapPin, Upload } from 'lucide-react';

interface Props {
  prospects: Prospect[];
  onCall: (prospect: Prospect) => void;
  onUpload: (file: File) => void;
}

// Memoized row component to prevent unnecessary re-renders
const ProspectRow = React.memo(({ prospect, onCall }: { prospect: Prospect; onCall: (p: Prospect) => void }) => (
  <tr className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition duration-150 group">
    <td className="p-4">
      <div className="font-semibold text-gray-900 dark:text-white">{prospect.firstName} {prospect.lastName}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{prospect.phone}</div>
    </td>
    <td className="p-4">
      <div className="text-sm text-gray-900 dark:text-gray-200">{prospect.title}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{prospect.company}</div>
    </td>
    <td className="p-4">
      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
        <MapPin size={14} className="mr-1" />
        {prospect.timezone}
      </div>
    </td>
    <td className="p-4">
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
        prospect.status === 'New' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
        prospect.status === 'Qualified' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
      }`}>
        {prospect.status}
      </span>
    </td>
    <td className="p-4 text-right">
      <button
        onClick={() => onCall(prospect)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 hover:bg-green-600 hover:text-white dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-600 dark:hover:text-white transition shadow-sm mr-2"
        title="Call Now"
      >
        <Phone size={14} />
      </button>
      <button className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
        <MoreHorizontal size={16} />
      </button>
    </td>
  </tr>
));

export const ProspectTable: React.FC<Props> = React.memo(({ prospects, onCall, onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUpload(file);
      event.target.value = '';
    }
  }, [onUpload]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Memoize prospect rows
  const prospectRows = useMemo(() => 
    prospects.map((prospect) => (
      <ProspectRow key={prospect.id} prospect={prospect} onCall={onCall} />
    )),
    [prospects, onCall]
  );

  return (
    <div className="bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden transition-colors duration-200">
      <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Priority Lists</h2>
          <span className="text-xs font-medium px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">{prospects.length} leads</span>
        </div>
        
        <div>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange}
          />
          <button 
            onClick={handleUploadClick}
            className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 transition shadow-sm"
          >
            <Upload size={16} />
            <span>Import CSV</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold">Name</th>
              <th className="p-4 font-semibold">Title / Company</th>
              <th className="p-4 font-semibold">Location</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {prospectRows}
          </tbody>
        </table>
      </div>
    </div>
  );
});