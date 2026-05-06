/**
 * CPR Assist - Master Controller (Medical Grade Background-Safe)
 * - FEATURE: Natives "Beutel-Maske" Routing integriert.
 * - UX/LOGIC: BVM überspringt Doku-Menü, erzwingt 30:2/15:2 und blendet den Edit-Stift aus.
 * - PING-PONG: Das dynamische Zusammenspiel zwischen CPR und Beatmung ist aktiv!
 * - SMART PROMPT (VISUAL HAMMER): Atemwegs-Button zeigt nun aktiv "DOKU FEHLT" an!
 * - BUGFIX: Redundanter Aufruf von UI.updateSatellites() entfernt (CSS regelt das!).
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
            vt.className = "hidden flex-col items-center justify-center w-full h-full text-center relative pointer-events-none rounded-full";
            vt.innerHTML = `
                <div class="absolute top-[50px] w-full flex justify-center">
                    <span id="timer-top-text" class="text-[12px] font-black text-slate-500 uppercase tracking-widest transition-colors duration-300 pointer-events-none drop-shadow-sm">Zyklus</span>
                </div>
                <div class="absolute top-[85px] w-full flex justify-center pointer-events-none">
                    <div id="cycle-timer" class="text-[64px] font-mono font-black text-slate-800 tracking-tighter leading-none transition-colors duration-300 drop-shadow-sm" style="line-height: 0.85;">02:00</div>
                </div>
                <div class="absolute top-[155px] w-full flex justify-center z-10 pointer-events-auto">
                    <button id="btn-analyze" class="w-[85%] max-w-[300px] bg-white border border-slate-200 text-slate-700 py-3.5 rounded-full font-black uppercase tracking-[0.15em] text-[15px] shadow-[0_8px_25px_rgba(0,0,0,0.05)] active:scale-95 transition-all duration-300 opacity-50 flex items-center justify-center gap-3">
                        <i class="fa-solid fa-heart-pulse text-2xl text-slate-400 pointer-events-none transition-colors"></i> 
                        <span class="pointer-events-none transition-colors">Rhythmus Check</span>
                    </button>
                </div>
                
                <div id="inner-prepare-alert" class="hidden absolute bottom-[50px] left-1/2 -translate-x-1/2 w-[85%] items-center justify-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl shadow-sm text-amber-700 animate-pulse transition-all">
                    <i class="fa-solid fa-bolt text-amber-500"></i>
                    <span class="text-[10px] font-black uppercase tracking-wider leading-tight text-center">Defi Bereit<br>machen!</span>
                </div>
                <div id="inner-precharge-alert" class="hidden absolute bottom-[50px] left-1/2 -translate-x-1/2 w-[85%] items-center justify-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl shadow-sm text-amber-700 animate-pulse transition-all">
                    <i class="fa-solid fa-bolt text-amber-500"></i>
                    <span class="text-[10px] font-black uppercase tracking-wider leading-tight text-center">Jetzt Vorladen<br>(Pre-Charge)</span>
                </div>
                <div id="inner-analyze-alert" class="hidden absolute bottom-[50px] left-1/2 -translate-x-1/2 w-[85%] items-center justify-center gap-2 bg-[#E3000F] border border-red-500 px-4 py-2 rounded-xl shadow-sm text-white animate-pulse transition-all">
                    <i class="fa-solid fa-heart-pulse text-white"></i>
                    <span class="text-[10px] font-black uppercase tracking-wider leading-tight text-center">Pause für<br>Analyse!</span>
                </div>
            `;
        }
    }
    remodelViewTimer();

    // =========================================================
    // 🌟 WAKELOCK (Bildschirm bleibt an)
    // =========================================================
    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                Globals.wakeLock = await navigator.wakeLock.request('screen');
                Globals.wakeLock.addEventListener('release', () => { Utils.sysLog("Wake Lock lost."); });
            } catch (err) {}
        }
    }
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && AppState.state !== 'IDLE') requestWakeLock();
    });

    // =========================================================
    // 🌟 THE BIG TICK (Master Game Loop - BACKGROUND SAFE)
    // =========================================================
    function runMainTick() {
        const now = Date.now();
        // Berechne Delta in ms, um Timer exakt nachzuziehen, auch wenn die App minimiert war
        const deltaMs = now - lastTickTime;
        
        // Wir runden hier grob auf volle Sekunden für die Stats
        const deltaSec = Math.floor(deltaMs / 1000); 

        // Update der App-Laufzeiten
        AppState.totalSeconds += deltaSec;
        AppState.arrestSeconds += deltaSec;
        if (AppState.isCompressing) AppState.compressingSeconds += deltaSec;
        
        // CATCH-UP für den Cycle-Timer
        if (deltaSec > 0 && AppState.cycleSeconds > 0) {
            AppState.cycleSeconds -= deltaSec;
            if (AppState.cycleSeconds < 0) AppState.cycleSeconds = 0;
        }

        updateTopStats();
        
        // Cycle-Timer Updates auf dem Screen
        if (AppState.state === 'COMPRESSING' || AppState.state === 'VENTILATING' || AppState.state === 'PAUSED_CPR') {
            updateCycleTimerUI();
            updateCircleProgress();
            updateCprUI();
        } else if (AppState.state === 'ROSC') {
            updateRoscTimer(deltaSec);
        }

        lastTickTime += (deltaSec * 1000); 
        
        if (deltaSec > 2 && window.CPR.CPRTimer) {
             window.CPR.CPRTimer.updateUI();
        }

        if (AppState.state !== 'IDLE') {
            Utils.saveSession();
        }
    }

    let mainTickInterval;
    let lastTickTime = Date.now();

    function startMainTick() {
        if (mainTickInterval) clearInterval(mainTickInterval);
        lastTickTime = Date.now();
        mainTickInterval = setInterval(runMainTick, 200);
    }
    function stopMainTick() {
        if (mainTickInterval) clearInterval(mainTickInterval);
        mainTickInterval = null;
    }

    // =========================================================
    // 🌟 HELPER & LOGIK
    // =========================================================
    window.addLogEntry = function(action) {
        if (!AppState.protocolData) AppState.protocolData = [];
        AppState.protocolData.push({
            time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            secondsFromStart: AppState.totalSeconds,
            action: action
        });
        if (CPR.LogTimeline && typeof CPR.LogTimeline.forceRender === 'function') CPR.LogTimeline.forceRender();
    };

    function startArrestTimer() {
        if (AppState.state === 'IDLE') {
            Utils.sysLog("Arrest Timer gestartet.");
            AppState.state = 'OB_1';
            updateTopStats();
            document.getElementById('top-stats-container').classList.remove('opacity-0');
            document.getElementById('medical-disclaimer').classList.add('hidden');
            
            const d = new Date();
            const startStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            document.getElementById('start-time').innerText = startStr;
            requestWakeLock();
            startMainTick();
            addLogEntry("Start Reanimation");
        }
    }

    function switchState(newState) {
        AppState.previousState = AppState.state;
        AppState.state = newState;
        Utils.sysLog("State switch: " + AppState.previousState + " -> " + newState);

        if (newState !== 'IDLE') document.getElementById('top-stats-container').classList.remove('opacity-0');

        const isMenuState = ['DECISION', 'RESUME', 'JOULE', 'MEDS_MENU', 'AIRWAY_MENU', 'ZUGANG_MENU', 'END_MENU', 'ABBRUCH_MENU', 'AIRWAY_DOC'].includes(newState);
        if (isMenuState) document.body.classList.add('center-menu-open');
        else document.body.classList.remove('center-menu-open');

        // Audio Management
        if (newState === 'COMPRESSING') {
            if (!CPR.CPRTimer.isRunning()) CPR.CPRTimer.start();
        } else {
            if (CPR.CPRTimer && typeof CPR.CPRTimer.pause === 'function') CPR.CPRTimer.pause();
        }
        
        if (newState === 'COMPRESSING' || newState === 'VENTILATING' || newState === 'PAUSED_CPR') {
            document.body.classList.add('dashboard-active');
            // UI.updateSatellites(); ENTFERNT: CSS kümmert sich um die Satelliten!
        } else {
            document.body.classList.remove('dashboard-active');
            const sat = document.getElementById('satellites');
            if (sat) sat.classList.add('hidden');
            const pC = document.getElementById('progress-circle');
            if (pC) pC.classList.add('opacity-0');
            const mBA = document.getElementById('main-btn-area');
            if (mBA) mBA.style.boxShadow = '';
        }

        switch (newState) {
            case 'IDLE':
                UI.switchView('ob-1');
                document.getElementById('top-stats-container').classList.add('opacity-0');
                document.getElementById('medical-disclaimer').classList.remove('hidden');
                stopMainTick();
                break;
            case 'OB_1':
                UI.switchView('ob-1');
                break;
            case 'OB_BREATHS':
                UI.switchView('initial-breaths');
                break;
            case 'OB_2':
                UI.switchView('ob-2');
                break;
            case 'OB_3':
                UI.switchView('ob-3');
                UI.updateCircle('progress-circle', 100, '#E3000F');
                document.getElementById('progress-circle').classList.remove('opacity-0');
                break;
            case 'DECISION':
                UI.switchView('decision');
                break;
            case 'RESUME':
                UI.switchView('cpr-resume');
                break;
            case 'JOULE':
                UI.switchView('joule');
                break;
            case 'MEDS_MENU':
                UI.switchView('meds-menu');
                break;
            case 'AIRWAY_MENU':
                UI.switchView('airway');
                break;
            case 'AIRWAY_DOC':
                UI.switchView('airway-doc');
                break;
            case 'ZUGANG_MENU':
                UI.switchView('zugang');
                break;
            case 'END_MENU':
                UI.switchView('rosc-end');
                break;
            case 'ABBRUCH_MENU':
                UI.switchView('abbruch-reason');
                break;
            case 'COMPRESSING':
            case 'VENTILATING':
            case 'PAUSED_CPR':
                UI.switchView('timer');
                document.getElementById('progress-circle').classList.remove('opacity-0');
                updateCycleTimerUI();
                updateCircleProgress();
                updateCprUI();
                // UI.updateSatellites(); ENTFERNT: CSS kümmert sich um die Satelliten!
                break;
            case 'ROSC':
                document.getElementById('cpr-interface').classList.add('hidden');
                document.getElementById('rosc-interface').classList.remove('hidden');
                document.getElementById('rosc-interface').classList.add('flex');
                document.getElementById('stat-ccf').classList.add('hidden');
                document.getElementById('stat-rosc').classList.remove('hidden');
                document.getElementById('stat-rosc').classList.add('flex');
                
                if (AppState.isPediatric) {
                    document.getElementById('pedi-rosc-vitals').classList.remove('hidden');
                    if (AppState.patientWeight) {
                        document.getElementById('pedi-rosc-kg').innerText = AppState.patientWeight + " kg";
                        document.getElementById('pedi-rosc-vt').innerText = Math.round(AppState.patientWeight * 6) + " ml";
                    }
                }
                updateRoscTimer(0);
                if (window.CPR.Checklists) window.CPR.Checklists.initRosc();
                if (window.CPR.LogTimeline && typeof window.CPR.LogTimeline.forceRender === 'function') window.CPR.LogTimeline.forceRender();
                break;
            case 'DEBRIEFING':
                document.getElementById('debriefing-modal').classList.remove('hidden');
                document.getElementById('debriefing-modal').classList.add('flex');
                stopMainTick();
                
                document.getElementById('debrief-duration').innerText = Utils.formatTime(AppState.totalSeconds);
                const aSec = AppState.arrestSeconds || 0;
                const cSec = AppState.compressingSeconds || 0;
                const ccf = aSec > 0 ? Math.min(100, Math.round((cSec / aSec) * 100)) : 0;
                document.getElementById('debrief-ccf').innerText = ccf + "%";
                document.getElementById('debrief-shocks').innerText = AppState.shockCount || 0;
                
                let adrTotal = "0 mg", adrCount = AppState.adrCount || 0;
                if (adrCount > 0) adrTotal = (AppState.isPediatric && AppState.patientWeight) ? (adrCount * Math.round(AppState.patientWeight * 10)) + " µg" : adrCount + " mg";
                document.getElementById('debrief-adr').innerText = adrTotal + " (" + adrCount + "x)";
                
                Utils.safeRemoveItem('cpr_assist_session');
                break;
        }
        Utils.saveSession();
    }

    // =========================================================
    // 🌟 PEDIATRIC MODAL LOGIC (Die Broselow Slider)
    // =========================================================
    const pediModal = document.getElementById('patient-setup-modal');
    const ageSlider = document.getElementById('slider-age');
    const kgSlider = document.getElementById('slider-kg');
    const cmSlider = document.getElementById('slider-cm');
    const ageVal = document.getElementById('val-age');
    const kgVal = document.getElementById('val-kg');
    const exactKgInput = document.getElementById('exact-kg-input');
    const cmVal = document.getElementById('val-cm');
    const colorGrid = document.getElementById('color-grid');
    const sumBadge = document.getElementById('summary-badge');
    const awInfo = document.getElementById('pediatric-airway-info');

    let currentPediData = null;

    function getAgeGroup(age) {
        if (age === 0) return 'Säugling (< 1 J.)';
        if (age >= 1 && age <= 12) return `Kind (${age} J.)`;
        return 'Teenager';
    }

    function updatePediUI(source, val) {
        let kg = 4;
        if (source === 'age') {
            const age = parseInt(val);
            if (age === 0) kg = 4;
            else if (age === 1) kg = 10;
            else if (age === 2) kg = 12;
            else kg = (age * 2) + 8;
            kgSlider.value = kg;
            exactKgInput.value = kg;
        } else if (source === 'kg') {
            kg = parseFloat(val);
            kgSlider.value = kg;
            exactKgInput.value = kg;
            if (kg < 10) ageSlider.value = 0;
            else ageSlider.value = Math.max(1, Math.floor((kg - 8) / 2));
        }

        const ageStr = getAgeGroup(parseInt(ageSlider.value));
        ageVal.innerText = ageStr;
        kgVal.innerText = kg + ' kg';

        let activeColorData = broselowData[0];
        let minDiff = 999;
        broselowData.forEach(d => {
            const diff = Math.abs(d.avgKg - kg);
            if (diff < minDiff) { minDiff = diff; activeColorData = d; }
        });

        currentPediData = { kg: kg, color: activeColorData.color, ageStr: ageStr, airway: activeColorData.airway };

        cmSlider.value = activeColorData.cm;
        cmVal.innerText = activeColorData.cm + ' cm';

        if (colorGrid) {
            colorGrid.querySelectorAll('button').forEach(b => {
                b.style.opacity = '0.4';
                b.style.transform = 'scale(0.95)';
                b.style.border = '1px solid transparent';
            });
            const activeBtn = colorGrid.querySelector(`button[data-color="${activeColorData.color}"]`);
            if (activeBtn) {
                activeBtn.style.opacity = '1';
                activeBtn.style.transform = 'scale(1.05)';
                activeBtn.style.border = '2px solid #1e293b';
            }
        }

        if (sumBadge) {
            sumBadge.innerHTML = `<span class="text-slate-400 font-bold">Gewählt:</span> <span class="text-slate-800">${ageStr} &bull; ${kg} kg &bull; ${activeColorData.color.toUpperCase()}</span>`;
            sumBadge.classList.remove('hidden');
        }
        
        const btnEdit = document.getElementById('btn-pediatric-edit');
        if (btnEdit) {
            btnEdit.classList.remove('hidden');
            const kgDisp = document.getElementById('pediatric-weight-display');
            if (kgDisp) kgDisp.innerText = kg + " kg";
            
            btnEdit.className = 'text-[9px] px-2 py-1 rounded-full font-black uppercase flex items-center gap-1 shadow-sm transition-all border';
            if (activeColorData.color === 'weiss' || activeColorData.color === 'grau') {
                btnEdit.classList.add('bg-slate-100', 'text-slate-700', 'border-slate-300');
            } else {
                btnEdit.classList.add('text-white', 'border-transparent');
                btnEdit.style.backgroundColor = getHexForColor(activeColorData.color);
            }
        }

        if (awInfo && activeColorData.airway) {
            awInfo.classList.remove('hidden');
            document.getElementById('airway-info-kg').innerText = `${kg} kg`;
            document.getElementById('airway-info-tubus').innerText = activeColorData.airway.tubus || '--';
            document.getElementById('airway-info-tiefe').innerText = activeColorData.airway.tiefe || '--';
            document.getElementById('airway-info-wendel').innerText = activeColorData.airway.wendel || '--';
            document.getElementById('airway-info-guedel').innerText = activeColorData.airway.guedel || '--';
        }
        
        Utils.sysLog(`Pediatric updated: ${kg}kg, Color: ${activeColorData.color}`);
    }

    function getHexForColor(c) {
        const m = { 'grau':'#9ca3af', 'rosa':'#f472b6', 'rot':'#ef4444', 'lila':'#a855f7', 'gelb':'#eab308', 'weiss':'#ffffff', 'blau':'#3b82f6', 'orange':'#f97316', 'gruen':'#22c55e' };
        return m[c] || '#64748b';
    }

    if (ageSlider) ageSlider.addEventListener('input', (e) => updatePediUI('age', e.target.value));
    if (kgSlider) kgSlider.addEventListener('input', (e) => updatePediUI('kg', e.target.value));
    if (exactKgInput) {
        exactKgInput.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val) || val < 1) return;
            if (val > 50) val = 50;
            updatePediUI('kg', val);
        });
        exactKgInput.addEventListener('blur', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val) || val < 1) exactKgInput.value = currentPediData ? currentPediData.kg : 4;
        });
    }

    if (colorGrid) {
        colorGrid.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                Utils.vibrate(20);
                const c = btn.getAttribute('data-color');
                const d = broselowData.find(x => x.color === c);
                if (d) updatePediUI('kg', d.avgKg);
            });
        });
    }

    document.getElementById('btn-start-adult')?.addEventListener('click', () => {
        Utils.vibrate(20);
        AppState.isPediatric = false;
        AppState.patientWeight = null;
        AppState.cprMode = '30:2';
        document.getElementById('btn-pediatric-edit')?.classList.add('hidden');
        if (awInfo) awInfo.classList.add('hidden');
        startArrestTimer();
        switchState('OB_2');
    });

    document.getElementById('btn-start-child')?.addEventListener('click', () => {
        Utils.vibrate(20);
        pediModal.classList.remove('hidden');
        pediModal.classList.add('flex');
        updatePediUI('age', 0);
    });

    document.getElementById('btn-close-pedi-modal')?.addEventListener('click', () => {
        Utils.vibrate(20);
        pediModal.classList.remove('flex');
        pediModal.classList.add('hidden');
        if (AppState.state === 'IDLE') return; 
    });

    document.getElementById('btn-start-pediatric-unknown')?.addEventListener('click', () => {
        Utils.vibrate(20);
        AppState.isPediatric = true;
        AppState.patientWeight = null;
        AppState.cprMode = '15:2';
        pediModal.classList.remove('flex');
        pediModal.classList.add('hidden');
        
        const btnEdit = document.getElementById('btn-pediatric-edit');
        if (btnEdit) {
            btnEdit.classList.remove('hidden');
            const kgDisp = document.getElementById('pediatric-weight-display');
            if (kgDisp) kgDisp.innerText = "UNBEKANNT";
            btnEdit.className = 'hidden text-[9px] bg-red-100 text-red-700 border border-red-300 px-2 py-1 rounded-full font-black uppercase flex items-center gap-1 active:scale-95 shadow-sm transition-all animate-pulse';
        }
        
        if (AppState.state === 'IDLE') {
            startArrestTimer();
            switchState('OB_BREATHS');
        }
    });

    document.getElementById('btn-start-pediatric')?.addEventListener('click', () => {
        Utils.vibrate([30, 50, 30]);
        AppState.isPediatric = true;
        AppState.patientWeight = currentPediData ? currentPediData.kg : 4;
        AppState.cprMode = '15:2';
        pediModal.classList.remove('flex');
        pediModal.classList.add('hidden');
        if (AppState.state === 'IDLE') {
            startArrestTimer();
            switchState('OB_BREATHS');
        }
    });

    document.getElementById('btn-pediatric-edit')?.addEventListener('click', () => {
        Utils.vibrate(20);
        pediModal.classList.remove('hidden');
        pediModal.classList.add('flex');
        if (AppState.patientWeight) updatePediUI('kg', AppState.patientWeight);
        else updatePediUI('age', 0);
    });

    // =========================================================
    // 🌟 CPR INITIAL-BEATMUNGEN (Kind)
    // =========================================================
    document.getElementById('btn-breaths-done')?.addEventListener('click', () => {
        Utils.vibrate(20); addLogEntry("5 init. Beatmungen"); switchState('OB_2');
    });
    document.getElementById('btn-breaths-skipped')?.addEventListener('click', () => {
        Utils.vibrate(20); addLogEntry("Init. Beatmungen übersprungen"); switchState('OB_2');
    });

    // =========================================================
    // 🌟 CPR INITIAL (Start / Confirm)
    // =========================================================
    document.getElementById('btn-confirm-cpr')?.addEventListener('click', () => {
        Utils.vibrate(30);
        AppState.isCompressing = true;
        AppState.cycleSeconds = CONFIG.CYCLE_SEC;
        addLogEntry("Kompression begonnen");
        switchState('COMPRESSING');
    });

    // =========================================================
    // 🌟 RHYTHMUS ANALYSE & SCHOCK
    // =========================================================
    document.getElementById('view-ob-3').addEventListener('click', () => {
        Utils.vibrate(30); switchState('DECISION');
    });

    document.getElementById('btn-analyze')?.addEventListener('click', () => {
        const btnArea = document.getElementById('main-btn-area');
        if (btnArea && btnArea.classList.contains('border-red-400')) {
            Utils.vibrate(30);
            addLogEntry("Rhythmusanalyse");
            
            const pa = document.getElementById('inner-prepare-alert');
            const pc = document.getElementById('inner-precharge-alert');
            const aa = document.getElementById('inner-analyze-alert');
            if(pa) { pa.classList.add('hidden'); pa.classList.remove('flex'); }
            if(pc) { pc.classList.add('hidden'); pc.classList.remove('flex'); }
            if(aa) { aa.classList.add('hidden'); aa.classList.remove('flex'); }
            
            switchState('DECISION');
        }
    });

    document.getElementById('btn-shockable')?.addEventListener('click', () => {
        Utils.vibrate([40, 60, 40]);
        AppState.isShockable = true;
        addLogEntry("Rhythmus: Schockbar");
        
        let jouleText = '150 - 200 J';
        if (AppState.isPediatric && AppState.patientWeight) {
            jouleText = Math.round(AppState.patientWeight * 4) + ' J'; 
        } else if (AppState.isPediatric) {
            jouleText = '4 J / kg';
        }

        const jContainer = document.getElementById('joule-container');
        if (jContainer) {
            jContainer.innerHTML = `
                <button class="w-full bg-red-50 text-[#E3000F] py-5 rounded-2xl shadow-sm border border-red-200 active:scale-95 transition-all text-2xl font-black mb-3">
                    <i class="fa-solid fa-bolt mr-2"></i> ${jouleText}
                </button>
            `;
            const jBtn = jContainer.querySelector('button');
            if (jBtn) {
                jBtn.addEventListener('click', () => {
                    Utils.vibrate(50);
                    AppState.shockCount = (AppState.shockCount || 0) + 1;
                    addLogEntry("Schock abgegeben (" + jouleText + ")");
                    
                    if (window.CPR.CPRTimer && typeof window.CPR.CPRTimer.reset === 'function') window.CPR.CPRTimer.reset();
                    
                    AppState.isCompressing = true;
                    AppState.cycleSeconds = CONFIG.CYCLE_SEC;
                    switchState('COMPRESSING');
                });
            }
        }
        switchState('JOULE');
    });

    document.getElementById('btn-non-shockable')?.addEventListener('click', () => {
        Utils.vibrate(20);
        AppState.isShockable = false;
        addLogEntry("Rhythmus: Nicht Schockbar");
        
        if (window.CPR.CPRTimer && typeof window.CPR.CPRTimer.reset === 'function') window.CPR.CPRTimer.reset();
        
        AppState.cycleSeconds = CONFIG.CYCLE_SEC;
        switchState('RESUME');
    });

    document.getElementById('btn-confirm-resume')?.addEventListener('click', () => {
        Utils.vibrate(30);
        AppState.isCompressing = true;
        addLogEntry("Kompression fortgesetzt");
        switchState('COMPRESSING');
    });

    document.getElementById('btn-decision-cancel')?.addEventListener('click', () => {
        Utils.vibrate(20);
        if (AppState.previousState && AppState.previousState !== 'IDLE') switchState(AppState.previousState);
        else switchState('COMPRESSING');
    });
    
    document.getElementById('btn-joule-cancel')?.addEventListener('click', () => {
        Utils.vibrate(20); switchState('DECISION');
    });

    // =========================================================
    // 🌟 CYCLE TIMER LOGIK & PRE-WARNINGS
    // =========================================================
    function updateCycleTimerUI() {
        const ct = document.getElementById('cycle-timer');
        const tt = document.getElementById('timer-top-text');
        const btnAnalyze = document.getElementById('btn-analyze');
        const btnArea = document.getElementById('main-btn-area');
        
        const alertPrep = document.getElementById('inner-prepare-alert');
        const alertPreCh = document.getElementById('inner-precharge-alert');
        const alertAna = document.getElementById('inner-analyze-alert');

        if (!ct || !tt || !btnAnalyze || !btnArea) return;

        let sec = AppState.cycleSeconds;
        
        if (sec <= 0) {
            ct.innerText = "00:00";
            ct.className = "text-[64px] font-mono font-black tracking-tighter leading-none transition-colors duration-300 drop-shadow-sm text-[#E3000F] animate-pulse";
            tt.innerText = "Zeit abgelaufen!";
            tt.className = "text-[12px] font-black uppercase tracking-widest pointer-events-none drop-shadow-sm text-[#E3000F] animate-pulse";
            
            btnArea.classList.remove('border-slate-100', 'border-4');
            btnArea.classList.add('border-red-400', 'border-[6px]', 'shadow-[0_4px_20px_rgba(227,0,15,0.25)]');
            
            btnAnalyze.className = 'w-[85%] max-w-[300px] bg-[#E3000F] border border-[#E3000F] text-white py-3.5 rounded-full font-black uppercase tracking-[0.15em] text-[15px] shadow-[0_8px_25px_rgba(227,0,15,0.3)] active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 animate-pulse cursor-pointer';
            btnAnalyze.querySelector('i').className = 'fa-solid fa-heart-pulse text-2xl text-white/90 pointer-events-none';
            btnAnalyze.querySelector('span').innerText = 'Hier Drücken';
            btnAnalyze.disabled = false;
            
            if(alertPrep) { alertPrep.classList.add('hidden'); alertPrep.classList.remove('flex'); }
            if(alertPreCh) { alertPreCh.classList.add('hidden'); alertPreCh.classList.remove('flex'); }
            if(alertAna) { alertAna.classList.remove('hidden'); alertAna.classList.add('flex'); }
            
        } else {
            ct.innerText = Utils.formatTime(sec);
            ct.className = "text-[64px] font-mono font-black text-slate-800 tracking-tighter leading-none transition-colors duration-300 drop-shadow-sm";
            tt.innerText = "Zyklus";
            tt.className = "text-[12px] font-black text-slate-500 uppercase tracking-widest pointer-events-none drop-shadow-sm";
            
            btnArea.classList.remove('border-red-400', 'border-[6px]', 'shadow-[0_4px_20px_rgba(227,0,15,0.25)]');
            btnArea.classList.add('border-slate-100', 'border-4');
            
            btnAnalyze.className = 'w-[85%] max-w-[300px] bg-white border border-slate-200 text-slate-700 py-3.5 rounded-full font-black uppercase tracking-[0.15em] text-[15px] shadow-[0_8px_25px_rgba(0,0,0,0.05)] active:scale-95 transition-all duration-300 opacity-50 flex items-center justify-center gap-3 pointer-events-none';
            btnAnalyze.querySelector('i').className = 'fa-solid fa-heart-pulse text-2xl text-slate-400 pointer-events-none transition-colors';
            btnAnalyze.querySelector('span').innerText = 'Rhythmus Check';
            btnAnalyze.disabled = true;

            if (AppState.state === 'COMPRESSING') {
                if (sec <= CONFIG.PRECHARGE_WARN_SEC && sec > 0) {
                    if(alertPrep) { alertPrep.classList.add('hidden'); alertPrep.classList.remove('flex'); }
                    if(alertPreCh) { alertPreCh.classList.remove('hidden'); alertPreCh.classList.add('flex'); }
                    if(alertAna) { alertAna.classList.add('hidden'); alertAna.classList.remove('flex'); }
                } else if (sec <= CONFIG.PREPARE_WARN_SEC && sec > CONFIG.PRECHARGE_WARN_SEC) {
                    if(alertPrep) { alertPrep.classList.remove('hidden'); alertPrep.classList.add('flex'); }
                    if(alertPreCh) { alertPreCh.classList.add('hidden'); alertPreCh.classList.remove('flex'); }
                    if(alertAna) { alertAna.classList.add('hidden'); alertAna.classList.remove('flex'); }
                } else {
                    if(alertPrep) { alertPrep.classList.add('hidden'); alertPrep.classList.remove('flex'); }
                    if(alertPreCh) { alertPreCh.classList.add('hidden'); alertPreCh.classList.remove('flex'); }
                    if(alertAna) { alertAna.classList.add('hidden'); alertAna.classList.remove('flex'); }
                }
            } else {
                if(alertPrep) { alertPrep.classList.add('hidden'); alertPrep.classList.remove('flex'); }
                if(alertPreCh) { alertPreCh.classList.add('hidden'); alertPreCh.classList.remove('flex'); }
                if(alertAna) { alertAna.classList.add('hidden'); alertAna.classList.remove('flex'); }
            }
        }
    }

    function updateCircleProgress() {
        const pct = Math.max(0, Math.min(100, (AppState.cycleSeconds / CONFIG.CYCLE_SEC) * 100));
        let color = '#10b981'; 
        if (AppState.cycleSeconds <= CONFIG.PRECHARGE_WARN_SEC) color = '#E3000F';
        else if (AppState.cycleSeconds <= CONFIG.PREPARE_WARN_SEC) color = '#f59e0b';
        UI.updateCircle('progress-circle', pct, color);
    }

    // =========================================================
    // 🌟 CPR / BEATMUNGS BUTTON LOGIK
    // =========================================================
    function updateCprUI() {
        const btnCpr = document.getElementById('btn-cpr');
        const btnAw = document.getElementById('btn-airway');
        if (!btnCpr || !btnAw) return;

        const mainText = document.getElementById('cpr-main-text');
        const iNormal = document.getElementById('cpr-icon-normal');
        const iPause = document.getElementById('cpr-icon-pause');
        const iVent = document.getElementById('cpr-icon-vent');

        const isMenuOpen = document.body.classList.contains('center-menu-open');

        if (AppState.state === 'COMPRESSING') {
            btnCpr.className = `pointer-events-auto bg-white border-[4px] border-emerald-400 flex flex-col items-center justify-center text-emerald-600 relative select-none shadow-[0_8px_30px_rgba(16,185,129,0.2)] active:scale-95 transition-all duration-300 ${isMenuOpen ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`;
            mainText.innerText = "DRÜCKEN";
            mainText.className = "text-[12px] font-black tracking-widest uppercase pointer-events-none mt-1 text-emerald-600 drop-shadow-sm";
            iNormal.classList.remove('hidden'); iNormal.className = "fa-solid fa-hands-asl-interpreting text-3xl mb-1 pointer-events-none text-emerald-500 drop-shadow-sm";
            iPause.classList.add('hidden');
            iVent.classList.add('hidden');
            
            if (AppState.airwayEstablished && window.CPR.AirwayTimer) {
                window.CPR.AirwayTimer.start();
            } else if (!AppState.airwayEstablished && AppState.isRunning !== false) {
                if (btnAw.dataset.isWarning !== "true") {
                    btnAw.innerHTML = `
                        <div class="absolute inset-0 bg-amber-400/20 animate-pulse rounded-full"></div>
                        <div class="absolute -top-1 -right-1 bg-[#E3000F] text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-md border-2 border-white z-20">!</div>
                        <div class="flex flex-col items-center justify-center w-full h-full relative z-10">
                            <i class="fa-solid fa-lungs text-[22px] mb-1 text-amber-500"></i>
                            <div class="flex flex-col items-center leading-none w-full px-1">
                                <span class="text-[10px] font-black text-amber-700 tracking-tighter uppercase">Atemweg</span>
                                <span class="text-[8px] font-black text-white bg-amber-500 uppercase tracking-widest mt-1 px-1.5 py-0.5 rounded shadow-sm border border-amber-600">Doku Fehlt</span>
                            </div>
                        </div>
                    `;
                    btnAw.className = `pointer-events-auto bg-amber-50 border-[4px] border-amber-400 flex flex-col items-center justify-center relative select-none shadow-[0_8px_30px_rgba(245,158,11,0.3)] active:scale-95 transition-all duration-300 overflow-visible ${isMenuOpen ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`;
                    btnAw.dataset.isWarning = "true";
                }
            }
            
        } else if (AppState.state === 'VENTILATING') {
            btnCpr.className = `pointer-events-auto bg-cyan-50 border-[4px] border-cyan-400 flex flex-col items-center justify-center relative select-none shadow-[0_8px_30px_rgba(6,182,212,0.3)] active:scale-95 transition-all duration-300 ${isMenuOpen ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`;
            mainText.innerText = "BEATMUNG";
            mainText.className = "text-[11px] font-black tracking-widest uppercase pointer-events-none mt-1 text-cyan-700 drop-shadow-sm";
            iNormal.classList.add('hidden');
            iPause.classList.add('hidden');
            iVent.classList.remove('hidden'); iVent.className = "fa-solid fa-lungs text-3xl mb-1 pointer-events-none text-cyan-500 drop-shadow-sm animate-pulse";
            
            if (window.CPR.AirwayTimer) window.CPR.AirwayTimer.pause();
            
        } else if (AppState.state === 'PAUSED_CPR') {
            btnCpr.className = `pointer-events-auto bg-slate-100 border-[4px] border-slate-300 flex flex-col items-center justify-center text-slate-500 relative select-none shadow-sm active:scale-95 transition-all duration-300 ${isMenuOpen ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`;
            mainText.innerText = "PAUSE";
            mainText.className = "text-[12px] font-black tracking-widest uppercase pointer-events-none mt-1 text-slate-500";
            iNormal.classList.add('hidden');
            iPause.classList.remove('hidden'); iPause.className = "fa-solid fa-pause text-3xl mb-1 pointer-events-none text-slate-400";
            iVent.classList.add('hidden');
            
            if (window.CPR.AirwayTimer) window.CPR.AirwayTimer.pause();
        }

        if (AppState.airwayEstablished && btnAw.dataset.isWarning === "true") {
            btnAw.innerHTML = `
                <div id="aw-glow-bg" class="absolute inset-0 w-full h-full bg-cyan-300 opacity-0 pointer-events-none rounded-full transition-opacity duration-150"></div>
                <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none relative z-10">
                    <i id="aw-icon" class="fa-solid fa-lungs text-[32px] mb-1 text-slate-400"></i>
                    <span id="airway-label" class="text-[12px] font-extrabold uppercase tracking-wide mt-1 whitespace-nowrap">${Globals.tempAirwayType || "Atemweg"}</span>
                </div>
                <span id="airway-countdown-badge" class="hidden absolute -top-2 -right-2 bg-slate-800 text-white text-[12px] font-black px-2 min-w-[26px] h-7 flex items-center justify-center rounded-full shadow-md border-2 border-white z-30 transition-colors"></span>
            `;
            btnAw.className = `pointer-events-auto bg-white border-2 border-cyan-100 flex flex-col items-center justify-center text-slate-500 relative select-none shadow-[0_8px_30px_rgb(0,0,0,0.08)] ${isMenuOpen ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`;
            btnAw.dataset.isWarning = "false";
        } else if (AppState.airwayEstablished) {
            btnAw.className = `pointer-events-auto bg-white border-2 border-cyan-100 flex flex-col items-center justify-center text-slate-500 relative select-none shadow-[0_8px_30px_rgb(0,0,0,0.08)] ${isMenuOpen ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`;
            const lbl = document.getElementById('airway-label');
            if (lbl && Globals.tempAirwayType) lbl.innerText = Globals.tempAirwayType;
        }
    }

    document.getElementById('btn-cpr')?.addEventListener('click', () => {
        if (AppState.state === 'COMPRESSING') {
            Utils.vibrate(20);
            AppState.isCompressing = false;
            
            if (AppState.cprMode === '30:2' || AppState.cprMode === '15:2') {
                 if (window.CPR.UI && typeof window.CPR.UI.handleCprToVentilation === 'function') {
                     window.CPR.UI.handleCprToVentilation();
                 }
            } else {
                 addLogEntry("CPR pausiert");
            }
            switchState('PAUSED_CPR');
            
        } else if (AppState.state === 'PAUSED_CPR' || AppState.state === 'VENTILATING') {
            Utils.vibrate(30);
            AppState.isCompressing = true;
            addLogEntry("Kompression fortgesetzt");
            
            const badge = document.getElementById('cpr-counter-badge');
            if (badge) {
                badge.innerText = "0";
                badge.classList.add('hidden');
            }
            if (window.CPR.UI) window.CPR.UI._cprCount = 0; 
            
            switchState('COMPRESSING');
        }
    });

    // =========================================================
    // 🌟 ATEMWEG MENÜ & DOKU
    // =========================================================
    document.getElementById('btn-airway')?.addEventListener('click', () => {
        Utils.vibrate(20); switchState('AIRWAY_MENU');
    });

    const airwayContainer = document.getElementById('airway-buttons-container');
    if (airwayContainer) {
        let modeText = AppState.cprMode || '30:2';
        airwayContainer.innerHTML = `
            <button class="btn-airway-opt flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="ETI">ETI<br><span class="text-[8px] font-bold opacity-70">Endotracheal</span></button>
            <button class="btn-airway-opt flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="SGA">SGA<br><span class="text-[8px] font-bold opacity-70">Larynxmaske</span></button>
            <button class="btn-airway-opt flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="LTS">LTS<br><span class="text-[8px] font-bold opacity-70">Larynxtubus</span></button>
            <button class="btn-airway-opt col-span-2 w-full mt-2 bg-indigo-50 border border-indigo-200 text-indigo-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95 transition-all" data-short="Beutel-Maske">Beutel-Maske<br><span class="text-[8px] font-bold opacity-70" id="bvm-mode-text">${modeText}</span></button>
        `;

        airwayContainer.querySelectorAll('.btn-airway-opt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                Utils.vibrate(20);
                const short = btn.getAttribute('data-short');
                Globals.tempAirwayType = short;
                
                if (short === 'Beutel-Maske') {
                    AppState.airwayEstablished = true;
                    AppState.cprMode = AppState.isPediatric ? '15:2' : '30:2'; 
                    UI.updateModeToggle(); 
                    
                    document.getElementById('btn-airway-edit-doc')?.classList.add('hidden'); 
                    document.getElementById('btn-airway-remove')?.classList.remove('hidden'); 
                    
                    addLogEntry("Atemweg: Beutel-Maske");
                    
                    if (AppState.state === 'PAUSED_CPR') switchState('PAUSED_CPR'); 
                    else switchState('COMPRESSING');
                    
                } else {
                    document.getElementById('doc-airway-type').innerText = short;
                    switchState('AIRWAY_DOC');
                }
            });
        });
    }

    document.getElementById('btn-airway-doc-save')?.addEventListener('click', () => {
        Utils.vibrate(30);
        AppState.airwayEstablished = true;
        AppState.cprMode = 'continuous';
        UI.updateModeToggle();
        
        const size = document.getElementById('aw-size').value;
        const depth = document.getElementById('aw-depth').value;
        let logStr = "Atemweg: " + Globals.tempAirwayType;
        if (size) logStr += " (Gr: " + size + ")";
        if (depth) logStr += " (Tiefe: " + depth + ")";
        addLogEntry(logStr);
        
        document.getElementById('btn-airway-edit-doc')?.classList.remove('hidden');
        document.getElementById('btn-airway-remove')?.classList.remove('hidden');
        
        if (AppState.previousState === 'AIRWAY_MENU') switchState('COMPRESSING');
        else switchState(AppState.previousState);
    });

    document.getElementById('btn-airway-cancel')?.addEventListener('click', () => {
        Utils.vibrate(20);
        if (AppState.previousState && AppState.previousState !== 'IDLE') switchState(AppState.previousState);
        else switchState('COMPRESSING');
    });

    document.getElementById('btn-airway-doc-cancel')?.addEventListener('click', () => {
        Utils.vibrate(20); switchState('AIRWAY_MENU');
    });

    document.getElementById('btn-airway-remove')?.addEventListener('click', () => {
        Utils.vibrate([30, 50, 30]);
        AppState.airwayEstablished = false;
        addLogEntry("Atemweg entfernt");
        document.getElementById('btn-airway-edit-doc')?.classList.add('hidden');
        document.getElementById('btn-airway-remove')?.classList.add('hidden');
        document.getElementById('aw-size').value = '';
        document.getElementById('aw-depth').value = '';
        document.getElementById('airway-label').innerText = 'Atemweg';
        
        AppState.cprMode = AppState.isPediatric ? '15:2' : '30:2';
        UI.updateModeToggle();
        
        if (window.CPR.AirwayTimer) window.CPR.AirwayTimer.pause();
        
        switchState('COMPRESSING');
    });

    // =========================================================
    // 🌟 ZUGANG
    // =========================================================
    document.getElementById('btn-zugang-menu')?.addEventListener('click', () => {
        Utils.vibrate(20); switchState('ZUGANG_MENU');
    });

    document.getElementById('zugang-typ')?.addEventListener('change', (e) => {
        const groesse = document.getElementById('zugang-groesse');
        const ort = document.getElementById('zugang-ort');
        if (e.target.value === 'i.o.') {
            groesse.innerHTML = '<optgroup label="i.o. Nadeln"><option value="EZ-IO Pink">🟪 EZ-IO Pink (Kind)</option><option value="EZ-IO Blau" selected>🟦 EZ-IO Blau (Erw.)</option><option value="EZ-IO Gelb">🟨 EZ-IO Gelb (Adipös)</option></optgroup>';
            ort.innerHTML = '<optgroup label="i.o. Orte"><option value="Tibia prox." selected>📍 Tibia prox.</option><option value="Tibia dist.">📍 Tibia dist.</option><option value="Femur">📍 Femur</option><option value="Humerus">📍 Humerus</option></optgroup>';
        } else {
            groesse.innerHTML = '<optgroup label="i.v. Farben"><option value="Grün (18G)" selected>🟢 Grün (18G)</option><option value="Rosa (20G)">🌸 Rosa (20G)</option><option value="Blau (22G)">🔵 Blau (22G)</option><option value="Gelb (24G)">🟡 Gelb (24G)</option><option value="Weiß (17G)">⚪ Weiß (17G)</option><option value="Grau (16G)">🔘 Grau (16G)</option><option value="Orange (14G)">🟠 Orange (14G)</option></optgroup>';
            ort.innerHTML = '<optgroup label="i.v. Orte"><option value="Handrücken" selected>📍 Handrücken</option><option value="Unterarm">📍 Unterarm</option><option value="Ellenbeuge">📍 Ellenbeuge</option><option value="Jugularis">📍 V. jugularis</option></optgroup>';
        }
    });

    document.getElementById('btn-zugang-save')?.addEventListener('click', () => {
        Utils.vibrate(30);
        const typ = document.getElementById('zugang-typ').value;
        const groesse = document.getElementById('zugang-groesse').value.split(' ')[0]; 
        const ort = document.getElementById('zugang-ort').value;
        
        let logStr = `Zugang: ${typ} ${groesse} (${ort})`;
        addLogEntry(logStr);
        
        const btnAccess = document.getElementById('btn-zugang-menu');
        if (btnAccess) {
            btnAccess.classList.replace('border-indigo-100', 'border-rose-100');
            btnAccess.querySelector('i').classList.replace('text-slate-400', 'text-rose-500');
            document.getElementById('zugang-label').innerText = typ;
            document.getElementById('zugang-label').className = "text-[12px] font-black uppercase tracking-wide mt-1 whitespace-nowrap text-rose-600";
        }
        
        if (AppState.previousState && AppState.previousState !== 'IDLE') switchState(AppState.previousState);
        else switchState('COMPRESSING');
    });

    document.getElementById('btn-zugang-cancel')?.addEventListener('click', () => {
        Utils.vibrate(20);
        if (AppState.previousState && AppState.previousState !== 'IDLE') switchState(AppState.previousState);
        else switchState('COMPRESSING');
    });

    // =========================================================
    // 🌟 TOP STATS & LOGBUCH LOGIK
    // =========================================================
    function updateTopStats() {
        const ct = document.getElementById('main-timer');
        const ccf = document.getElementById('ccf-display');
        const rt = document.getElementById('rosc-timer-display');

        if (ct) ct.innerText = Utils.formatTime(AppState.totalSeconds);
        
        if (ccf && AppState.arrestSeconds > 0) {
            const val = Math.min(100, Math.round((AppState.compressingSeconds / AppState.arrestSeconds) * 100));
            ccf.innerText = val + '%';
            if (val >= 80) ccf.className = "text-2xl sm:text-3xl font-black tracking-tight leading-none text-emerald-500";
            else if (val >= 60) ccf.className = "text-2xl sm:text-3xl font-black tracking-tight leading-none text-amber-500";
            else ccf.className = "text-2xl sm:text-3xl font-black tracking-tight leading-none text-[#E3000F]";
        }
        if (rt) rt.innerText = Utils.formatTime(AppState.roscSeconds);
    }

    function updateRoscTimer(deltaSec) {
        AppState.roscSeconds += deltaSec;
        updateTopStats();
    }

    document.getElementById('btn-toggle-protocol')?.addEventListener('click', () => {
        Utils.vibrate(20);
        const p = document.getElementById('protocol-panel');
        if (p) p.classList.remove('translate-y-full');
        if (window.CPR.LogTimeline && typeof window.CPR.LogTimeline.forceRender === 'function') window.CPR.LogTimeline.forceRender();
    });
    document.getElementById('btn-close-log')?.addEventListener('click', () => {
        Utils.vibrate(20);
        document.getElementById('protocol-panel')?.classList.add('translate-y-full');
    });
    
    document.getElementById('btn-toggle-hits')?.addEventListener('click', () => {
        Utils.vibrate(20);
        document.getElementById('hits-panel')?.classList.remove('translate-y-full');
    });
    document.getElementById('btn-close-hits')?.addEventListener('click', () => {
        Utils.vibrate(20);
        document.getElementById('hits-panel')?.classList.add('translate-y-full');
    });

    // HITS TABS
    document.getElementById('btn-tab-hits')?.addEventListener('click', (e) => {
        e.target.className = 'flex-1 px-3 py-2 rounded-lg text-[11px] font-black uppercase bg-white text-slate-800 shadow-sm transition-all';
        document.getElementById('btn-tab-anamnese').className = 'flex-1 px-3 py-2 rounded-lg text-[11px] font-black uppercase text-slate-500 transition-all';
        document.getElementById('view-hits').classList.remove('hidden');
        document.getElementById('view-anamnese').classList.add('hidden');
    });
    document.getElementById('btn-tab-anamnese')?.addEventListener('click', (e) => {
        e.target.className = 'flex-1 px-3 py-2 rounded-lg text-[11px] font-black uppercase bg-white text-slate-800 shadow-sm transition-all';
        document.getElementById('btn-tab-hits').className = 'flex-1 px-3 py-2 rounded-lg text-[11px] font-black uppercase text-slate-500 transition-all';
        document.getElementById('view-anamnese').classList.remove('hidden');
        document.getElementById('view-hits').classList.add('hidden');
    });

    // UNDO LOG
    document.getElementById('btn-undo-log')?.addEventListener('click', () => {
        Utils.vibrate(20);
        if (AppState.protocolData && AppState.protocolData.length > 0) {
            const last = AppState.protocolData.pop();
            Utils.sysLog("Undo: " + last.action);
            
            if (last.action.includes('Amiodaron')) {
                if (AppState.amioCount > 0) AppState.amioCount--;
                if (window.CPR.UI && typeof window.CPR.UI.updateSmartMedsButton === 'function') {
                    window.CPR.UI.updateSmartMedsButton();
                }
            }
            
            if (window.CPR.LogTimeline && typeof window.CPR.LogTimeline.forceRender === 'function') window.CPR.LogTimeline.forceRender();
            Utils.saveSession();
        }
    });

    // =========================================================
    // 🌟 SOUND LOGIK
    // =========================================================
    document.getElementById('btn-toggle-sound')?.addEventListener('click', () => {
        Utils.vibrate(20);
        AppState.isSoundActive = !AppState.isSoundActive;
        const onIcon = document.getElementById('icon-sound-on');
        const offIcon = document.getElementById('icon-sound-off');
        if (AppState.isSoundActive) {
            onIcon.classList.remove('hidden'); offIcon.classList.add('hidden');
        } else {
            onIcon.classList.add('hidden'); offIcon.classList.remove('hidden');
        }
        
        if (AppState.isSoundActive && window.CPR.Audio && window.CPR.Audio.init) {
            window.CPR.Audio.init();
        }
    });

    // =========================================================
    // 🌟 ROSC & ENDE
    // =========================================================
    document.getElementById('btn-rosc-end')?.addEventListener('click', () => {
        Utils.vibrate(20); switchState('END_MENU');
    });
    
    document.getElementById('btn-rosc-cancel')?.addEventListener('click', () => {
        Utils.vibrate(20);
        if (AppState.previousState && AppState.previousState !== 'IDLE') switchState(AppState.previousState);
        else switchState('COMPRESSING');
    });

    document.getElementById('btn-opt-rosc')?.addEventListener('click', () => {
        Utils.vibrate([50, 100, 50]);
        addLogEntry("ROSC!");
        AppState.roscSeconds = 0;
        switchState('ROSC');
    });

    document.getElementById('btn-opt-abbruch')?.addEventListener('click', () => {
        Utils.vibrate(20); switchState('ABBRUCH_MENU');
    });
    document.getElementById('btn-abbruch-cancel')?.addEventListener('click', () => {
        Utils.vibrate(20); switchState('END_MENU');
    });

    ['team', 'family', 'doc'].forEach(reason => {
        document.getElementById(`btn-reason-${reason}`)?.addEventListener('click', (e) => {
            Utils.vibrate([50, 100, 50]);
            addLogEntry("Reanimation beendet (" + e.target.innerText + ")");
            switchState('DEBRIEFING');
        });
    });

    document.getElementById('btn-rearrest')?.addEventListener('click', () => {
        Utils.vibrate([50, 100, 50]);
        addLogEntry("RE-ARREST");
        AppState.cycleSeconds = CONFIG.CYCLE_SEC;
        AppState.isCompressing = true;
        switchState('COMPRESSING');
    });
    
    document.getElementById('btn-rosc-exit')?.addEventListener('click', () => {
        Utils.vibrate([50, 100, 50]);
        addLogEntry("Reanimation beendet (Transport/Übergabe)");
        switchState('DEBRIEFING');
    });
    
    document.getElementById('btn-debrief-resume')?.addEventListener('click', () => {
        Utils.vibrate(20);
        document.getElementById('debriefing-modal').classList.add('hidden');
        document.getElementById('debriefing-modal').classList.remove('flex');
        
        if (AppState.protocolData[AppState.protocolData.length-1].action.includes('ROSC')) {
            switchState('ROSC');
        } else {
             AppState.isCompressing = false;
             switchState('PAUSED_CPR');
        }
    });

    document.getElementById('btn-debrief-reset')?.addEventListener('click', () => {
        Utils.vibrate([50, 100, 50]);
        if (confirm("Möchtest du wirklich einen neuen Einsatz starten? Alle aktuellen Daten werden gelöscht.")) {
            Utils.sysLog("Manueller Reset via Debriefing ausgelöst.");
            window.CPR.isResetting = true;
            localStorage.clear();
            window.location.href = window.location.pathname + '?reset=' + Date.now();
        }
    });

    // =========================================================
    // 🌟 SESSION RECOVERY (Crash Protection)
    // =========================================================
    function checkRecovery() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('reset')) return; 

        const saved = Utils.safeGetItem('cpr_assist_session');
        if (saved) {
            try {
                const session = JSON.parse(saved);
                if (session && session.state !== 'IDLE' && session.state !== 'DEBRIEFING') {
                    const diffMs = Date.now() - session.lastSavedTimestamp;
                    
                    if (diffMs > 12 * 60 * 60 * 1000) {
                        Utils.sysLog("Alte Session (>12h) verworfen.");
                        Utils.safeRemoveItem('cpr_assist_session');
                        return;
                    }

                    if (confirm("Ein nicht beendeter Einsatz wurde gefunden. Möchtest du ihn fortsetzen?")) {
                        Utils.sysLog("Session Recovery gestartet.");
                        Object.assign(AppState, session);
                        
                        const diffSec = Math.floor(diffMs / 1000);
                        AppState.totalSeconds += diffSec;
                        AppState.arrestSeconds += diffSec;
                        
                        if (AppState.isCompressing) AppState.compressingSeconds += diffSec;
                        
                        if (AppState.cycleSeconds > 0) {
                            AppState.cycleSeconds -= diffSec;
                            if (AppState.cycleSeconds < 0) AppState.cycleSeconds = 0;
                        }
                        
                        if (session.startTime) document.getElementById('start-time').innerText = session.startTime;
                        if (session.airwayLabel) {
                            const lbl = document.getElementById('airway-label');
                            if(lbl) lbl.innerText = session.airwayLabel;
                        }
                        if (session.zugangLabel) {
                            const lbl = document.getElementById('zugang-label');
                            if(lbl) lbl.innerText = session.zugangLabel;
                            const btnAccess = document.getElementById('btn-zugang-menu');
                            if(btnAccess) {
                                btnAccess.classList.replace('border-indigo-100', 'border-rose-100');
                                btnAccess.querySelector('i').classList.replace('text-slate-400', 'text-rose-500');
                                document.getElementById('zugang-label').className = "text-[12px] font-black uppercase tracking-wide mt-1 whitespace-nowrap text-rose-600";
                            }
                        }

                        if (AppState.isPediatric && AppState.patientWeight) {
                             const btnEdit = document.getElementById('btn-pediatric-edit');
                             if (btnEdit) {
                                 btnEdit.classList.remove('hidden');
                                 document.getElementById('pediatric-weight-display').innerText = AppState.patientWeight + " kg";
                             }
                        }

                        UI.updateModeToggle();
                        if (AppState.isSoundActive) {
                            document.getElementById('icon-sound-on').classList.remove('hidden');
                            document.getElementById('icon-sound-off').classList.add('hidden');
                        }

                        if (window.CPR.Checklists && typeof window.CPR.Checklists.restore === 'function') {
                            window.CPR.Checklists.restore();
                        }
                        if (window.CPR.LogTimeline && typeof window.CPR.LogTimeline.forceRender === 'function') {
                            window.CPR.LogTimeline.forceRender();
                        }

                        document.getElementById('medical-disclaimer').classList.add('hidden');
                        document.getElementById('top-stats-container').classList.remove('opacity-0');
                        requestWakeLock();
                        startMainTick();
                        
                        if(AppState.state === 'PAUSED_CPR') AppState.isCompressing = false; 
                        switchState(AppState.state);
                        
                    } else {
                        Utils.sysLog("Recovery durch User abgelehnt.");
                        Utils.safeRemoveItem('cpr_assist_session');
                    }
                }
            } catch(e) {
                Utils.sysLog("Recovery Error: " + e.message);
                Utils.safeRemoveItem('cpr_assist_session');
            }
        }
    }

    // =========================================================
    // 🌟 BOOT SEQUENCE
    // =========================================================
    UI.switchView('ob-1');
    setTimeout(checkRecovery, 200);
});
