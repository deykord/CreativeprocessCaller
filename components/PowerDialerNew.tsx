import { Prospect } from '../types';
import { Play, SkipForward, Phone } from 'lucide-react';

import React, { useState, useEffect } from 'react';
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
  import PowerDialer from './PowerDialer';

  export default PowerDialer;
const PowerDialer: React.FC<Props> = ({ queue, onCall, disabled = false, onAdvanceToNext, dispositionSaved, setDispositionSaved }) => {
