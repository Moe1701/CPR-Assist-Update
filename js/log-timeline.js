/**
 * CPR Assist - Log Timeline & KPI Stats Modul (V65 - Autonomous Architecture)
 * - BUGFIX: Dynamische Erstellung aller Container löst das DOM-Injektions-Problem.
 * - FEATURE: Intelligente Stats-Engine aggregiert Behandlungs-KPIs on-the-fly.
 * - BUGFIX: Globale Event-Delegation für absolut sichere Tab-Wechsel.
 */

window.CPR = window.CPR || {};

window.CPR.LogTimeline = (function() {
    let currentView = 'list'; 
    
    // --- 1. ICON LOGIK ---
    function getIconData(txt) {
        if (!txt) return { icon: '•', color: 'text-slate-400', bg: 'bg-slate-100' };
        const t = txt.toLowerCase();
        
        if (t.includes('schock') && !t.includes('schockbar')) {
            const match = t.match(/(\d+)\s*[jJ]/);
            if (match) return { icon: match[1] + 'J', type: 'shock', color: 'text-white', bg: 'bg-[#E3000F]' };
            return { icon: '⚡', type: 'shock', color: 'text-white', bg: 'bg-[#E3000F]' };
        }
        
        if (t.includes('nicht schockbar')) return { icon: '🚫', type: 'analysis-no', color: 'text-white', bg: 'bg-slate-800' };
        if (t.includes('schockbar')) return { icon: '⚡', type: 'analysis-yes', color: 'text-slate-800', bg: 'bg-amber-400' };
        if (t.includes('hits') || t.includes('sampler') || t.includes('anamnese')) return { icon: '📋', type: 'info', color: 'text-white', bg: 'bg-indigo-500' };
        if (t.includes('adrenalin')) return { icon: '💉', type: 'adr', color: 'text-white', bg: 'bg-[#E3000F]' };
        if (t.includes('amiodaron') || t.includes('amio')) return { icon: '💊', type: 'amio', color: 'text-white', bg: 'bg-purple-500' };
        if (t.includes('atemweg:') || t.includes('beatmungen durchge')) return { icon: '🫁', type: 'airway', color: 'text-white', bg: 'bg-cyan-500' };
        if (t.includes('zugang:')) return { icon: '🩸', type: 'access', color: 'text-white', bg: 'bg-rose-500' };
        if (t.includes('start rea') || t.includes('kompression')) return { icon: '▶', type: 'start', color: 'text-white', bg: 'bg-emerald-500' };
        if (t.includes('rosc!')) return { icon: '❤️', type: 'rosc', color: 'text-white', bg: 'bg-emerald-500' };
        if (t.includes('re-arrest')) return { icon: '💔', type: 'arrest', color: 'text-white', bg: 'bg-[#E3000F]' };
        if (t.includes('abbruch') || t.includes('beendet')) return { icon: '🛑', type: 'end', color: 'text-white', bg: 'bg-slate-800' };
        
        return { icon: '🔹', type: 'default', color: 'text-slate-400', bg: 'bg-slate-100' };
    }

    // --- 2. RENDER STEUERUNG ---
    function renderCurrentView() {
        if (currentView === 'list') renderList();
        else if (currentView === 'timeline') renderTimeline();
        else if (currentView === 'summary') renderSummary();
        else if (currentView === 'stats') renderStats();
    }

    function switchTab(tabId) {
        currentView = tabId;

        // Button UI anpassen
        ['list', 'timeline', 'summary', 'stats'].forEach(id => {
            const btn = document.getElementById(`btn-view-${id}`);
            if (btn) {
                if (id === tabId) {
                    btn.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-white text-slate-800 shadow-sm transition-all';
                } else {
                    btn.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-500 transition-all bg-transparent shadow-none';
                }
            }
        });

        // Container Sichtbarkeit steuern
        ['list', 'timeline', 'summary', 'stats'].forEach(id => {
            const content = document.getElementById(`log-${id}-content`);
            if (content) {
                if (id === tabId) {
                    content.style.display = 'flex';
                    content.classList.remove('hidden');
                } else {
                    content.style.display = 'none';
                    content.classList.add('hidden');
                }
            }
        });

        renderCurrentView();
    }

    // --- 3. DIE VIEWS ---
    
    function renderList() {
        const container = document.getElementById('log-list-content');
        if (!container) return;
        
        const data = window.CPR.AppState?.protocolData || [];
        if (data.length === 0) { 
            container.innerHTML = '<div class="p-4 text-center text-slate-400 text-xs font-bold mt-10">Das Protokoll ist noch leer.</div>'; 
            return; 
        }
        
        let html = '<div class="flex flex-col p-2 gap-1">';
        data.forEach(item => {
            const relTime = window.CPR.Utils.formatRelative(item.secondsFromStart);
            html += `
                <div class="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <div class="flex flex-col items-center shrink-0 min-w-[45px]">
                        <span class="text-[9px] font-bold text-slate-400">${item.time}</span>
                        <span class="text-[11px] font-black text-[#E3000F]">${relTime}</span>
                    </div>
                    <div class="w-px bg-slate-200 self-stretch"></div>
                    <span class="text-[11px] font-bold text-slate-700 pt-0.5">${item.action}</span>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }

    function renderTimeline() {
        const container = document.getElementById('log-timeline-content');
        if (!container) return;
        
        const data = window.CPR.AppState?.protocolData || [];
        if (data.length === 0) { 
            container.innerHTML = '<div class="p-4 text-center text-slate-400 text-xs font-bold mt-10">Noch keine Einträge vorhanden.</div>'; 
            return; 
        }
        
        let html = '<div class="flex flex-col p-4 relative">';
        // Vertikaler Strich
        html += '<div class="absolute left-8 top-4 bottom-4 w-0.5 bg-slate-200"></div>';
        
        data.forEach(item => {
            const iconData = getIconData(item.action);
            const relTime = window.CPR.Utils.formatRelative(item.secondsFromStart);
            html += `
                <div class="flex items-center gap-4 mb-4 relative z-10">
                    <div class="w-8 h-8 rounded-full ${iconData.bg} ${iconData.color} flex items-center justify-center text-sm font-black shadow-sm shrink-0 border-2 border-white">
                        ${iconData.icon}
                    </div>
                    <div class="flex flex-col bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex-1">
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-[11px] font-black text-[#E3000F]">${relTime}</span>
                            <span class="text-[9px] font-bold text-slate-400">${item.time}</span>
                        </div>
                        <span class="text-[11px] font-bold text-slate-700 leading-tight">${item.action}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }

    function renderSummary() {
        const container = document.getElementById('log-summary-content');
        if (!container) return;
        
        const state = window.CPR.AppState || {};
        const totalSec = state.totalSeconds || 0;
        const arrSec = state.arrestSeconds || 0;
        const compSec = state.compressingSeconds || 0;
        const ccf = arrSec > 0 ? Math.min(100, Math.round((compSec / arrSec) * 100)) : 0;
        const ageStr = state.isPediatric ? (state.patientWeight ? `Kind (${state.patientWeight} kg)` : 'Kind') : 'Erwachsener';
        
        let adrTotal = "0 mg", adrCount = state.adrCount || 0;
        if (adrCount > 0) adrTotal = (state.isPediatric && state.patientWeight) ? (adrCount * Math.round(state.patientWeight * 10)) + " µg" : adrCount + " mg";
        let amioTotal = "0 mg", amioCount = state.amioCount || 0;
        if (amioCount > 0) amioTotal = (state.isPediatric && state.patientWeight) ? (amioCount * Math.round(state.patientWeight * 5)) + " mg" : (amioCount === 1 ? '300 mg' : '450 mg');

        let html = `<div class="p-4 flex flex-col gap-4 pb-12">`;
        
        // S - Situation
        html += `<div class="bg-white rounded-xl border-l-4 border-[#E3000F] p-3 shadow-sm">
            <h4 class="text-[10px] font-black text-[#E3000F] uppercase tracking-widest mb-2">S - Situation</h4>
            <div class="grid grid-cols-2 gap-2">
                <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Patient</span><span class="text-xs font-black text-slate-700">${ageStr}</span></div>
                <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Dauer</span><span class="text-xs font-black text-slate-700">${window.CPR.Utils.formatTime(totalSec)} Min</span></div>
                <div class="col-span-2"><span class="block text-[9px] font-bold text-slate-400 uppercase">Letzter Rhythmus</span><span class="text-xs font-black text-slate-700">${state.isShockable ? 'Schockbar (VF/pVT)' : 'Nicht Schockbar (PEA/Asystolie)'}</span></div>
            </div>
        </div>`;

        // B - Background
        const aData = state.anamneseData || {};
        let sampStr = [];
        if (aData.sampler) {
            const sMap = {s:'S', a:'A', m:'M', p:'P', l:'L', e:'E', r:'R'};
            Object.keys(sMap).forEach(k => { if (aData.sampler[k]) sampStr.push(`<span class="font-black text-slate-700">${sMap[k]}:</span> ${aData.sampler[k]}`); });
        }
        
        html += `<div class="bg-white rounded-xl border-l-4 border-slate-400 p-3 shadow-sm">
            <h4 class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">B - Background</h4>
            <div class="grid grid-cols-2 gap-y-2 gap-x-1 text-[10px]">
                <div><span class="font-bold text-slate-400">Beobachtet:</span> <span class="font-black text-slate-700">${aData.beobachtet || '?'}</span></div>
                <div><span class="font-bold text-slate-400">Laien-REA:</span> <span class="font-black text-slate-700">${aData.laienrea || '?'}</span></div>
            </div>
            ${sampStr.length > 0 ? `<div class="mt-2 text-[10px] leading-tight text-slate-600 space-y-1 pt-2 border-t border-slate-100">${sampStr.join('<br>')}</div>` : ''}
        </div>`;

        // A - Assessment
        let hitsArr = [];
        if (state.protocolData) hitsArr = state.protocolData.filter(d => d.action.includes('HITS: ')).map(h => h.action.replace('HITS: ', ''));
        
        html += `<div class="bg-white rounded-xl border-l-4 border-amber-400 p-3 shadow-sm">
            <h4 class="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">A - Assessment</h4>
            <div class="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                <span class="text-[10px] font-bold text-slate-500">CPR Qualität (CCF)</span>
                <span class="text-sm font-black ${ccf >= 80 ? 'text-emerald-500' : 'text-[#E3000F]'}">${ccf}%</span>
            </div>
            <div class="text-[10px] text-slate-600">
                <span class="font-bold text-slate-400 block mb-1">Erfasste Ursachen (HITS):</span>
                ${hitsArr.length > 0 ? hitsArr.map(h => `<div class="font-bold text-slate-700 truncate">- ${h}</div>`).join('') : 'Keine HITS erfasst.'}
            </div>
        </div>`;

        // R - Response
        html += `<div class="bg-white rounded-xl border-l-4 border-emerald-500 p-3 shadow-sm">
            <h4 class="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">R - Response</h4>
            <div class="grid grid-cols-1 gap-1.5 text-[10px]">
                <div class="flex justify-between"><span class="font-bold text-slate-400">Atemweg</span><span class="font-black text-slate-700">${state.airwayLabel || 'Nicht dok.'}</span></div>
                <div class="flex justify-between"><span class="font-bold text-slate-400">Zugang</span><span class="font-black text-slate-700">${state.zugangLabel || 'Nicht dok.'}</span></div>
                <div class="flex justify-between"><span class="font-bold text-slate-400">Schocks</span><span class="font-black text-amber-500">${state.shockCount || 0}x abgegeben</span></div>
                <div class="flex justify-between"><span class="font-bold text-slate-400">Adrenalin</span><span class="font-black text-[#E3000F]">${adrTotal} (${adrCount}x)</span></div>
                <div class="flex justify-between"><span class="font-bold text-slate-400">Amiodaron</span><span class="font-black text-purple-600">${amioTotal} (${amioCount}x)</span></div>
            </div>
        </div>`;

        html += `</div>`;
        container.innerHTML = html;
    }

    // --- 4. NEU: KPI DASHBOARD (Die gescheiterte Funktion ausgebaut!) ---
    function renderStats() {
        const container = document.getElementById('log-stats-content');
        if (!container) return;

        const data = window.CPR.AppState?.protocolData || [];
        if (data.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-slate-400 text-xs font-bold mt-10">Daten für KPIs sammeln...</div>';
            return;
        }

        let firstCPR = null, firstAirway = null, firstShock = null, firstAdr = null, firstAccess = null;
        let pauses = [];
        let currentPauseStart = null;
        let analyses = [];

        data.forEach(d => {
            const t = d.action.toLowerCase();
            const sec = d.secondsFromStart;

            // Meilensteine abfangen
            if (!firstCPR && (t.includes('start rea') || t.includes('kompression begonnen'))) firstCPR = sec;
            if (!firstAirway && t.includes('atemweg:') && !t.includes('entfernt')) firstAirway = sec;
            if (!firstShock && t.includes('schock abgegeben')) firstShock = sec;
            if (!firstAdr && t.includes('adrenalin')) firstAdr = sec;
            if (!firstAccess && t.includes('zugang:')) firstAccess = sec;

            // Pausen-Berechnung
            if ((t.includes('kompression') || t.includes('cpr')) && (t.includes('paus') || t.includes('stop') || t.includes('unterbroch'))) {
                if (currentPauseStart === null) currentPauseStart = sec;
            } else if ((t.includes('kompression') || t.includes('cpr')) && (t.includes('fortgesetzt') || t.includes('start') || t.includes('weiter'))) {
                if (currentPauseStart !== null) {
                    pauses.push(sec - currentPauseStart);
                    currentPauseStart = null;
                }
            }

            // Intervalle sammeln
            if (t.includes('rhythmusanalyse') || t.includes('schockbar')) {
                analyses.push(sec);
            }
        });

        // Mathematik
        let maxPause = pauses.length > 0 ? Math.max(...pauses) : 0;
        let avgPause = pauses.length > 0 ? Math.round(pauses.reduce((a, b) => a + b, 0) / pauses.length) : 0;

        let analysisIntervals = [];
        for (let i = 1; i < analyses.length; i++) {
            analysisIntervals.push(analyses[i] - analyses[i-1]);
        }
        let avgAnalysisInterval = analysisIntervals.length > 0 ? Math.round(analysisIntervals.reduce((a, b) => a + b, 0) / analysisIntervals.length) : 0;

        const format = window.CPR.Utils.formatTime;

        // Rendern
        let html = '<div class="p-4 flex flex-col gap-3 pb-12">';

        html += `<h3 class="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2 mb-1">Time to... (ab Start)</h3>`;
        html += buildStatRow('1. Kompression', firstCPR !== null ? format(firstCPR) : '--:--', 'fa-hands-asl-interpreting');
        html += buildStatRow('1. Schock', firstShock !== null ? format(firstShock) : '--:--', 'fa-bolt', 'text-amber-500');
        html += buildStatRow('Atemweg', firstAirway !== null ? format(firstAirway) : '--:--', 'fa-lungs', 'text-cyan-500');
        html += buildStatRow('Zugang', firstAccess !== null ? format(firstAccess) : '--:--', 'fa-droplet', 'text-indigo-500');
        html += buildStatRow('1. Adrenalin', firstAdr !== null ? format(firstAdr) : '--:--', 'fa-syringe', 'text-[#E3000F]');

        html += `<h3 class="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2 mb-1 mt-4">Performance Insights</h3>`;
        html += buildStatRow('Längste Pause', maxPause > 0 ? maxPause + ' s' : '0 s', 'fa-pause', maxPause > 10 ? 'text-[#E3000F]' : 'text-emerald-500');
        html += buildStatRow('Ø Pausen-Dauer', avgPause > 0 ? avgPause + ' s' : '0 s', 'fa-stopwatch', avgPause > 10 ? 'text-[#E3000F]' : 'text-emerald-500');
        html += buildStatRow('Ø Analyse-Intervall', avgAnalysisInterval > 0 ? format(avgAnalysisInterval) : '--:--', 'fa-heart-pulse');
        
        html += '</div>';

        container.innerHTML = html;
    }

    function buildStatRow(label, value, icon, iconColorClass = 'text-slate-400') {
        return `
            <div class="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div class="flex items-center gap-3">
                    <i class="fa-solid ${icon} ${iconColorClass} text-lg w-6 text-center"></i>
                    <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wide">${label}</span>
                </div>
                <span class="text-sm font-black text-slate-800">${value}</span>
            </div>
        `;
    }

    // --- 5. INITIALISIERUNG & DOM-INJEKTION ---
    function init() {
        try {
            // A. KPI Tab (Button) injizieren, falls er noch fehlt
            const btnSumm = document.getElementById('btn-view-summary');
            if (btnSumm && btnSumm.parentElement && !document.getElementById('btn-view-stats')) {
                const tabContainer = btnSumm.parentElement;
                const btnStats = document.createElement('button');
                btnStats.id = 'btn-view-stats';
                btnStats.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-500 transition-all';
                btnStats.innerText = 'KPIs';
                tabContainer.appendChild(btnStats);
            }

            // B. ALLE 4 Content-Container in protocol-list injizieren, falls sie fehlen!
            const mainListContainer = document.getElementById('protocol-list');
            if (mainListContainer) {
                ['list', 'timeline', 'summary', 'stats'].forEach(id => {
                    const contentId = `log-${id}-content`;
                    if (!document.getElementById(contentId)) {
                        const div = document.createElement('div');
                        div.id = contentId;
                        div.className = 'flex-col h-full overflow-y-auto custom-scrollbar bg-slate-50 w-full hidden';
                        div.style.display = 'none';
                        mainListContainer.appendChild(div);
                    }
                });
            }

            // C. ULTRA-SAFE EVENT DELEGATION (NUR FÜR DIE TABS)
            document.addEventListener('click', function(e) {
                const tabBtn = e.target.closest('button[id^="btn-view-"]');
                if (tabBtn) {
                    const id = tabBtn.id.replace('btn-view-', '');
                    if (['list', 'timeline', 'summary', 'stats'].includes(id)) {
                        e.preventDefault(); 
                        e.stopPropagation();
                        if (window.CPR && window.CPR.Utils && typeof window.CPR.Utils.vibrate === 'function') {
                            window.CPR.Utils.vibrate(20);
                        }
                        switchTab(id);
                    }
                }
            });

            // D. Startansicht sichern (wird kurz verzögert, damit DOM komplett bereit ist)
            setTimeout(() => { switchTab('list'); }, 100);
            
        } catch (e) {
            console.error("[CPR] Logbuch Init-Fehler:", e);
        }
    }

    return { 
        init: init, 
        forceRender: renderCurrentView 
    };
})();

// Stabiler Autostart
document.addEventListener('DOMContentLoaded', () => { 
    setTimeout(() => { 
        if (window.CPR && window.CPR.LogTimeline) window.CPR.LogTimeline.init(); 
    }, 150); 
});
