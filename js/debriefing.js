/**
 * CPR Assist - Debriefing & UI Tracker
 */

window.CPR = window.CPR || {};

document.addEventListener('DOMContentLoaded', () => {

    function addClick(id, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', callback);
    }

    // EXPORT MENÜ TOGGLES
    const btnShort = document.getElementById('btn-export-short');
    const btnLong = document.getElementById('btn-export-long');
    
    if(btnShort && btnLong) {
        btnShort.addEventListener('click', () => {
            btnShort.className = 'flex-1 py-2 rounded-lg text-[10px] font-black uppercase bg-white text-slate-800 shadow-sm border border-slate-200 transition-all';
            btnLong.className = 'flex-1 py-2 rounded-lg text-[10px] font-black uppercase text-slate-500 border border-transparent transition-all';
            if (window.CPR.AppState) window.CPR.AppState.protocolViewMode = 'summary';
        });
        
        btnLong.addEventListener('click', () => {
            btnLong.className = 'flex-1 py-2 rounded-lg text-[10px] font-black uppercase bg-white text-slate-800 shadow-sm border border-slate-200 transition-all';
            btnShort.className = 'flex-1 py-2 rounded-lg text-[10px] font-black uppercase text-slate-500 border border-transparent transition-all';
            if (window.CPR.AppState) window.CPR.AppState.protocolViewMode = 'timeline';
        });
    }

    // APP RESET
    function safeAppReset(e) {
        if(e) { e.preventDefault(); e.stopPropagation(); }
        if(confirm('Möchtest du wirklich alle Daten löschen und einen neuen Einsatz starten?')) {
            if (window.CPR.Utils && window.CPR.Utils.resetApp) {
                        window.CPR.Utils.resetApp();
                    } else {
                        // Fallback
                        window.CPR.isResetting = true;
                        localStorage.clear();
                        window.location.href = window.location.pathname + '?reset=' + Date.now();
                    } 
        }
    }

    addClick('btn-center-reset', safeAppReset);
    addClick('btn-hard-reset', safeAppReset);
    addClick('btn-debrief-reset', safeAppReset);

    // EXPORT & RESUME BUTTONS
    addClick('btn-debrief-export', (e) => {
        e.preventDefault(); e.stopPropagation();
        const modal = document.getElementById('export-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    });

    addClick('btn-debrief-resume', (e) => {
        e.preventDefault(); e.stopPropagation();
        const modal = document.getElementById('debriefing-modal');
        if (modal) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }
        if (window.addLogEntry) window.addLogEntry('Einsatz fortgesetzt (Debriefing verlassen)');
        if (window.CPR.AppState) {
            window.CPR.AppState.isRunning = true;
            if (window.CPR.AppState.state === 'RUNNING' && window.CPR.startCycleTimer) window.CPR.startCycleTimer();
            if (window.CPR.AppState.state === 'ROSC_ACTIVE' && window.CPR.startRoscTimer) window.CPR.startRoscTimer();
            if (window.CPR.startMainTimer) window.CPR.startMainTimer();
            if (window.CPR.updateCprUI) window.CPR.updateCprUI();
        }
    });

    // MANUELLE ANALYSE ERZWINGEN
    addClick('btn-permanent-analyze', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(30);
        const origBtn = document.getElementById('btn-rhythm-analyze');
        if (origBtn) origBtn.click();
    });

    // LIVE-TRACKER (Schocks & Joule)
    setInterval(() => {
        const state = window.CPR && window.CPR.AppState ? window.CPR.AppState : null;
        if(!state) return;
        
        const shockEl = document.getElementById('rhythm-info-shocks');
        if(shockEl) shockEl.innerText = state.shockCount || 0;
        
        const jouleEl = document.getElementById('rhythm-info-joule');
        if(jouleEl) { 
            let lastJoule = '-- J';
            if(state.protocolData) {
                const shocks = state.protocolData.filter(l => l.action.toLowerCase().includes('schock') && l.action.includes('J'));
                if(shocks.length > 0) {
                    const lastShockText = shocks[shocks.length - 1].action;
                    const match = lastShockText.match(/(\d+)\s*J/i);
                    if(match) lastJoule = match[1] + ' J';
                }
            }
            jouleEl.innerText = lastJoule;
        }

        const permBtn = document.getElementById('btn-permanent-analyze');
        const pulseBg = document.getElementById('analyze-pulse-bg');
        const topText = document.getElementById('analyze-text-top');
        const mainText = document.getElementById('analyze-text-main');

        if (permBtn && state.isRunning) {
            if (state.cycleSeconds === 0) {
                permBtn.classList.replace('border-slate-200', 'border-red-400');
                permBtn.classList.add('shadow-[0_4px_20px_rgba(227,0,15,0.25)]');
                if(pulseBg) pulseBg.classList.replace('opacity-0', 'opacity-100');

                if(topText) {
                    topText.innerText = "Zeit abgelaufen!";
                    topText.className = "text-[10px] font-black text-[#E3000F] uppercase tracking-widest mb-0.5 animate-pulse";
                }
                if(mainText) {
                    mainText.innerText = "Hier drücken";
                    mainText.className = "text-[16px] font-black text-[#E3000F] uppercase tracking-widest mb-2 animate-pulse";
                }
            } else {
                permBtn.classList.replace('border-red-400', 'border-slate-200');
                permBtn.classList.remove('shadow-[0_4px_20px_rgba(227,0,15,0.25)]');
                if(pulseBg) pulseBg.classList.replace('opacity-100', 'opacity-0');

                if(topText) {
                    topText.innerText = "Bei Rhythmusanalyse";
                    topText.className = "text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 transition-colors";
                }
                if(mainText) {
                    mainText.innerText = "Hier drücken";
                    mainText.className = "text-[13px] font-black text-slate-600 uppercase tracking-widest mb-2 transition-colors";
                }
            }
        }
    }, 500); 

});
