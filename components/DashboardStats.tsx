import React from 'react';
import { AgentStats } from '../types';
import { Phone, CheckCircle, Clock, Calendar } from 'lucide-react';

interface Props {
  stats: AgentStats;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center space-x-4 transition hover:shadow-md">
    <div className={`p-3 rounded-full ${color} text-white`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
    </div>
  </div>
);

export const DashboardStats: React.FC<Props> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard 
        title="Calls Made" 
        value={stats.callsMade} 
        icon={<Phone size={20} />} 
        color="bg-blue-500" 
      />
      <StatCard 
        title="Connections" 
        value={stats.connections} 
        icon={<CheckCircle size={20} />} 
        color="bg-green-500" 
      />
      <StatCard 
        title="Appointments" 
        value={stats.appointmentsSet} 
        icon={<Calendar size={20} />} 
        color="bg-purple-500" 
      />
      <StatCard 
        title="Talk Time (m)" 
        value={stats.talkTime} 
        icon={<Clock size={20} />} 
        color="bg-orange-500" 
      />
    </div>
  );
};