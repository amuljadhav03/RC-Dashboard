import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LabelList, Sector
} from 'recharts';
import { DashboardData } from './types';
import { parseCSV } from './utils/dataParser';

// --- CONFIGURATION ---
const PUBLISHED_ID = '2PACX-1vSrx7lqwi5bjj99rYho8jYGBYH47sYw2a5d62uPGrKS-HvSgiz6o-Rx_opsCMGNhVNRjJNx2bi6OTfK';
const BASE_URL = `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_ID}/pub?output=csv`;
const REFRESH_INTERVAL = 120000;

const TABS_CONFIG = {
  SUMMARY: { id: 'summary', label: 'Report Summary', gid: '0', icon: '📊' },
  NEW_ISSUES: { id: 'new_issues', label: 'New Issues', gid: '1410887303', icon: '🐛' },
  VALIDATION: { id: 'validation', label: 'Ticket Validation', gid: '1853472064', icon: '✅' },
};

const EXECUTION_COLORS = {
  pass: '#10B981',
  fail: '#F43F5E',
  notConsidered: '#94A3B8',
  automation: '#8B5CF6',
  manual: '#EC4899',
  critical: '#F43F5E',
  major: '#F59E0B',
  minor: '#3B82F6',
};

const BUILD_COL_ALIASES = ['RC Build', 'Build Version', 'Build', 'Version', 'Build Number'];
const PLATFORM_COL_ALIASES = ['Platform', 'OS', 'Environment'];
const DATE_COL_ALIASES = ['Build Date', 'Date', 'Reported Date', 'Created At'];
const BUILD_TYPE_COL_ALIASES = ['Build Type', 'Type', 'Deployment Type', 'Category'];
const BUILD_STATUS_COL_ALIASES = ['Status', 'Overall Status', 'Result', 'Execution Status'];

// --- INTERFACES ---
interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
}

interface CardProps {
  title: string;
  children?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

interface BadgeProps {
  value: any;
  color: string;
  label: string;
  size?: 'sm' | 'md';
}

// --- SUB-COMPONENTS ---

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const title = label || payload[0].name;
  return (
    <div className="bg-white/98 dark:bg-slate-900/98 backdrop-blur-md p-3 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl animate-in fade-in duration-150 min-w-[140px] pointer-events-none z-[200]">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 border-b border-slate-50 dark:border-slate-800 pb-1.5">{title}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => {
          const percent = entry.payload?.percent !== undefined ? entry.payload.percent : entry.percent;
          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{entry.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black text-slate-900 dark:text-white">{entry.value}</span>
                {percent !== undefined && (
                  <span className="text-[9px] font-black text-primary-500 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-md">
                    {(percent * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function DateSelector({ value, onChange, placeholder }: { value: string, onChange: (v: string) => void, placeholder: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const click = (e: MouseEvent) => { if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, []);

  const formatDate = (val: string) => val ? new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : placeholder;

  return (
    <div className="relative flex-1 min-w-0">
      <div onClick={() => setIsOpen(!isOpen)} className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-between group">
        <span className={`truncate mr-2 ${value ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{formatDate(value)}</span>
        <svg className="w-3.5 h-3.5 text-slate-300 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
      {isOpen && (
        <div ref={calendarRef} className="absolute top-full left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 mt-2 z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-4 w-[260px] animate-in fade-in zoom-in-95">
           <input type="date" value={value} onChange={(e) => { onChange(e.target.value); setIsOpen(false); }} className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border-none text-xs font-bold focus:ring-2 focus:ring-primary-500" />
           {value && <button onClick={() => { onChange(''); setIsOpen(false); }} className="w-full mt-3 text-[9px] font-black uppercase text-slate-400 hover:text-rose-500">Clear</button>}
        </div>
      )}
    </div>
  );
}

// --- MAIN APP COMPONENT ---

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('dashboard-theme') as 'light' | 'dark') || 'light');
  const [dataMap, setDataMap] = useState<Record<string, DashboardData>>({});
  const [activeTab, setActiveTab] = useState<string>(TABS_CONFIG.SUMMARY.id);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});
  const [lastUpdatedMap, setLastUpdatedMap] = useState<Record<string, Date>>({});
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('All');
  const [selectedBuild, setSelectedBuild] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const isDark = theme === 'dark';

  useEffect(() => {
    localStorage.setItem('dashboard-theme', theme);
    document.documentElement.classList.toggle('dark', isDark);
  }, [theme, isDark]);

  const fetchData = useCallback(async (tabId: string, silent = false) => {
    if (!silent) { setLoadingMap(p => ({ ...p, [tabId]: true })); setErrorMap(p => ({ ...p, [tabId]: null })); }
    const config = Object.values(TABS_CONFIG).find(t => t.id === tabId);
    if (!config) return;
    try {
      const resp = await fetch(`${BASE_URL}&gid=${config.gid}&t=${Date.now()}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      if (text.includes('<!DOCTYPE html>')) throw new Error("Private sheet");
      setDataMap(p => ({ ...p, [tabId]: parseCSV(text) }));
      setLastUpdatedMap(p => ({ ...p, [tabId]: new Date() }));
    } catch (e: any) {
      if (!silent) setErrorMap(p => ({ ...p, [tabId]: e.message }));
    } finally { if (!silent) setLoadingMap(p => ({ ...p, [tabId]: false })); }
  }, []);

  const syncAll = useCallback(async (isAuto = false) => {
    if (isAuto) setIsSyncing(true);
    await Promise.all(Object.values(TABS_CONFIG).map(t => fetchData(t.id, isAuto)));
    if (isAuto) setIsSyncing(false);
    setRefreshProgress(0);
  }, [fetchData]);

  useEffect(() => { syncAll(); }, []);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const prog = Math.min(((Date.now() - start) / REFRESH_INTERVAL) * 100, 100);
      setRefreshProgress(prog);
      if (prog >= 100) syncAll(true);
    }, 1000);
    return () => clearInterval(interval);
  }, [syncAll, activeTab]);

  const platforms = useMemo(() => {
    const all = new Set<string>();
    Object.values(dataMap).forEach(d => {
      const col = PLATFORM_COL_ALIASES.find(a => d.headers.includes(a));
      if (col) d.rows.forEach(r => r[col] && all.add(String(r[col])));
    });
    return Array.from(all).sort();
  }, [dataMap]);

  const builds = useMemo(() => {
    const all = new Set<string>();
    Object.values(dataMap).forEach(d => {
      const pCol = PLATFORM_COL_ALIASES.find(a => d.headers.includes(a)), bCol = BUILD_COL_ALIASES.find(a => d.headers.includes(a));
      if (bCol) d.rows.forEach(r => {
        if (selectedPlatform === 'All' || (pCol && String(r[pCol]) === selectedPlatform)) all.add(String(r[bCol] || '').trim());
      });
    });
    return Array.from(all).filter(Boolean).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [dataMap, selectedPlatform]);

  const buildMetadata = useMemo(() => {
    if (selectedBuild === 'All') return null;
    const summary = dataMap[TABS_CONFIG.SUMMARY.id];
    if (!summary) return null;
    const bCol = BUILD_COL_ALIASES.find(a => summary.headers.includes(a));
    const match = summary.rows.find(r => String(r[bCol || '']) === selectedBuild);
    if (!match) return null;
    const tCol = BUILD_TYPE_COL_ALIASES.find(a => summary.headers.includes(a)), dCol = DATE_COL_ALIASES.find(a => summary.headers.includes(a)), sCol = BUILD_STATUS_COL_ALIASES.find(a => summary.headers.includes(a));
    return {
      build: String(match[bCol || '']),
      type: tCol ? String(match[tCol] || 'N/A') : 'N/A',
      date: dCol ? String(match[dCol] || 'N/A') : 'N/A',
      status: sCol ? String(match[sCol] || 'N/A') : 'N/A',
    };
  }, [dataMap, selectedBuild]);

  const filteredRows = useMemo(() => {
    const data = dataMap[activeTab];
    if (!data) return [];
    let rows = [...data.rows];
    const pCol = PLATFORM_COL_ALIASES.find(a => data.headers.includes(a)), bCol = BUILD_COL_ALIASES.find(a => data.headers.includes(a)), dCol = DATE_COL_ALIASES.find(a => data.headers.includes(a));
    if (selectedPlatform !== 'All' && pCol) rows = rows.filter(r => String(r[pCol]) === selectedPlatform);
    if (selectedBuild !== 'All' && bCol) rows = rows.filter(r => String(r[bCol]) === selectedBuild);
    if (startDate || endDate) rows = rows.filter(r => {
      if (!r[dCol || '']) return false;
      const bd = new Date(r[dCol || '']);
      return (!startDate || bd >= new Date(startDate)) && (!endDate || bd <= new Date(endDate));
    });
    return rows;
  }, [dataMap, activeTab, selectedPlatform, selectedBuild, startDate, endDate]);

  const summaryStats = useMemo(() => {
    if (activeTab !== TABS_CONFIG.SUMMARY.id || !filteredRows.length) return null;
    return filteredRows.reduce((acc, r) => ({
      total: acc.total + (Number(r['Total Test Cases']) || 0),
      executed: acc.executed + (Number(r.Executed) || 0),
      passed: acc.passed + (Number(r.Passed) || 0),
      critical: acc.critical + (Number(r['Critical Issues']) || 0),
    }), { total: 0, executed: 0, passed: 0, critical: 0 });
  }, [filteredRows, activeTab]);

  const pieData = useMemo(() => {
    if (activeTab !== TABS_CONFIG.SUMMARY.id || !filteredRows.length) return [];
    return [
      { name: 'Pass', value: filteredRows.reduce((s, r) => s + (Number(r.Passed) || 0), 0), color: EXECUTION_COLORS.pass },
      { name: 'Fail', value: filteredRows.reduce((s, r) => s + (Number(r.Failed) || 0), 0), color: EXECUTION_COLORS.fail },
      { name: 'N/A', value: filteredRows.reduce((s, r) => s + (Number(r['Not considered']) || 0), 0), color: EXECUTION_COLORS.notConsidered },
    ];
  }, [filteredRows, activeTab]);

  const trendData = useMemo(() => filteredRows.slice(0, 10).reverse().map(r => ({
    name: r['RC Build'] || r['Build'] || r['Build Version'],
    Passed: Number(r.Passed) || 0,
    Failed: Number(r.Failed) || 0,
    Critical: Number(r['Critical Issues']) || 0,
    Major: Number(r['Major Issues']) || 0,
    Minor: Number(r['Minor Issues']) || 0,
    Automation: Number(r['Automation executed'] || r['Automation']) || 0,
    Manual: Number(r['Manual executed'] || r['Manual']) || 0,
  })), [filteredRows]);

  const renderActiveShape = (props: any) => <Sector {...props} outerRadius={props.outerRadius + 8} stroke="none" className="transition-all duration-300" />;

  const renderPieLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, percent, name, value, fill } = props;
    if (percent < 0.03) return null;
    const RADIAN = Math.PI / 180, sin = Math.sin(-RADIAN * midAngle), cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 4) * cos, sy = cy + (outerRadius + 4) * sin, mx = cx + (outerRadius + 28) * cos, my = cy + (outerRadius + 28) * sin, ex = mx + (cos >= 0 ? 1 : -1) * 20, ey = my;
    return (
      <g>
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={2} opacity={0.6} />
        <circle cx={ex} cy={ey} r={2.5} fill={fill} />
        <text x={ex + (cos >= 0 ? 8 : -8)} y={ey} textAnchor={cos >= 0 ? 'start' : 'end'} fill={isDark ? '#cbd5e1' : '#1e293b'} dominantBaseline="central" className="text-[11px] md:text-[12px] font-black uppercase tracking-tight">{name}: {value}</text>
        <text x={ex + (cos >= 0 ? 8 : -8)} y={ey} dy={14} textAnchor={cos >= 0 ? 'start' : 'end'} fill={isDark ? '#64748b' : '#94a3b8'} dominantBaseline="central" className="text-[10px] md:text-[11px] font-bold">({(percent * 100).toFixed(1)}%)</text>
      </g>
    );
  };

  const getBuildTypeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('hotfix')) return 'bg-rose-600';
    if (t.includes('planned')) return 'bg-emerald-600';
    if (t.includes('emergency')) return 'bg-orange-500';
    if (t.includes('adhoc') || t.includes('ad-hoc')) return 'bg-amber-500';
    if (t.includes('release')) return 'bg-primary-600';
    return 'bg-slate-500'; 
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] pb-12 transition-all">
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-900 z-[60] overflow-hidden">
        <div className="h-full bg-primary-600 transition-all duration-1000 ease-linear" style={{ width: `${refreshProgress}%` }} />
      </div>

      <nav className="sticky top-0 z-50 glass border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary-500/20">i</div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-xl font-black uppercase tracking-tight text-primary-600 truncate">{selectedBuild !== 'All' ? `Analytics: ${selectedBuild}` : 'RC Build Analytics'}</h1>
              <div className="flex items-center gap-1.5 mt-0.5"><span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Synced: {lastUpdatedMap[activeTab]?.toLocaleTimeString() || 'Waiting'}</span></div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:scale-105 transition-all">{isDark ? '☀️' : '🌙'}</button>
            <button onClick={() => syncAll()} className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase active:scale-95 shadow-lg shadow-primary-500/20">Sync</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative">
          {(selectedPlatform !== 'All' || selectedBuild !== 'All' || startDate || endDate) && (
            <button onClick={() => { setSelectedPlatform('All'); setSelectedBuild('All'); setStartDate(''); setEndDate(''); }} className="absolute top-4 right-8 text-[10px] font-black uppercase text-slate-400 hover:text-rose-500">Reset Filters</button>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Platform</label><select value={selectedPlatform} onChange={e => { setSelectedPlatform(e.target.value); setSelectedBuild('All'); }} className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 mt-1 rounded-2xl text-xs font-bold border-none appearance-none cursor-pointer">{platforms.map(p => <option key={p} value={p}>{p}</option>)}<option value="All">All Platforms</option></select></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Build</label><select value={selectedBuild} onChange={e => setSelectedBuild(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 mt-1 rounded-2xl text-xs font-bold border-none appearance-none cursor-pointer"><option value="All">All Builds</option>{builds.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
            <div className="md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Date Range</label><div className="flex items-center gap-2 mt-1"><DateSelector value={startDate} onChange={setStartDate} placeholder="Start Date" /><span className="text-slate-300">~</span><DateSelector value={endDate} onChange={setEndDate} placeholder="End Date" /></div></div>
          </div>
        </section>

        {buildMetadata && (
          <div className="bg-primary-600/5 dark:bg-primary-400/5 border border-primary-100 dark:border-primary-900/30 rounded-[2rem] p-6 flex flex-wrap gap-8 animate-in slide-in-from-top-4">
            <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-slate-400 mb-1">Build Version</span><div className="flex items-center gap-3"><span className="text-base font-black text-slate-900 dark:text-white">{buildMetadata.build}</span><span className={`text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${getBuildTypeColor(buildMetadata.type)} shadow-sm transition-colors duration-300`}>{buildMetadata.type}</span></div></div>
            <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-slate-400 mb-1">Date</span><span className="text-sm font-bold text-slate-700 dark:text-slate-300">{buildMetadata.date}</span></div>
            <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-slate-400 mb-1">Status</span><span className={`text-sm font-black uppercase ${buildMetadata.status.toLowerCase().includes('pass') ? 'text-emerald-500' : 'text-rose-500'}`}>{buildMetadata.status}</span></div>
          </div>
        )}

        <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-[1.8rem] w-full md:w-auto overflow-x-auto gap-1 shadow-inner">
          {Object.values(TABS_CONFIG).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}><span>{tab.icon}</span>{tab.label}</button>
          ))}
        </div>

        {activeTab === 'summary' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Total Cases" value={summaryStats?.total || 0} icon="🎯" />
              <MetricCard title="Executed" value={summaryStats?.executed || 0} icon="⚡" />
              <MetricCard title="Pass Rate" value={`${summaryStats?.executed ? ((summaryStats.passed / summaryStats.executed) * 100).toFixed(1) : 0}%`} icon="✅" />
              <MetricCard title="Critical" value={summaryStats?.critical || 0} icon="🌋" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <Card title="Distribution" loading={loadingMap[activeTab]} error={errorMap[activeTab]} onRetry={() => fetchData(activeTab)}>
                <div className="h-[320px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <Pie 
                        {...({ activeIndex, activeShape: renderActiveShape } as any)} 
                        data={pieData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={68} 
                        outerRadius={85} 
                        paddingAngle={5} 
                        dataKey="value" 
                        label={renderPieLabel} 
                        labelLine={false} 
                        onMouseEnter={(_, i) => setActiveIndex(i)} 
                        onMouseLeave={() => setActiveIndex(-1)}
                      >
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} offset={30} wrapperStyle={{ zIndex: 1000 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-[50]">
                    <div className="text-[11px] font-black text-slate-400 uppercase mb-1 tracking-widest leading-none">Total</div>
                    <div className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight">{pieData.reduce((s, c) => s + c.value, 0)}</div>
                  </div>
                </div>
              </Card>

              <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Issue Trend" loading={loadingMap[activeTab]} error={errorMap[activeTab]}>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} content={<CustomTooltip />} />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '25px', fontSize: '11px', fontWeight: '800' }} />
                        <Bar name="Critical" dataKey="Critical" fill={EXECUTION_COLORS.critical} radius={[6, 6, 0, 0]} barSize={14}>
                          <LabelList position="top" fontSize={11} fontWeight="900" fill={isDark ? '#f8fafc' : '#1e293b'} offset={8} />
                        </Bar>
                        <Bar name="Major" dataKey="Major" fill={EXECUTION_COLORS.major} radius={[6, 6, 0, 0]} barSize={14}>
                          <LabelList position="top" fontSize={11} fontWeight="900" fill={isDark ? '#f8fafc' : '#1e293b'} offset={8} />
                        </Bar>
                        <Bar name="Minor" dataKey="Minor" fill={EXECUTION_COLORS.minor} radius={[6, 6, 0, 0]} barSize={14}>
                          <LabelList position="top" fontSize={11} fontWeight="900" fill={isDark ? '#f8fafc' : '#1e293b'} offset={8} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="Methodology" loading={loadingMap[activeTab]} error={errorMap[activeTab]}>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} content={<CustomTooltip />} />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '25px', fontSize: '11px', fontWeight: '800' }} />
                        <Bar name="Automation" dataKey="Automation" fill={EXECUTION_COLORS.automation} radius={[6, 6, 0, 0]} barSize={16}>
                          <LabelList position="top" fontSize={11} fontWeight="900" fill={isDark ? '#f8fafc' : '#1e293b'} offset={8} />
                        </Bar>
                        <Bar name="Manual" dataKey="Manual" fill={EXECUTION_COLORS.manual} radius={[6, 6, 0, 0]} barSize={16}>
                          <LabelList position="top" fontSize={11} fontWeight="900" fill={isDark ? '#f8fafc' : '#1e293b'} offset={8} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>

            <Card title="Execution Matrix">
              <div className="overflow-x-auto no-scrollbar custom-scrollbar">
                <table className="w-full text-left min-w-[900px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-left">Build Version</th>
                      <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-right">Total Test Cases</th>
                      <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-right">Passed Cases</th>
                      <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-right">Failed Cases</th>
                      <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-right whitespace-nowrap">Not Considered</th>
                      <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-right">Automation</th>
                      <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-right">Manual</th>
                      <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider text-right">Issue Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group">
                        <td className="px-6 py-5">
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">
                            {row['RC Build'] || row['Build']}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tight">
                            {row.Platform} • {row['Build Date']}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-xs font-black text-slate-500 text-right">{row['Total Test Cases'] || 0}</td>
                        <td className="px-6 py-5 text-xs font-black text-emerald-600 text-right">{row['Passed'] || 0}</td>
                        <td className="px-6 py-5 text-xs font-black text-rose-500 text-right">{row['Failed'] || 0}</td>
                        <td className="px-6 py-5 text-xs font-black text-slate-400 text-right">{row['Not considered'] || 0}</td>
                        <td className="px-6 py-5 text-xs font-black text-violet-500 text-right">{row['Automation'] || 0}</td>
                        <td className="px-6 py-5 text-xs font-black text-pink-500 text-right">{row['Manual'] || 0}</td>
                        <td className="px-6 py-5">
                          <div className="flex gap-1.5 justify-end">
                            <Badge value={row['Critical Issues']} color="bg-rose-500" label="Critical" size="sm" />
                            <Badge value={row['Major Issues']} color="bg-amber-500" label="Major" size="sm" />
                            <Badge value={row['Minor Issues']} color="bg-blue-500" label="Minor" size="sm" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : (
          <Card title={activeTab === 'new_issues' ? 'Issue Backlog' : 'Validation Queue'} loading={loadingMap[activeTab]} error={errorMap[activeTab]} onRetry={() => fetchData(activeTab)}>
            <div className="overflow-x-auto no-scrollbar custom-scrollbar"><table className="w-full text-left min-w-[800px]">
              <thead><tr className="bg-slate-50 dark:bg-slate-800/50">{dataMap[activeTab]?.headers.map((h, i) => <th key={i} className="px-6 py-4 text-[11px] font-black uppercase text-slate-400 tracking-wider">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filteredRows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  {dataMap[activeTab]?.headers.map((h, j) => (
                    <td key={j} className="px-6 py-5">{h.toLowerCase().includes('status') ? <span className="text-[10px] font-black uppercase px-3 py-1.5 rounded-xl bg-emerald-500 text-white shadow-sm">{row[h] || 'PENDING'}</span> : <div className="text-[12px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">{row[h] || '-'}</div>}</td>
                  ))}
                </tr>
              ))}</tbody>
            </table></div>
          </Card>
        )}
      </main>
    </div>
  );
}

function MetricCard({ title, value, icon }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm relative group hover:-translate-y-1 transition-all duration-300">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-all rotate-12 text-6xl pointer-events-none">{icon}</div>
      <span className="text-[11px] font-black text-slate-400 uppercase mb-2 block tracking-widest">{title}</span>
      <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{value}</div>
    </div>
  );
}

function Card({ title, children, loading, error, onRetry }: CardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col min-h-[380px]">
      <div className="px-8 py-6 border-b border-slate-50 dark:bg-slate-800/30"><h3 className="text-[12px] font-black uppercase tracking-widest text-slate-400">{title}</h3></div>
      <div className="p-8 flex-1 relative flex flex-col">
        {loading && <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"><div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>}
        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8 animate-in fade-in"><div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 text-3xl">⚠️</div><p className="text-[12px] font-bold text-slate-500">{error}</p><button onClick={onRetry} className="w-full bg-slate-900 text-white py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all">Retry</button></div>
        ) : children}
      </div>
    </div>
  );
}

function Badge({ value, color, label, size = 'md' }: BadgeProps) {
  const v = (!value || value === 0 || value === "" || isNaN(value)) ? '-' : value;
  const s = size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-10 h-10 text-[13px]';
  return (
    <div className="relative group/badge inline-block">
      <div className={`${s} rounded-lg flex items-center justify-center font-black transition-all hover:scale-110 cursor-help ${v === '-' ? 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600' : `${color} text-white shadow-sm`}`}>{v}</div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-2 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover/badge:opacity-100 pointer-events-none transition-all duration-300 shadow-2xl z-[150] whitespace-nowrap">{v === '-' ? `No ${label}` : `${v} ${label}`}</div>
    </div>
  );
}
