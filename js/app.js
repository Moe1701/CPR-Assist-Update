/**
 * CPR Assist - Master Controller (Medical Grade Background-Safe)
 * - PING-PONG: Das dynamische Zusammenspiel zwischen CPR und Beatmung ist aktiv!
 * - UI UPGRADE: Millimetergenaue Y-Positionen verhindern jedes Herausrutschen!
 * - LOGIC FIX: Timer schaltet nicht mehr automatisch um, sondern eskaliert!
 * - ARCHITECTURE: Satelliten werden beim Öffnen von Menüs global im CSS ausgeblendet!
 * - BUGFIX (navHelper): Verhindert das Ausblenden der UI beim App-Resume aus dem Hintergrund.
 * - BUGFIX (Sonnenfinsternis): Hardcodierte DOM opacity-0 Klassen werden bei Dashboard-Init bereinigt.
 * - UX FIX (Space Reservation): Target-Displacement im Onboarding behoben. Button hüpft nicht mehr!
 * - BULLETPROOF FIX: Top Stats werden über redundante DOM-Befehle garantiert eingeblendet.
 * - TIME TRAVEL FIX: CPR und CCF-Berechnung laufen während App-Backgrounding lückenlos weiter.
 * - OVERLAP FIX: Redundanter "Jetzt hier drücken" Text entfernt für saubereres Layout im kleinen Button.
 * - LOGBOOK FIX: Rhythmusanalyse triggert nun aktiv das Schlüsselwort "PAUSE" für den roten Logbuch-Balken.
 */

document.addEventListener('DOMContentLoaded', function() {
    const CPR = window.CPR;
    const { CONFIG, Globals, AppState, broselowData, Utils, UI, Audio: AudioEngine } = CPR;

    // =========================================================
    // 🌟 ABSOLUT-POSITIONIERUNG für den Timer Screen
    // =========================================================
    function remodelViewTimer() {
        const vt = document.getElementById('view-timer');
        if (vt) {
            vt.className = "hidden flex-col items-center justify-center w-full h-full text-center relative pointer-events-none";
            const shocks = AppState.shockCount || 0;
            
            vt.innerHTML = `
                <!-- 1. Top: Bei Analyse drücken -->
                <div class="vt-top-text">
                    <span id="timer-top-text">Bei Analyse drücken</span>
                </div>

                <!-- 2. Mitte: Der Timer -->
                <div id="cycle-timer" class="vt-timer-display" style="font-variant-numeric: tabular-nums;">
                    02:00
                </div>

                <!-- 3. Unter dem Timer: Die Alerts -->
                <div id="inner-prepare-alert" class="hidden vt-alert-box">
                    <div class="vt-alert-row">
                        <div class="vt-alert-dot bg-amber-500 animate-ping"></div>
                        <span class="vt-alert-txt text-amber-500">Puls tasten, Defi laden</span>
                    </div>
                    <span id="prepare-time" class="vt-alert-num text-amber-500">30</span>
                </div>

                <div id="inner-precharge-alert" class="hidden vt-alert-box">
                    <div class="vt-alert-row">
                        <div class="vt-alert-dot bg-[#E3000F] animate-ping"></div>
                        <span class="vt-alert-txt text-[#E3000F]">Defi laden</span>
                    </div>
                    <span id="precharge-time" class="vt-alert-num text-[#E3000F]">15</span>
                </div>

                <!-- OVERLAP FIX: Redundanter Subtext "Jetzt hier drücken" wurde entfernt! -->
                <div id="inner-analyze-alert" class="hidden vt-alert-box">
                    <div class="vt-analyze-badge animate-pulse">
                        <span class="vt-analyze-txt">Analyse Fällig</span>
                    </div>
                </div>

                <!-- 4. Unten: Schock Info -->
                <div class="vt-bottom-info">
                    <i class="fa-solid fa-bolt text-amber-400"></i>
                    <span id="rhythm-info-shocks">${shocks}</span>
                    <span class="text-slate-300 mx-1">|</span>
                    <span id="rhythm-info-joule" class="text-[#E3000F]">150 J</span>
                </div>
            `;
        }
    }
    remodelViewTimer();
    // =========================================================

    // 🌟 HELPER: Garantiert die Sichtbarkeit der Top-Stats (Tailwind + natives DOM) 🌟
    function showTopStats() {
        const topStats = document.getElementById('top-stats-container');
        if (topStats) {
            topStats.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
            topStats.classList.add('opacity-100', 'pointer-events-auto');
            topStats.style.opacity = '1';
            topStats.style.pointerEvents = 'auto';
        }
    }

    // 🌟 ARCHITEKTUR-FIX: Steuert das globale Sichtbarkeits-Konzept der Satelliten
    function navHelper(newState, viewId, size) {
        if (newState) { AppState.previousState = AppState.state; AppState.state = newState; }
        
        // CHIRURGISCHER BUGFIX: Nur umschalten, wenn auch wirklich eine viewId übergeben wurde!
        if (viewId && UI && typeof UI.switchView === 'function') { 
            UI.switchView(viewId); 
        }
        
        // Entweder über UI.js oder als direkter Fallback:
        if (UI && typeof UI.setCenterSize === 'function' && size) { 
            UI.setCenterSize(size); 
        } else if (size) {
            if (size === 'small') {
                document.body.classList.add('cpr-mode-small');
                document.body.classList.remove('center-menu-open');
            } else if (size === 'large') {
                document.body.classList.remove('cpr-mode-small');
                document.body.classList.add('center-menu-open');
            }
        }
    }
    window.CPR.navHelper = navHelper;

    function addClick(id, handler) { 
        const el = document.getElementById(id); 
        if (el) {
            el.addEventListener('click', (e) => {
                if (window.CPR.Globals && Date.now() - (window.CPR.Globals.lastViewSwitch || 0) < 150) {
                    e.preventDefault(); e.stopPropagation(); return;
                }
                handler(e);
            });
        }
    }
    
    function markMenuAction() { Globals.lastMenuAction = Date.now(); }

    let logoClickCount = 0; let logoClickTimer = null;
    const logoContainer = document.getElementById('logo-container');
    if (logoContainer) {
        logoContainer.addEventListener('click', function(e) {
            logoClickCount++;
            if (logoClickCount === 1) logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1500); 
            if (logoClickCount >= 3) {
                clearTimeout(logoClickTimer); logoClickCount = 0;
                if (Utils && Utils.vibrate) Utils.vibrate([100, 100, 100]); 
                if (confirm("NOTFALL-RESET: Möchtest du die App sofort zurücksetzen und alle Daten löschen?")) {
                    if (CPR.Utils && CPR.Utils.resetApp) CPR.Utils.resetApp();
                    else { CPR.isResetting = true; localStorage.clear(); window.location.reload(); }
                }
            }
        });
    }

    async function requestWakeLock() {
        try { if ('wakeLock' in navigator) { Globals.wakeLock = await navigator.wakeLock.request('screen'); updateWakeLockUI(true); } } catch (err) {}
    }

    function updateWakeLockUI(isActive) {
        const wlBadge = document.getElementById('wake-lock-status');
        if (wlBadge) {
            wlBadge.innerHTML = isActive ? '<i class="fa-solid fa-sun"></i> Display-Schutz AKTIV' : '<i class="fa-solid fa-moon"></i> Display-Schutz inaktiv';
            wlBadge.className = isActive ? 'block text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-1' : 'block text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-1';
        }
    }

    // 🌟 CLEANUP: Meldet neue Einträge direkt an die LogTimeline, ohne selbst ins HTML zu pfuschen!
    function addLogEntry(txt) {
        if (!AppState.protocolData) AppState.protocolData = [];
        AppState.protocolData.push({
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            secondsFromStart: AppState.totalSeconds || 0,
            action: txt
        });
        Utils.saveSession();

        if (window.CPR.LogTimeline && typeof window.CPR.LogTimeline.forceRender === 'function') {
            window.CPR.LogTimeline.forceRender();
        }
    }
    window.addLogEntry = addLogEntry;

    function startMainTimer() {
        // Stats absolut sicher einblenden
        showTopStats();
        
        const startTimeEl = document.getElementById('start-time');
        if (startTimeEl && startTimeEl.innerText === '--:--') startTimeEl.innerText = "Start: " + new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        
        if (Globals.mainInterval) clearInterval(Globals.mainInterval);
        
        let lastTickTime = Date.now();
        
        Globals.mainInterval = setInterval(() => {
            if (AppState.isRunning !== false) {
                const now = Date.now();
                const deltaMs = now - lastTickTime;
                
                if (deltaMs >= 1000) {
                    const deltaSec = Math.floor(deltaMs / 1000);
                    AppState.totalSeconds += deltaSec;
                    if (AppState.state !== 'ROSC_ACTIVE') {
                        AppState.arrestSeconds += deltaSec;
                        if (AppState.isCompressing) AppState.compressingSeconds += deltaSec;
                        else if (AppState.isVentilationPhase) AppState.ventilationSeconds = (AppState.ventilationSeconds || 0) + deltaSec;
                    }
                    
                    const mainTimerEl = document.getElementById('main-timer');
                    if (mainTimerEl) mainTimerEl.innerText = Utils.formatTime(AppState.totalSeconds);
                    updateCCF(); 
                    Utils.saveSession();
                    lastTickTime += deltaSec * 1000;
                }
            } else {
                lastTickTime = Date.now();
            }
        }, 200);
    }

    function activateDashboard(resetTimer = false) {
        document.body.classList.add('dashboard-active');
        const sats = document.getElementById('satellites'); if (sats) sats.classList.remove('hidden');
        ['btn-airway', 'btn-cpr'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('opacity-0', 'pointer-events-none'); });
        
        // 🌟 FIX: CSS Layout Eclipse - Entfernt hartcodierte Opacity-0 Klassen von den Satelliten 🌟
        document.querySelectorAll('.satellite-btn').forEach(b => b.classList.remove('opacity-0', 'pointer-events-none'));
        
        if (UI && typeof UI.recalcMeds === 'function') UI.recalcMeds();
        AppState.isRunning = true;
        if (CPR.CPRTimer && typeof CPR.CPRTimer.start === 'function') CPR.CPRTimer.start(resetTimer);
        navHelper('RUNNING', 'view-timer', 'small');
    }

    function updateCCF() {
        if (AppState.arrestSeconds === 0) return;
        const rawCcf = (AppState.compressingSeconds / AppState.arrestSeconds) * 100;
        const ccfDisplay = document.getElementById('ccf-display');
        if (ccfDisplay) {
            ccfDisplay.innerText = Math.min(100, Math.round(rawCcf)) + "%";
            ccfDisplay.className = "text-2xl sm:text-3xl font-black " + (rawCcf >= 80 ? 'text-emerald-500' : 'text-[#E3000F]');
        }
    }

    function showMainInterface() {
        const ab = document.getElementById('btn-airway');
        const cb = document.getElementById('btn-cpr');
        if (ab) ab.style.opacity = '1';
        if (cb) cb.style.opacity = '1';
        
        if(UI && typeof UI.updateCprModeUI === 'function') UI.updateCprModeUI();
        if(window.CPR.MedsButton && typeof window.CPR.MedsButton.init === 'function') window.CPR.MedsButton.init();
    }

    window.CPR.onBeat = function() {
        if (!AppState.isCompressing || AppState.isRunning === false) return;
        
        const btnCpr = document.getElementById('btn-cpr');
        if (btnCpr && !AppState.isVentilationPhase) {
            btnCpr.classList.replace('border-slate-100', 'border-red-500');
            btnCpr.classList.add('shadow-[0_0_50px_rgba(227,0,15,0.85)]', 'bg-red-50');
            setTimeout(() => {
                btnCpr.classList.replace('border-red-500', 'border-slate-100');
                btnCpr.classList.remove('shadow-[0_0_50px_rgba(227,0,15,0.85)]', 'bg-red-50');
            }, 150);
        }

        if (AppState.cprMode !== 'continuous') {
            AppState.compressionCount = (AppState.compressionCount || 0) + 1;
            const limit = AppState.isPediatric ? 15 : 30;
            const badge = document.getElementById('cpr-counter-badge');
            if (badge) { badge.innerText = AppState.compressionCount; badge.classList.remove('hidden'); }
            
            const remainingComps = limit - AppState.compressionCount;
            const badgeAw = document.getElementById('airway-countdown-badge');

            if (remainingComps <= 5 && remainingComps > 0) {
                if (badgeAw) {
                    badgeAw.style.display = 'flex'; 
                    badgeAw.innerText = remainingComps;
                    badgeAw.classList.remove('hidden', 'bg-slate-800', 'border-white');
                    badgeAw.classList.add('bg-amber-500', 'border-amber-100', 'animate-pulse');
                }
                if (remainingComps <= 3 && window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(20);
            } else {
                if (badgeAw) {
                    badgeAw.style.display = 'none'; 
                    badgeAw.classList.add('hidden');
                    badgeAw.classList.remove('bg-amber-500', 'border-amber-100', 'animate-pulse');
                    badgeAw.classList.add('bg-slate-800', 'border-white');
                }
            }

            if (AppState.compressionCount >= limit) triggerVentilationPhase();
        }
    };

    function triggerVentilationPhase() {
        AppState.isCompressing = false; 
        AppState.isVentilationPhase = true; 
        AppState.compressionCount = 0; 
        updateCprUI();

        const glowBg = document.getElementById('aw-glow-bg');
        if (glowBg) glowBg.className = 'absolute inset-0 w-full h-full pointer-events-none rounded-full transition-all duration-500';

        function doBreath(callback) {
            if (AppState.isRunning === false || AppState.state === 'DECISION') return;
            if (AudioEngine && typeof AudioEngine.playVentilationSound === 'function') AudioEngine.playVentilationSound();
            if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(30);

            if (glowBg) {
                glowBg.style.opacity = '0.85';
                glowBg.style.transform = 'scale(1.15)';
                glowBg.style.backgroundColor = '#22d3ee'; 
                glowBg.style.boxShadow = '0 0 30px rgba(34,211,238,0.7)';
            }

            setTimeout(() => {
                if (glowBg) {
                    glowBg.style.opacity = '0.1';
                    glowBg.style.transform = 'scale(1)';
                    glowBg.style.boxShadow = 'none';
                }
                setTimeout(callback, 500); 
            }, 1000); 
        }

        doBreath(() => {
            doBreath(() => {
                if (AppState.isRunning && AppState.state !== 'DECISION') {
                    if (glowBg) glowBg.style.opacity = '0';
                    AppState.isVentilationPhase = false;
                    AppState.isCompressing = true;
                    updateCprUI();
                }
            });
        });
    }

    function updateCprUI() {
        const btnCpr = document.getElementById('btn-cpr');
        const badge = document.getElementById('cpr-counter-badge');
        const iconNormal = document.getElementById('cpr-icon-normal');
        const iconPause = document.getElementById('cpr-icon-pause');
        const iconVent = document.getElementById('cpr-icon-vent');
        const mainText = document.getElementById('cpr-main-text');
        const handsOffTimer = document.getElementById('cpr-hands-off-timer');
        
        if (Globals.pauseInterval) { clearInterval(Globals.pauseInterval); Globals.pauseInterval = null; }

        if (btnCpr) {
            btnCpr.classList.remove('bg-amber-50', 'bg-red-50', 'pause-warning', 'animate-pulse', 'border-red-600', 'border-amber-400', 'shadow-[0_0_60px_rgba(227,0,15,0.9)]', 'shadow-[0_0_80px_rgba(227,0,15,1)]', 'shadow-[0_0_20px_rgba(245,158,11,0.5)]', 'scale-110');
            btnCpr.classList.add('bg-white', 'text-slate-700', 'border-slate-100');
        }
        if (iconNormal) {
            iconNormal.classList.remove('text-amber-500', 'text-red-600', 'drop-shadow-[0_0_15px_rgba(227,0,15,0.9)]', 'drop-shadow-[0_0_20px_rgba(227,0,15,1)]', 'scale-110');
            iconNormal.classList.add('text-emerald-500');
        }
        if (mainText) {
            mainText.classList.remove('text-amber-600', 'text-red-600');
            mainText.classList.add('text-slate-600');
        }
        if (handsOffTimer) {
            handsOffTimer.classList.remove('bg-amber-500/90', 'bg-red-600/90');
            handsOffTimer.classList.add('bg-slate-700/85', 'hidden');
        }

        if (AppState.isCompressing && AppState.isRunning !== false) {
            AppState.isVentilationPhase = false;
            if (iconNormal) iconNormal.classList.add('hidden');
            if (iconVent) iconVent.classList.add('hidden');
            if (iconPause) { iconPause.classList.remove('hidden', 'text-red-600'); iconPause.classList.add('text-slate-400'); }
            if (mainText) mainText.innerText = "CPR PAUSIEREN";
            
            if (badge) {
                if (AppState.cprMode !== 'continuous' && AppState.compressionCount > 0) { badge.innerText = AppState.compressionCount; badge.classList.remove('hidden'); } 
                else { badge.classList.add('hidden'); }
            }
            
            if (AudioEngine && typeof AudioEngine.init === 'function') AudioEngine.init();
            if (window.CPR.AudioContext && window.CPR.AudioContext.ctx) window.CPR.AudioContext.nextNoteTime = window.CPR.AudioContext.ctx.currentTime + 0.05;
            if (AudioEngine && typeof AudioEngine.scheduler === 'function') AudioEngine.scheduler();
            
            if (AppState.cprMode === 'continuous' && window.CPR.AirwayTimer) {
                window.CPR.AirwayTimer.start();
            } else if (window.CPR.AirwayTimer) {
                window.CPR.AirwayTimer.stop();
            }

        } else if (AppState.isVentilationPhase) {
            if (iconNormal) iconNormal.classList.add('hidden');
            if (iconPause) iconPause.classList.add('hidden');
            if (iconVent) iconVent.classList.remove('hidden');
            if (mainText) mainText.innerText = "BEATMEN";
            if (badge) badge.classList.add('hidden');
            
            if (window.CPR.AirwayTimer) window.CPR.AirwayTimer.stop();

        } else {
            if (iconVent) iconVent.classList.add('hidden');
            if (iconPause) iconPause.classList.add('hidden');
            if (iconNormal) iconNormal.classList.remove('hidden');
            if (mainText) mainText.innerText = "CPR FORTSETZEN";
            if (badge) badge.classList.add('hidden');
            
            if (window.CPR.AirwayTimer) window.CPR.AirwayTimer.stop();
            
            const st = AppState.state || 'IDLE';
            if (st !== 'IDLE' && !st.startsWith('OB_') && st !== 'END' && st !== 'ROSC_ACTIVE') {
                Globals.pauseSeconds = 0; let pauseStartTime = Date.now(); let lastVibratedSecond = -1; 
                if (handsOffTimer) { handsOffTimer.innerText = "0s Pause"; handsOffTimer.classList.remove('hidden'); }

                Globals.pauseInterval = setInterval(() => {
                    if (AppState.isRunning !== false) {
                        Globals.pauseSeconds = Math.floor((Date.now() - pauseStartTime) / 1000);
                        if (handsOffTimer) handsOffTimer.innerText = Globals.pauseSeconds + "s Pause";
                        
                        if (Globals.pauseSeconds >= 10) {
                            if (btnCpr) { btnCpr.classList.add('bg-red-50', 'border-red-600', 'animate-pulse', 'shadow-[0_0_80px_rgba(227,0,15,1)]', 'scale-110'); btnCpr.classList.remove('bg-amber-50', 'bg-white', 'border-amber-400', 'border-slate-100'); }
                            if (handsOffTimer) { handsOffTimer.classList.remove('bg-slate-700/85', 'bg-amber-500/90'); handsOffTimer.classList.add('bg-red-600/90'); }
                            if (iconNormal) { iconNormal.classList.remove('text-emerald-500', 'text-amber-500'); iconNormal.classList.add('text-red-600', 'drop-shadow-[0_0_20px_rgba(227,0,15,1)]', 'scale-110'); }
                            if (mainText) { mainText.classList.remove('text-slate-600', 'text-amber-600'); mainText.classList.add('text-red-600'); }
                            if (Globals.pauseSeconds % 2 === 0 && lastVibratedSecond !== Globals.pauseSeconds) { Utils.vibrate([150, 50, 150]); lastVibratedSecond = Globals.pauseSeconds; }
                        } else if (Globals.pauseSeconds >= 5) {
                            if (btnCpr) { btnCpr.classList.add('bg-amber-50', 'border-amber-400', 'shadow-[0_0_20px_rgba(245,158,11,0.5)]'); btnCpr.classList.remove('bg-white', 'border-slate-100'); }
                            if (handsOffTimer) { handsOffTimer.classList.remove('bg-slate-700/85'); handsOffTimer.classList.add('bg-amber-500/90'); }
                            if (iconNormal) { iconNormal.classList.remove('text-emerald-500', 'text-amber-500'); iconNormal.classList.add('text-amber-500'); }
                            if (mainText) { mainText.classList.remove('text-slate-600'); mainText.classList.add('text-amber-600'); }
                            if (Globals.pauseSeconds === 5 && lastVibratedSecond !== Globals.pauseSeconds) { Utils.vibrate(50); lastVibratedSecond = Globals.pauseSeconds; }
                        }
                    } else { pauseStartTime = Date.now() - (Globals.pauseSeconds * 1000); }
                }, 200);
            }
        }
    }

    function updatePediRoscVitals() {
        const vitalsCard = document.getElementById('pedi-rosc-vitals');
        if (!vitalsCard) return;
        if (AppState.isPediatric && AppState.patientWeight) {
            const kg = AppState.patientWeight;
            let age = 0; if (kg >= 10) age = Math.max(1, Math.round((kg / 2) - 4));
            let rr = "> 70 mmHg"; if (age >= 1 && age <= 10) rr = `> ${70 + (2 * age)} mmHg`; else if (age > 10) rr = "> 90 mmHg";
            let hr = "110 - 160 /min"; if (age >= 1 && age < 2) hr = "100 - 150 /min"; else if (age >= 2 && age < 5) hr = "90 - 140 /min"; else if (age >= 5 && age <= 12) hr = "80 - 120 /min"; else if (age > 12) hr = "60 - 100 /min";
            let vt = Math.round(kg * 6) + " ml";
            
            const elKg = document.getElementById('pedi-rosc-kg'); if (elKg) elKg.innerText = kg + " kg";
            const elRr = document.getElementById('pedi-rosc-rr'); if (elRr) elRr.innerText = rr;
            const elHr = document.getElementById('pedi-rosc-hr'); if (elHr) elHr.innerText = hr;
            const elVt = document.getElementById('pedi-rosc-vt'); if (elVt) elVt.innerText = "~ " + vt;
            vitalsCard.classList.remove('hidden');
        } else { vitalsCard.classList.add('hidden'); }
    }

    function startRoscTimer() {
        if (Globals.roscInterval) clearInterval(Globals.roscInterval);
        Globals.roscSeconds = 0; let roscStartTime = Date.now();
        Globals.roscInterval = setInterval(() => {
            Globals.roscSeconds = Math.floor((Date.now() - roscStartTime) / 1000);
            const roscTimer = document.getElementById('rosc-timer-display');
            if (roscTimer) roscTimer.innerText = Utils.formatTime(Globals.roscSeconds);
            Utils.saveSession();
        }, 200);
    }

    function triggerDebrief(reason) {
        Utils.vibrate(50); addLogEntry("EINSATZ BEENDET - " + reason); AppState.isRunning = false;
        if (AppState.state !== 'ROSC_ACTIVE') AppState.state = 'END';
        
        if (Globals.pauseInterval) { clearInterval(Globals.pauseInterval); Globals.pauseInterval = null; }
        if (Globals.roscInterval) { clearInterval(Globals.roscInterval); Globals.roscInterval = null; }
        if (Globals.mainInterval) { clearInterval(Globals.mainInterval); Globals.mainInterval = null; }
        if (CPR.CPRTimer && typeof CPR.CPRTimer.pause === 'function') CPR.CPRTimer.pause();
        if (window.CPR.AirwayTimer) window.CPR.AirwayTimer.stop();
        
        const arrSec = AppState.arrestSeconds || 0; const compSec = AppState.compressingSeconds || 0; const totSec = AppState.totalSeconds || 0;
        const ccf = arrSec > 0 ? Math.min(100, Math.round((compSec / arrSec) * 100)) : 0;
        const m = Math.floor(totSec / 60).toString().padStart(2, '0'); const s = (totSec % 60).toString().padStart(2, '0');
        
        const durEl = document.getElementById('debrief-duration'); if(durEl) durEl.innerText = m + ":" + s;
        const ccfEl = document.getElementById('debrief-ccf'); if(ccfEl) ccfEl.innerText = ccf + "%";
        const shocksEl = document.getElementById('debrief-shocks'); if(shocksEl) shocksEl.innerText = AppState.shockCount || 0;
        const adrEl = document.getElementById('debrief-adr'); if(adrEl) adrEl.innerText = AppState.adrCount || 0;

        const modal = document.getElementById('debriefing-modal');
        if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
        Utils.saveSession();
    }

    function initHeaderEvents() {
        addClick('btn-toggle-sound', () => {
            Utils.vibrate(20); AppState.isSoundActive = !AppState.isSoundActive;
            const ion = document.getElementById('icon-sound-on'); const ioff = document.getElementById('icon-sound-off');
            if (ion && ioff) { ion.classList.toggle('hidden', !AppState.isSoundActive); ioff.classList.toggle('hidden', AppState.isSoundActive); }
            addLogEntry("Sound " + (AppState.isSoundActive ? "AN" : "AUS")); Utils.saveSession();
        });
        addClick('btn-help', () => { Utils.vibrate(20); if (window.CPR.HelpOverlay && typeof window.CPR.HelpOverlay.toggle === 'function') window.CPR.HelpOverlay.toggle(); });
        addClick('btn-settings', () => { Utils.vibrate(20); document.getElementById('settings-modal')?.classList.replace('hidden', 'flex'); });
    }

    function initPatientSetupEvents() {
        const sAge = document.getElementById('slider-age'); const sKg = document.getElementById('slider-kg'); const sCm = document.getElementById('slider-cm');
        const valAge = document.getElementById('val-age'); const valKg = document.getElementById('val-kg'); const valCm = document.getElementById('val-cm');

        function updateColorHighlight(kg) {
            if (!broselowData) return;
            let zone = broselowData.find(z => kg >= z.minKg && kg <= z.maxKg) || broselowData[broselowData.length - 1];
            document.querySelectorAll('.broselow-btn').forEach(b => {
                if (zone && b.dataset.color === zone.color) { b.style.opacity = '1'; b.style.transform = 'scale(1.05)'; b.style.border = '3px solid #1e293b'; } 
                else { b.style.opacity = '0.4'; b.style.transform = 'scale(1)'; b.style.border = 'none'; }
            });
            const summary = document.getElementById('summary-badge');
            if (summary && zone) { summary.innerText = zone.color.toUpperCase() + ' | ~' + zone.avgKg + 'kg | ' + zone.ageStr; summary.classList.remove('hidden'); }
        }

        function sync(src) {
            let age = parseInt(sAge.value), kg = parseInt(sKg.value), cm = parseInt(sCm.value);
            if (src === 'age') { if (age === 0) kg = 6; else kg = 2 * (age + 4); cm = Math.round((age * 6) + 77); sKg.value = kg; sCm.value = cm; } 
            else if (src === 'kg') { if (kg < 10) age = 0; else age = Math.max(1, Math.round((kg / 2) - 4)); cm = Math.round((age * 6) + 77); sAge.value = age; sCm.value = cm; } 
            if (valAge) valAge.innerText = age === 0 ? 'Säugling' : age + ' J.';
            if (valKg) valKg.innerText = kg + ' kg';
            if (valCm) valCm.innerText = cm + ' cm';
            updateColorHighlight(kg);
        }

        if (sAge) sAge.addEventListener('input', () => sync('age'));
        if (sKg) sKg.addEventListener('input', () => sync('kg'));
        if (sCm) sCm.addEventListener('input', () => sync('cm'));

        document.querySelectorAll('.broselow-btn').forEach(btn => { 
            btn.addEventListener('click', (e) => { Utils.vibrate(20); const color = e.currentTarget.dataset.color; const zone = broselowData ? broselowData.find(z => z.color === color) : null; if (zone && sKg) { sKg.value = zone.avgKg; sync('kg'); } }); 
        });

        addClick('btn-pediatric-edit', (e) => { e.stopPropagation(); Utils.vibrate(30); document.getElementById('patient-setup-modal')?.classList.replace('hidden', 'flex'); });
        addClick('btn-close-pedi-modal', (e) => { e.stopPropagation(); Utils.vibrate(30); document.getElementById('patient-setup-modal')?.classList.replace('flex', 'hidden'); });

        addClick('btn-start-adult', () => {
            if (AudioEngine && typeof AudioEngine.init === 'function') AudioEngine.init();
            Utils.vibrate(40); AppState.isPediatric = false; AppState.patientWeight = null; AppState.cprMode = '30:2'; AppState.compressionCount = 0; AppState.isRunning = true; AppState.isCompressing = true;
            if(UI && typeof UI.updateCprModeUI === 'function') UI.updateCprModeUI(); if(UI && typeof UI.recalcMeds === 'function') UI.recalcMeds(); 
            startMainTimer(); requestWakeLock(); addLogEntry("Start REA Erw."); navHelper('OB_COMPRESSIONS', 'view-ob-2', 'large'); updateCprUI();
        });

        addClick('btn-start-child', (e) => { e.stopPropagation(); Utils.vibrate(40); if (sKg && parseInt(sKg.value) === 4) sync('kg'); const m = document.getElementById('patient-setup-modal'); if(m) m.classList.replace('hidden', 'flex'); });

        addClick('btn-start-pediatric', () => {
            if (AudioEngine && typeof AudioEngine.init === 'function') AudioEngine.init();
            Utils.vibrate(40); AppState.isPediatric = true; AppState.patientWeight = parseFloat(sKg.value); AppState.cprMode = '15:2'; AppState.compressionCount = 0; AppState.isRunning = true; AppState.isCompressing = true;
            document.getElementById('patient-setup-modal')?.classList.replace('flex', 'hidden');
            if(UI && typeof UI.updatePediatricUI === 'function') UI.updatePediatricUI(); if(UI && typeof UI.updateCprModeUI === 'function') UI.updateCprModeUI(); if(UI && typeof UI.recalcMeds === 'function') UI.recalcMeds(); 
            startMainTimer(); requestWakeLock(); addLogEntry(`Start REA Kind (${AppState.patientWeight}kg)`); navHelper('OB_INITIAL_BREATHS', 'view-initial-breaths', 'large'); updateCprUI(); Utils.saveSession();
        });

        addClick('btn-start-pediatric-unknown', () => {
            if (AudioEngine && typeof AudioEngine.init === 'function') AudioEngine.init();
            Utils.vibrate(40); AppState.isPediatric = true; AppState.patientWeight = null; AppState.cprMode = '15:2'; AppState.compressionCount = 0; AppState.isRunning = true; AppState.isCompressing = true;
            document.getElementById('patient-setup-modal')?.classList.replace('flex', 'hidden');
            if(UI && typeof UI.updatePediatricUI === 'function') UI.updatePediatricUI(); if(UI && typeof UI.updateCprModeUI === 'function') UI.updateCprModeUI(); if(UI && typeof UI.recalcMeds === 'function') UI.recalcMeds(); 
            startMainTimer(); requestWakeLock(); addLogEntry("Start REA Kind (Gewicht unbekannt)"); navHelper('OB_INITIAL_BREATHS', 'view-initial-breaths', 'large'); updateCprUI(); Utils.saveSession();
        });
    }

    function initCPREvents() {
        addClick('btn-breaths-done', (e) => { e.stopPropagation(); Utils.vibrate(40); addLogEntry("5 initiale Beatmungen durchgeführt"); navHelper('OB_COMPRESSIONS', 'view-ob-2', 'large'); });
        addClick('btn-breaths-skipped', (e) => { e.stopPropagation(); Utils.vibrate([30, 50]); addLogEntry("5 initiale Beatmungen übersprungen"); navHelper('OB_COMPRESSIONS', 'view-ob-2', 'large'); });

        addClick('main-btn-area', (e) => {
            if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
            if (Date.now() - (Globals.lastMenuAction || 0) < 500) return;
            
            if (AppState.state === 'OB_COMPRESSIONS') { 
                Utils.vibrate(50); navHelper('OB_ANALYZE', 'view-ob-3', 'large'); 
            } else if (AppState.state === 'OB_ANALYZE') { 
                Utils.vibrate(50); navHelper('DECISION', 'view-decision', 'large'); 
            } else if (AppState.state === 'WAITING_CPR_RESUME') {
                Utils.vibrate([40, 40]);
                AppState.isCompressing = true;
                addLogEntry("Kompression FORTGESETZT");
                activateDashboard(true);
                updateCprUI();
                Utils.saveSession();
            } else if (AppState.state === 'RUNNING') {
                Utils.vibrate([30, 50]); 
                AppState.isCompressing = false; 
                
                // 🌟 LOGBOOK FIX: Bewusstes Auslösen des roten Zeitbalkens
                addLogEntry("Rhythmusanalyse (Kompression PAUSE)"); 
                
                navHelper('DECISION', 'view-decision', 'large'); 
                if (CPR.CPRTimer && typeof CPR.CPRTimer.pause === 'function') CPR.CPRTimer.pause(); 
                updateCprUI(); 
            }
        });

        addClick('btn-decision-cancel', (e) => {
            e.stopPropagation(); Utils.vibrate(30); markMenuAction();
            if (AppState.previousState === 'RUNNING') { navHelper('RUNNING', 'view-timer', 'small'); if (CPR.CPRTimer && typeof CPR.CPRTimer.start === 'function') CPR.CPRTimer.start(true); updateCprUI(); } 
            else { navHelper('OB_ANALYZE', 'view-ob-3', 'large'); }
        });

        addClick('btn-shockable', (e) => { 
            e.stopPropagation(); Utils.vibrate(40); AppState.isShockable = true; 
            if (UI && typeof UI.updateSmartMedsButton === 'function') UI.updateSmartMedsButton();
            addLogEntry("Schockbar"); navHelper('JOULE', 'view-joule', 'large'); 
        });
        
        addClick('btn-non-shockable', (e) => { 
            e.stopPropagation(); Utils.vibrate(40); AppState.isShockable = false; 
            if (UI && typeof UI.updateSmartMedsButton === 'function') UI.updateSmartMedsButton();
            addLogEntry("Nicht Schockbar"); navHelper('WAITING_CPR_RESUME', 'view-cpr-resume', 'large'); 
        });
        
        addClick('view-joule', (e) => {
            const jBtn = e.target.closest('.btn-joule');
            if (jBtn) { 
                e.stopPropagation(); AppState.shockCount = (AppState.shockCount || 0) + 1; 
                const sL = document.getElementById('rhythm-info-shocks'); if(sL) sL.innerText = AppState.shockCount;
                const jL = document.getElementById('rhythm-info-joule'); if(jL) jL.innerText = jBtn.dataset.joule;
                addLogEntry(`Schock abgegeben: ${jBtn.dataset.joule}`); navHelper('WAITING_CPR_RESUME', 'view-cpr-resume', 'large'); 
            }
            if (e.target.id === 'btn-joule-cancel') { e.stopPropagation(); markMenuAction(); navHelper('DECISION', 'view-decision', 'large'); }
        });

        addClick('btn-confirm-resume', (e) => { 
            e.stopPropagation(); Utils.vibrate([40, 40]); AppState.isCompressing = true; addLogEntry("Kompression FORTGESETZT"); activateDashboard(true); updateCprUI(); Utils.saveSession(); 
        });

        addClick('btn-cpr', (e) => { 
            e.stopPropagation(); if (AppState.state === 'IDLE' || AppState.state === 'END') return; 
            if (AppState.state === 'WAITING_CPR_RESUME') { Utils.vibrate([40, 40]); AppState.isCompressing = true; addLogEntry("Kompression FORTGESETZT"); activateDashboard(true); updateCprUI(); Utils.saveSession(); return; }
            AppState.isCompressing = !AppState.isCompressing; AppState.compressionCount = 0; addLogEntry(AppState.isCompressing ? "Kompression FORTGESETZT" : "Kompression PAUSE"); updateCprUI(); Utils.saveSession(); 
        });
    }

    function initMenuEvents() {
        addClick('btn-adrenalin', (e) => {
            e.stopPropagation(); 
            markMenuAction(); 
            try {
                const st = window.CPR.AppState.state || ''; 
                if (st === 'IDLE') return; 
                if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(50); 
                const btn = e.target.closest('#btn-adrenalin') || document.getElementById('btn-adrenalin');
                const dose = btn ? btn.dataset.dose : '1 mg'; 
                window.addLogEntry(`Adrenalin (${dose}) gegeben`); 
                window.CPR.AppState.adrCount = (window.CPR.AppState.adrCount || 0) + 1; 
                if (window.CPR.UI && typeof window.CPR.UI.updateAdrenalinBadge === 'function') {
                    window.CPR.UI.updateAdrenalinBadge();
                }
                if (window.CPR.AdrTimer && typeof window.CPR.AdrTimer.start === 'function') {
                    window.CPR.AdrTimer.start(); 
                }
                if (window.CPR.Utils && typeof window.CPR.Utils.saveSession === 'function') {
                    window.CPR.Utils.saveSession();
                }
            } catch(err) {
                console.error("[CPR] Adrenalin Button Fehler:", err);
            }
        });

        addClick('btn-meds-menu', (e) => {
            e.stopPropagation(); markMenuAction();
            const btn = e.currentTarget;
            if (btn.dataset.smartMode === "amio") {
                Utils.vibrate(50);
                const doseStr = btn.dataset.amioDose || "Amiodaron";
                AppState.amioCount = (AppState.amioCount || 0) + 1;
                addLogEntry(`Amiodaron ${doseStr} gegeben`);
                if (UI && typeof UI.updateSmartMedsButton === 'function') UI.updateSmartMedsButton();
                Utils.saveSession();
            } else {
                navHelper('MEDS_MENU', 'view-meds-menu', 'large');
            }
        });

        addClick('view-meds-menu', (e) => {
            const isCancel = e.target.closest('#btn-meds-cancel'); 
            const isOpt = e.target.closest('.btn-amio-opt') || e.target.closest('.btn-sonstige-opt');
            
            if (isCancel || isOpt) {
                e.stopPropagation(); Utils.vibrate(30); markMenuAction();
                if (isOpt) { 
                    const logText = isOpt.dataset.log || isOpt.innerText.replace('\n', ' ').trim(); 
                    addLogEntry(`${logText} gegeben`); 
                    if (logText.includes('Amiodaron') || logText.includes('Amio')) {
                        AppState.amioCount = (AppState.amioCount || 0) + 1;
                        if (UI && typeof UI.updateSmartMedsButton === 'function') UI.updateSmartMedsButton();
                    }
                }
                navHelper(AppState.previousState === 'RUNNING' ? 'RUNNING' : 'DECISION', AppState.previousState === 'RUNNING' ? 'view-timer' : 'view-decision', AppState.previousState === 'RUNNING' ? 'small' : 'large');
            }
        });

        addClick('btn-airway', (e) => { e.stopPropagation(); navHelper('AIRWAY_MENU', 'view-airway', 'large'); });
        addClick('view-airway', (e) => {
            const isCancel = e.target.closest('#btn-airway-cancel'); const isRemove = e.target.closest('#btn-airway-remove'); const isEdit = e.target.closest('#btn-airway-edit-doc'); const isOpt = e.target.closest('.btn-airway-opt');
            if (isOpt) {
                e.stopPropagation(); Globals.tempAirwayType = isOpt.dataset.short; const docAwType = document.getElementById('doc-airway-type'); if (docAwType) docAwType.innerText = Globals.tempAirwayType;
                if (UI && typeof UI.switchView === 'function') UI.switchView('view-airway-doc');
            } else if (isCancel || isRemove) {
                e.stopPropagation(); Utils.vibrate(30); markMenuAction(); 
                if (isRemove) {
                    addLogEntry("Atemweg entfernt"); const awLabel = document.getElementById('airway-label'); if (awLabel) awLabel.innerText = 'Atemweg';
                    AppState.airwayEstablished = false; AppState.compressionCount = 0;
                    if (AppState.cprMode === 'continuous') { AppState.cprMode = AppState.isPediatric ? '15:2' : '30:2'; addLogEntry(`Modus: ${AppState.cprMode} (Auto-Switch)`); if(UI && typeof UI.updateCprModeUI === 'function') UI.updateCprModeUI(); }
                    document.getElementById('btn-airway-remove')?.classList.add('hidden'); document.getElementById('btn-airway-edit-doc')?.classList.add('hidden'); updateCprUI();
                }
                navHelper(AppState.previousState === 'RUNNING' ? 'RUNNING' : 'DECISION', AppState.previousState === 'RUNNING' ? 'view-timer' : 'view-decision', AppState.previousState === 'RUNNING' ? 'small' : 'large');
            } else if (isEdit) {
                e.stopPropagation(); Utils.vibrate(30); const awLab = document.getElementById('airway-label'); Globals.tempAirwayType = awLab ? awLab.innerText : 'Atemweg';
                const docAwType = document.getElementById('doc-airway-type'); if (docAwType) docAwType.innerText = Globals.tempAirwayType;
                if (UI && typeof UI.switchView === 'function') UI.switchView('view-airway-doc');
            }
        });
        
        addClick('btn-airway-doc-cancel', (e) => { e.stopPropagation(); Utils.vibrate(30); if (UI && typeof UI.switchView === 'function') UI.switchView('view-airway'); });
        addClick('btn-airway-doc-save', (e) => {
            e.stopPropagation(); Utils.vibrate(30); markMenuAction();
            const aws = document.getElementById('aw-size'); const size = aws ? aws.value : '?'; const awd = document.getElementById('aw-depth'); const depth = awd ? awd.value : '?'; const awc = document.getElementById('aw-cuff'); const cuff = awc ? awc.value : '25';
            let actionStr = `Atemweg: ${Globals.tempAirwayType} (Gr. ${size}`; if (Globals.tempAirwayType === 'ETI' || Globals.tempAirwayType === 'LTS') actionStr += `, ${depth}cm`; actionStr += `, Cuff ${cuff}mbar)`;
            addLogEntry(actionStr); const awLabel = document.getElementById('airway-label'); if(awLabel) awLabel.innerText = Globals.tempAirwayType;
            document.getElementById('btn-airway-remove')?.classList.remove('hidden'); document.getElementById('btn-airway-edit-doc')?.classList.remove('hidden');
            AppState.airwayEstablished = true; AppState.compressionCount = 0;
            if (AppState.cprMode !== 'continuous') { AppState.cprMode = 'continuous'; addLogEntry("Modus: continuous (Auto-Switch durch Atemweg)"); if(UI && typeof UI.updateCprModeUI === 'function') UI.updateCprModeUI(); }
            navHelper(AppState.previousState === 'RUNNING' ? 'RUNNING' : 'DECISION', AppState.previousState === 'RUNNING' ? 'view-timer' : 'view-decision', AppState.previousState === 'RUNNING' ? 'small' : 'large');
            if (AppState.state === 'RUNNING' && CPR.CPRTimer && typeof CPR.CPRTimer.start === 'function') CPR.CPRTimer.start(true); updateCprUI();
        });

        addClick('btn-zugang-menu', (e) => { e.stopPropagation(); navHelper('ZUGANG_MENU', 'view-zugang', 'large'); });
        addClick('btn-zugang-cancel', (e) => { e.stopPropagation(); markMenuAction(); navHelper(AppState.previousState === 'RUNNING' ? 'RUNNING' : 'DECISION', AppState.previousState === 'RUNNING' ? 'view-timer' : 'view-decision', AppState.previousState === 'RUNNING' ? 'small' : 'large'); });
        const zTyp = document.getElementById('zugang-typ');
        if(zTyp) { zTyp.addEventListener('change', function(e) { const isIO = e.target.value === 'i.o.'; const groesse = document.getElementById('zugang-groesse'); const ort = document.getElementById('zugang-ort'); if (isIO) { if (groesse) groesse.value = AppState.isPediatric ? 'EZ-IO Pink' : 'EZ-IO Blau'; if (ort) ort.value = 'Tibia prox.'; } else { if (groesse) groesse.value = 'Grün (18G)'; if (ort) ort.value = 'Handrücken'; } }); }
        addClick('btn-zugang-save', (e) => {
            e.stopPropagation(); markMenuAction(); const typ = document.getElementById('zugang-typ')?.value || ''; const groesse = document.getElementById('zugang-groesse')?.value || ''; const ort = document.getElementById('zugang-ort')?.value || '';
            addLogEntry(`Zugang: ${typ} ${groesse} (${ort})`); navHelper(AppState.previousState === 'RUNNING' ? 'RUNNING' : 'DECISION', AppState.previousState === 'RUNNING' ? 'view-timer' : 'view-decision', AppState.previousState === 'RUNNING' ? 'small' : 'large');
        });

        addClick('btn-opt-abbruch', (e) => { e.stopPropagation(); Utils.vibrate(30); navHelper('ABBRUCH_MENU', 'view-abbruch-reason', 'large'); });
        addClick('btn-abbruch-cancel', (e) => { e.stopPropagation(); Utils.vibrate(30); markMenuAction(); navHelper('ROSC_MENU', 'view-rosc-end', 'large'); });
        addClick('btn-rosc-end', (e) => { e.stopPropagation(); navHelper('ROSC_MENU', 'view-rosc-end', 'large'); });
        addClick('btn-rosc-cancel', (e) => { e.stopPropagation(); markMenuAction(); navHelper(AppState.previousState === 'RUNNING' ? 'RUNNING' : 'DECISION', AppState.previousState === 'RUNNING' ? 'view-timer' : 'view-decision', AppState.previousState === 'RUNNING' ? 'small' : 'large'); });
        
        addClick('btn-opt-rosc', (e) => {
            e.stopPropagation(); markMenuAction(); 
            if (window.addLogEntry) {
                const m = Math.floor((window.CPR.AppState.totalSeconds || 0) / 60);
                const s = (window.CPR.AppState.totalSeconds || 0) % 60;
                window.addLogEntry(`ROSC eingetreten nach ${m} Min ${s} Sek`);
            }
            AppState.state = 'ROSC_ACTIVE'; Utils.saveSession(); AppState.isCompressing = false;
            if (Globals.pauseInterval) { clearInterval(Globals.pauseInterval); Globals.pauseInterval = null; }
            if (CPR.CPRTimer && typeof CPR.CPRTimer.pause === 'function') CPR.CPRTimer.pause(); 
            document.getElementById('main-btn-area')?.classList.remove('timer-ended'); 
            document.getElementById('cpr-interface')?.classList.add('hidden'); 
            document.getElementById('rosc-interface')?.classList.remove('hidden'); 
            
            showTopStats(); // 🌟 FIX: Garantiert die Einblendung der Top-Stats
            
            document.getElementById('stat-ccf')?.classList.add('hidden'); 
            document.getElementById('stat-rosc')?.classList.remove('hidden');
            updatePediRoscVitals(); startRoscTimer();
        });
        
        addClick('btn-rearrest', (e) => {
            e.stopPropagation(); Utils.vibrate([50, 50, 50]); markMenuAction(); addLogEntry("RE-ARREST! CPR fortgesetzt.");
            if (Globals.roscInterval) { clearInterval(Globals.roscInterval); Globals.roscInterval = null; }
            document.getElementById('rosc-interface')?.classList.add('hidden'); 
            document.getElementById('cpr-interface')?.classList.remove('hidden'); 
            
            showTopStats(); // 🌟 FIX: Garantiert die Einblendung der Top-Stats
            
            document.getElementById('stat-rosc')?.classList.add('hidden'); 
            document.getElementById('stat-ccf')?.classList.remove('hidden');
            activateDashboard(); updateCprUI();
        });

        addClick('btn-rosc-exit', (e) => { e.stopPropagation(); triggerDebrief('Einsatz offiziell beendet'); });
        addClick('btn-reason-team', (e) => { e.stopPropagation(); triggerDebrief('Abbruch: Teamentscheidung'); });
        addClick('btn-reason-family', (e) => { e.stopPropagation(); triggerDebrief('Abbruch: Angehörige'); });
        addClick('btn-reason-doc', (e) => { e.stopPropagation(); triggerDebrief('Abbruch: Patientenverfügung'); });

        addClick('btn-toggle-mode', (e) => {
            e.stopPropagation(); Utils.vibrate(30); const st = AppState.state || 'IDLE'; if (st === 'IDLE' || st === 'END' || st === 'ROSC_ACTIVE') return;
            if (AppState.cprMode === 'continuous') AppState.cprMode = AppState.isPediatric ? '15:2' : '30:2'; 
            else if (AppState.cprMode === '30:2' || AppState.cprMode === '15:2') AppState.cprMode = 'continuous'; 
            if(UI && typeof UI.updateCprModeUI === 'function') UI.updateCprModeUI(); addLogEntry(`Modus manuell gewechselt: ${AppState.cprMode}`); updateCprUI();
        });
    }

    // 🌟 CLEANUP: App.js feuert nur noch Befehle. Die Tab-Klicks werden von log-timeline.js verwaltet!
    function initProtocolEvents() {
        addClick('btn-undo-log', (e) => { 
            e.stopPropagation(); 
            Utils.vibrate(20); 
            if (AppState.protocolData && AppState.protocolData.length > 0) { 
                AppState.protocolData.pop(); 
                Utils.saveSession(); 
                if (window.CPR.LogTimeline && typeof window.CPR.LogTimeline.forceRender === 'function') window.CPR.LogTimeline.forceRender();
            } else { 
                Utils.showDialog('alert', 'Info', 'Das Protokoll ist bereits leer.'); 
            } 
        });
        addClick('btn-export-log', (e) => { e.stopPropagation(); document.getElementById('export-modal')?.classList.replace('hidden', 'flex'); });
        addClick('btn-cancel-export', (e) => { e.stopPropagation(); document.getElementById('export-modal')?.classList.replace('flex', 'hidden'); });
    }

    function initPanelEvents() {
        addClick('btn-toggle-protocol', (e) => { 
            e.stopPropagation(); 
            const panel = document.getElementById('protocol-panel');
            if (panel) {
                panel.classList.toggle('translate-y-full'); 
                // Wenn das Panel hochfährt, zwingen wir LogTimeline zum Zeichnen der aktuellen Daten!
                if (!panel.classList.contains('translate-y-full')) {
                    if (window.CPR.LogTimeline && typeof window.CPR.LogTimeline.forceRender === 'function') window.CPR.LogTimeline.forceRender();
                }
            }
        });
        addClick('btn-close-log', (e) => { e.stopPropagation(); document.getElementById('protocol-panel')?.classList.add('translate-y-full'); });
        
        addClick('btn-toggle-hits', (e) => { e.stopPropagation(); document.getElementById('hits-panel')?.classList.toggle('translate-y-full'); });
        addClick('btn-close-hits', (e) => { e.stopPropagation(); document.getElementById('hits-panel')?.classList.add('translate-y-full'); });

        // Tab-Switcher für das HITS-Menü bleibt unangetastet
        addClick('btn-tab-hits', (e) => { e.stopPropagation(); e.target.classList.replace('text-slate-500', 'text-slate-800'); e.target.classList.add('bg-white', 'shadow-sm'); const tAna = document.getElementById('btn-tab-anamnese'); if(tAna) { tAna.classList.replace('text-slate-800', 'text-slate-500'); tAna.classList.remove('bg-white', 'shadow-sm'); } const vHits = document.getElementById('view-hits'); if(vHits) vHits.classList.replace('hidden', 'flex'); const vAna = document.getElementById('view-anamnese'); if(vAna) vAna.classList.replace('flex', 'hidden'); });
        addClick('btn-tab-anamnese', (e) => { e.stopPropagation(); e.target.classList.replace('text-slate-500', 'text-slate-800'); e.target.classList.add('bg-white', 'shadow-sm'); const tHits = document.getElementById('btn-tab-hits'); if(tHits) { tHits.classList.replace('text-slate-800', 'text-slate-500'); tHits.classList.remove('bg-white', 'shadow-sm'); } const vAna = document.getElementById('view-anamnese'); if(vAna) vAna.classList.replace('hidden', 'flex'); const vHits = document.getElementById('view-hits'); if(vHits) vHits.classList.replace('flex', 'hidden'); });
    }

    function loadSession() {
        const saved = Utils.safeGetItem('cpr_assist_session'); if (!saved) return false;
        try {
            const session = JSON.parse(saved); 
            const passedSeconds = Math.floor((Date.now() - session.lastSavedTimestamp) / 1000);
            if (passedSeconds > 7200) { Utils.sysLog("Session Timeout (> 2h). Starte neuen Einsatz."); Utils.safeRemoveItem('cpr_assist_session'); return false; }
            
            Object.assign(AppState, session); 
            AppState.state = session.state || 'IDLE'; 
            AppState.previousState = session.previousState || 'IDLE';
            
            if (!AppState.bpm) AppState.bpm = CONFIG?.BPM_DEFAULT || 110;
            if (!AppState.anamneseData) AppState.anamneseData = { beobachtet: null, laienrea: null, brustschmerz: null, therapie: null, sampler: { s: '', a: '', m: '', p: '', l: '', e: '', r: '', 'plus-s': '' } };
            if (!AppState.protocolData) AppState.protocolData = [];
            
            // 🌟 TIME TRAVEL FIX: Lückenloses Aufrechnen der Sekunden 🌟
            if (AppState.isRunning !== false) { 
                AppState.totalSeconds += passedSeconds; 
                
                if (AppState.state !== 'ROSC_ACTIVE') {
                    AppState.arrestSeconds += passedSeconds; 
                    
                    // CCF-Fix: Wenn CPR lief, füllen wir die Lücke nahtlos auf!
                    if (session.isCompressing) {
                        AppState.compressingSeconds = (AppState.compressingSeconds || 0) + passedSeconds;
                    } else if (session.isVentilationPhase) {
                        AppState.ventilationSeconds = (AppState.ventilationSeconds || 0) + passedSeconds;
                    }
                }
                
                let currentCprSec = Number(AppState.cycleSeconds) || 0;
                AppState.cycleSeconds = Math.min(120, currentCprSec + passedSeconds); 
                let currentAdrSec = Number(AppState.adrSeconds) || 0;
                AppState.adrSeconds = Math.min(240, currentAdrSec + passedSeconds); 
            }
            // 🌟 Der alte, harte Stopp (AppState.isCompressing = false) wurde HIER eliminiert!
            
            if (session.isSoundActive !== undefined) { 
                const ion = document.getElementById('icon-sound-on'); if (ion) ion.classList.toggle('hidden', !AppState.isSoundActive); 
                const ioff = document.getElementById('icon-sound-off'); if (ioff) ioff.classList.toggle('hidden', AppState.isSoundActive); 
            }
            
            if (UI && typeof UI.updatePediatricUI === 'function') UI.updatePediatricUI(); 
            if (UI && typeof UI.updateBpmUI === 'function') UI.updateBpmUI();
            
            const startEl = document.getElementById('start-time'); if (startEl) startEl.innerText = session.startTime || '--:--';
            const awLabel = document.getElementById('airway-label'); if (awLabel) awLabel.innerText = session.airwayLabel || "Atemweg";
            const zugLabel = document.getElementById('zugang-label'); if (zugLabel) zugLabel.innerText = session.zugangLabel || "Zugang";
            
            if (AppState.airwayEstablished) { document.getElementById('btn-airway-remove')?.classList.remove('hidden'); document.getElementById('btn-airway-edit-doc')?.classList.remove('hidden'); }
            if (UI && typeof UI.recalcMeds === 'function') UI.recalcMeds(); 
            updateCCF(); 
            if (UI && typeof UI.updateCprModeUI === 'function') UI.updateCprModeUI(); 
            if (UI && typeof UI.updateAdrenalinBadge === 'function') UI.updateAdrenalinBadge();
            if (UI && typeof UI.updateSmartMedsButton === 'function') UI.updateSmartMedsButton();

            if (AppState.shockCount) {
                const shockLabel = document.getElementById('rhythm-info-shocks');
                if(shockLabel) shockLabel.innerText = AppState.shockCount;
            }

            if (AppState.state === 'END' || AppState.state === 'ROSC_ACTIVE') {
                if (AppState.state === 'ROSC_ACTIVE') {
                    document.getElementById('cpr-interface')?.classList.add('hidden'); 
                    document.getElementById('rosc-interface')?.classList.remove('hidden'); 
                    
                    showTopStats(); // 🌟 FIX: Garantiert die Einblendung der Top-Stats
                    
                    document.getElementById('stat-ccf')?.classList.add('hidden'); 
                    document.getElementById('stat-rosc')?.classList.remove('hidden');
                    updatePediRoscVitals(); 
                    if (AppState.isRunning !== false) { startMainTimer(); startRoscTimer(); } 
                    requestWakeLock();
                } else { 
                    showTopStats(); // 🌟 FIX: Garantiert die Einblendung der Top-Stats
                    
                    navHelper(null, 'view-timer', 'small'); 
                    if(AppState.isRunning === false) { document.getElementById('debriefing-modal')?.classList.replace('hidden', 'flex'); } 
                }
            } else if (AppState.state !== 'IDLE' && AppState.state.indexOf('OB_') !== 0) {
                document.body.classList.add('dashboard-active');
                
                showTopStats(); // 🌟 FIX: Garantiert die Einblendung der Top-Stats
                
                document.getElementById('satellites')?.classList.remove('hidden');
                ['btn-airway', 'btn-cpr'].forEach(id => { document.getElementById(id)?.classList.remove('opacity-0', 'pointer-events-none'); });
                
                // 🌟 FIX: CSS Layout Eclipse - Entfernt hartcodierte Opacity-0 Klassen von den Satelliten 🌟
                document.querySelectorAll('.satellite-btn').forEach(b => b.classList.remove('opacity-0', 'pointer-events-none'));
                
                if (AppState.state === 'WAITING_CPR_RESUME') {
                    navHelper(null, 'view-cpr-resume', 'large');
                } else if (AppState.state !== 'RUNNING') { 
                    navHelper(null, AppState.state === 'JOULE' ? 'view-joule' : 'view-decision', 'large'); 
                } else { 
                    navHelper(null, 'view-timer', 'small'); 
                }

                if (AppState.isRunning !== false) { 
                    startMainTimer(); 
                    if (AppState.state === 'RUNNING' && CPR.CPRTimer && typeof CPR.CPRTimer.start === 'function') {
                        CPR.CPRTimer.start(); 
                    } else if (CPR.CPRTimer && typeof CPR.CPRTimer.updateUI === 'function') {
                        CPR.CPRTimer.updateUI();
                    }
                } else { 
                    if(CPR.CPRTimer && typeof CPR.CPRTimer.updateUI === 'function') CPR.CPRTimer.updateUI(); 
                    document.getElementById('debriefing-modal')?.classList.replace('hidden', 'flex'); 
                }
                updateCprUI(); requestWakeLock();
                if (AppState.adrSeconds > 0 && CPR.AdrTimer && typeof CPR.AdrTimer.start === 'function') CPR.AdrTimer.start(true); 
                
                // 🌟 CLEANUP: Veraltete CSS Race-Condition Delays entfernt
                if (window.CPR.MedsButton && typeof window.CPR.MedsButton.init === 'function') {
                    window.CPR.MedsButton.init();
                }
            }

            // Sicherstellen, dass das Protokoll nach dem Laden der Session sofort gerendert wird
            if (window.CPR.LogTimeline && typeof window.CPR.LogTimeline.forceRender === 'function') window.CPR.LogTimeline.forceRender();
            Utils.sysLog("Session loaded successfully."); 
            return true;
        } catch (e) { 
            Utils.sysLog("Session load fail: " + e.message); 
            Utils.safeRemoveItem('cpr_assist_session'); 
            return false; 
        }
    }

    try { initHeaderEvents(); } catch(e) { Utils.sysLog("Error Init Header: " + e.message); }
    try { initPatientSetupEvents(); } catch(e) { Utils.sysLog("Error Init Patient: " + e.message); }
    try { initCPREvents(); } catch(e) { Utils.sysLog("Error Init CPR: " + e.message); }
    try { initMenuEvents(); } catch(e) { Utils.sysLog("Error Init Menus: " + e.message); }
    try { initProtocolEvents(); } catch(e) { Utils.sysLog("Error Init Protocol: " + e.message); }
    try { initPanelEvents(); } catch(e) { Utils.sysLog("Error Init Panels: " + e.message); }
    
    window.CPR.startMainTimer = startMainTimer;
    window.CPR.updateCprUI = updateCprUI;
    window.CPR.startRoscTimer = startRoscTimer;

    if (UI && typeof UI.switchView === 'function') { UI.switchView('view-ob-1'); }
    if (UI && typeof UI.setCenterSize === 'function') { UI.setCenterSize('large'); }

    setTimeout(() => {
        if (loadSession()) {
            const st = AppState.state || 'IDLE'; 
            // Nach dem Laden prüfen, ob wir im Timer sind -> Kreis klein machen!
            if (st !== 'IDLE' && st.indexOf('OB_') !== 0) {
                if (st === 'RUNNING') {
                    if (UI && typeof UI.updateOrbitGeometry === 'function') UI.updateOrbitGeometry('small');
                    navHelper(null, null, 'small');
                } else {
                    navHelper(null, null, 'large');
                }
            }
        }
    }, 100);
});

// =========================================================================
// UI/UX DEBUG MODUS (Fadenkreuz & Injection-Logik) - 100% AUTARK
// =========================================================================
(function() {
    let isDebugActive = false;

    const canvas = document.createElement('canvas');
    canvas.id = 'debug-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '999999';
    canvas.style.pointerEvents = 'none'; 
    canvas.style.display = 'none'; 
    document.body.appendChild(canvas);

    function drawGrid() {
        if (!isDebugActive) return;
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const topStats = document.getElementById('top-stats-container');
        const header = document.querySelector('header');
        
        // 🌟 DEBUG-GRID FIX: Der topStats Container reserviert immer Platz,
        // daher ist seine Bottom-Kante jetzt der ewige Ankerpunkt der App!
        let topY = header ? header.getBoundingClientRect().bottom : 0;
        if (topStats) {
            topY = topStats.getBoundingClientRect().bottom;
        }

        const bottomY = window.innerHeight;
        const originY = topY + ((bottomY - topY) / 2); 
        const originX = window.innerWidth / 2; 

        ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)';
        ctx.fillStyle = 'rgba(255, 0, 255, 0.9)';
        ctx.font = 'bold 10px monospace';
        ctx.lineWidth = 1.5;

        ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(canvas.width, originY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, canvas.height); ctx.stroke();

        const step = 10;
        for(let x = originX; x < canvas.width; x += step) {
            ctx.beginPath(); ctx.moveTo(x, originY - 4); ctx.lineTo(x, originY + 4); ctx.stroke();
            if((x - originX) % 50 === 0 && x !== originX) ctx.fillText(`+${Math.round(x - originX)}`, x + 2, originY - 8);
        }
        for(let x = originX; x > 0; x -= step) {
            ctx.beginPath(); ctx.moveTo(x, originY - 4); ctx.lineTo(x, originY + 4); ctx.stroke();
            if((originX - x) % 50 === 0 && x !== originX) ctx.fillText(`-${Math.round(originX - x)}`, x - 25, originY - 8);
        }
        for(let y = originY; y < canvas.height; y += step) {
            ctx.beginPath(); ctx.moveTo(originX - 4, y); ctx.lineTo(originX + 4, y); ctx.stroke();
            if((y - originY) % 50 === 0 && y !== originY) ctx.fillText(`+${Math.round(y - originY)}`, originX + 8, y + 4);
        }
        for(let y = originY; y > 0; y -= step) {
            ctx.beginPath(); ctx.moveTo(originX - 4, y); ctx.lineTo(originX + 4, y); ctx.stroke();
            if((originY - y) % 50 === 0 && y !== originY) ctx.fillText(`-${Math.round(originY - y)}`, originX + 8, y + 4);
        }
        
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillText("0,0", originX + 8, originY - 8);
    }

    window.addEventListener('resize', drawGrid);
    setInterval(drawGrid, 500);

    setTimeout(() => {
        const resetBtn = document.getElementById('btn-hard-reset');
        if (resetBtn) {
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'btn-toggle-debug';
            toggleBtn.className = 'w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm border border-slate-300 active:scale-95 flex items-center justify-center gap-2 mb-4 transition-all';
            toggleBtn.innerHTML = '<i class="fa-solid fa-ruler-combined text-lg"></i> Layout Grid (An / Aus)';
            
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                if(window.CPR && window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(20);
                
                isDebugActive = !isDebugActive;
                
                if (isDebugActive) {
                    canvas.style.display = 'block';
                    document.body.classList.add('debug-mode'); 
                    toggleBtn.classList.replace('bg-slate-100', 'bg-indigo-100');
                    toggleBtn.classList.replace('text-slate-700', 'text-indigo-700');
                    toggleBtn.classList.replace('border-slate-300', 'border-indigo-300');
                    drawGrid();
                } else {
                    canvas.style.display = 'none';
                    document.body.classList.remove('debug-mode'); 
                    toggleBtn.classList.replace('bg-indigo-100', 'bg-slate-100');
                    toggleBtn.classList.replace('text-indigo-700', 'text-slate-700');
                    toggleBtn.classList.replace('border-indigo-300', 'border-slate-300');
                }
            });

            resetBtn.parentNode.insertBefore(toggleBtn, resetBtn);
        }
    }, 1500); 
})();
