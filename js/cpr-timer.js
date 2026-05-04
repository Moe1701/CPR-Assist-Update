window.CPR = window.CPR || {};

window.CPR.CPRTimer = (function() {
    let interval = null;
    let accumulatedTime = 0; 
    let startTime = 0;
    const total = 120; 
    let isRunning = false;
    let lastAlarmSec = -1; // Merkt sich den letzten Alarm-Zeitpunkt

    // Baut das Design bei Klick oder Reset wieder ab
    function resetAlertStyles() {
        const timerTopText = document.getElementById('timer-top-text');
        if (timerTopText) { timerTopText.classList.remove('text-[#E3000F]'); timerTopText.classList.add('text-slate-500'); }

        const el = document.getElementById('cycle-timer');
        if (el) { el.classList.remove('text-[#E3000F]'); el.classList.add('text-slate-800'); }

        const btnArea = document.getElementById('main-btn-area');
        if (btnArea) btnArea.style.boxShadow = '';

        const progressCanvas = document.getElementById('progress-circle');
        if (progressCanvas) progressCanvas.classList.remove('animate-pulse');
    }

    // Zeichnet nativ auf das Canvas-Element
    function drawCircle(elapsed) {
        const canvas = document.getElementById('progress-circle');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        const trackWidth = 16;      
        const progressWidth = 12;   
        const center = width / 2;
        const radius = center - (trackWidth / 2); 

        ctx.clearRect(0, 0, width, height);

        // 1. Zeichne die graue "Schiene" (Track) 
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, 2 * Math.PI, false);
        ctx.lineWidth = trackWidth;
        ctx.strokeStyle = '#f1f5f9'; // Tailwind slate-100
        ctx.stroke();
        
        // 2. Zeichne den Cyan-Fortschritt (oder Rot bei Eskalation)
        const clampedElapsed = Math.min(elapsed, total); // Verhindert ein Überlaufen des Rings
        if (clampedElapsed > 0) {
            const pct = clampedElapsed / total;
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, pct * 2 * Math.PI, false);
            ctx.lineWidth = progressWidth;
            // 🌟 UX FIX: Der Ring wird sofort blutrot, wenn die 120s erreicht sind!
            ctx.strokeStyle = elapsed >= total ? '#E3000F' : '#06b6d4'; 
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    function updateUI(elapsed) {
        const el = document.getElementById('cycle-timer');
        if (!el) return;
        
        const remaining = total - elapsed; // Kann jetzt auch ins Minus laufen!
        const displayRemaining = Math.max(remaining, 0); // Display friert bei 00:00 ein

        const m = Math.floor(displayRemaining / 60).toString().padStart(2, '0');
        const s = (displayRemaining % 60).toString().padStart(2, '0');
        el.innerText = m + ":" + s;

        // Warn-Elemente
        const pa = document.getElementById('inner-prepare-alert');
        const pt = document.getElementById('prepare-time');
        const pc = document.getElementById('inner-precharge-alert');
        const pct = document.getElementById('precharge-time');
        const aa = document.getElementById('inner-analyze-alert');
        const timerTopText = document.getElementById('timer-top-text');
        
        if (remaining <= 30 && remaining > 15) {
            // 30s bis 16s Warnung
            if(pa) { pa.classList.remove('hidden'); pa.classList.add('flex'); }
            if(pc) { pc.classList.add('hidden'); pc.classList.remove('flex'); }
            if(aa) { aa.classList.add('hidden'); aa.classList.remove('flex'); }
            if(pt) pt.innerText = remaining;
            resetAlertStyles();
            
            if (remaining === 30 && isRunning && lastAlarmSec !== remaining) {
                if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate([100, 100]);
                if (window.CPR.Audio && typeof window.CPR.Audio.playBeep === 'function') window.CPR.Audio.playBeep(1200);
                lastAlarmSec = remaining;
            }
        } else if (remaining <= 15 && remaining > 0) {
            // 15s bis 1s Warnung
            if(pa) { pa.classList.add('hidden'); pa.classList.remove('flex'); }
            if(pc) { pc.classList.remove('hidden'); pc.classList.add('flex'); }
            if(aa) { aa.classList.add('hidden'); aa.classList.remove('flex'); }
            if(pct) pct.innerText = remaining;
            resetAlertStyles();
            
            if (remaining === 15 && isRunning && lastAlarmSec !== remaining) {
                if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate([200, 100, 200]);
                if (window.CPR.Audio && typeof window.CPR.Audio.playBeep === 'function') {
                    window.CPR.Audio.playBeep(1000);
                    setTimeout(function() { window.CPR.Audio.playBeep(1000); }, 200);
                }
                lastAlarmSec = remaining;
            }
        } else if (remaining <= 0) {
            // 🌟 0s ESKALATION: Rhythmusanalyse Fällig! 🌟
            if(pa) { pa.classList.add('hidden'); pa.classList.remove('flex'); }
            if(pc) { pc.classList.add('hidden'); pc.classList.remove('flex'); }
            if(aa) { aa.classList.remove('hidden'); aa.classList.add('flex'); }
            
            // Alles auf Rot schalten!
            if(timerTopText) { timerTopText.classList.remove('text-slate-500'); timerTopText.classList.add('text-[#E3000F]'); }
            el.classList.remove('text-slate-800'); el.classList.add('text-[#E3000F]');

            const btnArea = document.getElementById('main-btn-area');
            if (btnArea) btnArea.style.boxShadow = '0 0 40px rgba(227, 0, 15, 0.6)';

            const progressCanvas = document.getElementById('progress-circle');
            if (progressCanvas && !progressCanvas.classList.contains('animate-pulse')) {
                progressCanvas.classList.add('animate-pulse');
            }

            // Haptischer und Akustischer Loop alle 2 Sekunden!
            if (isRunning && Math.abs(remaining) % 2 === 0 && lastAlarmSec !== remaining) {
                if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate([300, 150, 300]);
                if (window.CPR.Audio && typeof window.CPR.Audio.playAlert === 'function') window.CPR.Audio.playAlert();
                lastAlarmSec = remaining;
            }
        } else {
            // Alles über 30s (Sicherer Bereich)
            if(pa) { pa.classList.add('hidden'); pa.classList.remove('flex'); }
            if(pc) { pc.classList.add('hidden'); pc.classList.remove('flex'); }
            if(aa) { aa.classList.add('hidden'); aa.classList.remove('flex'); }
            resetAlertStyles();
        }

        drawCircle(elapsed);
    }

    function tick() {
        if (!isRunning) return;
        
        const currentElapsedMs = accumulatedTime + (Date.now() - startTime);
        const elapsedSec = Math.floor(currentElapsedMs / 1000);
        
        if (window.CPR.AppState) window.CPR.AppState.cycleSeconds = elapsedSec;
        
        updateUI(elapsedSec);
        // ACHTUNG: Hier ist kein Auto-Nav-Befehl mehr! 
        // Die App tickt logisch einfach weiter und schreit um Hilfe, bis der User klickt.
    }

    function start(resetTimer = false) {
        if (resetTimer) {
            accumulatedTime = 0;
            lastAlarmSec = -1;
            resetAlertStyles();
            if (window.CPR.AppState) window.CPR.AppState.cycleSeconds = 0;
            updateUI(0);
            
            if (window.CPR.AppState) {
                window.CPR.AppState.cprCycleCount = (window.CPR.AppState.cprCycleCount || 0) + 1;
                const badge = document.getElementById('cpr-counter-badge');
                if (badge) {
                    badge.classList.remove('hidden');
                    badge.innerText = window.CPR.AppState.cprCycleCount;
                }
            }
        } else {
            if (window.CPR.AppState && !isNaN(window.CPR.AppState.cycleSeconds)) {
                accumulatedTime = window.CPR.AppState.cycleSeconds * 1000;
            }
        }
        
        if (isRunning) return;
        startTime = Date.now();
        isRunning = true;
        
        interval = setInterval(tick, 200); 
    }

    function pause() {
        if (!isRunning) return;
        accumulatedTime += (Date.now() - startTime);
        isRunning = false;
        clearInterval(interval);
        resetAlertStyles(); // Baut rote Alarme bei Pause/Klick sofort ab
    }

    return {
        start: start,
        pause: pause,
        reset: function() {
            pause();
            accumulatedTime = 0;
            lastAlarmSec = -1;
            if (window.CPR.AppState) window.CPR.AppState.cycleSeconds = 0;
            resetAlertStyles();
            updateUI(0);
            const badge = document.getElementById('cpr-counter-badge');
            if (badge) badge.classList.add('hidden');
            
            const pa = document.getElementById('inner-prepare-alert');
            const pc = document.getElementById('inner-precharge-alert');
            const aa = document.getElementById('inner-analyze-alert');
            if(pa) { pa.classList.add('hidden'); pa.classList.remove('flex'); }
            if(pc) { pc.classList.add('hidden'); pc.classList.remove('flex'); }
            if(aa) { aa.classList.add('hidden'); aa.classList.remove('flex'); }
        },
        isRunning: function() { return isRunning; },
        getElapsed: function() {
            if (!isRunning) return Math.floor(accumulatedTime / 1000);
            return Math.floor((accumulatedTime + (Date.now() - startTime)) / 1000);
        },
        updateUI: function() {
            updateUI(this.getElapsed());
        }
    };
})();
