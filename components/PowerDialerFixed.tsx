import React from 'react';
import { Prospect } from '../types';
import { Play, SkipForward, Phone } from 'lucide-react';

declare global {
  interface Window {
    __powerDialerAdvanceToNext?: () => void;
    __powerDialerSetDispositionSaved?: (v: boolean) => void;
  }
}

interface Props {
  queue: Prospect[];
  onCall: (prospect: Prospect) => void;
  disabled?: boolean;
  onAdvanceToNext?: () => void;
  dispositionSaved: boolean;
  setDispositionSaved: (v: boolean) => void;
}

const PowerDialerFixed: React.FC<Props> = ({ queue, onCall, disabled = false, onAdvanceToNext, dispositionSaved, setDispositionSaved }) => {
  const [isActive, setIsActive] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [completedIds, setCompletedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    window.__powerDialerSetDispositionSaved = (v: boolean) => setDispositionSaved(v);
    return () => { delete window.__powerDialerSetDispositionSaved; };
  }, [setDispositionSaved]);

  const activeQueue = queue.filter(p => !completedIds.includes(p.id) && p.status === 'New');
  const safeIndex = activeQueue.length === 0 ? 0 : Math.min(currentIndex, activeQueue.length - 1);
  const currentProspect = activeQueue[safeIndex] || null;

  React.useEffect(() => {
    if (onAdvanceToNext) {
      window.__powerDialerAdvanceToNext = () => {
        if (safeIndex < activeQueue.length - 1) {
          setCurrentIndex(prev => Math.min(prev + 1, activeQueue.length - 1));
        } else {
          setIsActive(false);
        }
      };
    }
    return () => { if (window.__powerDialerAdvanceToNext) delete window.__powerDialerAdvanceToNext; };
  }, [safeIndex, activeQueue.length, onAdvanceToNext]);

  const handleStart = () => { setIsActive(true); if (currentProspect && !disabled) onCall(currentProspect); };
  const handleSkip = () => { if (safeIndex < activeQueue.length - 1) setCurrentIndex(i => Math.min(i + 1, activeQueue.length - 1)); else setIsActive(false); };
  const handleComplete = (id: string) => { setCompletedIds(prev => [...prev, id]); setDispositionSaved(true); if (safeIndex < activeQueue.length - 1) setCurrentIndex(i => Math.min(i + 1, activeQueue.length - 1)); else setIsActive(false); };

  if (activeQueue.length === 0) return <div className="p-8 text-center">No More Leads</div>;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Power Dialer</h2>
          <div className="text-sm text-gray-500">{queue.length} prospects • {safeIndex + 1}</div>
        </div>
        <div>
          {!isActive ? (
            <button onClick={handleStart} disabled={disabled} className="px-3 py-2 bg-blue-600 text-white rounded">Start</button>
          ) : (
            <button onClick={() => setIsActive(false)} className="px-3 py-2 bg-red-600 text-white rounded">End</button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded">
        <div className="mb-4 font-semibold">{currentProspect?.firstName} {currentProspect?.lastName}</div>
        <div className="flex gap-2">
          <button onClick={handleSkip} className="px-3 py-2 border rounded">Skip</button>
          <button onClick={() => currentProspect && onCall(currentProspect)} className="px-3 py-2 bg-green-600 text-white rounded">Call Now</button>
          <button onClick={() => currentProspect && handleComplete(currentProspect.id)} className="px-3 py-2 bg-gray-400 text-white rounded">Mark Done</button>
        </div>
      </div>
    </div>
  );
};

export default PowerDialerFixed;
