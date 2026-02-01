
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { fetchSpreadsheetData, fetchSpeakers, fetchFoglio1Data } from './services/googleSheets';
import { MeetingRecord, DashboardStats, Speaker } from './types';
import StatBadge from './components/StatBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type ViewState = 'splash' | 'dashboard' | 'speakers';

const AUTO_TOGGLE_INTERVAL = 8000; // 8 secondi per ogni metrica

const App: React.FC = () => {
  const [data, setData] = useState<MeetingRecord[]>([]);
  const [foglio1Data, setFoglio1Data] = useState<MeetingRecord[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [currentSpeakerIdx, setCurrentSpeakerIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>('splash');
  const [chartMetric, setChartMetric] = useState<'contatti' | 'grazie'>('contatti');
  const [toggleProgress, setToggleProgress] = useState(0);

  const [timeLeft, setTimeLeft] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<number | null>(null);
  const autoToggleRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [sheetData, speakersList, f1Data] = await Promise.all([
          fetchSpreadsheetData(),
          fetchSpeakers(),
          fetchFoglio1Data()
        ]);
        setData(sheetData);
        setSpeakers(speakersList);
        setFoglio1Data(f1Data);
      } catch (error) {
        console.error("Errore nel caricamento dati:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Gestione Auto-Toggle Dashboard
  useEffect(() => {
    if (currentView === 'dashboard') {
      const startTime = Date.now();
      
      progressIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = (elapsed % AUTO_TOGGLE_INTERVAL) / AUTO_TOGGLE_INTERVAL * 100;
        setToggleProgress(progress);
      }, 100);

      autoToggleRef.current = window.setInterval(() => {
        setChartMetric(prev => prev === 'contatti' ? 'grazie' : 'contatti');
      }, AUTO_TOGGLE_INTERVAL);
    } else {
      if (autoToggleRef.current) clearInterval(autoToggleRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }

    return () => {
      if (autoToggleRef.current) clearInterval(autoToggleRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [currentView]);

  // Timer Speaker View
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      playAlarm();
      setTimerActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, timeLeft]);

  const playAlarm = () => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playBeep = (time: number, freq: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.2, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
      osc.start(time);
      osc.stop(time + 0.3);
    };
    const now = audioCtx.currentTime;
    playBeep(now, 880);
    playBeep(now + 0.4, 880);
  };

  const toggleTimer = () => setTimerActive(!timerActive);
  const resetTimer = () => {
    setTimerActive(false);
    setTimeLeft(60);
  };

  const handleNextSpeaker = () => {
    setCurrentSpeakerIdx((prev) => (prev + 1) % speakers.length);
    resetTimer();
  };

  const handlePrevSpeaker = () => {
    setCurrentSpeakerIdx((prev) => (prev - 1 + speakers.length) % speakers.length);
    resetTimer();
  };

  const normalizeDateStr = (dateStr: string) => {
    if (!dateStr) return "";
    let clean = dateStr.trim();
    if (clean.includes('-')) {
      const p = clean.split('-');
      if (p.length === 3) {
        if (p[0].length === 4) return `${p[2].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[0]}`;
        return `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`;
      }
    }
    const parts = clean.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = `20${year}`;
      return `${day}/${month}/${year}`;
    }
    return clean;
  };

  const nextMeetingDate = useMemo(() => {
    if (data.length === 0) return new Date();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const futureDates = data
      .map(record => {
        const parts = record.data.split('/');
        if (parts.length === 3) {
          return new Date(+parts[2], +parts[1] - 1, +parts[0]);
        }
        return new Date(record.data);
      })
      .filter(date => !isNaN(date.getTime()) && date >= tomorrow)
      .sort((a, b) => a.getTime() - b.getTime());
    
    return futureDates.length > 0 ? futureDates[0] : tomorrow;
  }, [data]);

  const meetingDateStrNormalized = useMemo(() => {
    const d = nextMeetingDate;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }, [nextMeetingDate]);

  const nextMeetingLabel = useMemo(() => {
    const formatted = nextMeetingDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    return `Riunione del ${formatted}`;
  }, [nextMeetingDate]);

  const speakerStats = useMemo(() => {
    if (currentView !== 'speakers' || !speakers[currentSpeakerIdx]) return null;
    const speakerName = speakers[currentSpeakerIdx].nome.toLowerCase().trim();
    
    const recordsContatti = foglio1Data.filter(r => {
      return r.membro.toLowerCase().trim() === speakerName && 
             normalizeDateStr(r.data) === meetingDateStrNormalized;
    });

    const targetsPortati = recordsContatti
      .map(r => r.target)
      .filter(t => t && t.trim() !== '')
      .flatMap(t => t!.split(',').map(name => name.trim()));
    const uniqueTargets = Array.from(new Set(targetsPortati)).filter((t: any) => t.length > 0);

    const recordsGrazieInviati = foglio1Data.filter(r => {
      const recordTarget = (r.target || "").toLowerCase().trim();
      return recordTarget === speakerName && 
             normalizeDateStr(r.data) === meetingDateStrNormalized &&
             r.affareFatto > 0;
    });

    const totalGrazieInviati = recordsGrazieInviati.reduce((acc, r) => acc + r.affareFatto, 0);
    const grazieDettaglio = recordsGrazieInviati.map(r => ({
      membro: r.membro,
      valore: r.affareFatto
    }));

    return { uniqueTargets, totalGrazieInviati, grazieDettaglio };
  }, [foglio1Data, speakers, currentSpeakerIdx, meetingDateStrNormalized, currentView]);

  const stats = useMemo((): DashboardStats => {
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);
    return data.reduce((acc, record) => {
      const recordDateParts = record.data.split('/');
      let recordDate: Date;
      if (recordDateParts.length === 3) {
        recordDate = new Date(+recordDateParts[2], +recordDateParts[1] - 1, +recordDateParts[0]);
      } else {
        recordDate = new Date(record.data);
      }
      const isThisWeek = !isNaN(recordDate.getTime()) && recordDate >= oneWeekAgo;
      acc.contattiTotali += record.contattiStrategici;
      acc.grazieTotali += record.grazieGenerati;
      if (isThisWeek) {
        acc.contattiSettimana += record.contattiStrategici;
        acc.grazieSettimana += record.grazieGenerati;
      }
      return acc;
    }, {
      contattiSettimana: 0,
      contattiTotali: 0,
      grazieSettimana: 0,
      grazieTotali: 0
    });
  }, [data]);

  const chartData = useMemo(() => {
    return data.slice(0, 10).map((d) => ({
      name: d.data.split('/')[0] + '/' + d.data.split('/')[1],
      contatti: d.contattiStrategici,
      grazie: d.grazieGenerati
    }));
  }, [data]);

  const currencyFormatter = (value: number) => 
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium animate-pulse">Sincronizzazione Nameless...</p>
        </div>
      </div>
    );
  }

  if (currentView === 'splash') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 opacity-50"></div>
        <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
          <div className="mb-8 flex justify-center">
            <div className="h-20 w-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 animate-bounce">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
               </svg>
            </div>
          </div>
          <h2 className="text-indigo-400 font-bold uppercase tracking-widest mb-2">Riunione Nameless</h2>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
            Benvenuti alla riunione del <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{nextMeetingDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl italic mb-12">
            "Insieme, facciamo crescere il nostro valore."
          </p>
          <button 
            onClick={() => setCurrentView('dashboard')}
            className="group relative inline-flex items-center justify-center px-10 py-4 font-bold text-white transition-all duration-200 bg-indigo-600 rounded-full hover:bg-indigo-700 shadow-xl shadow-indigo-600/40 active:scale-95"
          >
            Inizia Sessione
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'speakers') {
    const currentSpeaker = speakers[currentSpeakerIdx] || { nome: 'Nessuno speaker' };
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (timeLeft / 60) * circumference;

    return (
      <div className="min-h-screen bg-white flex flex-col animate-[fadeIn_0.5s_ease-in] overflow-hidden">
        <header className="px-8 py-4 flex items-center justify-between border-b border-slate-50 sticky top-0 bg-white/80 backdrop-blur-md z-50">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className="group flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors text-sm font-bold uppercase tracking-tight"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Dashboard
          </button>
          <div className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black tracking-widest uppercase">
            Speaker {currentSpeakerIdx + 1} / {speakers.length}
          </div>
        </header>

        <div className="fixed top-24 left-8 z-40">
           <div 
             className="bg-slate-900 text-white rounded-full pl-6 pr-[13px] py-[13px] flex items-center gap-4 shadow-2xl shadow-indigo-500/20 border border-slate-800 cursor-pointer group hover:scale-105 transition-all opacity-50 hover:opacity-100"
             onClick={toggleTimer}
           >
              <div className="flex flex-col">
                <span className="text-[10px] font-black tracking-[0.2em] text-indigo-400 leading-none uppercase">Intervento</span>
                <span className="text-[9px] font-medium text-slate-400">Tempo residuo</span>
              </div>
              <div className="relative">
                <svg className="w-12 h-12 transform -rotate-90" >
                  <circle cx="24" cy="24" r={radius} stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-slate-800" />
                  <circle
                    cx="24"
                    cy="24"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="transparent"
                    strokeDasharray={circumference}
                    style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1s linear' }}
                    strokeLinecap="round"
                    className={`${timeLeft <= 10 ? 'text-red-500' : 'text-indigo-500'}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                   <span className={`text-sm font-black tabular-nums ${timeLeft <= 10 ? 'text-red-500' : 'text-white'}`}>
                      {timeLeft}
                   </span>
                </div>
              </div>
           </div>
        </div>

        <main className="flex-grow flex flex-col items-center justify-center px-8 relative text-center">
          <div className="w-full max-w-4xl animate-[fadeIn_0.6s_ease-out] mb-12">
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-tight mb-2">
              {currentSpeaker.nome}
            </h1>
            {currentSpeaker.professione && (
              <p className="text-xl md:text-2xl font-bold text-indigo-600 uppercase tracking-[0.2em] mb-4">
                {currentSpeaker.professione}
              </p>
            )}
            {currentSpeaker.descrizione && (
              <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto italic leading-relaxed font-medium">
                "{currentSpeaker.descrizione}"
              </p>
            )}
          </div>

          {speakerStats && (
            <div className="w-full max-w-5xl bg-slate-50 rounded-[40px] p-10 border border-slate-100 animate-[fadeIn_0.8s_ease-out] shadow-sm">
              <div className="flex items-center justify-center gap-3 mb-10">
                 <div className="h-px w-12 bg-slate-200" />
                 <h2 className="text-[11px] font-black tracking-[0.6em] text-slate-400 uppercase">Contributo per questa riunione</h2>
                 <div className="h-px w-12 bg-slate-200" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left">
                
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col min-h-[250px]">
                   <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <span className="text-base font-black text-slate-800 uppercase tracking-tight">Contatti Strategici Portati</span>
                   </div>
                   <div className="flex-grow">
                      {speakerStats.uniqueTargets.length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                          {speakerStats.uniqueTargets.map((target, idx) => (
                            <span key={idx} className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black bg-blue-50 text-blue-800 border border-blue-100 uppercase tracking-tight animate-[fadeIn_0.3s_ease-out]">
                              {target}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                           <p className="text-sm text-slate-400 italic font-medium">Nessun contatto registrato per oggi</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col min-h-[250px]">
                   <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-base font-black text-slate-800 uppercase tracking-tight">Grazie Inviati</span>
                   </div>
                   <div className="flex-grow overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
                      {speakerStats.grazieDettaglio.length > 0 ? (
                        <div className="space-y-3">
                          {speakerStats.grazieDettaglio.map((g, idx) => (
                            <div key={idx} className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 animate-[fadeIn_0.3s_ease-out]">
                               <p className="text-sm font-bold text-slate-700">
                                 <span className="text-emerald-700">grazie a</span> {g.membro} <span className="text-emerald-700">per</span> {currencyFormatter(g.valore)}
                               </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                           <p className="text-sm text-slate-400 italic font-medium">Nessun affare fatto oggi</p>
                        </div>
                      )}
                   </div>
                   {speakerStats.totalGrazieInviati > 0 && (
                     <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-right text-lg font-black text-emerald-600">
                          Totale: {currencyFormatter(speakerStats.totalGrazieInviati)}
                        </p>
                     </div>
                   )}
                </div>

              </div>
            </div>
          )}

          <button onClick={handlePrevSpeaker} className="fixed left-6 top-1/2 -translate-y-1/2 p-4 text-slate-200 hover:text-indigo-400 transition-all hover:bg-slate-50 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={handleNextSpeaker} className="fixed right-6 top-1/2 -translate-y-1/2 p-4 text-slate-200 hover:text-indigo-400 transition-all hover:bg-slate-50 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </main>

        <footer className="fixed bottom-10 w-full flex justify-center">
            <div className="flex items-center gap-2">
               {speakers.map((_, idx) => (
                 <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSpeakerIdx ? 'w-12 bg-indigo-600' : 'w-2 bg-slate-200'}`} />
               ))}
            </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 animate-[fadeIn_0.5s_ease-in]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => setCurrentView('splash')} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-1 uppercase">
                scambi nameless
              </h1>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">{nextMeetingLabel}</p>
            </div>
          </div>
          <button 
            onClick={() => setCurrentView('speakers')}
            className="flex items-center gap-2 bg-slate-900 text-white px-7 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95"
          >
            Speaker View
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatBadge label="Contatti (Settimana)" value={stats.contattiSettimana} color="blue" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
          <StatBadge label="Contatti (Totali)" value={stats.contattiTotali} color="purple" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
          <StatBadge label="Grazie (Settimana)" value={currencyFormatter(stats.grazieSettimana)} color="green" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <StatBadge label="Grazie (Totali)" value={currencyFormatter(stats.grazieTotali)} color="orange" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group transition-all duration-500 hover:shadow-xl">
            <div className="flex items-center justify-between mb-8 relative z-10">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Andamento Ultime Riunioni</h2>
              <div className="flex flex-col gap-1 items-end">
                <div className="flex gap-1 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                  <button 
                    onClick={() => { setChartMetric('contatti'); setToggleProgress(0); }} 
                    className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-500 transform ${chartMetric === 'contatti' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Contatti
                  </button>
                  <button 
                    onClick={() => { setChartMetric('grazie'); setToggleProgress(0); }} 
                    className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-500 transform ${chartMetric === 'grazie' ? 'bg-emerald-600 text-white shadow-lg scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Grazie
                  </button>
                </div>
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                   <div 
                     className={`h-full transition-all duration-100 ${chartMetric === 'contatti' ? 'bg-indigo-400' : 'bg-emerald-400'}`}
                     style={{ width: `${toggleProgress}%` }}
                   />
                </div>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc', radius: 10}} 
                    contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px'}}
                    itemStyle={{fontWeight: 800, textTransform: 'uppercase', fontSize: '10px'}}
                  />
                  <Bar 
                    dataKey={chartMetric} 
                    radius={[12, 12, 0, 0]} 
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                  >
                    {chartData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={chartMetric === 'contatti' ? '#4f46e5' : '#10b981'} 
                        className="transition-all duration-700"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden transition-all duration-500 hover:shadow-xl">
            <h2 className="text-xl font-black text-slate-800 tracking-tight mb-8">Storico Riunioni</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50 text-left">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Contatti</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Grazie (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.slice(0, 8).map((record, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-all group cursor-default">
                      <td className="px-6 py-4 text-sm text-slate-600 font-bold group-hover:text-indigo-600 transition-colors">{record.data}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-900 font-black">{record.contattiStrategici}</td>
                      <td className="px-6 py-4 text-sm text-right text-emerald-600 font-black">{currencyFormatter(record.grazieGenerati)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
