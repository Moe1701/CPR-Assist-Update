/**
 * CPR Assist - Log Timeline Modul (V56 - EKG-Style & Naked Icons)
 * - FEATURE: Naked-Icons (ohne weiße Bubbles) für 50% weniger Platzbedarf.
 * - FEATURE: Kompakte Blöcke (110px Höhe, 8px Margin) für 4 Zyklen pro Screen.
 * - FEATURE: Schock-Energie als fetter Text statt Kasten.
 * - FEATURE: Feinere Verbindungslinien und inteligente Höhenstaffelung.
 */

window.CPR = window.CPR || {};

window.CPR.LogTimeline = (function() {
    let currentView = 'list'; 
    let liveMarkerInterval = null;
    
    // --- 1. ICON & JOULE LOGIK ---
    function getIconData(txt) {
        if (!txt) return null;
        const t = txt.toLowerCase();
        
        if (t.includes('schock') && !t.includes('schockbar')) {
            const match = t.match(/(\d+)\s*[jJ]/);
            if (match) return { icon: match[1] + 'J', isText: true, isJoule: true, type: 'shock', color: 'text-white', bg: 'bg-[#E3000F]' };
            return { icon: '⚡', type: 'shock', color: 'text-white', bg: 'bg-[#E3000F]' };
        }
        
        if (t.includes('nicht schockbar')) return { 
            icon: '🚫⚡', 
            htmlIcon: '<div class="relative inline-block">⚡<div class="absolute top-1/2 left-[-2px] right-[-2px] h-[1.5px] bg-red-500 rotate-45 -translate-y-1/2"></div></div>', 
            type: 'analysis-no', color: 'text-slate-400', bg: 'bg-slate-200' 
        };
        if (t.includes('schockbar')) return { icon: '⚡', type: 'analysis-yes', color: 'text-amber-500', bg: 'bg-amber-50' };

        if (t.includes('hits') || t.includes('sampler') || t.includes('anamnese')) return { icon: '📋', type: 'info', color: 'text-slate-500', bg: 'bg-white' };
        if (t.includes('adrenalin')) return { icon: '💉', type: 'adr', color: 'text-[#E3000F]', bg: 'bg-red-50' };
        if (t.includes('amiodaron') || t.includes('amio')) return { icon: '💊', type: 'amio', color: 'text-purple-600', bg: 'bg-purple-50' };
        if (t.includes('atemweg:') || t.includes('beatmungen durchge')) return { icon: '🫁', type: 'airway', color: 'text-cyan-600', bg: 'bg-cyan-50' };
        if (t.includes('zugang:')) return { icon: '🩸', type: 'access', color: 'text-indigo-600', bg: 'bg-indigo-50' };
        if (t.includes('start rea')) return { icon: '▶️', type: 'start', color: 'text-emerald-600', bg: 'bg-emerald-50' };
        if (t.includes('rosc!')) return { icon: '❤️', type: 'rosc', color: 'text-emerald-600', bg: 'bg-emerald-50' };
        if (t.includes('re-arrest')) return { icon: '💔', type: 'arrest', color: 'text-red-600', bg: 'bg-red-100' };
        if (t.includes('abbruch') || t.includes('beendet')) return { icon: '🛑', type: 'end', color: 'text-slate-800', bg: 'bg-slate-200' };
        
        if (t.includes('kompression pause') || t.includes('kompression fortgesetzt') || 
            t.includes('beatmungen übersprungen') || t.includes('modus manuell') ||
            t.includes('atemweg entfernt')) return null; 
        
        return { icon: '🔹', type: 'default', color: 'text-slate-400', bg: 'bg-slate-100' };
    }

    // --- PAUSEN EXTRAKTOR ---
    function extractPauses(data, currentAppSec) {
        let pauses = [];
        let currentStart = null;
        data.forEach(d => {
            const t = d.action.toLowerCase();
            if (t.includes('pause') || t.includes('stop') || t.includes('analyse') || t.includes('schockbar') || t.includes('unterbroch')) {
                if (currentStart === null) currentStart = d.secondsFromStart;
            }
            if (t.includes('fortgesetzt') || t.includes('weiter') || t.includes('start')) {
                if (currentStart !== null) {
                    pauses.push({ start: currentStart, end: d.secondsFromStart, duration: d.secondsFromStart - currentStart });
                    currentStart = null;
                }
            }
        });
        if (currentStart !== null) {
            pauses.push({ start: currentStart, end: currentAppSec, duration: currentAppSec - currentStart, ongoing: true });
        }
        return pauses;
    }

    // --- 2. DATA HARVESTER ---
    function extractSbarFacts() {
        const state = window.CPR.AppState || {};
        const data = state.protocolData || [];
        const totalSec = state.totalSeconds || 0;
        const arrSec = state.arrestSeconds || 0;
        const compSec = state.compressingSeconds || 0;
        const ccf = arrSec > 0 ? Math.min(100, Math.round((compSec / arrSec) * 100)) : 0;
        const ageStr = state.isPediatric ? (state.patientWeight ? `Kind (${state.patientWeight} kg)` : 'Kind (Gewicht unbek.)') : 'Erwachsener';
        let adrTotal = "0 mg", adrCount = state.adrCount || 0;
        if (adrCount > 0) adrTotal = (state.isPediatric && state.patientWeight) ? (adrCount * Math.round(state.patientWeight * 10)) + " µg" : adrCount + " mg";
        let amioTotal = "0 mg", amioCount = state.amioCount || 0;
        if (amioCount > 0) amioTotal = (state.isPediatric && state.patientWeight) ? (amioCount * Math.round(state.patientWeight * 5)) + " mg" : (amioCount === 1 ? '300 mg' : '450 mg');

        const aData = state.anamneseData || {};
        let sampStr = [];
        if (aData.sampler) {
            const sMap = {s:'Symptome', a:'Allergien', m:'Medikamente', p:'Vorerkrankungen', l:'Letzte Mahlzeit', e:'Ereignis', r:'Risikofaktoren'};
            Object.keys(sMap).forEach(k => { 
                if (aData.sampler[k]) sampStr.push(`<span class="text-[10px] font-black text-slate-500 mr-1">${sMap[k]}:</span> <span class="font-bold text-slate-800">${aData.sampler[k]}</span>`); 
            });
        }
        const hitsLogs = data.filter(d => d.action.includes('HITS:'));
        const hitsHtml = hitsLogs.map(h => `<li class="mb-1">${h.action.replace('HITS: ', '')}</li>`).join('');

        let endStatus = 'Laufende CPR';
        let timeToRosc = null;
        let abbruchReason = "";

        data.forEach(d => {
            const t = d.action.toLowerCase();
            if (t.includes('rosc') && !t.includes('re-arrest')) {
                endStatus = 'ROSC';
                if (timeToRosc === null) timeToRosc = d.secondsFromStart;
            } else if (t.includes('re-arrest') || t.includes('start rea')) {
                endStatus = 'Laufende CPR';
            } else if (t.includes('abbruch') || t.includes('beendet')) {
                endStatus = 'Abbruch';
                const splitChar = t.includes(':') ? ':' : (t.includes('-') ? '-' : null);
                if (splitChar) {
                    const parts = d.action.split(splitChar);
                    if (parts.length > 1) abbruchReason = parts[1].trim();
                }
            }
        });

        if (endStatus === 'ROSC' && timeToRosc === null) timeToRosc = totalSec;
        if (endStatus === 'Abbruch' && !abbruchReason) abbruchReason = "Teamentscheidung / Unbekannt";

        return { ageStr, totalSec, ccf, adrCount, adrTotal, amioCount, amioTotal, aData, sampStr, hitsLogs, hitsHtml, state, data, endStatus, timeToRosc, abbruchReason };
    }

    // --- 3. DOM RENDERING: SBAR DASHBOARD ---
    function renderSummary() {
        const { ageStr, totalSec, ccf, adrTotal, amioTotal, aData, sampStr, hitsLogs, hitsHtml, state, adrCount, amioCount, endStatus, timeToRosc, abbruchReason } = extractSbarFacts();
        const ccfColor = ccf >= 80 ? 'text-emerald-500' : 'text-[#E3000F]';
        
        let statusColor = 'text-slate-800';
        let extraInfoHtml = '';
        
        if (endStatus === 'ROSC') {
            statusColor = 'text-emerald-600';
            extraInfoHtml = `<span class="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg">Zeit bis ROSC: ${window.CPR.Utils.formatTime(timeToRosc)} Min</span>`;
        } else if (endStatus === 'Abbruch') {
            statusColor = 'text-slate-800';
            extraInfoHtml = `<span class="text-[9px] font-black text-slate-600 bg-slate-200 border border-slate-300 px-2 py-1 rounded-lg truncate max-w-[140px] text-right inline-block">Grund: ${abbruchReason}</span>`;
        }
        
        return `
            <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-3 pb-24 custom-scrollbar bg-slate-50">
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="bg-blue-50 px-3 py-2 border-b border-blue-100 flex items-center gap-2">
                        <i class="fa-solid fa-user-injured text-blue-600"></i>
                        <h3 class="text-[11px] font-black text-blue-800 uppercase tracking-widest">S - Situation</h3>
                    </div>
                    <div class="p-3 flex flex-col gap-2">
                        <div class="grid grid-cols-2 gap-2">
                            <div class="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col justify-center text-center">
                                <span class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Patient</span>
                                <span class="text-sm font-black text-slate-800">${ageStr}</span>
                            </div>
                            <div class="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col justify-center text-center">
                                <span class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Gesamtdauer</span>
                                <span class="text-sm font-black text-slate-800">${window.CPR.Utils.formatTime(totalSec)} Min</span>
                            </div>
                        </div>
                        <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex justify-between items-center mt-1">
                            <div class="flex flex-col">
                                <span class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Einsatz-Status</span>
                                <span class="text-sm font-black ${statusColor} leading-none">${endStatus.toUpperCase()}</span>
                            </div>
                            <div>${extraInfoHtml}</div>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="bg-indigo-50 px-3 py-2 border-b border-indigo-100 flex items-center gap-2">
                        <i class="fa-solid fa-clipboard-list text-indigo-600"></i>
                        <h3 class="text-[11px] font-black text-indigo-800 uppercase tracking-widest">B - Background</h3>
                    </div>
                    <div class="p-3">
                        <div class="flex justify-between border-b border-slate-100 pb-3 mb-3">
                            <div class="text-center">
                                <span class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Beobachtet</span>
                                <span class="text-xs font-black text-slate-800">${aData.beobachtet || '?'}</span>
                            </div>
                            <div class="text-center border-l border-r border-slate-100 px-4">
                                <span class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Laien-REA</span>
                                <span class="text-xs font-black text-slate-800">${aData.laienrea || '?'}</span>
                            </div>
                            <div class="text-center">
                                <span class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Brustschmerz</span>
                                <span class="text-xs font-black text-slate-800">${aData.brustschmerz || '?'}</span>
                            </div>
                        </div>
                        <div>
                            <span class="block text-[9px] font-bold text-slate-400 uppercase mb-1.5">SAMPLER</span>
                            <div class="text-[11px] leading-relaxed text-slate-700">
                                ${sampStr.length > 0 ? sampStr.join('<br>') : '<span class="italic text-slate-400">Keine Daten erfasst</span>'}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="bg-amber-50 px-3 py-2 border-b border-amber-100 flex items-center gap-2">
                        <i class="fa-solid fa-stethoscope text-amber-600"></i>
                        <h3 class="text-[11px] font-black text-amber-800 uppercase tracking-widest">A - Assessment</h3>
                    </div>
                    <div class="p-3">
                        <div class="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
                            <span class="text-[9px] font-bold text-slate-400 uppercase">HITS (Ursachen)</span>
                            <div class="flex items-center gap-1.5">
                                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">CCF</span>
                                <span class="text-lg font-black ${ccfColor} leading-none">${ccf}%</span>
                            </div>
                        </div>
                        <ul class="text-[11px] font-bold text-slate-700 pl-4 list-disc marker:text-amber-400">
                            ${hitsLogs.length > 0 ? hitsHtml : '<li class="list-none -ml-4 italic text-slate-400 font-normal">Keine erfasst</li>'}
                        </ul>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="bg-red-50 px-3 py-2 border-b border-red-100 flex items-center gap-2">
                        <i class="fa-solid fa-kit-medical text-[#E3000F]"></i>
                        <h3 class="text-[11px] font-black text-[#E3000F] uppercase tracking-widest">R - Response</h3>
                    </div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                            <span class="text-[10px] font-bold text-slate-500 uppercase"><i class="fa-solid fa-lungs text-cyan-500 w-4"></i> Atemweg</span>
                            <span class="text-xs font-black text-slate-800 text-right">${state.airwayLabel || 'Nicht dok.'}</span>
                        </div>
                        <div class="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                            <span class="text-[10px] font-bold text-slate-500 uppercase"><i class="fa-solid fa-droplet text-indigo-500 w-4"></i> Zugang</span>
                            <span class="text-xs font-black text-slate-800 text-right">${state.zugangLabel || 'Nicht dok.'}</span>
                        </div>
                        <div class="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                            <span class="text-[10px] font-bold text-slate-500 uppercase"><i class="fa-solid fa-bolt text-amber-500 w-4"></i> Schocks</span>
                            <span class="text-xs font-black text-slate-800">${state.shockCount || 0}x abgegeben</span>
                        </div>
                        <div class="flex justify-between items-center px-4 py-3 border-b border-red-100 bg-red-50/40">
                            <span class="text-[10px] font-bold text-red-700 uppercase"><i class="fa-solid fa-syringe text-red-500 w-4"></i> Adrenalin</span>
                            <span class="text-xs font-black text-[#E3000F]">${adrTotal} <span class="text-[9px] font-bold text-red-400 ml-1">(${adrCount}x)</span></span>
                        </div>
                        <div class="flex justify-between items-center px-4 py-3 bg-purple-50/40">
                            <span class="text-[10px] font-bold text-purple-700 uppercase"><i class="fa-solid fa-pills text-purple-500 w-4"></i> Amiodaron</span>
                            <span class="text-xs font-black text-purple-700">${amioTotal} <span class="text-[9px] font-bold text-purple-400 ml-1">(${amioCount}x)</span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // --- 4. DOM RENDERING: CHRONOLOGIE LISTE ---
    function renderList(data) {
        if (data.length === 0) return '<div class="text-center text-slate-400 font-bold p-10 text-xs uppercase tracking-widest">Noch keine Einträge</div>';
        const { ccf, adrTotal } = extractSbarFacts();
        let html = `
            <div class="bg-white px-4 py-2 border-b border-slate-200 shadow-sm shrink-0 z-10 flex justify-between items-center sticky top-0">
                <div class="flex items-center gap-4">
                    <div class="flex flex-col"><span class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Qualität</span><span class="text-[11px] leading-none font-black ${ccf >= 80 ? 'text-emerald-500' : 'text-[#E3000F]'}">CCF ${ccf}%</span></div>
                    <div class="w-px h-6 bg-slate-200"></div>
                    <div class="flex flex-col"><span class="text-[8px] font-black text-red-400 uppercase tracking-widest mb-0.5">Adrenalin</span><span class="text-[11px] leading-none font-black text-red-600">${adrTotal}</span></div>
                </div>
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest"><i class="fa-solid fa-clock-rotate-left mr-1"></i> Log</span>
            </div>
            <div class="flex-1 overflow-y-auto p-3 pb-24 custom-scrollbar bg-slate-50"><div class="flex flex-col gap-2">
        `;
        data.slice().reverse().forEach(item => {
            const evData = getIconData(item.action) || { icon: '🔹', bg: 'bg-slate-100', color: 'text-slate-500' };
            const iconContent = evData.htmlIcon || evData.icon;
            const textClass = evData.isText ? 'text-[9px] font-black tracking-tighter' : 'text-lg';
            const relTime = window.CPR.Utils.formatRelative(item.secondsFromStart);
            html += `
                <div class="bg-white rounded-xl p-3 shadow-sm border border-slate-200 flex items-center gap-3 relative overflow-hidden">
                    <div class="w-10 h-10 rounded-full ${evData.bg} ${evData.color} border border-white flex items-center justify-center shrink-0 shadow-inner ${textClass}">
                        ${iconContent}
                    </div>
                    <div class="flex flex-col flex-1 min-w-0 pr-2">
                        <span class="text-[11px] font-black text-slate-800 leading-tight mb-1" style="word-break: break-word;">${item.action}</span>
                        <span class="text-[9px] font-bold text-slate-400"><i class="fa-regular fa-clock"></i> ${item.time}</span>
                    </div>
                    <div class="shrink-0 flex flex-col items-end justify-center">
                        <span class="text-[11px] font-black text-[#E3000F] bg-red-50 px-2 py-1 rounded-lg border border-red-100 shadow-sm">${relTime}</span>
                    </div>
                </div>
            `;
        });
        html += `</div></div>`;
        return html;
    }

    // --- 5. DOM RENDERING: EKG-STYLE TIMELINE ---
    function renderTimeline() {
        const { totalSec, data } = extractSbarFacts();
        let currentAppSec = totalSec;
        
        let html = `
        <div class="flex flex-col h-full overflow-hidden relative">
            <div class="sticky top-0 z-50 bg-slate-50 border-b border-slate-200 px-2 py-2 shrink-0 shadow-sm">
                <div class="bg-white p-1.5 rounded-xl border border-slate-100">
                    <div class="flex flex-wrap justify-center items-center gap-x-2 gap-y-1.5">
                        <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm">▶️</span><span class="text-[7.5px] font-bold text-slate-600 uppercase tracking-widest">Start</span></div>
                        <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm text-emerald-500">❤️</span><span class="text-[7.5px] font-bold text-slate-600 uppercase tracking-widest">ROSC</span></div>
                        <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm text-amber-500">⚡</span><span class="text-[7.5px] font-bold text-slate-600 uppercase tracking-widest">Schockbar</span></div>
                        <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm relative text-slate-400">⚡<div class="absolute top-1/2 left-[-2px] right-[-2px] h-[1.5px] bg-red-500 rotate-45 -translate-y-1/2"></div></span><span class="text-[7.5px] font-bold text-slate-600 uppercase tracking-widest">Kein Schock</span></div>
                        <div class="flex items-center gap-1"><span class="text-[10px] font-black text-[#E3000F] drop-shadow-sm">150J</span><span class="text-[7.5px] font-bold text-slate-600 uppercase tracking-widest">Schock</span></div>
                        <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm">💉</span><span class="text-[7.5px] font-bold text-slate-600 uppercase tracking-widest">Adr.</span></div>
                        <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm">💊</span><span class="text-[7.5px] font-bold text-slate-600 uppercase tracking-widest">Amio.</span></div>
                        <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm">🫁</span><span class="text-[7.5px] font-bold text-slate-600 uppercase tracking-widest">Aw.</span></div>
                        <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm">🩸</span><span class="text-[7.5px] font-bold text-slate-600 uppercase tracking-widest">Zug.</span></div>
                        <div class="flex items-center gap-1"><div class="w-4 h-1 bg-red-500 rounded"></div><span class="text-[7.5px] font-bold text-slate-600 uppercase tracking-widest">Pause</span></div>
                    </div>
                </div>
            </div>
            <div class="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50 relative pb-24 pt-3 px-3">
        `;

        if (data.length === 0) {
            html += '<div class="text-center text-slate-400 font-bold p-10 text-xs uppercase tracking-widest mt-4">Noch keine Einträge</div></div></div>';
            return html;
        }

        const filtered = data.map(d => ({ ...d, iconData: getIconData(d.action) })).filter(d => d.iconData !== null);
        const pauses = extractPauses(data, currentAppSec);
        
        if (filtered.length > 0 && filtered[filtered.length - 1].secondsFromStart > currentAppSec) {
            currentAppSec = filtered[filtered.length - 1].secondsFromStart;
        }
        
        const cycleDuration = 120;
        let totalCycles = Math.max(4, Math.ceil(currentAppSec / cycleDuration));
        let currentStartSec = 0;
        // Engere Y-Offsets, da keine Bubbles mehr im Weg sind
        const yOffsets = [12, -12, 26, -26, 40, -40];

        for (let i = 0; i < totalCycles; i++) {
            const cycleEndSec = currentStartSec + cycleDuration;
            const cycleEvents = filtered.filter(e => e.secondsFromStart >= currentStartSec && e.secondsFromStart < cycleEndSec);
            const isActiveBlock = (currentAppSec >= currentStartSec && currentAppSec <= cycleEndSec);

            html += `
                <div class="relative w-full h-[110px] mb-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
                    <div class="absolute top-1/2 left-1 -translate-y-1/2 text-[8px] font-black text-slate-400 bg-white/80 px-1 z-10">${window.CPR.Utils.formatTime(currentStartSec)}</div>
                    <div class="absolute top-1/2 right-1 -translate-y-1/2 text-[8px] font-black text-slate-400 bg-white/80 px-1 z-10">${window.CPR.Utils.formatTime(cycleEndSec)}</div>
                    
                    <div class="absolute inset-y-0 left-7 right-7 pointer-events-none">
                        <!-- Mittellinie (Track) -->
                        <div class="absolute top-1/2 left-0 right-0 h-[2px] bg-slate-100 rounded-full -translate-y-1/2 shadow-inner z-0"></div>
            `;

            // 15s LINEAL
            for (let t = 15; t < 120; t += 15) {
                const tickSec = currentStartSec + t;
                const pct = (t / 120) * 100;
                const isHalf = t === 60;
                const tickH = isHalf ? 'h-3' : 'h-1.5';
                html += `<div class="absolute top-1/2 w-px ${tickH} bg-slate-300 -translate-y-1/2 -translate-x-1/2 z-10" style="left: ${pct}%;"></div>`;
                html += `<div class="absolute top-1/2 mt-3 text-[6px] font-black text-slate-400 -translate-y-1/2 -translate-x-1/2 z-10" style="left: ${pct}%;">${window.CPR.Utils.formatTime(tickSec)}</div>`;
            }

            // CPR PAUSEN
            pauses.forEach(p => {
                const pStart = Math.max(p.start, currentStartSec);
                const pEnd = Math.min(p.end, cycleEndSec);
                if (pStart < pEnd) {
                    const pctStart = ((pStart - currentStartSec) / cycleDuration) * 100;
                    const pctEnd = ((pEnd - currentStartSec) / cycleDuration) * 100;
                    const widthPct = pctEnd - pctStart;
                    html += `
                        <div class="absolute top-1/2 h-2.5 bg-red-500 rounded-sm flex items-center justify-center -translate-y-1/2 z-[5]"
                             style="left: ${pctStart}%; width: ${widthPct}%;">
                             ${widthPct > 4 ? `<span class="text-[6px] font-black text-white shadow-sm">${p.duration}s</span>` : ''}
                        </div>
                    `;
                }
            });

            // LIVE MARKER
            if (isActiveBlock) {
                const markerPct = ((currentAppSec - currentStartSec) / cycleDuration) * 100;
                html += `
                        <div class="live-time-marker absolute top-0 bottom-0 w-[2px] bg-red-500 z-[15] shadow-[0_0_8px_rgba(239,68,68,0.8)]" 
                             data-start="${currentStartSec}" data-end="${cycleEndSec}" 
                             style="left: ${markerPct}%;">
                             <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 shadow-sm"></div>
                             <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 shadow-sm"></div>
                        </div>
                `;
            }

            // NAKED ICONS RENDER LOOP
            cycleEvents.forEach((ev, idx) => {
                const secInCycle = ev.secondsFromStart - currentStartSec;
                const pct = (secInCycle / cycleDuration) * 100;
                const yOff = yOffsets[idx % yOffsets.length];
                const isTop = yOff < 0; 
                const lineH = Math.abs(yOff);
                const linePosClass = isTop ? 'bottom-1/2 mb-[1px]' : 'top-1/2 mt-[1px]';

                const iconContent = ev.iconData.htmlIcon || ev.iconData.icon;
                
                let renderIcon = '';
                if (ev.iconData.isJoule) {
                    renderIcon = `<span class="text-[10px] font-black text-[#E3000F] drop-shadow-[0_0_2px_rgba(255,255,255,1)] tracking-tighter">${iconContent}</span>`;
                } else if (ev.iconData.isText) {
                    renderIcon = `<span class="text-[9px] font-black text-slate-700 drop-shadow-[0_0_2px_rgba(255,255,255,1)]">${iconContent}</span>`;
                } else {
                    renderIcon = `<span class="text-[13px] drop-shadow-sm leading-none block">${iconContent}</span>`;
                }

                const anchorTransform = isTop ? '-translate-y-full pb-[1px]' : 'pt-[1px]';

                html += `
                        <div class="absolute top-1/2 w-1 h-1 rounded-full bg-slate-400 -translate-x-1/2 -translate-y-1/2 z-[11]" style="left: ${pct}%;"></div>
                        <div class="absolute w-px bg-slate-300 -translate-x-1/2 ${linePosClass} z-10" style="left: ${pct}%; height: ${lineH}px;"></div>
                        <div class="absolute -translate-x-1/2 flex flex-col items-center justify-center z-20 ${anchorTransform}" 
                             style="left: ${pct}%; top: calc(50% ${isTop ? '-' : '+'} ${lineH}px); z-index: ${20 + idx};">
                            ${renderIcon}
                        </div>
                `;
            });

            html += `</div></div>`;
            currentStartSec = cycleEndSec;
        }

        html += `</div></div>`;
        return html;
    }

    // --- LIVE MARKER UPDATER ---
    function updateLiveMarker() {
        if (currentView !== 'timeline') return;
        const state = window.CPR.AppState;
        if (!state) return; 

        const currentAppSec = state.totalSeconds || 0;
        
        const currentBlock = Math.floor(currentAppSec / 120);
        if (window._lastRenderedBlock === undefined) window._lastRenderedBlock = currentBlock;
        
        if (currentBlock !== window._lastRenderedBlock) {
            window._lastRenderedBlock = currentBlock;
            renderCurrentView();
        }

        const markers = document.querySelectorAll('.live-time-marker');
        markers.forEach(marker => {
            const blockStart = parseInt(marker.dataset.start);
            const blockEnd = parseInt(marker.dataset.end);
            if (currentAppSec >= blockStart && currentAppSec <= blockEnd) {
                const pct = ((currentAppSec - blockStart) / 120) * 100;
                marker.style.left = `${pct}%`;
            }
        });
    }

    function startLiveMarkerInterval() {
        if (liveMarkerInterval) clearInterval(liveMarkerInterval);
        liveMarkerInterval = setInterval(updateLiveMarker, 1000);
    }
    function stopLiveMarkerInterval() {
        if (liveMarkerInterval) { clearInterval(liveMarkerInterval); liveMarkerInterval = null; }
    }

    // --- 6. DOM UPDATER ---
    function renderCurrentView() {
        const container = document.getElementById('protocol-list');
        if (!container) return;
        const scrollTarget = container.querySelector('.overflow-y-auto');
        const currentScrollPos = scrollTarget ? scrollTarget.scrollTop : 0;

        if (currentView === 'timeline') container.innerHTML = renderTimeline();
        else if (currentView === 'summary') container.innerHTML = renderSummary();
        else container.innerHTML = renderList((window.CPR.AppState && window.CPR.AppState.protocolData) ? window.CPR.AppState.protocolData : []);

        requestAnimationFrame(() => {
            const newScrollTarget = container.querySelector('.overflow-y-auto');
            if (newScrollTarget) newScrollTarget.scrollTop = currentScrollPos;
        });
    }

    // --- 7. TAB LOGIK ---
    function switchTab(tab) {
        currentView = tab;
        if (window.CPR.AppState) window.CPR.AppState.protocolViewMode = tab;
        
        const btnTime = document.getElementById('btn-view-timeline');
        const btnList = document.getElementById('btn-view-list');
        const btnSumm = document.getElementById('btn-view-summary');

        [btnTime, btnList, btnSumm].forEach(b => {
            if(b) { b.classList.remove('bg-white', 'text-slate-800', 'shadow-sm'); b.classList.add('text-slate-500'); }
        });

        let activeBtn = null;
        if(tab === 'timeline') activeBtn = btnTime;
        if(tab === 'list') activeBtn = btnList;
        if(tab === 'summary') activeBtn = btnSumm;

        if(activeBtn) { activeBtn.classList.remove('text-slate-500'); activeBtn.classList.add('bg-white', 'text-slate-800', 'shadow-sm'); }

        renderCurrentView();
        if (tab === 'timeline') startLiveMarkerInterval();
        else stopLiveMarkerInterval();
    }

    function init() {
        const btnTime = document.getElementById('btn-view-timeline');
        if (btnTime) btnTime.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('timeline'); });
        const btnList = document.getElementById('btn-view-list');
        if (btnList) btnList.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('list'); });
        const btnSumm = document.getElementById('btn-view-summary');
        if (btnSumm) btnSumm.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('summary'); });

        const btnToggle = document.getElementById('btn-toggle-protocol');
        if (btnToggle) btnToggle.addEventListener('click', () => { renderCurrentView(); });
        const btnDebrief = document.getElementById('btn-rosc-end');
        if(btnDebrief) btnDebrief.addEventListener('click', () => { setTimeout(renderCurrentView, 500); });

        setTimeout(() => { switchTab('list'); }, 100);
    }

    return { init: init, forceRender: renderCurrentView };
})();

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { if (window.CPR && window.CPR.LogTimeline) window.CPR.LogTimeline.init(); }, 200); });
