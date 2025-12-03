import React, { useState, useEffect, useRef } from 'react';
import { LeadList, LeadListPermission, User, Prospect } from '../types';
import { backendAPI } from '../services/BackendAPI';
import { Plus, Trash2, Share2, Eye, Edit, Lock, Users, Upload, FileText, CheckCircle, X, ArrowRight, ArrowLeft, AlertTriangle, Loader2, Check, Square, CheckSquare } from 'lucide-react';

// Define prospect fields that can be mapped
const PROSPECT_FIELDS = [
  { key: 'firstName', label: 'First Name', required: false },
  { key: 'lastName', label: 'Last Name', required: false },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'company', label: 'Company', required: false },
  { key: 'title', label: 'Title', required: false },
  { key: 'timezone', label: 'Timezone', required: false },
  { key: 'notes', label: 'Notes', required: false },
] as const;

type FieldMapping = Record<string, string>; // csvHeader -> prospectField

interface Props {
  prospects?: any[];
  teamMembers?: User[];
  openImportModal?: boolean;
  onImportModalClose?: () => void;
}

export const LeadListManager: React.FC<Props> = ({ prospects = [], teamMembers = [], openImportModal = false, onImportModalClose }) => {
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [permissions, setPermissions] = useState<Map<string, LeadListPermission[]>>(new Map());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedList, setSelectedList] = useState<LeadList | null>(null);
  const [selectedListForDelete, setSelectedListForDelete] = useState<LeadList | null>(null);
  const [selectedLeadForDelete, setSelectedLeadForDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  // Bulk selection state
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Map<string, Set<string>>>(new Map()); // listId -> Set of prospectIds
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [newListData, setNewListData] = useState({
    name: '',
    description: '',
    selectedProspects: [] as string[],
  });

  const [permissionData, setPermissionData] = useState({
    targetUserId: '',
    canView: true,
    canEdit: false,
  });

  // CSV Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importListName, setImportListName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Field Mapping State (Step 2)
  const [fieldMappings, setFieldMappings] = useState<FieldMapping>({});
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);

  // Import Preview State (Step 3)
  const [previewData, setPreviewData] = useState<Partial<Prospect>[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });

  // Duplicate Detection State
  interface DuplicateRow {
    rowIndex: number;
    prospect: Partial<Prospect>;
    duplicateType: 'internal' | 'database';
    duplicateInfo?: {
      field: 'phone' | 'email';
      conflictingValue: string;
      existingRecord?: Prospect;
    };
    selected: boolean;
  }
  const [duplicates, setDuplicates] = useState<DuplicateRow[]>([]);
  const [allDuplicatesSelected, setAllDuplicatesSelected] = useState(false);

  // Load lead lists
  useEffect(() => {
    setIsMounted(true);
    loadLeadLists();
    return () => {
      setIsMounted(false);
    };
  }, []);

  // Handle openImportModal prop from parent
  useEffect(() => {
    if (openImportModal) {
      setShowImportModal(true);
      // Reset the prop via callback
      onImportModalClose?.();
    }
  }, [openImportModal, onImportModalClose]);

  const loadLeadLists = async () => {
    try {
      setLoading(true);
      setError(null);
      const lists = await backendAPI.getLeadLists();
      
      if (!isMounted) return; // Don't update state if component unmounted

      setLeadLists(lists);
      // Note: Permissions are now fetched only when user clicks "Share" button
      // This eliminates the N+1 request problem
    } catch (err) {
      console.error('Failed to load lead lists:', err);
      if (isMounted) {
        setError('Failed to load lead lists');
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  // Load permissions only when opening the share modal
  const loadListPermissions = async (listId: string) => {
    try {
      const perms = await backendAPI.getLeadListPermissions(listId);
      setPermissions(prev => {
        const newMap = new Map(prev);
        newMap.set(listId, perms);
        return newMap;
      });
    } catch (err) {
      console.error('Failed to load permissions:', err);
      setPermissions(prev => {
        const newMap = new Map(prev);
        newMap.set(listId, []);
        return newMap;
      });
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListData.name.trim()) {
      setError('List name is required');
      return;
    }

    try {
      const prospectIds = newListData.selectedProspects.length > 0 
        ? newListData.selectedProspects 
        : [];
      
      await backendAPI.createLeadList(
        newListData.name,
        newListData.description,
        prospectIds
      );

      setNewListData({ name: '', description: '', selectedProspects: [] });
      setShowCreateModal(false);
      await loadLeadLists();
    } catch (err) {
      console.error('Failed to create lead list:', err);
      setError('Failed to create lead list');
    }
  };

  const handleDeleteList = async (listId: string) => {
    setSelectedListForDelete(leadLists.find(l => l.id === listId) || null);
    setShowDeleteModal(true);
  };

  const confirmDeleteList = async () => {
    if (!selectedListForDelete) return;

    try {
      setIsDeleting(true);
      setError(null);
      
      await backendAPI.deleteLeadList(selectedListForDelete.id);
      
      if (isMounted) {
        setSuccess(`Lead list "${selectedListForDelete.name}" deleted successfully`);
        setShowDeleteModal(false);
        setSelectedListForDelete(null);
        
        // Update state immediately instead of reloading
        setLeadLists(prev => prev.filter(l => l.id !== selectedListForDelete.id));
        setPermissions(prev => {
          const newMap = new Map(prev);
          newMap.delete(selectedListForDelete.id);
          return newMap;
        });
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          if (isMounted) setSuccess(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to delete lead list:', err);
      if (isMounted) {
        setError('Failed to delete lead list');
      }
    } finally {
      if (isMounted) {
        setIsDeleting(false);
      }
    }
  };

  const handleDeleteLeadFromList = async (listId: string, leadId: string) => {
    if (!window.confirm('Remove this lead from the list?')) return;

    try {
      setError(null);
      const list = leadLists.find(l => l.id === listId);
      if (!list) return;

      // Update the list by removing the prospect
      const updatedProspectIds = list.prospectIds.filter(id => id !== leadId);
      await backendAPI.updateLeadList(listId, { prospectIds: updatedProspectIds });
      
      if (isMounted) {
        setSuccess('Lead removed from list');
        // Update local state
        setLeadLists(prev => prev.map(l => 
          l.id === listId 
            ? { ...l, prospectIds: updatedProspectIds, prospectCount: updatedProspectIds.length }
            : l
        ));
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          if (isMounted) setSuccess(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to delete lead from list:', err);
      if (isMounted) {
        setError('Failed to remove lead from list');
      }
    }
  };

  // Bulk selection helpers
  const toggleLeadSelection = (listId: string, prospectId: string) => {
    setSelectedLeads(prev => {
      const newMap = new Map(prev);
      const listSelections = new Set(newMap.get(listId) || []);
      
      if (listSelections.has(prospectId)) {
        listSelections.delete(prospectId);
      } else {
        listSelections.add(prospectId);
      }
      
      newMap.set(listId, listSelections);
      return newMap;
    });
  };

  const selectAllLeadsInList = (listId: string, prospectIds: string[]) => {
    setSelectedLeads(prev => {
      const newMap = new Map(prev);
      newMap.set(listId, new Set(prospectIds));
      return newMap;
    });
  };

  const deselectAllLeadsInList = (listId: string) => {
    setSelectedLeads(prev => {
      const newMap = new Map(prev);
      newMap.set(listId, new Set());
      return newMap;
    });
  };

  const getSelectedCount = (listId: string): number => {
    return selectedLeads.get(listId)?.size || 0;
  };

  const isLeadSelected = (listId: string, prospectId: string): boolean => {
    return selectedLeads.get(listId)?.has(prospectId) || false;
  };

  const handleBulkDeleteLeads = async (listId: string) => {
    const selectedIds = Array.from(selectedLeads.get(listId) || []);
    if (selectedIds.length === 0) {
      setError('No leads selected');
      return;
    }

    if (!window.confirm(`Remove ${selectedIds.length} lead(s) from this list?`)) return;

    try {
      setIsBulkDeleting(true);
      setError(null);
      
      const result = await backendAPI.removeProspectsFromList(listId, selectedIds);
      
      if (isMounted) {
        setSuccess(`${result.removedCount} lead(s) removed from list`);
        
        // Update local state
        setLeadLists(prev => prev.map(l => {
          if (l.id === listId) {
            const updatedProspectIds = l.prospectIds.filter(id => !selectedIds.includes(id));
            return { ...l, prospectIds: updatedProspectIds, prospectCount: updatedProspectIds.length };
          }
          return l;
        }));
        
        // Clear selections for this list
        deselectAllLeadsInList(listId);
        
        setTimeout(() => {
          if (isMounted) setSuccess(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to bulk delete leads:', err);
      if (isMounted) {
        setError('Failed to remove leads from list');
      }
    } finally {
      if (isMounted) {
        setIsBulkDeleting(false);
      }
    }
  };

  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedList || !permissionData.targetUserId) {
      setError('User selection is required');
      return;
    }

    try {
      await backendAPI.addLeadListPermission(
        selectedList.id,
        permissionData.targetUserId,
        permissionData.canView,
        permissionData.canEdit
      );

      setPermissionData({ targetUserId: '', canView: true, canEdit: false });
      setSuccess('Permission added successfully');
      // Refresh permissions for this list
      await loadListPermissions(selectedList.id);
      
      setTimeout(() => {
        if (isMounted) setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to add permission:', err);
      setError('Failed to add permission');
    }
  };

  const handleRemovePermission = async (listId: string, userId: string) => {
    if (!window.confirm('Remove this user\'s access?')) return;

    try {
      await backendAPI.removeLeadListPermission(listId, userId);
      setSuccess('Permission removed');
      // Refresh permissions for this list
      await loadListPermissions(listId);
      
      setTimeout(() => {
        if (isMounted) setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to remove permission:', err);
      setError('Failed to remove permission');
    }
  };

  const openPermissionsModal = async (list: LeadList) => {
    setSelectedList(list);
    setShowPermissionsModal(true);
    // Load permissions when opening the modal (not on page load)
    await loadListPermissions(list.id);
  };

  // CSV Import Functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setSelectedFile(file);
      parseCSV(file);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length === 0) {
          setError('CSV file is empty');
          return;
        }

        // Parse headers
        const headers = parseCSVLine(lines[0]);
        
        // Parse data rows (limit to first 10000 rows to prevent memory issues)
        const maxRows = Math.min(lines.length - 1, 10000);
        const data: string[][] = [];
        
        for (let i = 1; i <= maxRows; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length > 0) {
            data.push(values);
          }
        }
        
        setCsvHeaders(headers);
        setCsvData(data);
        
        if (lines.length - 1 > maxRows) {
          setError(`Large file: Only first ${maxRows} rows will be imported`);
        }
      } catch (err) {
        console.error('CSV parse error:', err);
        setError('Failed to parse CSV file. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  // Robust CSV line parser
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    
    // Don't forget the last value
    values.push(current.trim());
    
    return values;
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Please drop a CSV file');
        return;
      }
      setSelectedFile(file);
      parseCSV(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const resetImportModal = () => {
    setShowImportModal(false);
    setImportStep(1);
    setImportListName('');
    setSelectedFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setIsUploading(false);
    setFieldMappings({});
    setMappingErrors([]);
    setPreviewData([]);
    setImportProgress(0);
    setImportStatus('idle');
    setImportResults({ success: 0, failed: 0, errors: [] });
    setDuplicates([]);
    setAllDuplicatesSelected(false);
  };

  // Auto-detect field mappings based on CSV headers
  const autoDetectMappings = () => {
    const mappings: FieldMapping = {};
    const headerLower = csvHeaders.map(h => h.toLowerCase().replace(/[_\s-]/g, ''));
    
    PROSPECT_FIELDS.forEach(field => {
      const fieldLower = field.key.toLowerCase();
      const fieldLabel = field.label.toLowerCase().replace(/\s/g, '');
      
      // Find matching CSV header
      const matchIndex = headerLower.findIndex(h => 
        h === fieldLower || 
        h === fieldLabel ||
        h.includes(fieldLower) ||
        fieldLower.includes(h) ||
        // Common variations
        (fieldLower === 'firstname' && (h === 'first' || h === 'fname')) ||
        (fieldLower === 'lastname' && (h === 'last' || h === 'lname')) ||
        (fieldLower === 'phone' && (h.includes('phone') || h.includes('mobile') || h.includes('cell'))) ||
        (fieldLower === 'email' && h.includes('email')) ||
        (fieldLower === 'company' && (h.includes('company') || h.includes('organization') || h.includes('org'))) ||
        (fieldLower === 'title' && (h.includes('title') || h.includes('position') || h.includes('jobtitle')))
      );
      
      if (matchIndex !== -1) {
        mappings[csvHeaders[matchIndex]] = field.key;
      }
    });
    
    setFieldMappings(mappings);
  };

  // Validate field mappings
  const validateMappings = (): boolean => {
    const errors: string[] = [];
    const mappedFields = Object.values(fieldMappings);
    
    // Check required fields are mapped
    PROSPECT_FIELDS.filter(f => f.required).forEach(field => {
      if (!mappedFields.includes(field.key)) {
        errors.push(`Required field "${field.label}" is not mapped`);
      }
    });
    
    // Check for duplicate mappings
    const duplicates = mappedFields.filter((item, index) => mappedFields.indexOf(item) !== index && item !== '');
    if (duplicates.length > 0) {
      errors.push(`Duplicate mappings found: ${[...new Set(duplicates)].join(', ')}`);
    }
    
    setMappingErrors(errors);
    return errors.length === 0;
  };

  // Generate preview data based on mappings
  const generatePreview = () => {
    const preview: Partial<Prospect>[] = [];
    
    csvData.forEach((row, index) => {
      const prospect: Partial<Prospect> = {
        id: `preview-${index}`,
        status: 'New',
        timezone: 'America/Los_Angeles', // Default timezone
      };
      
      Object.entries(fieldMappings).forEach(([csvHeader, prospectField]) => {
        const headerIndex = csvHeaders.indexOf(csvHeader);
        if (headerIndex !== -1 && row[headerIndex]) {
          (prospect as any)[prospectField] = row[headerIndex];
        }
      });
      
      preview.push(prospect);
    });
    
    setPreviewData(preview);
  };

  // Detect duplicates within CSV and in database
  const detectDuplicates = async (preview: Partial<Prospect>[]) => {
    const detectedDuplicates: DuplicateRow[] = [];
    const phoneMap = new Map<string, number>(); // Track phones in CSV
    const emailMap = new Map<string, number>(); // Track emails in CSV
    
    // Get all existing prospects from database
    let existingProspects: Prospect[] = [];
    try {
      existingProspects = await backendAPI.getProspects();
    } catch (err) {
      console.warn('Could not fetch existing prospects for duplicate detection:', err);
    }
    
    // Create lookup maps for database prospects
    const dbPhoneMap = new Map<string, Prospect>();
    const dbEmailMap = new Map<string, Prospect>();
    
    existingProspects.forEach(p => {
      if (p.phone) dbPhoneMap.set(p.phone.toLowerCase().replace(/\D/g, ''), p);
      if (p.email) dbEmailMap.set(p.email.toLowerCase(), p);
    });
    
    // Check each row for duplicates
    preview.forEach((prospect, index) => {
      const cleanPhone = prospect.phone?.toLowerCase().replace(/\D/g, '') || '';
      const cleanEmail = prospect.email?.toLowerCase() || '';
      
      let isDuplicate = false;
      let duplicateType: 'internal' | 'database' = 'internal';
      let duplicateInfo: DuplicateRow['duplicateInfo'] = undefined;
      
      // Check for internal duplicates (within CSV)
      if (cleanPhone) {
        if (phoneMap.has(cleanPhone)) {
          isDuplicate = true;
          duplicateType = 'internal';
          duplicateInfo = {
            field: 'phone',
            conflictingValue: cleanPhone,
          };
        }
        phoneMap.set(cleanPhone, index);
      }
      
      if (cleanEmail && !isDuplicate) {
        if (emailMap.has(cleanEmail)) {
          isDuplicate = true;
          duplicateType = 'internal';
          duplicateInfo = {
            field: 'email',
            conflictingValue: cleanEmail,
          };
        }
        emailMap.set(cleanEmail, index);
      }
      
      // Check for database duplicates
      if (!isDuplicate && cleanPhone && dbPhoneMap.has(cleanPhone)) {
        isDuplicate = true;
        duplicateType = 'database';
        const existingRecord = dbPhoneMap.get(cleanPhone);
        duplicateInfo = {
          field: 'phone',
          conflictingValue: cleanPhone,
          existingRecord,
        };
      }
      
      if (!isDuplicate && cleanEmail && dbEmailMap.has(cleanEmail)) {
        isDuplicate = true;
        duplicateType = 'database';
        const existingRecord = dbEmailMap.get(cleanEmail);
        duplicateInfo = {
          field: 'email',
          conflictingValue: cleanEmail,
          existingRecord,
        };
      }
      
      if (isDuplicate && duplicateInfo) {
        detectedDuplicates.push({
          rowIndex: index,
          prospect,
          duplicateType,
          duplicateInfo,
          selected: false,
        });
      }
    });
    
    setDuplicates(detectedDuplicates);
    return detectedDuplicates;
  };

  // Toggle duplicate selection
  const toggleDuplicateSelection = (index: number) => {
    setDuplicates(prev => {
      const updated = [...prev];
      updated[index].selected = !updated[index].selected;
      return updated;
    });
  };

  // Toggle select all duplicates
  const toggleSelectAllDuplicates = () => {
    setDuplicates(prev => 
      prev.map(dup => ({
        ...dup,
        selected: !allDuplicatesSelected
      }))
    );
    setAllDuplicatesSelected(!allDuplicatesSelected);
  };

  const handleImportNext = () => {
    if (importStep === 1) {
      if (!importListName.trim()) {
        setError('Please enter a list name');
        return;
      }
      if (!selectedFile) {
        setError('Please select a CSV file');
        return;
      }
      // Auto-detect mappings when moving to step 2
      autoDetectMappings();
      setImportStep(2);
    } else if (importStep === 2) {
      if (!validateMappings()) {
        return;
      }
      // Generate preview data when moving to step 3
      const preview: Partial<Prospect>[] = [];
      
      csvData.forEach((row, index) => {
        const prospect: Partial<Prospect> = {
          id: `preview-${index}`,
          status: 'New',
          timezone: 'America/Los_Angeles', // Default timezone
        };
        
        Object.entries(fieldMappings).forEach(([csvHeader, prospectField]) => {
          const headerIndex = csvHeaders.indexOf(csvHeader);
          if (headerIndex !== -1 && row[headerIndex]) {
            (prospect as any)[prospectField] = row[headerIndex];
          }
        });
        
        preview.push(prospect);
      });
      
      setPreviewData(preview);
      
      // Detect duplicates before moving to step 3
      detectDuplicates(preview).then(() => {
        setImportStep(3);
      });
    }
  };

  const handleImportBack = () => {
    if (importStep === 2) {
      setImportStep(1);
    } else if (importStep === 3) {
      setImportStep(2);
      setDuplicates([]);
      setAllDuplicatesSelected(false);
    }
  };

  // Handle the actual import
  const handleImport = async () => {
    setImportStatus('importing');
    setImportProgress(0);
    
    const results = { 
      success: 0, 
      failed: 0, 
      skipped: 0,
      updated: 0,
      errors: [] as string[] 
    };
    const prospectIds: string[] = [];
    const skippedDuplicates: string[] = [];
    
    // Get the set of duplicate row indices that were NOT selected
    const unselectedDuplicateIndices = new Set(
      duplicates.filter(d => !d.selected).map(d => d.rowIndex)
    );
    
    // Create map of selected duplicates for easy lookup
    const selectedDuplicateMap = new Map<number, DuplicateRow>();
    duplicates.filter(d => d.selected).forEach(d => {
      selectedDuplicateMap.set(d.rowIndex, d);
    });
    
    try {
      // Create prospects one by one
      for (let i = 0; i < previewData.length; i++) {
        const prospect = previewData[i];
        
        // Skip unselected duplicates
        if (unselectedDuplicateIndices.has(i)) {
          results.skipped++;
          const name = `${prospect.firstName || ''} ${prospect.lastName || ''}`.trim() || 'Unknown';
          const phone = prospect.phone || 'No phone';
          skippedDuplicates.push(`Row ${i + 1}: "${name}" (${phone})`);
          continue;
        }
        
        setImportProgress(Math.round(((i + 1) / previewData.length) * 100));
        
        try {
          const selectedDup = selectedDuplicateMap.get(i);
          
          // If this is a selected duplicate with an existing record, UPDATE it instead of CREATE
          if (selectedDup && selectedDup.duplicateInfo?.existingRecord) {
            const existingRecord = selectedDup.duplicateInfo.existingRecord;
            
            // Update the existing prospect with new data
            const updated = await backendAPI.updateProspect(existingRecord.id, {
              firstName: prospect.firstName || existingRecord.firstName,
              lastName: prospect.lastName || existingRecord.lastName,
              phone: prospect.phone || existingRecord.phone,
              email: prospect.email || existingRecord.email,
              company: prospect.company || existingRecord.company,
              title: prospect.title || existingRecord.title,
              timezone: prospect.timezone || existingRecord.timezone,
              notes: prospect.notes || existingRecord.notes,
              // Keep existing status (don't override)
              status: existingRecord.status,
            });
            
            prospectIds.push(updated.id);
            results.updated++;
          } else {
            // Create new prospect (either not a duplicate or new entry)
            const newProspect = await backendAPI.createProspect({
              firstName: prospect.firstName || '',
              lastName: prospect.lastName || '',
              phone: prospect.phone || '',
              email: prospect.email || '',
              company: prospect.company || '',
              title: prospect.title || '',
              timezone: prospect.timezone || 'America/Los_Angeles',
              notes: prospect.notes || '',
              status: 'New',
            });
            
            prospectIds.push(newProspect.id);
            results.success++;
          }
        } catch (err: any) {
          const errorMsg = err.message || '';
          results.failed++;
          results.errors.push(`❌ Row ${i + 1}: ${errorMsg || 'Failed to process prospect'}`);
        }
      }
      
      // Create the lead list with all imported prospects
      if (prospectIds.length > 0) {
        await backendAPI.createLeadList(importListName, `Imported from ${selectedFile?.name}`, prospectIds);
      }
      
      setImportResults(results);
      setImportStatus('success');
      
      // Reload lead lists
      await loadLeadLists();
      
      // Show appropriate success/warning message
      let successMsg = `Import complete!`;
      if (results.success > 0) {
        successMsg += ` ✅ ${results.success} new lead(s) imported`;
      }
      if (results.updated > 0) {
        successMsg += `${results.success > 0 ? ',' : ''} 📝 ${results.updated} existing lead(s) updated`;
      }
      if (results.skipped > 0) {
        successMsg += `${results.success > 0 || results.updated > 0 ? ',' : ''} ⏭️ ${results.skipped} duplicate(s) skipped`;
      }
      successMsg += ` to "${importListName}"`;
      
      setSuccess(successMsg);
      
      // Emit event to notify other components (PowerDialer) about the new import
      const importEvent = new CustomEvent('leadListImported', { 
        detail: { 
          listName: importListName,
          prospectCount: prospectIds.length
        } 
      });
      window.dispatchEvent(importEvent);
      
      // Don't auto-close if there were errors - let user review
      if (results.failed === 0) {
        setTimeout(() => {
          resetImportModal();
        }, 2000);
      }
      
    } catch (err: any) {
      console.error('Import failed:', err);
      setImportStatus('error');
      setError(`Import failed: ${err.message}`);
    }
  };

  return (
    <div className="w-full bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Lead Lists</h2>
            <p className="text-gray-600 dark:text-gray-400">Manage shared lead lists and permissions</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold rounded-lg transition"
            >
              <Upload size={20} />
              Import CSV
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              <Plus size={20} />
              New List
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-700 dark:text-red-300 hover:font-semibold">✕</button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-700 dark:text-green-300 hover:font-semibold">✕</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : leadLists.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-8 text-center">
            <Users size={48} className="mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">No lead lists yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Create Your First List
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leadLists.map((list) => {
              const listPermissions = permissions.get(list.id) || [];
              const listProspects = prospects.filter(p => list.prospectIds.includes(p.id));
              
              return (
                <div
                  key={list.id}
                  className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 hover:shadow-md transition"
                >
                  <div className="mb-4">
                    <div className="flex items-start justify-between">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {list.name}
                      </h3>
                      {list.isOwner === false && (
                        <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                          Shared
                        </span>
                      )}
                    </div>
                    {list.creatorName && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                        Created by: {list.creatorName}
                      </p>
                    )}
                    {list.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {list.description}
                      </p>
                    )}
                  </div>

                  <div className="mb-4 space-y-2">
                    <button
                      onClick={() => setExpandedListId(expandedListId === list.id ? null : list.id)}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                    >
                      <Users size={16} />
                      <span>{list.prospectCount} leads</span>
                      <span className="text-xs">({expandedListId === list.id ? 'collapse' : 'expand'})</span>
                    </button>
                  </div>

                  {/* Expanded leads with checkboxes for bulk selection */}
                  {expandedListId === list.id && listProspects.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          Leads in this list ({getSelectedCount(list.id)} selected):
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const allIds = listProspects.map(p => p.id);
                              if (getSelectedCount(list.id) === listProspects.length) {
                                deselectAllLeadsInList(list.id);
                              } else {
                                selectAllLeadsInList(list.id, allIds);
                              }
                            }}
                            className="text-xs px-2 py-1 bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-slate-600 transition flex items-center gap-1"
                          >
                            {getSelectedCount(list.id) === listProspects.length ? (
                              <>
                                <CheckSquare size={12} /> Deselect All
                              </>
                            ) : (
                              <>
                                <Square size={12} /> Select All
                              </>
                            )}
                          </button>
                          {getSelectedCount(list.id) > 0 && (
                            <button
                              onClick={() => handleBulkDeleteLeads(list.id)}
                              disabled={isBulkDeleting}
                              className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition flex items-center gap-1 disabled:opacity-50"
                            >
                              {isBulkDeleting ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" /> Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 size={12} /> Delete {getSelectedCount(list.id)}
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {listProspects.map((prospect) => (
                          <div 
                            key={prospect.id} 
                            className={`text-xs text-gray-700 dark:text-gray-300 flex items-center justify-between bg-white dark:bg-slate-700 p-2 rounded transition ${
                              isLeadSelected(list.id, prospect.id) ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={isLeadSelected(list.id, prospect.id)}
                                onChange={() => toggleLeadSelection(list.id, prospect.id)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="truncate">
                                {prospect.firstName} {prospect.lastName}
                                <span className="text-gray-500 ml-1">({prospect.company || 'No company'})</span>
                              </span>
                            </label>
                            <button
                              onClick={() => handleDeleteLeadFromList(list.id, prospect.id)}
                              className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded"
                              title="Remove lead from list"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Collapsed view - just show count */}
                  {expandedListId !== list.id && listProspects.length > 0 && (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        Click "expand" to view and select leads
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => openPermissionsModal(list)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold rounded-lg transition"
                    >
                      <Share2 size={16} />
                      Share
                    </button>
                    <button
                      onClick={() => handleDeleteList(list.id)}
                      className="px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 font-semibold rounded-lg transition"
                      title="Delete entire list"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create List Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Lead List</h3>
              </div>

              <form onSubmit={handleCreateList} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    List Name *
                  </label>
                  <input
                    type="text"
                    value={newListData.name}
                    onChange={(e) => setNewListData({ ...newListData, name: e.target.value })}
                    placeholder="e.g., Q4 Sales Prospects"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newListData.description}
                    onChange={(e) => setNewListData({ ...newListData, description: e.target.value })}
                    placeholder="Optional description..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Select Prospects
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-700">
                    {prospects.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No prospects available</p>
                    ) : (
                      <div className="space-y-2">
                        {prospects.map((prospect) => (
                          <label key={prospect.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newListData.selectedProspects.includes(prospect.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewListData({
                                    ...newListData,
                                    selectedProspects: [...newListData.selectedProspects, prospect.id],
                                  });
                                } else {
                                  setNewListData({
                                    ...newListData,
                                    selectedProspects: newListData.selectedProspects.filter(
                                      (id) => id !== prospect.id
                                    ),
                                  });
                                }
                              }}
                              className="w-4 h-4 cursor-pointer"
                            />
                            <span className="text-sm text-gray-900 dark:text-gray-200">
                              {prospect.firstName} {prospect.lastName} ({prospect.company})
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {newListData.selectedProspects.length} selected
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                  >
                    Create List
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Permissions Modal */}
        {showPermissionsModal && selectedList && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Share "{selectedList.name}"
                </h3>
              </div>

              {/* Current Shares */}
              {(permissions.get(selectedList.id) || []).length > 0 && (
                <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Currently shared with:</p>
                  <div className="space-y-2">
                    {(permissions.get(selectedList.id) || []).map((perm: any) => (
                      <div key={perm.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-700 p-3 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {perm.user?.firstName || 'Unknown'} {perm.user?.lastName || ''}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {perm.user?.email || perm.userId}
                          </p>
                          <div className="flex gap-2 mt-1">
                            {perm.canView && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                                View
                              </span>
                            )}
                            {perm.canEdit && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                                Edit
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemovePermission(selectedList.id, perm.userId)}
                          className="ml-2 p-2 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          title="Remove access"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleAddPermission} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Add Team Member *
                  </label>
                  <select
                    value={permissionData.targetUserId}
                    onChange={(e) => setPermissionData({ ...permissionData, targetUserId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a team member...</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName} ({member.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissionData.canView}
                      onChange={(e) =>
                        setPermissionData({ ...permissionData, canView: e.target.checked })
                      }
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-200 font-medium flex items-center gap-2">
                      <Eye size={16} />
                      Can View Leads
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissionData.canEdit}
                      onChange={(e) =>
                        setPermissionData({ ...permissionData, canEdit: e.target.checked })
                      }
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-200 font-medium flex items-center gap-2">
                      <Edit size={16} />
                      Can Edit Leads
                    </span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPermissionsModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                  >
                    Add Permission
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedListForDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                  <Trash2 size={24} className="text-red-600 dark:text-red-400" />
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
                  Delete Lead List
                </h3>
                
                <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                  Are you sure you want to delete <span className="font-semibold">"{selectedListForDelete.name}"</span>? 
                </p>
                
                <p className="text-sm text-gray-500 dark:text-gray-500 text-center mb-6">
                  This action cannot be undone. You have <span className="font-semibold">{selectedListForDelete.prospectCount}</span> leads in this list.
                </p>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteList}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 size={16} />
                        Delete List
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Import CSV Modal - Step 1 */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Import Leads from CSV</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Step {importStep} of 3</p>
                </div>
                <button
                  onClick={resetImportModal}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Step Progress Indicator */}
              <div className="px-6 pt-6">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      importStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400'
                    }`}>
                      {importStep > 1 ? <CheckCircle size={18} /> : '1'}
                    </div>
                    <span className={`text-sm font-medium ${
                      importStep >= 1 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                    }`}>Upload File</span>
                  </div>
                  <div className={`w-16 h-0.5 ${importStep >= 2 ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'}`}></div>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      importStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400'
                    }`}>
                      {importStep > 2 ? <CheckCircle size={18} /> : '2'}
                    </div>
                    <span className={`text-sm font-medium ${
                      importStep >= 2 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                    }`}>Map Fields</span>
                  </div>
                  <div className={`w-16 h-0.5 ${importStep >= 3 ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'}`}></div>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      importStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400'
                    }`}>
                      {importStep > 3 ? <CheckCircle size={18} /> : '3'}
                    </div>
                    <span className={`text-sm font-medium ${
                      importStep >= 3 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                    }`}>Review & Import</span>
                  </div>
                </div>
              </div>

              {/* Step 1: Upload File */}
              {importStep === 1 && (
                <div className="p-6 space-y-6">
                  {/* List Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      List Name *
                    </label>
                    <input
                      type="text"
                      value={importListName}
                      onChange={(e) => setImportListName(e.target.value)}
                      placeholder="Enter a name for this lead list"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                    />
                  </div>

                  {/* File Upload Area */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Upload CSV File *
                    </label>
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                        selectedFile 
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                          : 'border-gray-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      
                      {selectedFile ? (
                        <div className="space-y-3">
                          <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                            <FileText size={32} className="text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedFile.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {(selectedFile.size / 1024).toFixed(1)} KB • {csvData.length} records found
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                              setCsvData([]);
                              setCsvHeaders([]);
                            }}
                            className="text-sm text-red-600 dark:text-red-400 hover:underline"
                          >
                            Remove file
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                            <Upload size={32} className="text-gray-400" />
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              Drop your CSV file here
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              or click to browse your files
                            </p>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Supported format: .csv
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Preview Table */}
                  {csvData.length > 0 && csvHeaders.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Preview (First 5 rows)
                      </label>
                      <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
                            <thead className="bg-gray-50 dark:bg-slate-700">
                              <tr>
                                {csvHeaders.slice(0, 6).map((header, idx) => (
                                  <th key={idx} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                    {header}
                                  </th>
                                ))}
                                {csvHeaders.length > 6 && (
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    +{csvHeaders.length - 6} more
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-600">
                              {csvData.slice(0, 5).map((row, rowIdx) => (
                                <tr key={rowIdx}>
                                  {row.slice(0, 6).map((cell, cellIdx) => (
                                    <td key={cellIdx} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200 whitespace-nowrap truncate max-w-[150px]">
                                      {cell || '-'}
                                    </td>
                                  ))}
                                  {row.length > 6 && (
                                    <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">...</td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Field Mapping */}
              {importStep === 2 && (
                <div className="p-6 space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      Map your CSV columns to the corresponding lead fields. Required fields are marked with <span className="text-red-500">*</span>
                    </p>
                  </div>

                  {/* Mapping Errors */}
                  {mappingErrors.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-red-800 dark:text-red-300 mb-1">Please fix the following errors:</p>
                          <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                            {mappingErrors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Field Mapping Table */}
                  <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
                      <thead className="bg-gray-50 dark:bg-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-1/3">
                            CSV Column
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-16">
                            →
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-1/3">
                            Map To Field
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                            Sample Data
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-600">
                        {csvHeaders.map((header, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                            <td className="px-4 py-3">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{header}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <ArrowRight size={16} className="text-gray-400 mx-auto" />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={fieldMappings[header] || ''}
                                onChange={(e) => {
                                  setFieldMappings(prev => ({
                                    ...prev,
                                    [header]: e.target.value
                                  }));
                                  setMappingErrors([]); // Clear errors on change
                                }}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">-- Don't import --</option>
                                {PROSPECT_FIELDS.map(field => (
                                  <option key={field.key} value={field.key}>
                                    {field.label} {field.required && '*'}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-500 dark:text-gray-400 truncate block max-w-[200px]">
                                {csvData[0]?.[idx] || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mapping Summary */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {Object.values(fieldMappings).filter(v => v).length} of {csvHeaders.length} columns mapped
                    </span>
                    <button
                      onClick={autoDetectMappings}
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      Auto-detect mappings
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Import */}
              {importStep === 3 && (
                <div className="p-6 space-y-6">
                  {importStatus === 'idle' && (
                    <>
                      {/* Duplicate Detection Alert */}
                      {duplicates.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-semibold text-amber-900 dark:text-amber-200">
                                ⚠️ {duplicates.length} duplicate(s) detected
                              </p>
                              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                                Some leads in your CSV file already exist in the database or appear multiple times in the file. 
                                <br />
                                <strong>When you select a duplicate:</strong>
                              </p>
                              <ul className="text-sm text-amber-800 dark:text-amber-300 mt-2 ml-4 space-y-1">
                                <li>• <strong>📂 Database duplicates (📝 Will update)</strong> - Will update the existing record with new information from CSV (name, phone, email, company, title, notes)</li>
                                <li>• <strong>🔄 Within CSV duplicates (🔄 Will add)</strong> - Will add as a new separate entry</li>
                                <li>• <strong>✗ Unselected duplicates</strong> - Will be skipped completely</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Duplicates Table */}
                      {duplicates.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Select duplicates to import ({duplicates.filter(d => d.selected).length} of {duplicates.length} selected)
                            </h4>
                            <button
                              onClick={toggleSelectAllDuplicates}
                              className="text-xs px-3 py-1 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
                            >
                              {allDuplicatesSelected ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          
                          <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                            <table className="min-w-full divide-y divide-amber-200 dark:divide-amber-800">
                              <thead className="bg-amber-50 dark:bg-amber-900/30 sticky top-0">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-900 dark:text-amber-200 w-12">
                                    <input
                                      type="checkbox"
                                      checked={allDuplicatesSelected}
                                      onChange={toggleSelectAllDuplicates}
                                      className="w-4 h-4 cursor-pointer"
                                    />
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-900 dark:text-amber-200">Row</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-900 dark:text-amber-200">Name</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-900 dark:text-amber-200">Contact</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-900 dark:text-amber-200">Type</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-900 dark:text-amber-200">Conflict Info</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-slate-800 divide-y divide-amber-200 dark:divide-amber-800">
                                {duplicates.map((dup, idx) => (
                                  <tr key={idx} className="hover:bg-amber-50 dark:hover:bg-amber-900/10">
                                    <td className="px-4 py-3">
                                      <input
                                        type="checkbox"
                                        checked={dup.selected}
                                        onChange={() => toggleDuplicateSelection(idx)}
                                        className="w-4 h-4 cursor-pointer"
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                      #{dup.rowIndex + 1}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                      {dup.prospect.firstName} {dup.prospect.lastName}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                      {dup.duplicateInfo?.field === 'phone' ? dup.prospect.phone : dup.prospect.email}
                                    </td>
                                    <td className="px-4 py-3 text-xs">
                                      <span className={`px-2 py-1 rounded-full whitespace-nowrap ${
                                        dup.duplicateType === 'internal'
                                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                                          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                      }`}>
                                        {dup.duplicateType === 'internal' ? '🔄 Within CSV' : '📂 In Database'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                                      {dup.duplicateInfo?.field === 'phone' ? '📞' : '📧'}{' '}
                                      {dup.duplicateType === 'database' && dup.duplicateInfo?.existingRecord
                                        ? `Matches: ${dup.duplicateInfo.existingRecord.firstName} ${dup.duplicateInfo.existingRecord.lastName}`
                                        : 'Duplicate entry'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Import Summary */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle size={24} className="text-blue-600 dark:text-blue-400" />
                          <div className="flex-1">
                            <p className="font-semibold text-blue-800 dark:text-blue-300">Ready to import</p>
                            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                              {previewData.filter((_, i) => !duplicates.find(d => d.rowIndex === i && !d.selected)).length} leads will be imported into "<strong>{importListName}</strong>"
                              {duplicates.length > 0 && (
                                <span className="ml-2">
                                  ({duplicates.filter(d => d.selected).length} selected duplicate(s) will be imported)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Field Summary */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Field Mappings</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(fieldMappings).filter(([_, v]) => v).map(([csvCol, field]) => {
                            const fieldDef = PROSPECT_FIELDS.find(f => f.key === field);
                            return (
                              <div key={csvCol} className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-slate-700 rounded px-3 py-2">
                                <span className="text-gray-600 dark:text-gray-400">{csvCol}</span>
                                <ArrowRight size={14} className="text-gray-400" />
                                <span className="font-medium text-gray-900 dark:text-white">{fieldDef?.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Preview Table */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Preview (First 5 leads to import)</h4>
                        <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
                              <thead className="bg-gray-50 dark:bg-slate-700">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">#</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Name</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Phone</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Email</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Company</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Status</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-600">
                                {previewData.slice(0, 5).map((prospect, idx) => {
                                  const isDuplicate = duplicates.some(d => d.rowIndex === idx);
                                  const isSelected = duplicates.find(d => d.rowIndex === idx)?.selected ?? true;
                                  const duplicateRow = duplicates.find(d => d.rowIndex === idx);
                                  const hasExistingRecord = duplicateRow?.duplicateInfo?.existingRecord;
                                  const rowClass = isDuplicate && !isSelected ? 'opacity-50' : '';
                                  
                                  return (
                                    <tr key={idx} className={`${rowClass}`}>
                                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{idx + 1}</td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                        {prospect.firstName} {prospect.lastName}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{prospect.phone || '-'}</td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{prospect.email || '-'}</td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{prospect.company || '-'}</td>
                                      <td className="px-4 py-3 text-sm">
                                        {isDuplicate ? (
                                          isSelected ? (
                                            hasExistingRecord ? (
                                              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded whitespace-nowrap">
                                                📝 Will update
                                              </span>
                                            ) : (
                                              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded whitespace-nowrap">
                                                🔄 Will add
                                              </span>
                                            )
                                          ) : (
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                                              ✗ Skip
                                            </span>
                                          )
                                        ) : (
                                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded">
                                            ✓ Import
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        {previewData.length > 5 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                            And {previewData.length - 5} more leads...
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Importing Progress */}
                  {importStatus === 'importing' && (
                    <div className="text-center py-8">
                      <Loader2 size={48} className="mx-auto text-blue-600 animate-spin mb-4" />
                      <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Importing leads...</p>
                      <div className="w-full max-w-xs mx-auto bg-gray-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${importProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{importProgress}% complete</p>
                    </div>
                  )}

                  {/* Import Success */}
                  {importStatus === 'success' && (
                    <div className="py-6">
                      <div className="text-center mb-4">
                        <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                          <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Import Complete!</p>
                        
                        {importResults.success > 0 && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            ✅ <span className="font-medium text-green-600">{importResults.success}</span> new lead(s) imported successfully
                          </p>
                        )}
                        
                        {(importResults as any).updated > 0 && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            📝 <span className="font-medium text-blue-600">{(importResults as any).updated}</span> existing lead(s) updated
                          </p>
                        )}
                        
                        {(importResults as any).skipped > 0 && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            ⏭️ <span className="font-medium text-amber-600">{(importResults as any).skipped}</span> duplicate(s) skipped per your selection
                          </p>
                        )}
                        
                        {importResults.failed > 0 && (
                          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                            ⚠️ <span className="font-medium">{importResults.failed}</span> row(s) failed to process
                          </p>
                        )}
                      </div>
                      
                      {/* Error Details */}
                      {importResults.errors.length > 0 && (
                        <div className="mt-4 max-h-48 overflow-y-auto border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                            <AlertTriangle size={16} />
                            Details:
                          </p>
                          <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
                            {importResults.errors.slice(0, 20).map((error, idx) => (
                              <li key={idx} className="break-words">{error}</li>
                            ))}
                            {importResults.errors.length > 20 && (
                              <li className="font-medium">...and {importResults.errors.length - 20} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                      
                      {/* Close button if there were errors */}
                      {importResults.failed > 0 && (
                        <div className="mt-4 text-center">
                          <button
                            onClick={resetImportModal}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Import Error */}
                  {importStatus === 'error' && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle size={32} className="text-red-600 dark:text-red-400" />
                      </div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Import Failed</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {importResults.errors[0] || 'An error occurred during import'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex justify-between">
                {importStep === 1 ? (
                  <button
                    onClick={resetImportModal}
                    className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    onClick={handleImportBack}
                    disabled={importStatus === 'importing'}
                    className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                )}
                
                {importStep < 3 ? (
                  <button
                    onClick={handleImportNext}
                    disabled={importStep === 1 && (!importListName.trim() || !selectedFile)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition flex items-center gap-2"
                  >
                    Next Step
                    <ArrowRight size={16} />
                  </button>
                ) : importStatus === 'idle' ? (
                  <button
                    onClick={handleImport}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition flex items-center gap-2"
                  >
                    <Upload size={16} />
                    Import {previewData.length} Leads
                  </button>
                ) : importStatus === 'success' ? (
                  <button
                    onClick={resetImportModal}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                  >
                    Done
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
