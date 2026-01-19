
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, Sector, LabelList
} from 'recharts';
import { DashboardData } from './types';
import { parseCSV } from './utils/dataParser';

// --- CONFIGURATION ---
const PUBLISHED_ID = '2PACX-1vSrx7lqwi5bjj99rYho8jYGBYH47sYw2a5d62uPGrKS-HvSgiz6o-Rx_opsCMGNhVNRjJNx2bi6OTfK';
const BASE_URL = `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_ID}/pub?output=csv`;
const HTML_URL = `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_ID}/pubhtml`;
const REFRESH_INTERVAL = 120000;

const pageDisplayName = 'Ifocus RC Build Reports';

// Tabs configuration with fallback labels for GID discovery
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
  critical: '#EF4444',
  major: '#F59E0B',
  minor: '#3B82F6',
};

const BUILD_COL_ALIASES = ['RC Build', 'Build Version', 'Build', 'Version', 'Build Number'];
const PLATFORM_COL_ALIASES = ['Platform', 'OS', 'Environment'];
const DATE_COL_ALIASES = ['Build Date', 'Date', 'Reported Date', 'Created At'];
const SEVERITY_COL_ALIASES = ['Severity', 'Issue Severity', 'Priority'];
const AUTO_COL_ALIASES = ['Automation executed', 'Automation', 'Auto Executed', 'Automation Test Cases'];
const MANUAL_COL_ALIASES = ['Manual executed', 'Manual', 'Manual Executed', 'Manual Test Cases'];

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
  discoveredTabs?: Record<string, string>;
  fullWidth?: boolean;
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
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 border-b border-slate-50 dark:border-slate-800 pb-1.5 truncate max-w-[180px]">{title}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => {
          const percent = entry.payload?.percent !== undefined ? entry.payload.percent : entry.percent;
          const hasPercent = percent !== undefined && !isNaN(percent);

          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{entry.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black text-slate-900 dark:text-white">{entry.value}</span>
                {hasPercent && (
                  <span className="text-[9px] font-black text-primary-500">
                    ({(percent * 100).toFixed(1)}%)
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
  const inputRef = useRef<HTMLInputElement>(null);
  
  const formatDate = (val: string) => {
    if (!val) return placeholder;
    return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleOpenPicker = () => {
    const el = inputRef.current;
    if (el) {
      try {
        if ('showPicker' in el) {
          (el as any).showPicker();
        } else {
          // Fix: cast to any to resolve the 'never' type inference issue in the else block
          (el as any).focus();
          (el as any).click();
        }
      } catch (e) {
        // Fix: cast to any to resolve potential 'never' type issues in the catch block
        (el as any).focus();
        (el as any).click();
      }
    }
  };

  return (
    <div className="relative flex-1 min-w-0 h-11">
      <div 
        onClick={handleOpenPicker}
        className="w-full h-full bg-slate-50 dark:bg-slate-800 px-4 rounded-2xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all flex items-center justify-between cursor-pointer group z-0"
      >
        <span className={`text-xs font-bold truncate mr-2 ${value ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
          {formatDate(value)}
        </span>
        <svg className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" />
        </svg>
      </div>
      
      <input 
        ref={inputRef}
        type="date" 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none z-10"
        aria-label={placeholder}
      />

      {value && (
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(''); }} 
          className="absolute right-10 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-all z-20"
          type="button"
        >
          <svg className="w-3 h-3 text-slate-400 hover:text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
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
  
  const [dynamicGidMap, setDynamicGidMap] = useState<Record<string, string>>({});
  const [discoveredTabs, setDiscoveredTabs] = useState<Record<string, string>>({});

  const isDark = theme === 'dark';

  useEffect(() => {
    localStorage.setItem('dashboard-theme', theme);
    document.documentElement.classList.toggle('dark', isDark);
  }, [theme, isDark]);

  // Robust GID discovery to fix "Invalid GID" errors
  const discoverGids = useCallback(async () => {
    try {
      const resp = await fetch(`${HTML_URL}&t=${Date.now()}`);
      if (!resp.ok) return null;
      const html = await resp.text();
      const tabMap: Record<string, string> = {};
      
      // Look for standard sheet-button GIDs
      const liRegex = /id="sheet-button-([^"]+)">.*?>(.*?)<\/a>/g;
      let match;
      while ((match = liRegex.exec(html)) !== null) {
        const gid = match[1];
        const name = match[2].trim();
        tabMap[name] = gid;
      }
      
      // Alternative fallback for GID discovery from scripts
      if (Object.keys(tabMap).length === 0) {
        const scriptRegex = /"([^"]+)",\d+,"([^"]+)",\d+,\d+,"[^"]*",\d+/g;
        while ((match = scriptRegex.exec(html)) !== null) {
          const gid = match[2];
          const name = match[1];
          if (/^\d+$/.test(gid) && name.length < 50) {
             tabMap[name] = gid;
          }
        }
      }
      setDiscoveredTabs(tabMap);
      return tabMap;
    } catch (e) {
      console.error("GID Discovery Error:", e);
      return null;
    }
  }, []);

  const fetchData = useCallback(async (tabId: string, silent = false, retryDiscovery = true) => {
    if (!silent) { 
      setLoadingMap(p => ({ ...p, [tabId]: true })); 
      setErrorMap(p => ({ ...p, [tabId]: null })); 
    }
    const config = Object.values(TABS_CONFIG).find(t => t.id === tabId);
    if (!config) return;

    const currentGid = dynamicGidMap[tabId] || config.gid;

    try {
      const resp = await fetch(`${BASE_URL}&gid=${currentGid}&t=${Date.now()}`);
      
      if (!resp.ok) {
        if ((resp.status === 400 || resp.status === 404) && retryDiscovery) {
          const tabs = await discoverGids();
          if (tabs) {
            const labelLower = config.label.toLowerCase().replace(/\s/g, '');
            const foundName = Object.keys(tabs).find(name => {
              const nameLower = name.toLowerCase().replace(/\s/g, '');
              return nameLower === labelLower || nameLower.includes(labelLower) || labelLower.includes(nameLower);
            });

            if (foundName) {
              const newGid = tabs[foundName];
              setDynamicGidMap(prev => ({ ...prev, [tabId]: newGid }));
              return fetchData(tabId, silent, false);
            }
          }
        }
        throw new Error(`Invalid source configuration (GID: ${currentGid}). The tab '${config.label}' was not found in the published spreadsheet.`);
      }

      const text = await resp.text();
      const parsed = parseCSV(text);
      setDataMap(p => ({ ...p, [tabId]: parsed }));
      setLastUpdatedMap(p => ({ ...p, [tabId]: new Date() }));
    } catch (e: any) {
      if (!silent) setErrorMap(p => ({ ...p, [tabId]: e.message }));
    } finally { 
      if (!silent) setLoadingMap(p => ({ ...p, [tabId]: false })); 
    }
  }, [dynamicGidMap, discoverGids]);

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
        if (selectedPlatform === 'All' || (pCol && String(r[pCol]) === selectedPlatform)) {
          all.add(String(r[bCol] || '').trim());
        }
      });
    });
    return Array.from(all).filter(Boolean).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [dataMap, selectedPlatform]);

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
    const data = dataMap[TABS_CONFIG.SUMMARY.id];
    if (!data) return null;
    let rows = [...data.rows];
    const pCol = PLATFORM_COL_ALIASES.find(a => data.headers.includes(a)), bCol = BUILD_COL_ALIASES.find(a => data.headers.includes(a)), dCol = DATE_COL_ALIASES.find(a => data.headers.includes(a));
    if (selectedPlatform !== 'All' && pCol) rows = rows.filter(r => String(r[pCol]) === selectedPlatform);
    if (selectedBuild !== 'All' && bCol) rows = rows.filter(r => String(r[bCol]) === selectedBuild);
    if (startDate || endDate) rows = rows.filter(r => {
      if (!r[dCol || '']) return false;
      const bd = new Date(r[dCol || '']);
      return (!startDate || bd >= new Date(startDate)) && (!endDate || bd <= new Date(endDate));
    });

    return rows.reduce((acc, r) => ({
      total: acc.total + (Number(r['Total Test Cases']) || 0),
      executed: acc.executed + (Number(r.Executed) || 0),
      passed: acc.passed + (Number(r.Passed) || 0),
      critical: acc.critical + (Number(r['Critical Issues']) || 0),
    }), { total: 0, executed: 0, passed: 0, critical: 0 });
  }, [dataMap, selectedPlatform, selectedBuild, startDate, endDate]);

  const pieData = useMemo(() => {
    const data = dataMap[TABS_CONFIG.SUMMARY.id];
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

    const totals = rows.reduce((acc, r) => ({
      passed: acc.passed + (Number(r.Passed) || 0),
      failed: acc.failed + (Number(r.Failed) || 0),
      notConsidered: acc.notConsidered + (Number(r['Not considered']) || 0),
    }), { passed: 0, failed: 0, notConsidered: 0 });
    const sum = totals.passed + totals.failed + totals.notConsidered;
    return [
      { name: 'Pass', value: totals.passed, color: EXECUTION_COLORS.pass, percent: sum ? totals.passed / sum : 0 },
      { name: 'Fail', value: totals.failed, color: EXECUTION_COLORS.fail, percent: sum ? totals.failed / sum : 0 },
      { name: 'N/A', value: totals.notConsidered, color: EXECUTION_COLORS.notConsidered, percent: sum ? totals.notConsidered / sum : 0 },
    ];
  }, [dataMap, selectedPlatform, selectedBuild, startDate, endDate]);

  // Combined trend data for multiple charts
  const trendData = useMemo(() => {
    const data = dataMap[TABS_CONFIG.SUMMARY.id];
    if (!data) return [];
    let rows = [...data.rows];
    const pCol = PLATFORM_COL_ALIASES.find(a => data.headers.includes(a)), bCol = BUILD_COL_ALIASES.find(a => data.headers.includes(a)), dCol = DATE_COL_ALIASES.find(a => data.headers.includes(a));
    if (selectedPlatform !== 'All' && pCol) rows = rows.filter(r => String(r[pCol]) === selectedPlatform);
    if (startDate || endDate) rows = rows.filter(r => {
      if (!r[dCol || '']) return false;
      const bd = new Date(r[dCol || '']);
      return (!startDate || bd >= new Date(startDate)) && (!endDate || bd <= new Date(endDate));
    });

    return rows.slice(0, 10).reverse().map(r => {
      const rawName = String(r['RC Build'] || r['Build'] || r['Build Version'] || 'Unknown');
      const shortName = rawName.split(' ').pop() || rawName;
      const autoKey = AUTO_COL_ALIASES.find(a => r[a] !== undefined);
      const manualKey = MANUAL_COL_ALIASES.find(a => r[a] !== undefined);
      return {
        name: shortName,
        fullName: rawName,
        Passed: Number(r.Passed) || 0,
        Failed: Number(r.Failed) || 0,
        Critical: Number(r['Critical Issues']) || 0,
        Major: Number(r['Major Issues']) || 0,
        Minor: Number(r['Minor Issues']) || 0,
        Automation: autoKey ? Number(r[autoKey]) : 0,
        Manual: manualKey ? Number(r[manualKey]) : 0,
      };
    });
  }, [dataMap, selectedPlatform, startDate, endDate]);

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
        <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 10} outerRadius={outerRadius + 12} fill={fill} opacity={0.3} />
      </g>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] pb-12 transition-all">
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-900 z-[60] overflow-hidden">
        <div className="h-full bg-primary-600 transition-all duration-1000 ease-linear" style={{ width: `${refreshProgress}%` }} />
      </div>

      <nav className="sticky top-0 z-50 glass border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">i</div>
            <h1 className="text-sm md:text-xl font-black uppercase tracking-tight text-primary-600 truncate">{pageDisplayName}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:scale-105 transition-all">{isDark ? '☀️' : '🌙'}</button>
            <button onClick={() => syncAll()} className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase active:scale-95 shadow-lg">Sync</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Platform</label><select value={selectedPlatform} onChange={e => setSelectedPlatform(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 mt-1 rounded-2xl text-xs font-bold border-none appearance-none cursor-pointer">{platforms.map(p => <option key={p} value={p}>{p}</option>)}<option value="All">All Platforms</option></select></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Build</label><select value={selectedBuild} onChange={e => setSelectedBuild(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 mt-1 rounded-2xl text-xs font-bold border-none appearance-none cursor-pointer"><option value="All">All Builds</option>{builds.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
            <div className="md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Date Range</label><div className="flex items-center gap-2 mt-1"><DateSelector value={startDate} onChange={setStartDate} placeholder="Start Date" /><span className="text-slate-300">~</span><DateSelector value={endDate} onChange={setEndDate} placeholder="End Date" /></div></div>
          </div>
        </section>

        <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-[1.8rem] w-full md:w-auto overflow-x-auto gap-1 shadow-inner no-scrollbar">
          {Object.values(TABS_CONFIG).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}><span>{tab.icon}</span>{tab.label}</button>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card title="Distribution" loading={loadingMap[activeTab]} error={errorMap[activeTab]} onRetry={() => fetchData(activeTab)}>
                <div className="h-[300px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                      <Pie 
                        {...({ activeIndex, activeShape: renderActiveShape } as any)} 
                        data={pieData} 
                        cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} 
                        dataKey="value"
                        onMouseEnter={(_, i) => setActiveIndex(i)} 
                        onMouseLeave={() => setActiveIndex(-1)}
                      >
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <div className="text-[10px] font-black text-slate-400 uppercase">Total</div>
                    <div className="text-xl font-black text-slate-900 dark:text-white">{summaryStats?.executed || 0}</div>
                  </div>
                </div>
              </Card>

              <div className="lg:col-span-2">
                <Card title="Methodology Trend" loading={loadingMap[activeTab]} error={errorMap[activeTab]}>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 30, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                        {/* Fix: remove the invalid 'hide' property from LabelList as it is not supported in the recharts LabelListProps */}
                        <Bar name="Automation" dataKey="Automation" fill={EXECUTION_COLORS.automation} radius={[4, 4, 0, 0]} barSize={14}>
                          <LabelList position="top" fontSize={9} fontWeight="900" fill={isDark ? '#cbd5e1' : '#64748b'} offset={8} />
                        </Bar>
                        <Bar name="Manual" dataKey="Manual" fill={EXECUTION_COLORS.manual} radius={[4, 4, 0, 0]} barSize={14}>
                          <LabelList position="top" fontSize={9} fontWeight="900" fill={isDark ? '#cbd5e1' : '#64748b'} offset={8} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>

            <Card title="Issue Severity Trend" fullWidth>
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 30, right: 20, left: -20, bottom: 10 }} stackOffset="none">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 800 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fontWeight: 800 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingBottom: '20px' }} />
                    <Bar name="Critical" dataKey="Critical" stackId="severity" fill={EXECUTION_COLORS.critical} barSize={28}>
                       <LabelList dataKey="Critical" position="center" fill="#fff" fontSize={9} fontWeight="900" formatter={(val: any) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar name="Major" dataKey="Major" stackId="severity" fill={EXECUTION_COLORS.major} barSize={28}>
                       <LabelList dataKey="Major" position="center" fill="#fff" fontSize={9} fontWeight="900" formatter={(val: any) => val > 0 ? val : ''} />
                    </Bar>
                    <Bar name="Minor" dataKey="Minor" stackId="severity" fill={EXECUTION_COLORS.minor} radius={[4, 4, 0, 0]} barSize={28}>
                       <LabelList dataKey="Minor" position="center" fill="#fff" fontSize={9} fontWeight="900" formatter={(val: any) => val > 0 ? val : ''} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Execution Matrix" fullWidth>
              <div className="max-h-[600px] overflow-auto custom-scrollbar border border-slate-100 dark:border-slate-800 rounded-2xl shadow-inner">
                <table className="w-full text-left min-w-[1200px] border-separate border-spacing-0">
                  <thead className="sticky top-0 z-40 bg-slate-50 dark:bg-slate-900 shadow-sm">
                    <tr className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 sticky left-0 z-50 min-w-[200px]">RC Build</th>
                      <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-center">Platform</th>
                      <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-right">Total</th>
                      <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-right">Passed</th>
                      <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-right">Failed</th>
                      <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-right">Auto</th>
                      <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-right">Manual</th>
                      <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-right">Severities</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-5 sticky left-0 z-30 bg-white dark:bg-slate-900 font-extrabold text-sm text-slate-900 dark:text-white border-r border-slate-50 dark:border-slate-800 whitespace-nowrap min-w-[200px]">
                          {row['RC Build'] || row['Build']}
                        </td>
                        <td className="px-6 py-5 text-center text-[11px] font-bold text-slate-500">{row['Platform'] || 'N/A'}</td>
                        <td className="px-6 py-5 text-xs font-black text-slate-500 text-right">{row['Total Test Cases'] || 0}</td>
                        <td className="px-6 py-5 text-xs font-black text-emerald-600 text-right">{row['Passed'] || 0}</td>
                        <td className="px-6 py-5 text-xs font-black text-rose-500 text-right">{row['Failed'] || 0}</td>
                        <td className="px-6 py-5 text-xs font-black text-violet-500 text-right">{row['Automation executed'] || 0}</td>
                        <td className="px-6 py-5 text-xs font-black text-pink-500 text-right">{row['Manual executed'] || 0}</td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex gap-1 justify-end">
                            <Badge value={row['Critical Issues']} color="bg-rose-500" label="Crit" size="sm" />
                            <Badge value={row['Major Issues']} color="bg-amber-500" label="Maj" size="sm" />
                            <Badge value={row['Minor Issues']} color="bg-blue-500" label="Min" size="sm" />
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
          <Card title={activeTab === 'new_issues' ? 'Issue Backlog' : 'Validation Queue'} loading={loadingMap[activeTab]} error={errorMap[activeTab]} onRetry={() => fetchData(activeTab)} discoveredTabs={discoveredTabs} fullWidth>
            <div className="max-h-[600px] overflow-auto custom-scrollbar border border-slate-100 dark:border-slate-800 rounded-2xl shadow-inner bg-white dark:bg-slate-900">
              <table className="w-full text-left min-w-[1000px] border-separate border-spacing-0">
                <thead className="sticky top-0 z-40 bg-slate-50 dark:bg-slate-900">
                  <tr className="text-[10px] font-black uppercase text-slate-400">
                    {dataMap[activeTab]?.headers.map((h, i) => (
                      <th key={i} className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap bg-slate-50 dark:bg-slate-900">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      {dataMap[activeTab]?.headers.map((h, j) => (
                        <td key={j} className="px-6 py-5 text-[12px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed min-w-[120px]">
                          {row[h] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {filteredRows.length === 0 && !loadingMap[activeTab] && (
                    <tr>
                      <td colSpan={dataMap[activeTab]?.headers.length || 1} className="px-6 py-12 text-center text-slate-400 font-bold text-xs uppercase tracking-widest italic">
                        No records match the current filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

function MetricCard({ title, value, icon }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm relative group hover:-translate-y-1 transition-all duration-300">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all text-6xl pointer-events-none rotate-6">{icon}</div>
      <span className="text-[11px] font-black text-slate-400 uppercase mb-2 block tracking-widest">{title}</span>
      <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</div>
    </div>
  );
}

function Card({ title, children, loading, error, onRetry, discoveredTabs, fullWidth }: CardProps) {
  const tabsList = discoveredTabs ? Object.entries(discoveredTabs) : [];
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-[400px] ${fullWidth ? 'lg:col-span-3' : ''}`}>
      <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-800/50 flex justify-between items-center">
        <h3 className="text-[12px] font-black uppercase tracking-widest text-slate-400">{title}</h3>
      </div>
      <div className="p-8 flex-1 relative flex flex-col">
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-[2.5rem]">
            <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
            <div className="text-4xl opacity-40">⚠️</div>
            <p className="text-[11px] font-bold text-rose-500 max-w-xs">{error}</p>
            {tabsList.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-left w-full max-w-sm border border-slate-100 dark:border-slate-700">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Available Sheets (Discovery):</p>
                <div className="space-y-1">
                  {tabsList.map(([name, gid]) => (
                    <div key={gid} className="flex justify-between items-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
                      <span>{name}</span>
                      <span className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[8px]">GID: {gid}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={onRetry} className="px-8 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-lg">Retry Sync</button>
          </div>
        ) : children}
      </div>
    </div>
  );
}

function Badge({ value, color, label, size = 'md' }: BadgeProps) {
  const v = (!value || value === 0 || value === "" || isNaN(value)) ? '-' : value;
  const s = size === 'sm' ? 'w-8 h-8 text-[10px]' : 'w-10 h-10 text-[12px]';
  return (
    <div className="relative group/badge inline-block">
      <div className={`${s} rounded-lg flex items-center justify-center font-black transition-all ${v === '-' ? 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-700' : `${color} text-white shadow-sm`}`}>{v}</div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-slate-900 text-white text-[9px] font-black uppercase rounded opacity-0 group-hover/badge:opacity-100 pointer-events-none transition-all z-[100] whitespace-nowrap shadow-xl">{label}: {v}</div>
    </div>
  );
}
