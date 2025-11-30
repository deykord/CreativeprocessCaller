import React, { useRef, useCallback, useMemo } from 'react';
import { Prospect } from '../types';
import { Phone, MoreHorizontal, MapPin, Upload } from 'lucide-react';

interface Props {
  prospects: Prospect[];
  onCall: (prospect: Prospect) => void;
  onUpload: (file: File) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Prospect>) => void;
}

// Memoized row component to prevent unnecessary re-renders
const ProspectRow = React.memo(({ prospect, onCall, onDelete, onUpdate }: { prospect: Prospect; onCall: (p: Prospect) => void; onDelete?: (id: string) => void; onUpdate?: (id: string, updates: Partial<Prospect>) => void }) => (
  <ProspectRowWithMenu prospect={prospect} onCall={onCall} onDelete={onDelete} onUpdate={onUpdate} />
));

// Row with 3-dots menu
const ProspectRowWithMenu = React.memo(({ prospect, onCall, onDelete, onUpdate }: { prospect: Prospect; onCall: (p: Prospect) => void; onDelete?: (id: string) => void; onUpdate?: (id: string, updates: Partial<Prospect>) => void }) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [editProspect, setEditProspect] = React.useState<Prospect | null>(null);
  const user = React.useMemo(() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  }, []);
  
  const canDelete = user?.role === 'admin' || user?.permissions?.canDeleteLeads;
  const canEdit = user?.role === 'admin' || user?.permissions?.canEditLeads;
  return (
    <>
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
        <td className="p-4 text-right relative">
          <button
            onClick={() => onCall(prospect)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 hover:bg-green-600 hover:text-white dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-600 dark:hover:text-white transition shadow-sm mr-2"
            title="Call Now"
          >
            <Phone size={14} />
          </button>
          <button className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition" onClick={() => setShowMenu(!showMenu)}>
            <MoreHorizontal size={16} />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-10">
              <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700" onClick={() => { setShowModal(true); setShowMenu(false); }}>View Info</button>
              {canEdit && <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700" onClick={() => { setEditMode(true); setEditProspect(prospect); setShowModal(true); setShowMenu(false); }}>Edit</button>}
              {canDelete && <button className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}>Delete</button>}
            </div>
          )}
        </td>
      </tr>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 w-full max-w-md relative">
            <button className="absolute top-3 right-3 text-gray-500 dark:text-gray-300" onClick={() => { setShowModal(false); setEditMode(false); }}>
              ×
            </button>
            {!editMode ? (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Lead Info</h3>
                <div className="space-y-2 mb-4">
                  <p><span className="font-semibold">Name:</span> {prospect.firstName} {prospect.lastName}</p>
                  <p><span className="font-semibold">Title:</span> {prospect.title}</p>
                  <p><span className="font-semibold">Company:</span> {prospect.company}</p>
                  <p><span className="font-semibold">Phone:</span> {prospect.phone}</p>
                  <p><span className="font-semibold">Email:</span> {prospect.email}</p>
                  <p><span className="font-semibold">Status:</span> {prospect.status}</p>
                  <p><span className="font-semibold">Timezone:</span> {prospect.timezone}</p>
                  {prospect.notes && <p><span className="font-semibold">Notes:</span> {prospect.notes}</p>}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Edit Lead</h3>
                <form className="space-y-2" onSubmit={e => { 
                  e.preventDefault(); 
                  if (onUpdate && editProspect) {
                    const { id, ...updates } = editProspect;
                    onUpdate(prospect.id, updates);
                  }
                  setShowModal(false); 
                  setEditMode(false); 
                }}>
                  <input type="text" className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.firstName || ''} onChange={e => setEditProspect(p => p ? { ...p, firstName: e.target.value } : p)} placeholder="First Name" />
                  <input type="text" className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.lastName || ''} onChange={e => setEditProspect(p => p ? { ...p, lastName: e.target.value } : p)} placeholder="Last Name" />
                  <input type="text" className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.title || ''} onChange={e => setEditProspect(p => p ? { ...p, title: e.target.value } : p)} placeholder="Title" />
                  <input type="text" className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.company || ''} onChange={e => setEditProspect(p => p ? { ...p, company: e.target.value } : p)} placeholder="Company" />
                  <input type="text" className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.phone || ''} onChange={e => setEditProspect(p => p ? { ...p, phone: e.target.value } : p)} placeholder="Phone" />
                  <input type="email" className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.email || ''} onChange={e => setEditProspect(p => p ? { ...p, email: e.target.value } : p)} placeholder="Email" />
                  <select className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.status || ''} onChange={e => setEditProspect(p => p ? { ...p, status: e.target.value as any } : p)}>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Lost">Lost</option>
                    <option value="Do Not Call">Do Not Call</option>
                  </select>
                  <textarea className="w-full px-3 py-2 rounded border dark:bg-slate-700 dark:text-white" value={editProspect?.notes || ''} onChange={e => setEditProspect(p => p ? { ...p, notes: e.target.value } : p)} placeholder="Notes" />
                  <div className="flex gap-2 mt-2">
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save</button>
                    <button type="button" className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500" onClick={() => { setEditMode(false); setShowModal(false); }}>Cancel</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Delete Lead</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete <strong>{prospect.firstName} {prospect.lastName}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (onDelete) onDelete(prospect.id);
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export const ProspectTable: React.FC<Props> = React.memo(({ prospects, onCall, onUpload, onDelete, onUpdate }) => {
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
      <ProspectRow key={prospect.id} prospect={prospect} onCall={onCall} onDelete={onDelete} onUpdate={onUpdate} />
    )),
    [prospects, onCall, onDelete, onUpdate]
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