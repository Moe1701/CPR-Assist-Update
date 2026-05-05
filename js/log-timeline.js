/**
 * CPR Assist - Log Timeline & KPI Stats Modul (V61 - Bulletproof Event Delegation)
 * - BUGFIX: Harte CSS-Overrides (`style.display` & `style.color`) beheben eingefrorene Tabs!
 * - BUGFIX: Globale Event-Delegation sorgt dafür, dass Reiter IMMER klickbar bleiben.
 * - FEATURE: Intelligente Stats-Engine aggregiert Behandlungs-KPIs on-the-fly.
 * - FEATURE: Dynamische Tab-Injektion (Fügt "KPIs" Tab automatisch ins UI ein).
 */

window.CPR = window.CPR || {};

window.CPR.LogTimeline = (function() {
    let currentView = 'list'; 
    
    // --- 1. ICON & LOGIK ---
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
        const data = (window.CPR.AppState && window.CPR.AppState.protocolData) ? window.CPR.AppState.protocolData : [];
        
        if (data.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-400 mt-10 font-bold w-full">Noch keine Einträge.</div>';
            return;
        }

        let html = '<div class="space-y-2 p-4 w-full">';
        data.forEach(item => {
            const iconObj = getIconData(item.action);
            const sec = item.secondsFromStart || 0;
            const timeStr = window.CPR.Utils && typeof window.CPR.Utils.formatTime === 'function' ? window.CPR.Utils.formatTime(sec) : '--:--';
            
            html += `
                <div class="flex items-center bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                    <div class="w-10 h-10 shrink-0 rounded-full ${iconObj.bg} ${iconObj.color} flex items-center justify-center font-black text-sm shadow-sm mr-3">
                        ${iconObj.icon}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-[13px] font-bold text-slate-700 truncate">${item.action || 'Eintrag'}</div>
                        <div class="text-[10px] font-bold text-slate-400">${item.time || ''} (+${timeStr})</div>
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
        const data = (window.CPR.AppState && window.CPR.AppState.protocolData) ? window.CPR.AppState.protocolData : [];

        if (data.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-400 mt-10 font-bold w-full">Warte auf Ereignisse...</div>';
            return;
        }

        let html = '<div class="relative pl-6 ml-4 mt-4 border-l-2 border-slate-200 space-y-6 pb-12 w-full">';
        data.forEach(item => {
            const iconObj = getIconData(item.action);
            const sec = item.secondsFromStart || 0;
            const timeStr = window.CPR.Utils && typeof window.CPR.Utils.formatTime === 'function' ? window.CPR.Utils.formatTime(sec) : '--:--';

            html += `
                <div class="relative">
                    <div class="absolute -left-[35px] bg-[#f8fafc] py-1 z-10">
                        <div class="w-8 h-8 rounded-full ${iconObj.bg} ${iconObj.color} flex items-center justify-center font-black text-xs shadow-sm ring-4 ring-[#f8fafc]">
                            ${iconObj.icon}
                        </div>
                    </div>
                    <div class="pl-4">
                        <div class="bg-white p-3 rounded-xl shadow-sm border border-slate-100 inline-block max-w-[90%]">
                            <div class="text-[12px] font-black text-slate-800">${item.action || 'Eintrag'}</div>
                            <div class="text-[9px] font-bold text-slate-400 mt-0.5">${item.time || ''} | +${timeStr} min</div>
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
        const state = window.CPR.AppState || {};
        
        let html = '<div class="p-4 space-y-4 pb-12 w-full">';
        
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

    // --- 5. RENDER: KPI STATISTIKEN ---
    function renderStats() {
        const container = document.getElementById('log-stats-content');
        if (!container) return;

        const data = (window.CPR.AppState && window.CPR.AppState.protocolData) ? window.CPR.AppState.protocolData : [];
        const state = window.CPR.AppState || {};
        
        let firstCPR = null, firstShock = null, firstAirway = null, firstAdr = null, firstAccess = null, roscTime = null;
        let pauses = [], pauseStart = null;
        let analyses = [], lastAnalysis = null;
        
        data.forEach(item => {
            const a = (item.action || '').toLowerCase();
            const s = item.secondsFromStart || 0;

            if (!firstCPR && (a.includes('start rea') || a.includes('kompression begonnen'))) firstCPR = s;
            if (!firstShock && a.includes('schock abgegeben')) firstShock = s;
            if (!firstAirway && (a.includes('atemweg:') && !a.includes('entfernt'))) firstAirway = s;
            if (!firstAdr && a.includes('adrenalin')) firstAdr = s;
            if (!firstAccess && a.includes('zugang:')) firstAccess = s;
            if (!roscTime && (a.includes('rosc eingetreten') || a.includes('rosc'))) roscTime = s;

            if (a.includes('kompression pause')) {
                pauseStart = s;
            } else if (a.includes('kompression fortgesetzt') && pauseStart !== null) {
                const duration = s - pauseStart;
                if (duration > 0) pauses.push(duration);
                pauseStart = null;
            }

            if (a.includes('rhythmusanalyse')) {
                if (lastAnalysis !== null) {
                    const diff = s - lastAnalysis;
                    if (diff > 0) analyses.push(diff);
                }
                lastAnalysis = s;
            }
        });

        const maxPause = pauses.length ? Math.max(...pauses) : 0;
        const avgPause = pauses.length ? Math.round(pauses.reduce((a,b)=>a+b,0) / pauses.length) : 0;
        const avgCheck = analyses.length ? Math.round(analyses.reduce((a,b)=>a+b,0) / analyses.length) : 0;
        
        const arrSec = state.arrestSeconds || 0;
        const compSec = state.compressingSeconds || 0;
        const ccf = arrSec > 0 ? Math.min(100, Math.round((compSec / arrSec) * 100)) : 0;

        const ft = (sec) => sec !== null && window.CPR.Utils && window.CPR.Utils.formatTime ? window.CPR.Utils.formatTime(sec) : '--:--';
        
        const ccfColor = ccf >= 80 ? 'text-emerald-500' : 'text-[#E3000F]';
        const pauseColor = maxPause > 10 ? 'text-[#E3000F]' : (maxPause > 0 ? 'text-emerald-500' : 'text-slate-400');
        const avgPauseColor = avgPause > 10 ? 'text-[#E3000F]' : (avgPause > 0 ? 'text-emerald-500' : 'text-slate-400');

        let html = '<div class="p-4 space-y-4 pb-12 w-full">';
        
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

        html += `
            <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex items-center gap-2">
                    <i class="fa-solid fa-heart-pulse text-indigo-500"></i>
                    <h3 class="text-[10px] uppercase font-black text-indigo-700 tracking-widest">Performance (KPI)</h3>
                </div>
                <div class="p-4 space-y-4">
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

        html += `
            <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="bg-emerald-50 px-4 py-2 border-b border-emerald-100 flex items-center gap-2">
                    <i class="fa-solid fa-chart-pie text-emerald-500"></i>
                    <h3 class="text-[10px] uppercase font-black text-emerald-700 tracking-widest">Therapie & Outcome</h3>
                </div>
                <div class="p-4 grid grid-cols-2 gap-4">
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Zeit bis ROSC</span><span class="font-black ${roscTime ? 'text-emerald-500' : 'text-slate-400'} text-lg">${ft(roscTime)}</span></div>
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Defibrillationen</span><span class="font-black text-slate-700 text-lg">${state.shockCount || 0}x</span></div>
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Adrenalin Gesamt</span><span class="font-black text-slate-700 text-lg">${state.adrCount || 0} Dosen</span></div>
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Amiodaron Gesamt</span><span class="font-black text-slate-700 text-lg">${state.amioCount || 0} Dosen</span></div>
                </div>
            </div>
        `;

        html += '</div>';
        container.innerHTML = html;
    }

    // --- TAB SWITCHER LOGIK (Nukleare Option: Inline Styles erzwingen!) ---
    function switchTab(tab) {
        currentView = tab;
        const ids = ['list', 'timeline', 'summary', 'stats'];
        
        ids.forEach(id => {
            const btn = document.getElementById('btn-view-' + id);
            const content = document.getElementById('log-' + id + '-content');
            
            // Reiter hart stylen (ignoriert Tailwind Override-Probleme)
            if (btn) {
                if (id === tab) {
                    btn.style.color = '#1e293b'; // slate-800
                    btn.style.borderBottomColor = '#1e293b';
                } else {
                    btn.style.color = '#94a3b8'; // slate-400
                    btn.style.borderBottomColor = 'transparent';
                }
            }
            
            // Container hart ein-/ausblenden (Überschreibt flex/hidden Konflikte)
            if (content) {
                if (id === tab) {
                    content.style.display = 'flex';
                    content.classList.remove('hidden');
                } else {
                    content.style.display = 'none';
                    content.classList.add('hidden');
                }
            }
        });

        try {
            renderCurrentView();
        } catch (e) {
            console.error("[CPR] Render-Fehler im Logbuch:", e);
        }
    }

    function renderCurrentView() {
        if (currentView === 'list') renderList();
        else if (currentView === 'timeline') renderTimeline();
        else if (currentView === 'summary') renderSummary();
        else if (currentView === 'stats') renderStats();
    }

    // --- INITIALISIERUNG & DOM-INJEKTION ---
    function init() {
        try {
            // KPI Tab injizieren
            const tabContainer = document.getElementById('btn-view-summary')?.parentElement;
            if (tabContainer && !document.getElementById('btn-view-stats')) {
                const btnStats = document.createElement('button');
                btnStats.id = 'btn-view-stats';
                btnStats.className = 'flex-1 py-3 text-[10px] font-black uppercase transition-all border-b-2';
                btnStats.style.color = '#94a3b8';
                btnStats.style.borderColor = 'transparent';
                btnStats.innerText = 'KPIs';
                tabContainer.appendChild(btnStats);
            }

            // KPI Content injizieren
            const contentContainer = document.getElementById('log-summary-content')?.parentElement;
            if (contentContainer && !document.getElementById('log-stats-content')) {
                const divStats = document.createElement('div');
                divStats.id = 'log-stats-content';
                divStats.className = 'hidden flex-col h-full overflow-y-auto custom-scrollbar bg-slate-50 w-full';
                contentContainer.appendChild(divStats);
            }

            // 🌟 EVENT DELEGATION: Fängt Klicks auf Tabs IMMER sicher ab, egal wann gerendert wurde!
            document.addEventListener('click', function(e) {
                const tabBtn = e.target.closest('button[id^="btn-view-"]');
                if (tabBtn) {
                    const id = tabBtn.id.replace('btn-view-', '');
                    if (['list', 'timeline', 'summary', 'stats'].includes(id)) {
                        e.preventDefault(); 
                        e.stopPropagation();
                        if (window.CPR.Utils && typeof window.CPR.Utils.vibrate === 'function') window.CPR.Utils.vibrate(20);
                        switchTab(id);
                    }
                }
            });

            // Fallback für externe Aktualisierungen
            const btnToggle = document.getElementById('btn-toggle-protocol');
            if (btnToggle) btnToggle.addEventListener('click', () => { renderCurrentView(); });
            
            const btnDebrief = document.getElementById('btn-rosc-end');
            if (btnDebrief) btnDebrief.addEventListener('click', () => { setTimeout(renderCurrentView, 500); });

            // Startansicht sichern
            setTimeout(() => { switchTab('list'); }, 100);
            
        } catch (e) {
            console.error("[CPR] Logbuch Init-Fehler:", e);
        }
    }

    return { init: init, forceRender: renderCurrentView };
})();

// Stabiler Autostart
document.addEventListener('DOMContentLoaded', () => { 
    setTimeout(() => { 
        if (window.CPR && window.CPR.LogTimeline) window.CPR.LogTimeline.init(); 
    }, 150); 
});
