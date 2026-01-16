
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { DashboardData } from './types';
import { parseCSV } from './utils/dataParser';

// --- CONFIGURATION ---
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1yjf5kI6WPNwi_WhH3dFTgiIUONztM54I50sJtnr_PxY/export?format=csv&gid=0';

const EXECUTION_COLORS = {
  pass: '#10B981',
  fail: '#F43F5E',
  notConsidered: '#94A3B8',
  pending: '#F59E0B',
};

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => 
    (localStorage.getItem('dashboard-theme') as 'light' | 'dark') || 'light'
  );
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Filters State
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
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Fetch error. Using static sample.");
      const sampleCsv = `Sprint number,RC Build,Build Date,Platform,Total Test Cases,Executed,Passed,Pass %,Failed,Not considered,Not considered %,Pending %,Completion %,Critical Issues,Major Issues,Minor Issues,Status\n139,5.139.118 (68151),2 Jan 2026,Android,892,892,802,89.91%,6,84,9.42%,0.00%,100.00%,0,0,1,Active`;
      setData(parseCSV(sampleCsv));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { localStorage.setItem('dashboard-theme', theme); }, [theme]);

  // Derived Filter Options
  const platforms = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.rows.map(r => r.Platform))).filter(Boolean).sort();
  }, [data]);

  const builds = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (selectedPlatform !== 'All') {
      rows = rows.filter(r => r.Platform === selectedPlatform);
    }
    return Array.from(new Set(rows.map(r => r['RC Build']))).filter(Boolean).reverse();
  }, [data, selectedPlatform]);

  // Main Filtering Logic
  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    
    if (selectedPlatform !== 'All') {
      rows = rows.filter(r => r.Platform === selectedPlatform);
    }
    
    if (selectedBuild !== 'All') {
      rows = rows.filter(r => r['RC Build'] === selectedBuild);
    }

    if (startDate) {
      const sDate = new Date(startDate);
      rows = rows.filter(r => new Date(r['Build Date']) >= sDate);
    }

    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      rows = rows.filter(r => new Date(r['Build Date']) <= eDate);
    }
    
    return rows;
  }, [data, selectedPlatform, selectedBuild, startDate, endDate]);

  const summaryStats = useMemo(() => {
    if (filteredRows.length === 0) return null;
    const stats = filteredRows.reduce((acc, r) => ({
      passed: acc.passed + (Number(r.Passed) || 0),
      total: acc.total + (Number(r['Total Test Cases']) || 0),
      critical: acc.critical + (Number(r['Critical Issues'] || r.Critical_Issues || 0)),
      major: acc.major + (Number(r['Major Issues'] || r.Major_Issues || 0)),
      executed: acc.executed + (Number(r.Executed) || 0),
    }), { passed: 0, total: 0, critical: 0, major: 0, executed: 0 });

    return {
      passed: stats.passed,
      total: stats.total,
      critical: stats.critical,
      major: stats.major,
      executed: stats.executed,
      passRate: stats.executed > 0 ? ((stats.passed / stats.executed) * 100).toFixed(1) : "0.0",
      completion: stats.total > 0 ? ((stats.executed / stats.total) * 100).toFixed(1) : "0.0"
    };
  }, [filteredRows]);

  const chartData = useMemo(() => {
    if (!filteredRows.length) return [];
    const uniqueBuilds = Array.from(new Set(filteredRows.map(r => r['RC Build'])));
    return uniqueBuilds.map(b => {
      const buildRows = filteredRows.filter(r => r['RC Build'] === b);
      return {
        build: b.split('(')[0].trim(),
        passed: buildRows.reduce((sum, r) => sum + (Number(r.Passed) || 0), 0),
        failed: buildRows.reduce((sum, r) => sum + (Number(r.Failed) || 0), 0),
        notConsidered: buildRows.reduce((sum, r) => sum + (Number(r['Not considered'] || 0)), 0),
        critical: buildRows.reduce((sum, r) => sum + (Number(r['Critical Issues'] || 0)), 0),
        major: buildRows.reduce((sum, r) => sum + (Number(r['Major Issues'] || 0)), 0),
      };
    });
  }, [filteredRows]);

  const pieData = useMemo(() => {
    if (!filteredRows.length) return [];
    const totalPassed = filteredRows.reduce((sum, r) => sum + (Number(r.Passed) || 0), 0);
    const totalFailed = filteredRows.reduce((sum, r) => sum + (Number(r.Failed) || 0), 0);
    const totalNC = filteredRows.reduce((sum, r) => sum + (Number(r['Not considered'] || 0)), 0);
    return [
      { name: 'Pass', value: totalPassed, color: EXECUTION_COLORS.pass },
      { name: 'Fail', value: totalFailed, color: EXECUTION_COLORS.fail },
      { name: 'N.C', value: totalNC, color: EXECUTION_COLORS.notConsidered },
    ];
  }, [filteredRows]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const openDatePicker = (e: React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
    try {
      if ('showPicker' in e.currentTarget) {
        (e.currentTarget as any).showPicker();
      }
    } catch (err) {
      console.debug("Native date picker trigger failed, falling back to standard interaction.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 pb-12">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
              <span className="font-black text-xl">IF</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-extrabold uppercase tracking-tight truncate">Ifocus - Report Summary</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Live Sync • {lastUpdated?.toLocaleTimeString() || 'Connecting...'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button onClick={toggleTheme} className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:scale-105 transition-transform shadow-sm">
              {isDark ? '☀️' : '🌙'}
            </button>
            <button onClick={fetchData} className="px-3 md:px-5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] md:text-xs font-black uppercase hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
              {loading ? '...' : 'Refresh'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        
        {/* Filters Panel */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Platform</label>
              <div className="relative">
                <select 
                  value={selectedPlatform} 
                  onChange={(e) => {
                    setSelectedPlatform(e.target.value);
                    setSelectedBuild('All');
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer appearance-none pr-10"
                >
                  <option value="All">All Platforms</option>
                  {platforms.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Build Version</label>
              <div className="relative">
                <select 
                  value={selectedBuild} 
                  onChange={(e) => setSelectedBuild(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer appearance-none pr-10"
                >
                  <option value="All">All Build Versions</option>
                  {builds.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Start Date</label>
              <div className="relative group">
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onClick={openDatePicker}
                  onFocus={openDatePicker}
                  placeholder="Select Start Date"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer appearance-none relative z-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 z-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">End Date</label>
              <div className="relative group">
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={openDatePicker}
                  onFocus={openDatePicker}
                  placeholder="Select End Date"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer appearance-none relative z-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 z-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                </div>
              </div>
            </div>
          </div>
          
          {(selectedPlatform !== 'All' || selectedBuild !== 'All' || startDate || endDate) && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => {
                  setSelectedPlatform('All');
                  setSelectedBuild('All');
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                Clear All Filters
              </button>
            </div>
          )}
        </section>

        {/* Metrics Overview */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Test Scope" value={summaryStats?.total || 0} icon="🎯" color="indigo" />
          <MetricCard title="Executed" value={summaryStats?.executed || 0} icon="⚡" color="blue" />
          <MetricCard title="Success" value={`${summaryStats?.passRate || 0}%`} icon="✅" color="emerald" />
          <MetricCard title="Critical Bugs" value={summaryStats?.critical || 0} icon="🌋" color="rose" />
        </section>

        {/* Full-width Charts and Logs */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Execution Breakdown">
              <div className="h-[280px] flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
                <div className="w-full sm:w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-3 sm:space-y-4">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d.name}</span>
                      <span className="text-xs sm:text-sm font-black" style={{ color: d.color }}>{d.value} Cases</span>
                    </div>
                  ))}
                  <div className="pt-2">
                    <div className="text-[9px] font-black uppercase text-slate-300 tracking-widest mb-1">Pass Rate</div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-500">{summaryStats?.passRate}%</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Issue Trends across Builds">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1E293B' : '#E2E8F0'} />
                    <XAxis dataKey="build" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '10px' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                    <Bar name="Critical" dataKey="critical" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                    <Bar name="Major" dataKey="major" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card title="Execution & Issue Detailed Logs">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Build Info</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Platform</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Pass Rate</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Metrics</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Issues (C|M|m)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.map((row, idx) => {
                    const passVal = parseFloat(row['Pass %'] || '0');
                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-5">
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white">{row['RC Build']}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{row['Build Date']}</div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                            row.Platform === 'Android' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {row.Platform}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${passVal > 90 ? 'bg-emerald-500' : passVal > 70 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                style={{ width: `${passVal}%` }}
                              ></div>
                            </div>
                            <span className={`text-xs font-black ${passVal > 90 ? 'text-emerald-600' : 'text-amber-600'}`}>{row['Pass %']}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-[10px] font-bold text-slate-500">
                            TC: {row['Total Test Cases']} | EX: {row['Executed']}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Badge value={row['Critical Issues']} color="bg-rose-500" label="Critical" />
                            <Badge value={row['Major Issues']} color="bg-amber-500" label="Major" />
                            <Badge value={row['Minor Issues']} color="bg-blue-500" label="Minor" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredRows.length === 0 && (
              <div className="py-20 text-center">
                <div className="text-3xl mb-3">🔍</div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">No matching records found</div>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ title, value, icon, color }: any) {
  const colors: any = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600',
  };
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-500 transition-colors">{title}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${colors[color]}`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</div>
    </div>
  );
}

function Card({ title, children, loading }: any) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
      <div className="px-6 py-5 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/20">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</h3>
        {loading && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function Badge({ value, color, label }: any) {
  const tooltip = `${value} ${label}`;
  if (!value || value === 0) return <span className="w-6 h-6 flex items-center justify-center text-slate-200 dark:text-slate-700 text-[10px] font-bold">-</span>;
  return (
    <div 
      title={tooltip} 
      className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-black cursor-help hover:scale-110 transition-transform shadow-sm ${color}`}
    >
      {value}
    </div>
  );
}
