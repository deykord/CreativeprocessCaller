import React, { useRef, useCallback, useMemo, useState } from 'react';
import { Prospect } from '../types';
import { Phone, MoreHorizontal, MapPin, Upload, Filter, Search, ChevronDown, Star, FileText, Mail, Clock } from 'lucide-react';

interface Props {
  prospects: Prospect[];
  onCall: (prospect: Prospect) => void;
  onUpload: (file: File) => void;
}

// FEATURE 1: Enhanced Search and Filter Bar
const SearchFilterBar: React.FC<{ 
  onSearch: (term: string) => void;
  onFilter: (status: string) => void;
  totalProspects: number;
}> = React.memo(({ onSearch, onFilter, totalProspects }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, company, or phone..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              onSearch(e.target.value);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 transition"
        >
          <Filter size={16} />
          <span>Filters</span>
        </button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
          <button onClick={() => onFilter('')} className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">All</button>
          <button onClick={() => onFilter('New')} className="px-3 py-2 bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition">New</button>
          <button onClick={() => onFilter('Contacted')} className="px-3 py-2 bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition">Contacted</button>
          <button onClick={() => onFilter('Qualified')} className="px-3 py-2 bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition">Qualified</button>
          <button onClick={() => onFilter('Lost')} className="px-3 py-2 bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition">Lost</button>
        </div>
      )}
    </div>
  );
});

// FEATURE 2: Enhanced Row with Quick Actions
const ProspectRowEnhanced = React.memo(({ 
  prospect, 
  onCall,
  isFavorite,
  onToggleFavorite
}: { 
  prospect: Prospect;
  onCall: (p: Prospect) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'New': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
      case 'Contacted': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
      case 'Qualified': return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
      case 'Lost': return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <tr className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition duration-150 group">
      <td className="p-4">
        <button
          onClick={() => onToggleFavorite(prospect.id)}
          className="inline-block"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={18} className={isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'} />
        </button>
      </td>
      <td className="p-4">
        <div className="font-semibold text-gray-900 dark:text-white">{prospect.firstName} {prospect.lastName}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Phone size={12} />
          {prospect.phone}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Mail size={12} />
          {prospect.email}
        </div>
      </td>
      <td className="p-4">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-200">{prospect.title}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{prospect.company}</div>
      </td>
      <td className="p-4">
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
          <MapPin size={14} className="mr-1" />
          {prospect.timezone}
        </div>
      </td>
      <td className="p-4">
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(prospect.status)}`}>
          {prospect.status}
        </span>
      </td>
      <td className="p-4">
        {prospect.lastCall ? (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock size={12} />
            {new Date(prospect.lastCall).toLocaleDateString()}
          </div>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-600">No calls</span>
        )}
      </td>
      <td className="p-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onCall(prospect)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 hover:bg-green-600 hover:text-white dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-600 dark:hover:text-white transition shadow-sm"
            title="Call Now"
          >
            <Phone size={14} />
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
            >
              <MoreHorizontal size={16} />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-10">
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700">
                  <FileText size={14} className="inline mr-2" />
                  View Notes
                </button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700">
                  <Mail size={14} className="inline mr-2" />
                  Send Email
                </button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700">
                  Edit Prospect
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
});

// FEATURE 3: Bulk Actions Toolbar
const BulkActionsToolbar: React.FC<{ selectedCount: number; onSelectAll: () => void; onClearSelection: () => void }> = React.memo(({ selectedCount, onSelectAll, onClearSelection }) => {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 p-4 rounded-lg flex items-center justify-between">
      <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
        {selectedCount} prospect{selectedCount !== 1 ? 's' : ''} selected
      </span>
      <div className="flex gap-2">
        <button className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          Add to List
        </button>
        <button className="px-3 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
          Bulk Call
        </button>
        <button onClick={onClearSelection} className="px-3 py-2 text-sm font-medium bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition">
          Clear
        </button>
      </div>
    </div>
  );
});

// FEATURE 4: View Switcher
const ViewSwitcher: React.FC<{ view: 'table' | 'grid'; onViewChange: (view: 'table' | 'grid') => void }> = React.memo(({ view, onViewChange }) => (
  <div className="flex items-center gap-2">
    <button
      onClick={() => onViewChange('table')}
      className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
        view === 'table'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600'
      }`}
    >
      Table
    </button>
    <button
      onClick={() => onViewChange('grid')}
      className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
        view === 'grid'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600'
      }`}
    >
      Grid
    </button>
  </div>
));

// FEATURE 5: Grid Card View
const ProspectCard: React.FC<{ prospect: Prospect; onCall: (p: Prospect) => void; isFavorite: boolean; onToggleFavorite: (id: string) => void }> = React.memo(({ prospect, onCall, isFavorite, onToggleFavorite }) => (
  <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700 hover:shadow-md transition">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900 dark:text-white">{prospect.firstName} {prospect.lastName}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">{prospect.title}</p>
      </div>
      <button
        onClick={() => onToggleFavorite(prospect.id)}
        className="p-1"
      >
        <Star size={18} className={isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'} />
      </button>
    </div>
    
    <div className="space-y-2 mb-4 text-sm">
      <p className="text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Company:</span> {prospect.company}</p>
      <p className="text-gray-600 dark:text-gray-400"><span className="font-medium text-gray-700 dark:text-gray-300">Phone:</span> {prospect.phone}</p>
      <p className="text-gray-600 dark:text-gray-400 flex items-center gap-1"><MapPin size={14} />{prospect.timezone}</p>
    </div>

    <div className="flex items-center justify-between">
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
        prospect.status === 'New' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
        prospect.status === 'Qualified' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
      }`}>
        {prospect.status}
      </span>
      <button
        onClick={() => onCall(prospect)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 hover:bg-green-600 hover:text-white dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-600 transition"
      >
        <Phone size={14} />
      </button>
    </div>
  </div>
));

export const ProspectTableEnhanced: React.FC<Props> = React.memo(({ prospects, onCall, onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'table' | 'grid'>('table');

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

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedProspects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Filter and search prospects
  const filteredProspects = useMemo(() => {
    return prospects.filter(prospect => {
      const matchesSearch = 
        prospect.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prospect.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prospect.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prospect.phone.includes(searchTerm);
      
      const matchesFilter = !filterStatus || prospect.status === filterStatus;
      
      return matchesSearch && matchesFilter;
    });
  }, [prospects, searchTerm, filterStatus]);

  const prospectRows = useMemo(() => 
    filteredProspects.map((prospect) => (
      <ProspectRowEnhanced 
        key={prospect.id} 
        prospect={prospect} 
        onCall={onCall}
        isFavorite={favorites.has(prospect.id)}
        onToggleFavorite={toggleFavorite}
      />
    )),
    [filteredProspects, onCall, favorites, toggleFavorite]
  );

  return (
    <div className="space-y-4">
      {/* Header with Upload and View Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Prospects</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and organize your leads</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewSwitcher view={view} onViewChange={setView} />
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange}
          />
          <button 
            onClick={handleUploadClick}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition shadow-sm"
          >
            <Upload size={16} />
            <span>Import CSV</span>
          </button>
        </div>
      </div>

      {/* FEATURE 1: Search and Filter */}
      <SearchFilterBar 
        onSearch={setSearchTerm}
        onFilter={setFilterStatus}
        totalProspects={filteredProspects.length}
      />

      {/* FEATURE 3: Bulk Actions */}
      <BulkActionsToolbar 
        selectedCount={selectedProspects.size}
        onSelectAll={() => setSelectedProspects(new Set(filteredProspects.map(p => p.id)))}
        onClearSelection={() => setSelectedProspects(new Set())}
      />

      {/* Table or Grid View */}
      {view === 'table' ? (
        // FEATURE 2 & 4: Enhanced Table View
        <div className="bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-4 w-8">
                    <input type="checkbox" className="w-4 h-4" />
                  </th>
                  <th className="p-4 font-semibold">Name</th>
                  <th className="p-4 font-semibold">Title / Company</th>
                  <th className="p-4 font-semibold">Location</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Last Call</th>
                  <th className="p-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {prospectRows}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredProspects.length} of {prospects.length} prospects
            </p>
          </div>
        </div>
      ) : (
        // FEATURE 5: Grid Card View
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProspects.map((prospect) => (
            <ProspectCard
              key={prospect.id}
              prospect={prospect}
              onCall={onCall}
              isFavorite={favorites.has(prospect.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}

      {filteredProspects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No prospects found</p>
          <button 
            onClick={handleUploadClick}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            Import Your First List
          </button>
        </div>
      )}
    </div>
  );
});
