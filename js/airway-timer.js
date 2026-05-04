window.CPR = window.CPR || {};

/**
 * CPR Assist - Autonome Lunge für den kontinuierlichen Modus
 * FIX: Reagiert jetzt auf 'continuous' statt 'KONT'.
 * FIX: CSS-Farbe wird per Inline-Style erzwungen (backgroundColor), um Tailwind-Overrides zu ignorieren.
 * UX-UPDATE: Der Badge wird während der Beatmungs-Sekunde komplett ausgeblendet.
 */
window.CPR.AirwayTimer = (function() {
    let rafId = null;
    let isRunning = false;
    let cycleStartTime = 0;
    
    let hasPlayedSound = false; 
    
    let cycleDuration = 6000; 
    let fillDuration = 5000;  
    let ventDuration = 1000;  

    function animate() {
        if (!isRunning) return;

        const now = Date.now();
        let elapsed = now - cycleStartTime;

        if (elapsed >= cycleDuration) {
            cycleStartTime = now;
            elapsed = 0; 
            hasPlayedSound = false; 
        }

        const glowBg = document.getElementById('aw-glow-bg');
        const awIcon = document.getElementById('aw-icon');
        const badge = document.getElementById('airway-countdown-badge');
        const awLabel = document.getElementById('airway-label');

        if (elapsed < fillDuration) {
            // ==========================================
            // 1. COUNTDOWN-PHASE (Warten auf Beatmung)
            // ==========================================
            const remainingToVent = Math.ceil((fillDuration - elapsed) / 1000);
            const pct = elapsed / fillDuration;

            if (glowBg) {
                glowBg.style.transition = 'none';
                // FIX: Hartes Erzwingen der Farbe (cyan-300), damit Überschreibungen egal sind
                glowBg.style.backgroundColor = '#67e8f9'; 
                glowBg.style.opacity = (0.1 + (pct * 0.6)).toString();
                glowBg.style.transform = `scale(${1 + (pct * 0.05)})`;
            }

            if (awIcon) {
                awIcon.classList.remove('text-[#E3000F]');
                awIcon.classList.add('text-cyan-500');
            }

            if (badge) {
                badge.style.display = 'flex'; 
                badge.innerText = remainingToVent;
                badge.classList.remove('hidden', 'bg-amber-500', 'border-amber-100', 'animate-pulse', 'bg-[#E3000F]');
                badge.classList.add('bg-slate-800', 'border-white');
            }
            
            if (awLabel) {
                awLabel.innerText = window.CPR.Globals.tempAirwayType || "Atemweg";
                awLabel.classList.remove('text-[#E3000F]', 'animate-pulse');
            }

        } else {
            // ==========================================
            // 2. BEATMUNGS-PHASE (1 Sekunde Knalleffekt)
            // ==========================================
            if (!hasPlayedSound) {
                if (window.CPR.Audio && typeof window.CPR.Audio.playVentilationSound === 'function') {
                    window.CPR.Audio.playVentilationSound();
                }
                if (window.CPR.Utils && window.CPR.Utils.vibrate) {
                    window.CPR.Utils.vibrate(30); 
                }
                hasPlayedSound = true;
            }

            if (glowBg) {
                glowBg.style.transition = 'none';
                // FIX: Farbe (cyan-400) im Peak hart erzwingen
                glowBg.style.backgroundColor = '#22d3ee'; 
                glowBg.style.opacity = '0.85';
                glowBg.style.transform = 'scale(1.15)';
                glowBg.style.boxShadow = '0 0 20px rgba(34,211,238,0.6)';
            }

            if (badge) {
                // Badge unsichtbar machen während es knallt!
                badge.style.display = 'none'; 
            }

            if (awIcon) {
                awIcon.classList.add('text-[#E3000F]');
                awIcon.classList.remove('text-cyan-500');
            }

            if (awLabel) {
                awLabel.innerText = "BEATMEN";
                awLabel.classList.add('text-[#E3000F]');
            }
        }

        rafId = requestAnimationFrame(animate);
    }

    return {
        start: function() {
            if (isRunning) return;
            const state = window.CPR.AppState;
            
            // FIX: Überprüft jetzt korrekterweise auf 'continuous' statt auf 'KONT'
            if (!state || state.cprMode !== 'continuous') return;

            if (state.isPediatric) {
                cycleDuration = (window.CPR.CONFIG && window.CPR.CONFIG.VENT_INTERVAL_PED) ? window.CPR.CONFIG.VENT_INTERVAL_PED * 1000 : 2400; 
                fillDuration = cycleDuration - 1000;
            } else {
                cycleDuration = (window.CPR.CONFIG && window.CPR.CONFIG.VENT_INTERVAL_ADULT) ? window.CPR.CONFIG.VENT_INTERVAL_ADULT * 1000 : 6000;
                fillDuration = cycleDuration - 1000;
            }

            isRunning = true;
            cycleStartTime = Date.now();
            hasPlayedSound = false; 
            
            animate();
        },
        
        stop: function() {
            isRunning = false;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            
            const glowBg = document.getElementById('aw-glow-bg');
            const awIcon = document.getElementById('aw-icon');
            const badge = document.getElementById('airway-countdown-badge');
            const awLabel = document.getElementById('airway-label');
            
            if (glowBg) {
                glowBg.style.transition = ''; // Transition wiederherstellen für den 30:2 Modus
                glowBg.style.backgroundColor = ''; // Inline-Farbe wieder abräumen
                glowBg.style.opacity = '0';
                glowBg.style.transform = 'scale(1)';
                glowBg.style.boxShadow = 'none';
            }
            if (awIcon) {
                awIcon.classList.remove('text-cyan-500', 'text-[#E3000F]');
                awIcon.classList.add('text-slate-400');
            }
            
            if (badge) {
                badge.style.display = 'none'; 
                badge.classList.remove('bg-amber-500', 'border-amber-100', 'animate-pulse', 'bg-[#E3000F]');
                badge.classList.add('bg-slate-800', 'border-white', 'hidden');
            }
            
            if (awLabel) {
                awLabel.innerText = window.CPR.Globals.tempAirwayType || "Atemweg";
                awLabel.classList.remove('text-cyan-600', 'animate-pulse', 'text-[#E3000F]');
            }
        }
    };
})();
