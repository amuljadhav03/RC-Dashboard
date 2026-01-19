import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { DashboardData } from './types';
import { parseCSV } from './utils/dataParser';

// --- CONFIGURATION ---
const PUBLISHED_ID = '2PACX-1vSrx7lqwi5bjj99rYho8jYGBYH47sYw2a5d62uPGrKS-HvSgiz6o-Rx_opsCMGNhVNRjJNx2bi6OTfK';
const BASE_URL = `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_ID}/pub?output=csv`;
const INDEX_URL = `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_ID}/pubhtml`;

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

// --- TYPES ---
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
  tabGid?: string;
  onRetry?: () => void;
  onApplyFix?: (newGid: string) => void;
  suggestedGid?: string | null;
}

interface BadgeProps {
  value: any;
  color: string;
  label: string;
  size?: 'sm' | 'md';
}

interface DateSelectorProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

// --- CALENDAR COMPONENT ---
function CalendarPopover({ value, onSelect, onClose }: { value: string, onSelect: (val: string) => void, onClose: () => void }) {
  const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date());
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleDaySelect = (day: number) => {
    const selected = new Date(year, month, day);
    const formatted = selected.toISOString().split('T')[0];
    onSelect(formatted);
    onClose();
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const d = new Date(value);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  };

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(
      <button
        key={i}
        onClick={() => handleDaySelect(i)}
        className={`h-8 w-8 rounded-lg text-[10px] font-bold transition-all hover:bg-primary-50 dark:hover:bg-primary-900/30 flex items-center justify-center ${
          isSelected(i) 
            ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' 
            : 'text-slate-600 dark:text-slate-300'
        }`}
      >
        {i}
      </button>
    );
  }

  return (
    <div ref={calendarRef} className="absolute top-full left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 mt-2 z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-4 w-[260px] max-w-[calc(100vw-2rem)] animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-4 px-1">
        <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
          {months[month]} {year}
        </span>
        <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
          <div key={d} className="text-[9px] font-black text-slate-400 uppercase py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days}
      </div>
      {value && (
        <button 
          onClick={() => { onSelect(''); onClose(); }} 
          className="w-full mt-4 py-2 text-[9px] font-black uppercase text-slate-400 hover:text-rose-500 transition-colors border-t border-slate-50 dark:border-slate-800 pt-3"
        >
          Clear Date
        </button>
      )}
    </div>
  );
}

function DateSelector({ value, onChange, placeholder }: Omit<DateSelectorProps, 'label'>) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (val: string) => {
    if (!val) return placeholder || 'Select date';
    const date = new Date(val);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="relative flex-1 min-w-0">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-[11px] md:text-xs font-bold transition-all cursor-pointer flex items-center justify-between group overflow-hidden"
      >
        <span className={`truncate mr-2 ${value ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{formatDate(value)}</span>
        <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180 text-primary-500' : 'text-slate-300 group-hover:text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      {isOpen && <CalendarPopover value={value} onSelect={onChange} onClose={() => setIsOpen(false)} />}
    </div>
  );
}

// --- MAIN APP ---
export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => 
    (localStorage.getItem('dashboard-theme') as 'light' | 'dark') || 'light'
  );
  
  const [dataMap, setDataMap] = useState<Record<string, DashboardData>>({});
  const [activeTab, setActiveTab] = useState<string>(TABS_CONFIG.SUMMARY.id);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});
  const [suggestedGidMap, setSuggestedGidMap] = useState<Record<string, string | null>>({});
  const [gidOverrides, setGidOverrides] = useState<Record<string, string>>({});
  const [lastUpdatedMap, setLastUpdatedMap] = useState<Record<string, Date>>({});
  
  const [selectedPlatform, setSelectedPlatform] = useState<string>('All');
  const [selectedBuild, setSelectedBuild] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const isDark = theme === 'dark';

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const attemptGidDiscovery = async (tabLabel: string) => {
    try {
      const response = await fetch(`${INDEX_URL}?t=${Date.now()}`);
      if (!response.ok) return null;
      const html = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const tabs = doc.querySelectorAll('li[id^="sheet-button-"]');
      
      for (const tab of Array.from(tabs)) {
        const link = tab.querySelector('a');
        if (link && link.textContent?.trim().toLowerCase().includes(tabLabel.toLowerCase())) {
          const gid = link.getAttribute('href')?.replace('#', '');
          if (gid) return gid;
        }
      }
      
      const regex = new RegExp(`href="#([^"]+)"[^>]*>([^<]*${tabLabel}[^<]*)`, 'gi');
      let match;
      while ((match = regex.exec(html)) !== null) {
        if (match[1]) return match[1].trim();
      }
    } catch (e) {
      console.warn("GID auto-discovery failed", e);
    }
    return null;
  };

  const fetchData = useCallback(async (tabId: string, silent = false) => {
    if (!silent) setLoadingMap(prev => ({ ...prev, [tabId]: true }));
    setErrorMap(prev => ({ ...prev, [tabId]: null }));
    
    const config = Object.values(TABS_CONFIG).find(t => t.id === tabId);
    if (!config) return;

    const currentGid = gidOverrides[tabId] || config.gid;

    try {
      const fetchUrl = `${BASE_URL}&gid=${currentGid}&t=${Date.now()}`;
      const response = await fetch(fetchUrl, { cache: 'no-store' });
      
      if (!response.ok) {
        if (response.status === 400) {
          const suggested = await attemptGidDiscovery(config.label);
          if (suggested && suggested !== currentGid) {
            setSuggestedGidMap(prev => ({ ...prev, [tabId]: suggested }));
          }
          throw new Error(`Invalid Tab Identifier (GID: ${currentGid}). Google Sheets returned a 400 error. This happens if tabs were moved or deleted.`);
        }
        throw new Error(`Failed to connect to spreadsheet (Status: ${response.status}).`);
      }
      
      const csvText = await response.text();
      if (csvText.includes('ServiceLogin') || csvText.includes('<html')) {
        throw new Error("Access Denied. Sheet is either private or the Publish settings are incorrect.");
      }

      const parsed = parseCSV(csvText);
      setDataMap(prev => ({ ...prev, [tabId]: parsed }));
      setLastUpdatedMap(prev => ({ ...prev, [tabId]: new Date() }));
      setSuggestedGidMap(prev => ({ ...prev, [tabId]: null }));
    } catch (error: any) {
      setErrorMap(prev => ({ ...prev, [tabId]: error.message }));
    } finally {
      if (!silent) setLoadingMap(prev => ({ ...prev, [tabId]: false }));
    }
  }, [gidOverrides]);

  const applyGidFix = (tabId: string, newGid: string) => {
    setGidOverrides(prev => ({ ...prev, [tabId]: newGid }));
    setTimeout(() => fetchData(tabId), 10);
  };

  const syncAll = useCallback(async () => {
    await Promise.all(Object.values(TABS_CONFIG).map(tab => fetchData(tab.id)));
  }, [fetchData]);

  useEffect(() => { syncAll(); }, [syncAll]);

  useEffect(() => {
    const interval = setInterval(() => {
      Object.values(TABS_CONFIG).forEach(tab => fetchData(tab.id, true));
    }, 120000); 
    return () => clearInterval(interval);
  }, [fetchData]);

  const platforms = useMemo(() => {
    const allPlatforms = new Set<string>();
    Object.values(dataMap).forEach(data => {
      const col = PLATFORM_COL_ALIASES.find(a => data.headers.includes(a));
      if (col) data.rows.forEach(r => r[col] && allPlatforms.add(String(r[col])));
    });
    return Array.from(allPlatforms).sort();
  }, [dataMap]);

  const builds = useMemo(() => {
    if (selectedPlatform === 'All') return [];
    const allBuilds = new Set<string>();
    Object.values(dataMap).forEach(data => {
      const pCol = PLATFORM_COL_ALIASES.find(a => data.headers.includes(a));
      const bCol = BUILD_COL_ALIASES.find(a => data.headers.includes(a));
      if (pCol && bCol) {
        data.rows.forEach(r => {
          if (String(r[pCol]) === selectedPlatform && r[bCol]) allBuilds.add(String(r[bCol]));
        });
      }
    });
    return Array.from(allBuilds).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [dataMap, selectedPlatform]);

  const buildMetadata = useMemo(() => {
    if (selectedBuild === 'All') return null;
    const summary = dataMap[TABS_CONFIG.SUMMARY.id];
    if (!summary) return null;
    const bCol = BUILD_COL_ALIASES.find(a => summary.headers.includes(a));
    if (!bCol) return null;
    const match = summary.rows.find(r => String(r[bCol]) === selectedBuild);
    if (!match) return null;
    
    const tCol = BUILD_TYPE_COL_ALIASES.find(a => summary.headers.includes(a));
    const dCol = DATE_COL_ALIASES.find(a => summary.headers.includes(a));
    const sCol = BUILD_STATUS_COL_ALIASES.find(a => summary.headers.includes(a));
    
    return {
      build: String(match[bCol]),
      type: tCol ? String(match[tCol] || 'N/A') : 'N/A',
      date: dCol ? String(match[dCol] || 'N/A') : 'N/A',
      status: sCol ? String(match[sCol] || 'N/A') : 'N/A',
    };
  }, [dataMap, selectedBuild]);

  const dynamicTitle = useMemo(() => {
    if (selectedBuild !== 'All' && selectedPlatform !== 'All') {
      return `RC Build Analytics for ${selectedPlatform} - ${selectedBuild}`;
    }
    return 'RC Build Analytics';
  }, [selectedBuild, selectedPlatform]);

  const getBuildTypeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('hotfix')) return 'bg-rose-600 shadow-rose-500/20';
    if (t.includes('planned') || t.includes('release')) return 'bg-emerald-600 shadow-emerald-500/20';
    if (t.includes('beta')) return 'bg-amber-500 shadow-amber-500/20';
    if (t.includes('dev')) return 'bg-indigo-600 shadow-indigo-500/20';
    return 'bg-primary-600 shadow-primary-500/20';
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('pass') || s.includes('fix') || s.includes('resolve') || s.includes('complete')) return 'text-emerald-500';
    if (s.includes('fail') || s.includes('block') || s.includes('open') || s.includes('critical')) return 'text-rose-500';
    return 'text-amber-500';
  };

  const filteredRows = useMemo(() => {
    const currentData = dataMap[activeTab];
    if (!currentData) return [];
    let rows = [...currentData.rows];
    const headers = currentData.headers;
    if (selectedPlatform !== 'All') {
      const col = PLATFORM_COL_ALIASES.find(a => headers.includes(a));
      if (col) rows = rows.filter(r => String(r[col]) === selectedPlatform);
    }
    if (selectedBuild !== 'All') {
      const col = BUILD_COL_ALIASES.find(a => headers.includes(a));
      if (col) rows = rows.filter(r => String(r[col]) === selectedBuild);
    }
    // Date Filtering
    if (startDate || endDate) {
      const dCol = DATE_COL_ALIASES.find(a => headers.includes(a));
      if (dCol) {
        rows = rows.filter(r => {
          if (!r[dCol]) return false;
          const buildDate = new Date(r[dCol]);
          if (startDate && buildDate < new Date(startDate)) return false;
          if (endDate && buildDate > new Date(endDate)) return false;
          return true;
        });
      }
    }
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
    const p = filteredRows.reduce((s, r) => s + (Number(r.Passed) || 0), 0);
    const f = filteredRows.reduce((s, r) => s + (Number(r.Failed) || 0), 0);
    const n = filteredRows.reduce((s, r) => s + (Number(r['Not considered']) || 0), 0);
    return [
      { name: 'Pass', value: p, color: EXECUTION_COLORS.pass },
      { name: 'Fail', value: f, color: EXECUTION_COLORS.fail },
      { name: 'N/A', value: n, color: EXECUTION_COLORS.notConsidered },
    ];
  }, [filteredRows, activeTab]);

  const trendData = useMemo(() => {
    return filteredRows.slice(0, 10).reverse().map(r => ({
      name: r['RC Build'] || r['Build'] || r['Build Version'],
      Passed: Number(r.Passed) || 0,
      Failed: Number(r.Failed) || 0,
      'Not considered': Number(r['Not considered']) || 0,
      Automation: Number(r['Automation executed'] || r['Automation']) || 0,
      Manual: Number(r['Manual executed'] || r['Manual']) || 0,
      Critical: Number(r['Critical Issues']) || 0,
      Major: Number(r['Major Issues']) || 0,
      Minor: Number(r['Minor Issues']) || 0,
    }));
  }, [filteredRows]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] pb-12 transition-all">
      <nav className="sticky top-0 z-50 glass border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
             <div className="w-8 h-8 md:w-10 md:h-10 bg-primary-600 rounded-lg md:rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-lg md:text-xl shadow-lg shadow-primary-500/20">i</div>
             <div className="min-w-0">
               <h1 className="text-sm md:text-xl font-black uppercase tracking-tight text-primary-600 dark:text-primary-400 truncate">{dynamicTitle}</h1>
               <div className="flex items-center gap-1.5 md:gap-2 mt-0.5">
                 <span className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full flex-shrink-0 ${Object.values(loadingMap).some(v => v) ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                 <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                   Synced: {lastUpdatedMap[activeTab]?.toLocaleTimeString() || 'Waiting...'}
                 </span>
               </div>
             </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} className="p-2 md:p-2.5 rounded-lg md:rounded-xl bg-slate-100 dark:bg-slate-800 hover:scale-105 transition-transform text-sm md:text-base">{isDark ? '☀️' : '🌙'}</button>
            <button onClick={syncAll} disabled={Object.values(loadingMap).some(v => v)} className="px-3 md:px-5 py-2 md:py-2.5 bg-primary-600 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase hover:bg-primary-700 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-primary-500/10">Sync</button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* FILTERS */}
        <section className="bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
          <div className="space-y-1.5 md:space-y-2">
            <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Platform</label>
            <select value={selectedPlatform} onChange={e => { setSelectedPlatform(e.target.value); setSelectedBuild('All'); }} className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl md:rounded-2xl border-none text-[11px] md:text-xs font-bold focus:ring-2 focus:ring-primary-500 transition-all appearance-none cursor-pointer">
              <option value="All">All Platforms</option>
              {platforms.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className={`space-y-1.5 md:space-y-2 transition-opacity ${selectedPlatform === 'All' ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Build Version</label>
            <select value={selectedBuild} onChange={e => setSelectedBuild(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl md:rounded-2xl border-none text-[11px] md:text-xs font-bold focus:ring-2 focus:ring-primary-500 transition-all appearance-none cursor-pointer">
              <option value="All">All Builds</option>
              {builds.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 md:space-y-2 md:col-span-2 flex flex-col justify-end">
            <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-0 md:mb-1">Date Range</label>
            <div className="flex items-center gap-2">
              <DateSelector value={startDate} onChange={setStartDate} placeholder="Start Date" />
              <span className="text-slate-300 font-bold px-0.5 text-sm md:text-base">~</span>
              <DateSelector value={endDate} onChange={setEndDate} placeholder="End Date" />
            </div>
          </div>
        </section>

        {/* METADATA BAR */}
        {buildMetadata && (
          <div className="bg-primary-600/5 dark:bg-primary-400/5 border border-primary-100 dark:border-primary-900/30 rounded-2xl md:rounded-3xl p-4 md:p-5 flex flex-wrap items-center gap-y-4 gap-x-6 md:gap-8 shadow-sm animate-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Selected Build</span>
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xs md:text-sm font-black text-slate-900 dark:text-white">{buildMetadata.build}</span>
                <span className={`text-white text-[8px] md:text-[9px] font-black uppercase px-2 py-0.5 md:px-2.5 md:py-1 rounded-md md:rounded-lg shadow-lg ${getBuildTypeColor(buildMetadata.type)}`}>
                  {buildMetadata.type}
                </span>
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden md:block"></div>
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Platform</span>
              <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300">{selectedPlatform}</span>
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden md:block"></div>
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Release Date</span>
              <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300">{buildMetadata.date}</span>
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden md:block"></div>
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Build Status</span>
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full animate-pulse ${getStatusColor(buildMetadata.status).replace('text', 'bg')}`}></span>
                <span className={`text-[10px] md:text-sm font-black uppercase ${getStatusColor(buildMetadata.status)}`}>{buildMetadata.status}</span>
              </div>
            </div>
          </div>
        )}

        {/* TABS */}
        <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-[1rem] md:rounded-[1.5rem] w-full md:w-auto overflow-x-auto no-scrollbar shadow-inner gap-1">
          {Object.values(TABS_CONFIG).map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-2xl text-[9px] md:text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 active:scale-95 ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              <span className="text-sm md:text-base">{tab.icon}</span>{tab.label}
              {errorMap[tab.id] && <span className="text-rose-500 animate-pulse">!</span>}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        {activeTab === 'summary' ? (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Total Testcases" value={summaryStats?.total || 0} icon="🎯" />
              <MetricCard title="Executed" value={summaryStats?.executed || 0} icon="⚡" />
              <MetricCard title="Pass Rate" value={`${summaryStats?.executed ? ((summaryStats.passed / summaryStats.executed) * 100).toFixed(1) : 0}%`} icon="✅" />
              <MetricCard title="Critical Issues" value={summaryStats?.critical || 0} icon="🌋" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
              <Card 
                title="Result Distribution" 
                error={errorMap[activeTab]} 
                loading={loadingMap[activeTab]} 
                suggestedGid={suggestedGidMap[activeTab]}
                onApplyFix={(newGid) => applyGidFix(activeTab, newGid)}
                onRetry={() => fetchData(activeTab)}
              >
                <div className="h-[250px] md:h-[300px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={60} 
                        outerRadius={85} 
                        paddingAngle={8} 
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelLine={true}
                      >
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate</div>
                    <div className="text-lg md:text-2xl font-black text-slate-900 dark:text-white">{pieData.reduce((s,c) => s+c.value, 0)}</div>
                  </div>
                </div>
              </Card>

              <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                 <Card 
                  title="Issue Severity Trend" 
                  error={errorMap[activeTab]} 
                  loading={loadingMap[activeTab]}
                  suggestedGid={suggestedGidMap[activeTab]}
                  onApplyFix={(newGid) => applyGidFix(activeTab, newGid)}
                  onRetry={() => fetchData(activeTab)}
                >
                  <div className="h-[250px] md:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 8, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.05)' }} />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '15px', fontSize: '8px', fontWeight: '800' }} />
                        <Bar name="Critical" dataKey="Critical" fill={EXECUTION_COLORS.critical} radius={[4, 4, 0, 0]} barSize={10} />
                        <Bar name="Major" dataKey="Major" fill={EXECUTION_COLORS.major} radius={[4, 4, 0, 0]} barSize={10} />
                        <Bar name="Minor" dataKey="Minor" fill={EXECUTION_COLORS.minor} radius={[4, 4, 0, 0]} barSize={10} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card 
                  title="Testing Methodology Trend" 
                  error={errorMap[activeTab]} 
                  loading={loadingMap[activeTab]}
                  suggestedGid={suggestedGidMap[activeTab]}
                  onApplyFix={(newGid) => applyGidFix(activeTab, newGid)}
                  onRetry={() => fetchData(activeTab)}
                >
                  <div className="h-[250px] md:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 8, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.05)' }} />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '15px', fontSize: '8px', fontWeight: '800' }} />
                        <Bar name="Automation" dataKey="Automation" fill={EXECUTION_COLORS.automation} radius={[4, 4, 0, 0]} barSize={10} />
                        <Bar name="Manual" dataKey="Manual" fill={EXECUTION_COLORS.manual} radius={[4, 4, 0, 0]} barSize={10} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>

            <Card 
              title="Execution Matrix" 
              error={errorMap[activeTab]} 
              loading={loadingMap[activeTab]}
              suggestedGid={suggestedGidMap[activeTab]}
              onApplyFix={(newGid) => applyGidFix(activeTab, newGid)}
              onRetry={() => fetchData(activeTab)}
            >
              <div className="overflow-x-auto no-scrollbar scroll-smooth">
                <table className="w-full text-left min-w-[900px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">RC Version</th>
                      <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Total</th>
                      <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Passed</th>
                      <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Failed</th>
                      <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">N/A</th>
                      <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Auto</th>
                      <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Man</th>
                      <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Defects</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRows.length > 0 ? filteredRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group">
                        <td className="px-4 py-4">
                          <div className="text-[11px] md:text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">
                            {row['RC Build'] || row['Build'] || row['Build Version']}
                          </div>
                          <div className="text-[8px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest">
                            {row.Platform || row.OS} • {row['Build Date'] || row['Date'] || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[10px] md:text-xs font-black text-slate-500">{row['Total Test Cases'] || 0}</td>
                        <td className="px-4 py-4 text-[10px] md:text-xs font-black text-emerald-600 dark:text-emerald-400">{row['Passed'] || 0}</td>
                        <td className="px-4 py-4 text-[10px] md:text-xs font-black text-rose-500">{row['Failed'] || 0}</td>
                        <td className="px-4 py-4 text-[10px] md:text-xs font-black text-slate-400">{row['Not considered'] || 0}</td>
                        <td className="px-4 py-4 text-[10px] md:text-xs font-black text-violet-500">{row['Automation executed'] || row['Automation'] || 0}</td>
                        <td className="px-4 py-4 text-[10px] md:text-xs font-black text-pink-500">{row['Manual executed'] || row['Manual'] || 0}</td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Badge value={row['Critical Issues']} color="bg-rose-500" label="Critical" size="sm" />
                            <Badge value={row['Major Issues']} color="bg-amber-500" label="Major" size="sm" />
                            <Badge value={row['Minor Issues']} color="bg-blue-500" label="Minor" size="sm" />
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center text-slate-400 font-black uppercase tracking-widest opacity-30 text-[10px]">No matching records</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : (
          <Card 
            title={activeTab === 'new_issues' ? 'Issue Backlog' : 'Validation Queue'} 
            error={errorMap[activeTab]} 
            loading={loadingMap[activeTab]} 
            suggestedGid={suggestedGidMap[activeTab]}
            onApplyFix={(newGid) => applyGidFix(activeTab, newGid)}
            onRetry={() => fetchData(activeTab)}
          >
            <div className="overflow-x-auto no-scrollbar scroll-smooth">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    {dataMap[activeTab]?.headers.map((h, i) => (
                      <th key={i} className="px-4 py-3.5 text-[9px] font-black uppercase text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      {dataMap[activeTab]?.headers.map((h, j) => {
                        const val = row[h];
                        const isStatus = h.toLowerCase().includes('status');
                        return (
                          <td key={j} className="px-4 py-3.5">
                            {isStatus ? (
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap ${
                                String(val).toLowerCase().includes('pass') || String(val).toLowerCase().includes('fixed') || String(val).toLowerCase().includes('resolved')
                                ? 'bg-emerald-500 text-white' : String(val).toLowerCase().includes('fail') || String(val).toLowerCase().includes('open') || String(val).toLowerCase().includes('block')
                                ? 'bg-rose-500 text-white' : 'bg-slate-400 text-white'
                              }`}>
                                {val || 'PENDING'}
                              </span>
                            ) : (
                              <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 line-clamp-2">{val || '-'}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
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
    <div className="bg-white dark:bg-slate-900 p-5 md:p-7 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
      <div className="absolute top-0 right-0 p-3 md:p-4 opacity-5 group-hover:opacity-20 transition-all rotate-12">
        <span className="text-4xl md:text-6xl">{icon}</span>
      </div>
      <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 md:mb-2">{title}</span>
      <div className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</div>
    </div>
  );
}

function Card({ title, children, loading, error, suggestedGid, onRetry, onApplyFix }: CardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col min-h-[300px] md:min-h-[350px]">
      <div className="px-6 md:px-8 py-4 md:py-5 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
        <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.25em] text-slate-400">{title}</h3>
      </div>
      <div className="p-4 md:p-8 flex-1 relative flex flex-col">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
             <div className="w-8 h-8 md:w-12 md:h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-4 md:py-8">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-rose-50 dark:bg-rose-950/20 rounded-2xl flex items-center justify-center text-rose-500 text-2xl md:text-3xl shadow-sm">⚠️</div>
            <div className="max-w-xs md:max-w-md px-4">
              <h4 className="text-[10px] md:text-xs font-black uppercase text-rose-600 mb-2 tracking-widest">Sync Failure</h4>
              <p className="text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed italic mb-6 md:mb-8 line-clamp-3">{error}</p>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 dark:border-slate-800 text-left">
                <p className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 mb-3 md:mb-4 border-b pb-2 tracking-widest">Remediation</p>
                <ul className="text-[9px] md:text-[10px] font-bold text-slate-500 space-y-2 mb-6 md:mb-8">
                  <li className="flex gap-2"><span>1.</span><span>Verify Publish to Web (CSV)</span></li>
                  <li className="flex gap-2"><span>2.</span><span>Confirm tab GID accuracy</span></li>
                </ul>
                
                {suggestedGid ? (
                  <div className="bg-primary-50 dark:bg-primary-950/30 p-3 md:p-4 rounded-xl md:rounded-2xl border border-primary-100 dark:border-primary-900/50 animate-pulse">
                    <p className="text-[9px] md:text-[10px] font-black text-primary-700 dark:text-primary-400 mb-2 md:mb-3 uppercase tracking-tighter flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                       Suggested GID: <span className="font-mono">{suggestedGid}</span>
                    </p>
                    <button 
                      onClick={() => onApplyFix?.(suggestedGid)}
                      className="w-full bg-primary-600 text-white py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/10"
                    >
                      Apply Fix
                    </button>
                  </div>
                ) : (
                  <button onClick={onRetry} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-[0.98]">Manual Sync</button>
                )}
              </div>
            </div>
          </div>
        ) : children}
      </div>
    </div>
  );
}

function Badge({ value, color, label, size = 'md' }: BadgeProps) {
  const v = (!value || value === 0 || value === "" || isNaN(value)) ? '-' : value;
  const sizeClasses = size === 'sm' ? 'w-5 h-5 md:w-6 md:h-6 text-[8px] md:text-[9px]' : 'w-7 h-7 md:w-8 md:h-8 text-[10px] md:text-[11px]';
  return (
    <div className="relative group/badge inline-block">
      <div className={`${sizeClasses} rounded-md md:rounded-lg flex items-center justify-center font-black transition-all hover:scale-110 cursor-help ${v === '-' ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600' : `${color} text-white shadow-sm`}`}>{v}</div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-lg md:rounded-xl opacity-0 scale-90 group-hover/badge:opacity-100 group-hover/badge:scale-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-[100] shadow-2xl border border-white/10 dark:border-slate-200 origin-bottom">
        <div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${v === '-' ? 'bg-slate-400' : color}`}></span>{v === '-' ? `No ${label} Items` : `${v} ${label} Items`}</div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-white"></div>
      </div>
    </div>
  );
}