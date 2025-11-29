import React, { useMemo } from 'react';
import { AgentStats } from '../types';
import { Phone, CheckCircle, Clock, Calendar } from 'lucide-react';

interface Props {
  stats: AgentStats;
}

// Memoized stat card to prevent re-renders
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = React.memo(({ title, value, icon, color }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center space-x-4 transition hover:shadow-md">
    <div className={`p-3 rounded-full ${color} text-white`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
    </div>
  </div>
));

export const DashboardStats: React.FC<Props> = React.memo(({ stats }) => {
  // Memoize stat card configurations to prevent object recreation
  const statCards = useMemo(() => [
    { title: "Calls Made", value: stats.callsMade, icon: <Phone size={20} />, color: "bg-blue-500" },
    { title: "Connections", value: stats.connections, icon: <CheckCircle size={20} />, color: "bg-green-500" },
    { title: "Appointments", value: stats.appointmentsSet, icon: <Calendar size={20} />, color: "bg-purple-500" },
    { title: "Talk Time (m)", value: stats.talkTime, icon: <Clock size={20} />, color: "bg-orange-500" }
  ], [stats.callsMade, stats.connections, stats.appointmentsSet, stats.talkTime]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {statCards.map((card, idx) => (
        <StatCard key={idx} {...card} />
      ))}
    </div>
  );
});