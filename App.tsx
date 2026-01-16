
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line 
} from 'recharts';
import { DashboardData } from './types';
import { parseCSV } from './utils/dataParser';

const PLATFORM_COLORS: Record<string, string> = {
  Android: '#10b981', // Emerald
  iOS: '#3b82f6',     // Blue
  Web: '#6366f1'      // Indigo
};

const DEFAULT_COLOR = '#94a3b8';

export default function App() {
  const [sheetUrl, setSheetUrl] = useState<string>('https://docs.google.com/spreadsheets/d/e/2PACX-1vT1X1X1X1X1X1X1X1X1X1X1X1X1X1X1X1X1X1X1X1X/pub?output=csv');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('All');
  const [selectedBuild, setSelectedBuild] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeSprint, setActiveSprint] = useState<string>('139');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(sheetUrl);
      if (!response.ok) throw new Error('Network response was not ok');
      const csvText = await response.text();
      const parsed = parseCSV(csvText);
      setData(parsed);
    } catch (error) {
      console.error("Using provided sample data due to fetch error.");
      const sampleCsv = `Sprint number,RC Build,Build Date,Platform,Total Test Cases,Executed,Automation executed,Manual executed,Passed,Pass %,Failed,Failure %,Not considered,Not considered %,Pending %,Completion %,Total Ticket validation,Pending Ticket validtaion,Critical Issues,Major Issues,Minor Issues,Status,QA Recommendation,Report Link
139,5.139.118 (68151),2 Jan 2026,Android,892,892,637,255,802,89.91%,6,0.67%,84,9.42%,0.00%,100.00%,4,0,0,0,1,,,
139,5.139.118 (68063),29 Dec 2025,Android,892,892,553,339,792,88.79%,4,0.45%,96,10.76%,0.00%,100.00%,20,0,0,4,1,,,
139,5.139.119(13589),5 Jan 2026,iOS,922,922,639,283,850,92.19%,2,0.22%,70,7.59%,0.00%,100.00%,2,0,0,0,0,,,`;
      setData(parseCSV(sampleCsv));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const availablePlatforms = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.rows.map(r => r.Platform))).filter(Boolean);
  }, [data]);

  const availableBuilds = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.rows.map(r => r['RC Build']))).filter(Boolean);
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;

    // Build Filter
    if (selectedBuild !== 'All') {
      rows = rows.filter(r => r['RC Build'] === selectedBuild);
    }

    // Platform Filter
    if (selectedPlatform !== 'All') {
      rows = rows.filter(r => r.Platform === selectedPlatform);
    }

    // Date Range Filter
    if (startDate) {
      const start = new Date(startDate);
      rows = rows.filter(r => new Date(r['Build Date']) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      rows = rows.filter(r => new Date(r['Build Date']) <= end);
    }

    return rows;
  }, [data, selectedPlatform, selectedBuild, startDate, endDate]);

  const summaryStats = useMemo(() => {
    if (filteredRows.length === 0) return null;
    
    // Aggregates
    const totalPassed = filteredRows.reduce((acc, r) => acc + (Number(r.Passed) || 0), 0);
    const totalExecuted = filteredRows.reduce((acc, r) => acc + (Number(r.Executed) || 0), 0);
    const totalTestCases = filteredRows.reduce((acc, r) => acc + (Number(r['Total Test Cases']) || 0), 0);
    const totalAutomation = filteredRows.reduce((acc, r) => acc + (Number(r['Automation executed']) || 0), 0);
    const totalManual = filteredRows.reduce((acc, r) => acc + (Number(r['Manual executed']) || 0), 0);
    const totalCritical = filteredRows.reduce((acc, r) => acc + (Number(r['Critical Issues']) || 0), 0);
    const totalMajor = filteredRows.reduce((acc, r) => acc + (Number(r['Major Issues']) || 0), 0);
    const totalMinor = filteredRows.reduce((acc, r) => acc + (Number(r['Minor Issues']) || 0), 0);
    
    // Platform Breakdown
    const platformBreakdown: Record<string, number> = {};
    filteredRows.forEach(row => {
      const p = row.Platform;
      platformBreakdown[p] = (platformBreakdown[p] || 0) + (Number(row.Executed) || 0);
    });

    const passRate = totalExecuted > 0 ? ((totalPassed / totalExecuted) * 100).toFixed(2) : "0.00";
    
    return { 
      passRate, 
      totalExecuted, 
      totalTestCases,
      totalAutomation, 
      totalManual, 
      totalCritical, 
      totalMajor, 
      totalMinor,
      platformBreakdown 
    };
  }, [filteredRows]);

  const trendData = useMemo(() => {
    if (!data) return [];
    const builds = Array.from(new Set(filteredRows.map(r => r['RC Build']))).reverse();
    return builds.map(b => {
      const point: any = { build: b };
      const relevantRows = filteredRows.filter(r => r['RC Build'] === b);
      
      if (selectedPlatform === 'All') {
        availablePlatforms.forEach(p => {
          const row = relevantRows.find(r => r.Platform === p);
          if (row) {
            point[p] = parseFloat(String(row['Pass %']).replace('%', '')) || 0;
          }
        });
      } else {
        const row = relevantRows.find(r => r.Platform === selectedPlatform);
        if (row) {
          point[selectedPlatform] = parseFloat(String(row['Pass %']).replace('%', '')) || 0;
        }
      }
      return point;
    });
  }, [filteredRows, selectedPlatform, availablePlatforms]);

  const clearFilters = () => {
    setSelectedPlatform('All');
    setSelectedBuild('All');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col gap-6 max-w-7xl mx-auto bg-slate-50">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg ring-4 ring-indigo-50">📊</div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">QA Intelligence</h1>
            <p className="text-slate-500 text-sm font-medium">Sprint {activeSprint} • Multi-Dimensional Filters</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
            <div className="flex items-center gap-2 pr-4 border-r border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Build:</span>
              <select 
                value={selectedBuild}
                onChange={(e) => setSelectedBuild(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[120px]"
              >
                <option value="All">All Builds</option>
                {availableBuilds.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pr-4 border-r border-slate-100 pl-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">OS:</span>
              <select 
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="All">All</option>
                {availablePlatforms.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2 px-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pl-4 border-l border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
              />
            </div>
            
            {(selectedPlatform !== 'All' || selectedBuild !== 'All' || startDate || endDate) && (
              <button 
                onClick={clearFilters}
                className="ml-2 text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase"
              >
                Clear
              </button>
            )}
          </div>

          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-all font-semibold text-sm shadow-sm flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync
          </button>
        </div>
      </header>

      {/* Summary Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard 
          title="Total Reported" 
          value={summaryStats?.totalTestCases || 0} 
          subValue="Scope of test cases" 
          icon="📝" 
          color="text-slate-900"
        />

        <SummaryCard 
          title="Executed Count" 
          value={summaryStats?.totalExecuted || 0} 
          icon="📋" 
          footer={
            summaryStats ? (
              <div className="mt-2 space-y-1">
                {Object.entries(summaryStats.platformBreakdown).map(([platform, count]) => (
                  <div key={platform} className="flex justify-between items-center text-[9px] font-bold">
                    <span className="text-slate-400 uppercase">{platform}</span>
                    <span className="text-slate-700">{count}</span>
                  </div>
                ))}
                <div className="pt-1 mt-1 border-t border-slate-100 flex justify-between text-[8px] text-slate-400 font-medium">
                  <span>Auto: {summaryStats.totalAutomation}</span>
                  <span>Manual: {summaryStats.totalManual}</span>
                </div>
              </div>
            ) : null
          }
        />

        <SummaryCard 
          title="Pass Rate" 
          value={summaryStats ? `${summaryStats.passRate}%` : '0%'} 
          subValue="Success efficiency" 
          icon="🎯" 
          color="text-emerald-600"
        />
        
        <SummaryCard 
          title="Critical Issues" 
          value={summaryStats?.totalCritical || 0} 
          subValue="Blockers detected" 
          icon="🔥" 
          color={summaryStats?.totalCritical ? "text-rose-600" : "text-emerald-600"}
        />
        <SummaryCard 
          title="Major Issues" 
          value={summaryStats?.totalMajor || 0} 
          subValue="Significant findings" 
          icon="⚠️" 
          color={summaryStats?.totalMajor ? "text-amber-600" : "text-slate-900"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
              Quality Trajectory
            </h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="build" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} domain={[80, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Legend iconType="circle" />
                  {selectedPlatform === 'All' ? (
                    availablePlatforms.map(p => (
                      <Line 
                        key={p} 
                        type="monotone" 
                        dataKey={p} 
                        stroke={PLATFORM_COLORS[p] || DEFAULT_COLOR} 
                        strokeWidth={3} 
                        dot={{r: 4, strokeWidth: 2, fill: '#fff'}} 
                        activeDot={{r: 6}} 
                        connectNulls
                      />
                    ))
                  ) : (
                    <Line 
                      type="monotone" 
                      dataKey={selectedPlatform} 
                      stroke={PLATFORM_COLORS[selectedPlatform] || DEFAULT_COLOR} 
                      strokeWidth={3} 
                      dot={{r: 4, strokeWidth: 2, fill: '#fff'}} 
                      activeDot={{r: 6}} 
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Issue Severity Distribution Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-6">Bug Severity Distribution</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="RC Build" axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                    <Tooltip />
                    <Legend iconType="rect" />
                    <Bar name="Critical" dataKey="Critical Issues" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                    <Bar name="Major" dataKey="Major Issues" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                    <Bar name="Minor" dataKey="Minor Issues" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Execution Depth Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-6">Execution Method</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="RC Build" axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                    <Tooltip />
                    <Legend iconType="rect" />
                    <Bar name="Automation" dataKey="Automation executed" fill="#10b981" stackId="a" opacity={0.7} />
                    <Bar name="Manual" dataKey="Manual executed" fill="#3b82f6" stackId="a" opacity={0.7} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col max-h-[800px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-[10px] uppercase tracking-widest">Audit History</h3>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">{filteredRows.length} logs</span>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-[11px]">
                <tbody className="divide-y divide-slate-50">
                  {filteredRows.length > 0 ? filteredRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{row['RC Build']}</div>
                        <div className="text-[9px] text-slate-400">{row.Platform} • {row['Build Date']}</div>
                        <div className="text-[8px] text-slate-400">Total Cases: {row['Total Test Cases']}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`font-black ${parseFloat(row['Pass %']) < 90 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {row['Pass %']}
                        </div>
                        <div className="text-[9px] text-slate-400">Efficiency</div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-slate-400 italic">
                        Adjust filters to see data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: any;
  value?: any;
  subValue?: any;
  icon: any;
  color?: string;
  footer?: any;
}

function SummaryCard({ title, value, subValue = null, icon, color = 'text-slate-900', footer = null }: SummaryCardProps) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1 transition-all hover:shadow-md hover:-translate-y-1 duration-300">
      <div className="flex items-center justify-between">
        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">{title}</span>
        <span className="text-lg bg-slate-50 p-2 rounded-lg">{icon}</span>
      </div>
      {value !== undefined && <div className={`text-2xl font-black ${color}`}>{value}</div>}
      {subValue && <div className="text-[10px] text-slate-400 font-medium">{subValue}</div>}
      {footer}
    </div>
  );
}
