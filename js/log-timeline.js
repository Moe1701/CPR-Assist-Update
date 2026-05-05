/**
 * CPR Assist - Log Timeline & KPI Stats Modul (V60 - Medical Grade Analytics)
 * - FEATURE: Intelligente Stats-Engine aggregiert Behandlungs-KPIs on-the-fly!
 * - FEATURE: Dynamische Tab-Injektion (Fügt "KPIs" Tab automatisch ins UI ein).
 * - FEATURE: Naked-Icons für kompakte, EKG-Style Timelines.
 * - FEATURE: Vollständiges SBAR-Summary & Chronologische Liste.
 * - ARCHITEKTUR: 100% autark. Erzeugt fehlende DOM-Elemente selbst.
 */

window.CPR = window.CPR || {};

window.CPR.LogTimeline = (function() {
    let currentView = 'list'; 
    let liveMarkerInterval = null;
    
    // --- 1. ICON & JOULE LOGIK ---
    function getIconData(txt) {
        if (!txt) return { icon: '•', color: 'text-slate-400', bg: 'bg-slate-100' };
        const t = txt.toLowerCase();
        
        if (t.includes('schock') && !t.includes('schockbar')) {
            const match = t.match(/(\d+)\s*[jJ]/);
            if (match) return { icon: match[1] + 'J', type: 'shock', color: 'text-white', bg: 'bg-[#E3000F]' };
            return { icon: '⚡', type: 'shock', color: 'text-white', bg: 'bg-[#E3000F]' };
        }
        
        if (t.includes('nicht schockbar')) return { icon: '🚫', type: 'analysis-no', color: 'text-white', bg: 'bg-slate-800' };
        if (t.includes('schockbar')) return { icon: '⚡', type: 'analysis-yes', color: 'text-white', bg: 'bg-amber-500' };
        if (t.includes('rhythmusanalyse')) return { icon: '❤️', type: 'analysis', color: 'text-white', bg: 'bg-indigo-500' };

        if (t.includes('hits') || t.includes('sampler') || t.includes('anamnese')) return { icon: '📋', type: 'info', color: 'text-white', bg: 'bg-blue-500' };
        if (t.includes('adrenalin')) return { icon: 'A', type: 'med', color: 'text-white', bg: 'bg-purple-600' };
        if (t.includes('amiodaron')) return { icon: 'Am', type: 'med', color: 'text-white', bg: 'bg-purple-500' };
        if (t.includes('gegeben') || t.includes('volumen') || t.includes('calcium')) return { icon: '💉', type: 'med', color: 'text-white', bg: 'bg-purple-400' };
        
        if (t.includes('atemweg')) return { icon: '🫁', type: 'airway', color: 'text-white', bg: 'bg-cyan-500' };
        if (t.includes('zugang')) return { icon: '🩸', type: 'access', color: 'text-white', bg: 'bg-rose-500' };
        
        if (t.includes('pause')) return { icon: '⏸️', type: 'pause', color: 'text-slate-600', bg: 'bg-amber-100' };
        if (t.includes('fortgesetzt') || t.includes('start rea')) return { icon: '▶️', type: 'play', color: 'text-slate-600', bg: 'bg-emerald-100' };
        
        if (t.includes('rosc')) return { icon: '💓', type: 'rosc', color: 'text-white', bg: 'bg-emerald-500' };
        if (t.includes('beendet')) return { icon: '🏁', type: 'end', color: 'text-white', bg: 'bg-slate-800' };

        return { icon: '•', color: 'text-slate-500', bg: 'bg-slate-200' };
    }

    // --- 2. RENDER: EINFACHE LISTE ---
    function renderList() {
        const container = document.getElementById('log-list-content');
        if (!container) return;
        const data = window.CPR.AppState?.protocolData || [];
        
        if (data.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-400 mt-10 font-bold">Noch keine Einträge.</div>';
            return;
        }

        let html = '<div class="space-y-2 p-4">';
        data.forEach(item => {
            const iconObj = getIconData(item.action);
            html += `
                <div class="flex items-center bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                    <div class="w-10 h-10 shrink-0 rounded-full ${iconObj.bg} ${iconObj.color} flex items-center justify-center font-black text-sm shadow-sm mr-3">
                        ${iconObj.icon}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-[13px] font-bold text-slate-700 truncate">${item.action}</div>
                        <div class="text-[10px] font-bold text-slate-400">${item.time} (+${window.CPR.Utils.formatTime(item.secondsFromStart)})</div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // --- 3. RENDER: VERTIKALE EKG-TIMELINE ---
    function renderTimeline() {
        const container = document.getElementById('log-timeline-content');
        if (!container) return;
        const data = window.CPR.AppState?.protocolData || [];

        if (data.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-400 mt-10 font-bold">Warte auf Ereignisse...</div>';
            return;
        }

        let html = '<div class="relative pl-6 ml-4 mt-4 border-l-2 border-slate-200 space-y-6 pb-12">';
        data.forEach(item => {
            const iconObj = getIconData(item.action);
            html += `
                <div class="relative">
                    <div class="absolute -left-[35px] bg-[#f8fafc] py-1">
                        <div class="w-8 h-8 rounded-full ${iconObj.bg} ${iconObj.color} flex items-center justify-center font-black text-xs shadow-sm ring-4 ring-[#f8fafc]">
                            ${iconObj.icon}
                        </div>
                    </div>
                    <div class="pl-4">
                        <div class="bg-white p-3 rounded-xl shadow-sm border border-slate-100 inline-block max-w-[90%]">
                            <div class="text-[12px] font-black text-slate-800">${item.action}</div>
                            <div class="text-[9px] font-bold text-slate-400 mt-0.5">${item.time} | +${window.CPR.Utils.formatTime(item.secondsFromStart)} min</div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // --- 4. RENDER: SBAR SUMMARY ---
    function renderSummary() {
        const container = document.getElementById('log-summary-content');
        if (!container) return;
        const state = window.CPR.AppState;
        
        let html = '<div class="p-4 space-y-4 pb-12">';
        
        // Einsatz Infos
        html += `
            <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <h3 class="text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100 pb-2 mb-3">Einsatz Infos</h3>
                <div class="grid grid-cols-2 gap-3">
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Startzeit</span><span class="font-black text-slate-700">${state.startTime || '--:--'}</span></div>
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Patient</span><span class="font-black text-slate-700">${state.isPediatric ? 'Kind (' + (state.patientWeight||'?') + 'kg)' : 'Erwachsener'}</span></div>
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">CPR Modus</span><span class="font-black text-slate-700">${state.cprMode || 'continuous'}</span></div>
                </div>
            </div>
        `;

        // Maßnahmen
        const aws = state.airwayLabel || 'Nicht etabliert';
        const zug = state.zugangLabel || 'Nicht etabliert';
        html += `
            <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <h3 class="text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100 pb-2 mb-3">Maßnahmen</h3>
                <div class="space-y-2">
                    <div class="flex justify-between items-center"><span class="text-xs font-bold text-slate-500">Atemweg</span><span class="text-xs font-black text-cyan-600">${aws}</span></div>
                    <div class="flex justify-between items-center"><span class="text-xs font-bold text-slate-500">Zugang</span><span class="text-xs font-black text-rose-600">${zug}</span></div>
                    <div class="flex justify-between items-center"><span class="text-xs font-bold text-slate-500">Schocks</span><span class="text-xs font-black text-[#E3000F]">${state.shockCount || 0}</span></div>
                    <div class="flex justify-between items-center"><span class="text-xs font-bold text-slate-500">Adrenalin</span><span class="text-xs font-black text-purple-600">${state.adrCount || 0}x gegeben</span></div>
                    <div class="flex justify-between items-center"><span class="text-xs font-bold text-slate-500">Amiodaron</span><span class="text-xs font-black text-purple-600">${state.amioCount || 0}x gegeben</span></div>
                </div>
            </div>
        `;

        html += '</div>';
        container.innerHTML = html;
    }

    // --- 5. RENDER: KPI STATISTIKEN (DER NEUE MEDICAL GRADE PARSER) ---
    function renderStats() {
        const container = document.getElementById('log-stats-content');
        if (!container) return;

        const data = window.CPR.AppState?.protocolData || [];
        
        // Stats Engine Variablen
        let firstCPR = null, firstShock = null, firstAirway = null, firstAdr = null, firstAccess = null, roscTime = null;
        let pauses = [], pauseStart = null;
        let analyses = [], lastAnalysis = null;
        
        // Parser-Logik
        data.forEach(item => {
            const a = item.action.toLowerCase();
            const s = item.secondsFromStart;

            // Golden Hour Metriken
            if (!firstCPR && (a.includes('start rea') || a.includes('kompression begonnen'))) firstCPR = s;
            if (!firstShock && a.includes('schock abgegeben')) firstShock = s;
            if (!firstAirway && (a.includes('atemweg:') && !a.includes('entfernt'))) firstAirway = s;
            if (!firstAdr && a.includes('adrenalin')) firstAdr = s;
            if (!firstAccess && a.includes('zugang:')) firstAccess = s;
            if (!roscTime && (a.includes('rosc eingetreten') || a.includes('rosc'))) roscTime = s;

            // Pausen-Aggregator
            if (a.includes('kompression pause')) {
                pauseStart = s;
            } else if (a.includes('kompression fortgesetzt') && pauseStart !== null) {
                const duration = s - pauseStart;
                if (duration > 0) pauses.push(duration);
                pauseStart = null;
            }

            // Analyse-Disziplin (Zeit zwischen Checks)
            if (a.includes('rhythmusanalyse')) {
                if (lastAnalysis !== null) {
                    const diff = s - lastAnalysis;
                    if (diff > 0) analyses.push(diff);
                }
                lastAnalysis = s;
            }
        });

        // Mathematik
        const maxPause = pauses.length ? Math.max(...pauses) : 0;
        const avgPause = pauses.length ? Math.round(pauses.reduce((a,b)=>a+b,0) / pauses.length) : 0;
        const avgCheck = analyses.length ? Math.round(analyses.reduce((a,b)=>a+b,0) / analyses.length) : 0;
        
        // CCF Re-Kalkulation zur Sicherheit
        const arrSec = window.CPR.AppState.arrestSeconds || 0;
        const compSec = window.CPR.AppState.compressingSeconds || 0;
        const ccf = arrSec > 0 ? Math.min(100, Math.round((compSec / arrSec) * 100)) : 0;

        // Hilfsfunktion für saubere Zeit-Anzeige
        const ft = (sec) => sec !== null ? window.CPR.Utils.formatTime(sec) : '--:--';
        
        // Qualitäts-Farben
        const ccfColor = ccf >= 80 ? 'text-emerald-500' : 'text-[#E3000F]';
        const pauseColor = maxPause > 10 ? 'text-[#E3000F]' : (maxPause > 0 ? 'text-emerald-500' : 'text-slate-400');
        const avgPauseColor = avgPause > 10 ? 'text-[#E3000F]' : (avgPause > 0 ? 'text-emerald-500' : 'text-slate-400');

        let html = '<div class="p-4 space-y-4 pb-12">';
        
        // KACHEL 1: GOLDEN HOUR
        html += `
            <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="bg-amber-50 px-4 py-2 border-b border-amber-100 flex items-center gap-2">
                    <i class="fa-solid fa-stopwatch text-amber-500"></i>
                    <h3 class="text-[10px] uppercase font-black text-amber-700 tracking-widest">Zeit bis Erstmaßnahme</h3>
                </div>
                <div class="p-4 grid grid-cols-2 gap-4">
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">1. Kompression</span><span class="font-black text-slate-700 text-lg">${ft(firstCPR)}</span></div>
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">1. Schock</span><span class="font-black text-slate-700 text-lg">${ft(firstShock)}</span></div>
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Atemweg gesichert</span><span class="font-black text-slate-700 text-lg">${ft(firstAirway)}</span></div>
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">1. Adrenalin</span><span class="font-black text-slate-700 text-lg">${ft(firstAdr)}</span></div>
                </div>
            </div>
        `;

        // KACHEL 2: QUALITÄT (CCF & Pausen)
        html += `
            <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex items-center gap-2">
                    <i class="fa-solid fa-heart-pulse text-indigo-500"></i>
                    <h3 class="text-[10px] uppercase font-black text-indigo-700 tracking-widest">Performance (KPI)</h3>
                </div>
                <div class="p-4 space-y-4">
                    <!-- CCF Bar -->
                    <div>
                        <div class="flex justify-between items-end mb-1">
                            <span class="text-[10px] font-bold text-slate-400 uppercase">CCF (Kompressionfraktion)</span>
                            <span class="font-black text-xl ${ccfColor}">${ccf}%</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div class="h-full ${ccf >= 80 ? 'bg-emerald-400' : 'bg-[#E3000F]'} transition-all duration-1000" style="width: ${ccf}%"></div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div>
                            <span class="block text-[9px] font-bold text-slate-400 uppercase">Längste Pause</span>
                            <span class="font-black text-lg ${pauseColor}">${maxPause} s</span>
                        </div>
                        <div>
                            <span class="block text-[9px] font-bold text-slate-400 uppercase">Ø Pause pro Check</span>
                            <span class="font-black text-lg ${avgPauseColor}">${avgPause} s</span>
                        </div>
                        <div class="col-span-2">
                            <span class="block text-[9px] font-bold text-slate-400 uppercase">Ø Zeit zw. Rhythmusanalysen (Ziel ~120s)</span>
                            <span class="font-black text-lg text-slate-700">${avgCheck > 0 ? avgCheck + ' s' : '--'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // KACHEL 3: EREIGNISSE & OUTCOME
        html += `
            <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="bg-emerald-50 px-4 py-2 border-b border-emerald-100 flex items-center gap-2">
                    <i class="fa-solid fa-chart-pie text-emerald-500"></i>
                    <h3 class="text-[10px] uppercase font-black text-emerald-700 tracking-widest">Therapie & Outcome</h3>
                </div>
                <div class="p-4 grid grid-cols-2 gap-4">
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Zeit bis ROSC</span><span class="font-black ${roscTime ? 'text-emerald-500' : 'text-slate-400'} text-lg">${ft(roscTime)}</span></div>
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Defibrillationen</span><span class="font-black text-slate-700 text-lg">${window.CPR.AppState.shockCount || 0}x</span></div>
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Adrenalin Gesamt</span><span class="font-black text-slate-700 text-lg">${window.CPR.AppState.adrCount || 0} Dosen</span></div>
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Amiodaron Gesamt</span><span class="font-black text-slate-700 text-lg">${window.CPR.AppState.amioCount || 0} Dosen</span></div>
                </div>
            </div>
        `;

        html += '</div>';
        container.innerHTML = html;
    }

    // --- TAB SWITCHER LOGIK ---
    function switchTab(tab) {
        currentView = tab;
        const ids = ['list', 'timeline', 'summary', 'stats'];
        
        ids.forEach(id => {
            const btn = document.getElementById('btn-view-' + id);
            const content = document.getElementById('log-' + id + '-content');
            
            if (btn) {
                if (id === tab) {
                    btn.classList.replace('text-slate-400', 'text-slate-800');
                    btn.classList.replace('border-transparent', 'border-slate-800');
                } else {
                    btn.classList.replace('text-slate-800', 'text-slate-400');
                    btn.classList.replace('border-slate-800', 'border-transparent');
                }
            }
            if (content) {
                if (id === tab) {
                    content.classList.remove('hidden');
                    content.classList.add('flex');
                } else {
                    content.classList.add('hidden');
                    content.classList.remove('flex');
                }
            }
        });

        renderCurrentView();
    }

    function renderCurrentView() {
        if (currentView === 'list') renderList();
        else if (currentView === 'timeline') renderTimeline();
        else if (currentView === 'summary') renderSummary();
        else if (currentView === 'stats') renderStats();
    }

    // --- INITIALISIERUNG & DOM-INJEKTION ---
    function init() {
        // 🌟 ARCHITEKTUR-HACK: Wir injizieren den KPIs Tab dynamisch in die NavBar, 
        // ohne dass index.html jemals angefasst werden muss!
        const tabContainer = document.getElementById('btn-view-summary')?.parentElement;
        if (tabContainer && !document.getElementById('btn-view-stats')) {
            const btnStats = document.createElement('button');
            btnStats.id = 'btn-view-stats';
            btnStats.className = 'flex-1 py-3 text-[10px] font-black uppercase text-slate-400 border-b-2 border-transparent transition-all';
            btnStats.innerText = 'KPIs';
            tabContainer.appendChild(btnStats);
        }

        // Dazugehörigen Content-Container injizieren
        const contentContainer = document.getElementById('log-summary-content')?.parentElement;
        if (contentContainer && !document.getElementById('log-stats-content')) {
            const divStats = document.createElement('div');
            divStats.id = 'log-stats-content';
            divStats.className = 'hidden flex-col h-full overflow-y-auto custom-scrollbar bg-slate-50';
            contentContainer.appendChild(divStats);
        }

        // Event-Listener anheften
        const btnTime = document.getElementById('btn-view-timeline');
        if (btnTime) btnTime.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('timeline'); });
        
        const btnList = document.getElementById('btn-view-list');
        if (btnList) btnList.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('list'); });
        
        const btnSumm = document.getElementById('btn-view-summary');
        if (btnSumm) btnSumm.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('summary'); });

        const btnStatsTab = document.getElementById('btn-view-stats');
        if (btnStatsTab) btnStatsTab.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('stats'); });

        const btnToggle = document.getElementById('btn-toggle-protocol');
        if (btnToggle) btnToggle.addEventListener('click', () => { renderCurrentView(); });
        
        const btnDebrief = document.getElementById('btn-rosc-end');
        if(btnDebrief) btnDebrief.addEventListener('click', () => { setTimeout(renderCurrentView, 500); });

        // Standard-Tab nach Start
        setTimeout(() => { switchTab('list'); }, 100);
    }

    return { init: init, forceRender: renderCurrentView };
})();

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { if (window.CPR && window.CPR.LogTimeline) window.CPR.LogTimeline.init(); }, 150); });
