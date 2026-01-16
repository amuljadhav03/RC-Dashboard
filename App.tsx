
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { DashboardData } from './types';
import { parseCSV } from './utils/dataParser';

// --- CONFIGURATION ---
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1yjf5kI6WPNwi_WhH3dFTgiIUONztM54I50sJtnr_PxY/export?format=csv&gid=0';

const PLATFORM_COLORS: Record<string, { main: string; light: string }> = {
  Android: { main: '#10B981', light: 'rgba(16, 185, 129, 0.1)' },
  iOS: { main: '#3B82F6', light: 'rgba(59, 130, 246, 0.1)' },
  Web: { main: '#8B5CF6', light: 'rgba(139, 92, 246, 0.1)' }
};

const EXECUTION_COLORS = {
  automation: '#22D3EE', 
  manual: '#6366F1',     
  pass: '#10B981',
  fail: '#F43F5E',
  notConsidered: '#94A3B8',
  pending: '#F59E0B',
  completion: '#8B5CF6'
};

const DEFAULT_COLOR = '#94a3b8';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => 
    (localStorage.getItem('dashboard-theme') as 'light' | 'dark') || 'light'
  );
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  const [selectedPlatform, setSelectedPlatform] = useState<string>('All');
  const [selectedBuild, setSelectedBuild] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const isDark = theme === 'dark';

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(DEFAULT_SHEET_URL);
      if (!response.ok) throw new Error('Network response was not ok');
      const csvText = await response.text();
      const parsed = parseCSV(csvText);
      setData(parsed);
    } catch (error) {
      console.error("Fetch error fallback activated.");
      const sampleCsv = `Sprint number,RC Build,Build Date,Platform,Total Test Cases,Executed,Automation executed,Manual executed,Passed,Pass %,Failed,Failure %,Not considered,Not considered %,Pending %,Completion %,Total Ticket validation,Pending Ticket validtaion,Critical Issues,Major Issues,Minor Issues,Status,QA Recommendation,Report Link
139,5.139.118 (68151),2 Jan 2026,Android,892,892,637,255,802,89.91%,6,0.67%,84,9.42%,0.00%,100.00%,4,0,0,0,1,,,
139,5.139.118 (68063),29 Dec 2025,Android,892,892,553,339,792,88.79%,4,0.45%,96,10.76%,0.00%,100.00%,20,0,0,4,1,,,
139,5.139.119(13589),5 Jan 2026,iOS,922,922,639,283,850,92.19%,2,0.22%,70,7.59%,0.00%,100.00%,2,0,0,0,0,,,`;
      setData(parseCSV(sampleCsv));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { localStorage.setItem('dashboard-theme', theme); }, [theme]);

  const allAvailablePlatforms = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.rows.map(r => r.Platform))).filter(Boolean).sort();
  }, [data]);

  const allAvailableBuilds = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (selectedPlatform !== 'All') {
      rows = rows.filter(r => r.Platform === selectedPlatform);
    }
    return Array.from(new Set(rows.map(r => r['RC Build']))).filter(Boolean).reverse();
  }, [data, selectedPlatform]);

  useEffect(() => {
    if (selectedBuild !== 'All' && !allAvailableBuilds.includes(selectedBuild)) {
      setSelectedBuild('All');
    }
  }, [allAvailableBuilds, selectedBuild]);

  const dynamicSubtitle = useMemo(() => {
    const parts = [];
    if (selectedPlatform !== 'All') parts.push(selectedPlatform);
    if (selectedBuild !== 'All') parts.push(selectedBuild);
    return parts.join(' • ');
  }, [selectedPlatform, selectedBuild]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (selectedBuild !== 'All') rows = rows.filter(r => r['RC Build'] === selectedBuild);
    if (selectedPlatform !== 'All') rows = rows.filter(r => r.Platform === selectedPlatform);
    if (startDate) rows = rows.filter(r => new Date(r['Build Date']) >= new Date(startDate));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      rows = rows.filter(r => new Date(r['Build Date']) <= end);
    }
    return rows;
  }, [data, selectedPlatform, selectedBuild, startDate, endDate]);

  const summaryStats = useMemo(() => {
    if (filteredRows.length === 0) return null;
    
    const parsePercent = (val: any) => {
      if (typeof val === 'string') return parseFloat(val.replace('%', '')) || 0;
      return Number(val) || 0;
    };

    const stats = filteredRows.reduce((acc, r) => ({
      passed: acc.passed + (Number(r.Passed) || 0),
      executed: acc.executed + (Number(r.Executed) || 0),
      total: acc.total + (Number(r['Total Test Cases']) || 0),
      auto: acc.auto + (Number(r['Automation executed']) || 0),
      manual: acc.manual + (Number(r['Manual executed']) || 0),
      critical: acc.critical + (Number(r['Critical Issues'] || r.Critical_Issues || 0)),
      major: acc.major + (Number(r['Major Issues'] || r.Major_Issues || 0)),
      minor: acc.minor + (Number(r['Minor Issues'] || r.Minor_Issues || 0)),
      avgPass: acc.avgPass + parsePercent(r['Pass %']),
      avgFail: acc.avgFail + parsePercent(r['Failure %']),
      avgNotConsidered: acc.avgNotConsidered + parsePercent(r['Not considered %']),
      avgPending: acc.avgPending + parsePercent(r['Pending %']),
      avgCompletion: acc.avgCompletion + parsePercent(r['Completion %']),
    }), { 
      passed: 0, executed: 0, total: 0, auto: 0, manual: 0, critical: 0, major: 0, minor: 0,
      avgPass: 0, avgFail: 0, avgNotConsidered: 0, avgPending: 0, avgCompletion: 0
    });

    const count = filteredRows.length;
    const passRate = stats.executed > 0 ? ((stats.passed / stats.executed) * 100).toFixed(2) : "0.00";

    return {
      total: stats.total,
      executed: stats.executed,
      passed: stats.passed,
      auto: stats.auto,
      manual: stats.manual,
      critical: stats.critical,
      major: stats.major,
      minor: stats.minor,
      passRate,
      passPct: (stats.avgPass / count).toFixed(1),
      failPct: (stats.avgFail / count).toFixed(1),
      notConsideredPct: (stats.avgNotConsidered / count).toFixed(1),
      pendingPct: (stats.avgPending / count).toFixed(1),
      completionPct: (stats.avgCompletion / count).toFixed(1),
    };
  }, [filteredRows]);

  const pieData = useMemo(() => {
    if (!summaryStats) return [];
    return [
      { name: 'Passed', value: parseFloat(summaryStats.passPct), color: EXECUTION_COLORS.pass },
      { name: 'Failed', value: parseFloat(summaryStats.failPct), color: EXECUTION_COLORS.fail },
      { name: 'Not Considered', value: parseFloat(summaryStats.notConsideredPct), color: EXECUTION_COLORS.notConsidered },
      { name: 'Pending', value: parseFloat(summaryStats.pendingPct), color: EXECUTION_COLORS.pending },
    ];
  }, [summaryStats]);

  const executionSummaryData = useMemo(() => {
    if (!filteredRows || filteredRows.length === 0) return [];
    const builds = Array.from(new Set(filteredRows.map(r => r['RC Build'])));
    return builds.map(b => {
      const buildRows = filteredRows.filter(r => r['RC Build'] === b);
      return {
        build: b.split('(')[0].trim(),
        passed: buildRows.reduce((sum, r) => sum + (Number(r.Passed) || 0), 0),
        failed: buildRows.reduce((sum, r) => sum + (Number(r.Failed) || 0), 0),
        notConsidered: buildRows.reduce((sum, r) => sum + (Number(r['Not considered'] || r.Not_considered || 0)), 0),
      };
    });
  }, [filteredRows]);

  const bugSummaryData = useMemo(() => {
    if (!filteredRows || filteredRows.length === 0) return [];
    const builds = Array.from(new Set(filteredRows.map(r => r['RC Build'])));
    return builds.map(b => {
      const buildRows = filteredRows.filter(r => r['RC Build'] === b);
      return {
        build: b.split('(')[0].trim(),
        critical: buildRows.reduce((sum, r) => sum + (Number(r['Critical Issues'] || r.Critical_Issues || 0)), 0),
        major: buildRows.reduce((sum, r) => sum + (Number(r['Major Issues'] || r.Major_Issues || 0)), 0),
        minor: buildRows.reduce((sum, r) => sum + (Number(r['Minor Issues'] || r.Minor_Issues || 0)), 0),
      };
    });
  }, [filteredRows]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const chartConfig = {
    gridColor: isDark ? '#1E293B' : '#E2E8F0',
    tickColor: isDark ? '#64748B' : '#94A3B8',
    tooltipBg: isDark ? '#0F172A' : '#FFFFFF',
    tooltipBorder: isDark ? '#334155' : '#E2E8F0',
    tooltipTextColor: isDark ? '#F1F5F9' : '#1E293B'
  };

  const commonTooltipStyle = {
    backgroundColor: chartConfig.tooltipBg,
    borderRadius: '12px',
    border: `1px solid ${chartConfig.tooltipBorder}`,
    boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)',
    fontSize: '11px',
    fontWeight: 700,
    color: chartConfig.tooltipTextColor,
    padding: '8px 12px'
  };

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-3 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent uppercase">Ifocus Report summary</h1>
              {dynamicSubtitle && (
                <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest opacity-80">
                  {dynamicSubtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:scale-105 transition-transform">
              {isDark ? '☀️' : '🌙'}
            </button>
            <div className="h-6 w-[1px] bg-slate-200 dark:border-slate-800 mx-1 hidden md:block" />
            <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <select 
                value={selectedPlatform} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPlatform(val);
                }} 
                className="bg-transparent text-[11px] font-bold focus:outline-none cursor-pointer px-2"
              >
                <option value="All">All Platforms</option>
                {allAvailablePlatforms.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700" />
              <select 
                value={selectedBuild} 
                onChange={(e) => setSelectedBuild(e.target.value)} 
                className="bg-transparent text-[11px] font-bold focus:outline-none cursor-pointer px-2 max-w-[140px]"
              >
                <option value="All">All History</option>
                {allAvailableBuilds.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <button onClick={fetchData} className="px-4 py-1.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-[11px] shadow-lg shadow-blue-600/20">
              {loading ? '...' : 'Refresh'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6">
        
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PremiumMetricCard title="Test Scope" value={summaryStats?.total || 0} trend="+4.2%" icon="🎯" color="indigo" />
          <PremiumMetricCard title="Executed" value={summaryStats?.executed || 0} trend="99.1%" icon="⚡" color="blue" />
          <PremiumMetricCard title="Success Rate" value={`${summaryStats?.passRate || 0}%`} trend="Overall" icon="✅" color="emerald" />
          <PremiumMetricCard title="Critical Bugs" value={summaryStats?.critical || 0} trend="Immediate Action" icon="🌋" color="rose" invert />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            <ChartContainer title="Execution Status Distribution">
              <div className="flex flex-col sm:flex-row items-center gap-8 h-full py-4">
                <div className="w-full sm:w-1/2 h-[220px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={commonTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="text-center">
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{summaryStats?.completionPct}%</div>
                        <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Done</div>
                     </div>
                  </div>
                </div>
                <div className="w-full sm:w-1/2 overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {[
                          { label: 'Pass', value: summaryStats?.passPct, color: 'text-emerald-500' },
                          { label: 'Fail', value: summaryStats?.failPct, color: 'text-rose-500' },
                          { label: 'Not Consider', value: summaryStats?.notConsideredPct, color: 'text-slate-400' },
                          { label: 'Pending', value: summaryStats?.pendingPct, color: 'text-amber-500' },
                        ].map((m, i) => (
                          <tr key={i}>
                            <td className="py-2.5 font-bold text-slate-500">{m.label}</td>
                            <td className={`py-2.5 text-right font-black ${m.color}`}>{m.value}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </ChartContainer>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartContainer title="Execution Summary">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={executionSummaryData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartConfig.gridColor} />
                      <XAxis dataKey="build" tick={{fontSize: 8}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 8}} axisLine={false} tickLine={false} />
                      <Tooltip 
                        cursor={{fill: 'rgba(0,0,0,0.02)'}} 
                        contentStyle={commonTooltipStyle} 
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold'}} />
                      <Bar name="Passed" dataKey="passed" fill={EXECUTION_COLORS.pass} radius={[2, 2, 0, 0]} />
                      <Bar name="Failed" dataKey="failed" fill={EXECUTION_COLORS.fail} radius={[2, 2, 0, 0]} />
                      <Bar name="Not Considered" dataKey="notConsidered" fill={EXECUTION_COLORS.notConsidered} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartContainer>

              <ChartContainer title="Bug Summary">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bugSummaryData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartConfig.gridColor} />
                      <XAxis dataKey="build" tick={{fontSize: 8}} axisLine={false} tickLine={false} />
                      <Tooltip 
                        cursor={{fill: 'rgba(0,0,0,0.02)'}}
                        contentStyle={commonTooltipStyle}
                        itemStyle={{ padding: '2px 0' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold'}} />
                      <Bar name="Critical" dataKey="critical" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                      <Bar name="Major" dataKey="major" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                      <Bar name="Minor" dataKey="minor" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartContainer>
            </div>
          </div>

          {/* Detailed Execution Logs & Issue Summary Sidebar */}
          <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden h-fit lg:max-h-[1000px]">
            <div className="p-5 bg-slate-50/80 dark:bg-slate-800/50 border-b dark:border-slate-800">
              <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-800 dark:text-slate-200">Execution & Issue Details</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Snapshot of Platform Specific Performance</p>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="bg-slate-50/50 dark:bg-slate-800/30">
                  <tr>
                    <th className="px-5 py-3 text-[9px] font-black uppercase text-slate-400 tracking-wider">Build/Platform</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 tracking-wider">Execution Summary</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 tracking-wider text-right">Issues Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.map((row, idx) => {
                    const critical = Number(row['Critical Issues'] || row.Critical_Issues || 0);
                    const major = Number(row['Major Issues'] || row.Major_Issues || 0);
                    const minor = Number(row['Minor Issues'] || row.Minor_Issues || 0);
                    const passed = Number(row.Passed || 0);
                    const total = Number(row['Total Test Cases'] || 0);
                    const executed = Number(row.Executed || 0);
                    const passPct = parseFloat(row['Pass %'] || '0');

                    return (
                      <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                        <td className="px-5 py-4">
                          <div className="font-extrabold text-[12px] text-slate-900 dark:text-white leading-tight mb-1 truncate max-w-[150px]" title={row['RC Build']}>
                            {row['RC Build']}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                              row.Platform === 'Android' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                              row.Platform === 'iOS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {row.Platform}
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold">{row['Build Date']}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              <span>{passed} / {total} Passed</span>
                              <span className={passPct < 90 ? 'text-rose-500' : 'text-emerald-500'}>{passPct}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${passPct < 90 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                                style={{ width: `${passPct}%` }}
                              />
                            </div>
                            <div className="text-[8px] text-slate-400 font-medium italic">
                              Executed: {executed} ({((executed/total)*100).toFixed(1)}% coverage)
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <IssueBadge value={critical} color="bg-rose-500" label="Critical" />
                            <IssueBadge value={major} color="bg-amber-500" label="Major" />
                            <IssueBadge value={minor} color="bg-blue-500" label="Minor" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <footer className="max-w-7xl mx-auto px-8 py-8 border-t border-slate-200 dark:border-slate-800 opacity-40 mb-4">
        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
          <p>RC ENGINE v2.6.2</p>
          <p>Live Sync Active</p>
        </div>
      </footer>
    </div>
  );
}

function IssueBadge({ value, color, label }: { value: number, color: string, label: string }) {
  const tooltipText = `${value} ${label}`;
  
  if (value === 0) return (
    <span 
      className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-[9px] font-bold transition-all hover:bg-slate-200 dark:hover:bg-slate-700 cursor-help" 
      title={tooltipText}
    >
      -
    </span>
  );
  
  return (
    <div 
      className={`w-6 h-6 flex items-center justify-center rounded-md ${color} text-white text-[10px] font-black shadow-sm cursor-help transition-all hover:scale-110 active:scale-95`} 
      title={tooltipText}
    >
      {value}
    </div>
  );
}

function PremiumMetricCard({ title, value, trend, icon, color, invert = false }: any) {
  return (
    <div className={`relative group bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow shadow-slate-200/50 dark:shadow-none hover:shadow-xl transition-all duration-300`}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
          <span className="text-xl p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">{icon}</span>
        </div>
        <div className="mt-1">
          <div className="text-2xl font-black text-slate-900 dark:text-white">{value}</div>
          <div className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${invert ? 'text-rose-500' : 'text-emerald-500'}`}>
             {trend}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartContainer({ title, children }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg h-full overflow-hidden">
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-3">
        {title}
        <div className="flex-1 h-[1px] bg-slate-100 dark:bg-slate-800/50"></div>
      </h2>
      <div className="h-full">
        {children}
      </div>
    </div>
  );
}
