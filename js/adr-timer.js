window.CPR = window.CPR || {};

/**
 * CPR Assist - Adrenalin Timer (Medical Grade)
 * CHIRURGISCHER SCHNITT: Komplett geschützt gegen Tailwind CSS Konflikte.
 * Nutzt ausschließlich natives DOM-Styling (style.display & style.opacity).
 */
window.CPR.AdrTimer = (function() {
    let internalInterval = null;

    function getMaxSec() {
        return (window.CPR.CONFIG && window.CPR.CONFIG.ADR_INTERVAL) ? window.CPR.CONFIG.ADR_INTERVAL : 240;
    }

    function updateUI() {
        try {
            const state = window.CPR.AppState;
            if (!state) return;

            const maxSec = getMaxSec();
            const remaining = maxSec - (state.adrSeconds || 0);

            const elTime = document.getElementById('adr-timer');
            const elInner = document.getElementById('adr-inner');
            const circle = document.getElementById('adr-progress-circle');

            if (state.adrSeconds > 0 && remaining > 0) {
                // ==========================================
                // TIMER LÄUFT
                // ==========================================
                if (elTime) {
                    // Natives, fehlerfreies Einblenden
                    elTime.style.display = 'flex';
                    
                    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
                    const s = (remaining % 60).toString().padStart(2, '0');
                    elTime.innerText = m + ':' + s;

                    if (remaining <= 30) {
                        elTime.classList.add('text-[#E3000F]', 'animate-pulse');
                        elTime.classList.remove('text-slate-700');
                    } else {
                        elTime.classList.add('text-slate-700');
                        elTime.classList.remove('text-[#E3000F]', 'animate-pulse');
                    }
                }
                
                // Spritze natives Ausblenden
                if (elInner) elInner.style.opacity = '0';
                
                // Ring natives Einblenden
                if (circle) {
                    circle.style.opacity = '1';
                    const pct = state.adrSeconds / maxSec;
                    if (window.CPR.UI && typeof window.CPR.UI.updateCircle === 'function') {
                        window.CPR.UI.updateCircle('adr-progress-circle', pct, '#E3000F');
                    }
                }
            } else {
                // ==========================================
                // TIMER INAKTIV / RESET
                // ==========================================
                if (elTime) {
                    elTime.style.display = 'none';
                    elTime.classList.remove('animate-pulse', 'text-[#E3000F]');
                    elTime.classList.add('text-slate-700');
                }
                
                if (elInner) elInner.style.opacity = '1';
                if (circle) circle.style.opacity = '0';
            }
        } catch(e) {
            console.error("[CPR] Fehler im Adrenalin UI Update:", e);
        }
    }

    return {
        start: function(resume) {
            if (!resume) {
                if (window.CPR.AppState) window.CPR.AppState.adrSeconds = 1;
            }
            updateUI();

            if (internalInterval) clearInterval(internalInterval);
            let lastTick = Date.now();

            internalInterval = setInterval(function() {
                try {
                    if (window.CPR.AppState && window.CPR.AppState.isRunning === false) {
                        lastTick = Date.now();
                        return;
                    }

                    const now = Date.now();
                    const deltaMs = now - lastTick;

                    if (deltaMs >= 1000) {
                        const deltaSec = Math.floor(deltaMs / 1000);
                        window.CPR.AppState.adrSeconds += deltaSec;
                        
                        const maxSec = getMaxSec();
                        
                        if (window.CPR.AppState.adrSeconds >= maxSec) {
                            window.CPR.AppState.adrSeconds = 0;
                            clearInterval(internalInterval);
                            internalInterval = null;
                            updateUI();
                            
                            if (window.CPR.Utils && window.CPR.Utils.vibrate) {
                                window.CPR.Utils.vibrate([200, 100, 200, 100, 200]);
                            }
                            if (window.CPR.Audio && window.CPR.Audio.playAlert) {
                                window.CPR.Audio.playAlert();
                            }
                        } else {
                            updateUI();
                        }
                        
                        lastTick += deltaSec * 1000;
                    }
                } catch(e) {
                    console.error("[CPR] Adrenalin Interval Fehler:", e);
                }
            }, 200);
        },
        pause: function() {
            if (internalInterval) {
                clearInterval(internalInterval);
                internalInterval = null;
            }
        },
        updateUI: updateUI
    };
})();
