import { Prospect, AgentStats } from './types';

// Empty initial state - users start fresh
export const INITIAL_STATS: AgentStats = {
  callsMade: 0,
  connections: 0,
  appointmentsSet: 0,
  talkTime: 0,
};

export const INITIAL_PROSPECTS: Prospect[] = [];