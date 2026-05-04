window.CPR = window.CPR || {};

window.CPR.UI = (function() {
    return {
        switchView: function(viewId) {
            if (window.CPR.Globals) window.CPR.Globals.lastViewSwitch = Date.now();
            
            const allViews = [
                'view-ob-1', 'view-ob-2', 'view-ob-3', 'view-timer', 'view-decision', 
                'view-cpr-resume', 'view-joule', 'view-airway', 'view-airway-doc', 
                'view-meds-menu', 'view-zugang', 'view-rosc-end', 'view-abbruch-reason', 
                'view-initial-breaths'
            ];
            
            allViews.forEach(function(id) {
                const el = document.getElementById(id);
                if (el) { 
                    el.style.display = ''; 
                    el.classList.add('hidden'); 
                    el.classList.remove('flex', 'flex-col'); 
                }
            });

            let targetId = viewId;
            if (targetId && targetId.indexOf('view-') !== 0) targetId = 'view-' + targetId;
            
            const targetEl = document.getElementById(targetId);
            if (targetEl) { 
                targetEl.classList.remove('hidden'); 
                
                if(targetId === 'view-timer' || targetId === 'view-meds-menu' || targetId === 'view-airway' || targetId === 'view-airway-doc' || targetId === 'view-zugang' || targetId === 'view-rosc-end' || targetId === 'view-abbruch-reason' || targetId === 'view-cpr-resume') {
                    targetEl.classList.add('flex', 'flex-col'); 
                } else {
                    targetEl.classList.add('flex'); 
                }
            }
            
            const progCircle = document.getElementById('progress-circle');
            if (progCircle) { 
                if (targetId === 'view-timer') progCircle.classList.remove('opacity-0'); 
                else progCircle.classList.add('opacity-0'); 
            }

            const disclaimer = document.getElementById('medical-disclaimer');
            if (disclaimer) { 
                if (targetId === 'view-ob-1') disclaimer.classList.remove('hidden'); 
                else disclaimer.classList.add('hidden'); 
            }
        },

        navigate: function(state, view, size) {
            if (!window.CPR.AppState) return;
            if (state) {
                window.CPR.AppState.previousState = window.CPR.AppState.state;
                window.CPR.AppState.state = state;
            }
            if (view) this.switchView(view);
            if (size) this.setCenterSize(size);
            
            const pPanel = document.getElementById('protocol-panel');
            if (pPanel) pPanel.classList.add('translate-y-full');
            const hPanel = document.getElementById('hits-panel');
            if (hPanel) hPanel.classList.add('translate-y-full');
        },

        // 🌟 DIE WAHRE LÖSUNG: CSS-Delegation statt JS-Timeouts 🌟
        // Die Funktion updateOrbitGeometry (die Zeitbombe) wurde restlos gelöscht.
        // Das Layout wird nun fehlerfrei von Abschnitt 6 & 9 deiner style.css gesteuert!
        setCenterSize: function(size) {
            if (size === 'small') {
                document.body.classList.add('cpr-mode-small');
                document.body.classList.remove('center-menu-open');
            } else if (size === 'large') {
                document.body.classList.remove('cpr-mode-small');
                document.body.classList.add('center-menu-open');
            }
        },

        updateBpmUI: function() {
            const bpm = (window.CPR.AppState && window.CPR.AppState.bpm) ? window.CPR.AppState.bpm : 110;
            
            document.querySelectorAll('.bpm-opt').forEach(function(b) {
                if (parseInt(b.dataset.bpm) === bpm) {
                    b.className = 'bpm-opt flex-1 py-3 text-slate-800 font-black text-lg rounded-lg shadow-sm bg-white transition-all transform scale-105 border border-slate-100';
                } else {
                    b.className = 'bpm-opt flex-1 py-3 text-slate-400 font-black text-lg rounded-lg transition-all border border-transparent bg-transparent';
                }
            });
        },

        updatePediatricUI: function() {
            const badge = document.getElementById('btn-pediatric-edit');
            const text = document.getElementById('pediatric-weight-display');
            if (!badge || !text) return;

            if (window.CPR.AppState && window.CPR.AppState.isPediatric) {
                badge.classList.remove('hidden');
                text.innerText = window.CPR.AppState.patientWeight ? window.CPR.AppState.patientWeight + ' kg' : 'Unbekannt';
            } else {
                badge.classList.add('hidden');
            }
        },

        updateCprModeUI: function() {
            if (!window.CPR.AppState) return;
            const thumb = document.getElementById('mode-slider-thumb');
            const lSync = document.getElementById('mode-label-sync');
            const lKont = document.getElementById('mode-label-kont');
            if (!thumb || !lSync || !lKont) return;

            const isKont = window.CPR.AppState.cprMode === 'continuous';
            if (isKont) {
                thumb.style.transform = 'translateX(43px)';
                lSync.className = 'flex-1 text-center text-[10px] font-black z-10 transition-colors duration-300 text-amber-400';
                lKont.className = 'flex-1 text-center text-[10px] font-black z-10 transition-colors duration-300 text-amber-700';
            } else {
                thumb.style.transform = 'translateX(0px)';
                lSync.className = 'flex-1 text-center text-[10px] font-black z-10 transition-colors duration-300 text-amber-700';
                lKont.className = 'flex-1 text-center text-[10px] font-black z-10 transition-colors duration-300 text-amber-400';
                lSync.innerText = window.CPR.AppState.isPediatric ? '15:2' : '30:2';
            }
        },

        updateAdrenalinBadge: function() {
            const badge = document.getElementById('adr-count-badge');
            if (!badge) return;
            
            const count = window.CPR.AppState ? (window.CPR.AppState.adrCount || 0) : 0;
            
            if (count > 0) {
                badge.style.display = 'flex';
                badge.innerText = count; 
            } else {
                badge.style.display = 'none';
            }
        },

        hideVentilationUI: function() {
            const badge = document.getElementById('airway-countdown-badge');
            if (badge) badge.classList.add('hidden');
            const glowBg = document.getElementById('aw-glow-bg');
            if (glowBg) glowBg.style.opacity = '0';
        },

        updateSmartMedsButton: function() {
            const btn = document.getElementById('btn-meds-menu');
            const state = window.CPR.AppState;
            if (!btn || !state) return;

            const count = state.amioCount || 0;

            if (state.isShockable && count < 2) {
                let doseText = count === 0 ? "300 mg" : "150 mg";
                if (state.isPediatric && state.patientWeight) {
                    doseText = Math.round(state.patientWeight * 5) + " mg";
                }

                btn.innerHTML = `
                    <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none relative z-10">
                        <i class="fa-solid fa-syringe text-[24px] mb-1 text-purple-500"></i>
                        <div class="flex flex-col items-center leading-none mt-0.5 w-full px-1">
                            <span class="text-[10px] font-bold text-purple-600 uppercase tracking-tighter">Amio.</span>
                            <span class="text-[11px] font-black text-purple-700 uppercase tracking-tight mt-0.5">${doseText}</span>
                        </div>
                    </div>
                `;
                btn.classList.remove('bg-white', 'border-purple-100', 'text-slate-500');
                btn.classList.add('bg-purple-50', 'border-purple-300', 'text-purple-600');
                
                btn.dataset.smartMode = "amio";
                btn.dataset.amioDose = doseText;
            } else {
                btn.innerHTML = `
                    <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none relative z-10">
                        <i class="fa-solid fa-capsules text-[24px] mb-1 text-slate-400"></i>
                        <div class="flex flex-col items-center leading-none mt-0.5 w-full px-1">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Meds</span>
                            <span class="text-[11px] font-black text-purple-700 uppercase tracking-tight mt-0.5">Menü</span>
                        </div>
                    </div>
                `;
                btn.classList.remove('bg-purple-50', 'border-purple-300', 'text-purple-600');
                btn.classList.add('bg-white', 'border-purple-100', 'text-slate-500');
                
                btn.dataset.smartMode = "menu";
            }
        },

        recalcMeds: function() {
            const isPedi = window.CPR.AppState && window.CPR.AppState.isPediatric;
            const kg = window.CPR.AppState ? window.CPR.AppState.patientWeight : 0;

            const adrBtn = document.getElementById('btn-adrenalin');
            const adrText = document.getElementById('adr-text-2');
            if (adrBtn && adrText) {
                if (isPedi && kg) {
                    const dose = Math.round(kg * 10) + ' µg';
                    adrBtn.dataset.dose = dose;
                    adrText.innerText = dose;
                } else {
                    adrBtn.dataset.dose = '1 mg';
                    adrText.innerText = '1 mg';
                }
            }

            const amioContainer = document.getElementById('amio-container');
            if (amioContainer) {
                if (isPedi && kg) {
                    const dose = Math.round(kg * 5) + ' mg';
                    amioContainer.innerHTML = '<button class="btn-amio-opt w-full bg-purple-50 border-purple-200 text-purple-700 py-3 rounded-xl font-black text-xs uppercase shadow-sm active:scale-95" data-log="Amiodaron ' + dose + '">Amio ' + dose + '</button>';
                } else {
                    amioContainer.innerHTML = 
                        '<button class="btn-amio-opt w-full bg-purple-50 border-purple-200 text-purple-700 py-3 rounded-xl font-black text-[10px] uppercase shadow-sm active:scale-95" data-log="Amiodaron 300mg">Amio 300mg</button>' +
                        '<button class="btn-amio-opt w-full bg-purple-50 border-purple-200 text-purple-700 py-3 rounded-xl font-black text-[10px] uppercase shadow-sm active:scale-95" data-log="Amiodaron 150mg">Amio 150mg</button>';
                }
            }

            const sonstContainer = document.getElementById('sonstige-container');
            if (sonstContainer) {
                sonstContainer.innerHTML = 
                    '<button class="btn-sonstige-opt w-full bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold text-[10px] uppercase shadow-sm active:scale-95" data-log="Volumen bolus">Volumen</button>' +
                    '<button class="btn-sonstige-opt w-full bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold text-[10px] uppercase shadow-sm active:scale-95" data-log="Puffersubstanz (Bikarbonat)">Bikarbonat</button>' +
                    '<button class="btn-sonstige-opt w-full bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold text-[10px] uppercase shadow-sm active:scale-95" data-log="Calcium">Calcium</button>' +
                    '<button class="btn-sonstige-opt w-full bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold text-[10px] uppercase shadow-sm active:scale-95" data-log="Magnesium">Magnesium</button>';
            }

            const jouleContainer = document.getElementById('joule-container');
            if (jouleContainer) {
                if (isPedi && kg) {
                    const j4 = Math.round(kg * 4);
                    const j8 = Math.round(kg * 8);
                    jouleContainer.innerHTML = 
                        '<div class="flex gap-3 w-full justify-center">' +
                        '<button class="btn-joule flex-1 bg-yellow-50 border-2 border-yellow-300 text-yellow-700 py-5 rounded-[1.5rem] font-black text-2xl shadow-sm active:scale-95 transition-all" data-joule="' + j4 + ' J">' + j4 + ' J<br><span class="text-[11px] font-bold opacity-70">4 J/kg</span></button>' +
                        '<button class="btn-joule flex-1 bg-yellow-50 border-2 border-yellow-300 text-yellow-700 py-5 rounded-[1.5rem] font-black text-2xl shadow-sm active:scale-95 transition-all" data-joule="' + j8 + ' J">' + j8 + ' J<br><span class="text-[11px] font-bold opacity-70">8 J/kg</span></button>' +
                        '</div>';
                } else {
                    jouleContainer.innerHTML = 
                        '<button class="btn-joule w-[70%] mx-auto bg-yellow-50 border-2 border-yellow-300 text-yellow-700 py-4 rounded-[1.5rem] font-black text-2xl shadow-sm active:scale-95 transition-all mb-3" data-joule="150 J">150 J</button>' +
                        '<div class="flex gap-3 w-full justify-center">' +
                        '<button class="btn-joule flex-1 bg-yellow-50 border-2 border-yellow-300 text-yellow-700 py-4 rounded-[1.5rem] font-black text-2xl shadow-sm active:scale-95 transition-all" data-joule="200 J">200 J</button>' +
                        '<button class="btn-joule flex-1 bg-yellow-50 border-2 border-yellow-300 text-yellow-700 py-4 rounded-[1.5rem] font-black text-2xl shadow-sm active:scale-95 transition-all" data-joule="360 J">360 J</button>' +
                        '</div>';
                }
            }

            const awContainer = document.getElementById('airway-buttons-container');
            const pediAwInfo = document.getElementById('pediatric-airway-info');

            if (isPedi && kg) {
                if (pediAwInfo) pediAwInfo.classList.remove('hidden');
                let activeZone = null;
                if (window.CPR.broselowData) {
                    activeZone = window.CPR.broselowData.find(function(z) { return kg >= z.minKg && kg <= z.maxKg; });
                    if (!activeZone) activeZone = window.CPR.broselowData[window.CPR.broselowData.length - 1];
                    if (kg < 6 && kg >= 3) {
                        if (kg <= 5) activeZone = window.CPR.broselowData.find(function(z) { return z.color === 'grau'; });
                        else activeZone = window.CPR.broselowData.find(function(z) { return z.color === 'rosa'; });
                    }
                }
                if (activeZone && activeZone.airway) {
                    const elKg = document.getElementById('airway-info-kg'); if (elKg) elKg.innerText = kg + ' kg';
                    const elTubus = document.getElementById('airway-info-tubus'); if (elTubus) elTubus.innerText = activeZone.airway.tubus;
                    const elTiefe = document.getElementById('airway-info-tiefe'); if (elTiefe) elTiefe.innerText = activeZone.airway.tiefe;
                    const elWendel = document.getElementById('airway-info-wendel'); if (elWendel) elWendel.innerText = activeZone.airway.wendel;
                    const elGuedel = document.getElementById('airway-info-guedel'); if (elGuedel) elGuedel.innerText = activeZone.airway.guedel;
                }
            } else {
                if (pediAwInfo) pediAwInfo.classList.add('hidden');
            }

            if (awContainer) {
                awContainer.innerHTML = 
                    '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="ETI">ETI<br><span class="text-[8px] font-bold opacity-70">Intubation</span></button>' +
                    '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="i-gel">i-gel<br><span class="text-[8px] font-bold opacity-70">SGA</span></button>' +
                    '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="LAMA">LAMA<br><span class="text-[8px] font-bold opacity-70">Larynxmaske</span></button>' +
                    '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="LTS">LTS<br><span class="text-[8px] font-bold opacity-70">Larynxtubus</span></button>';
            }

            this.updateSmartMedsButton();
        },

        updateCircle: function(canvasId, pct, color) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            const center = w / 2;
            const r = center - 8; 

            ctx.clearRect(0, 0, w, h);
            
            if (pct > 0) {
                ctx.beginPath();
                ctx.arc(center, center, r, 0, 2 * Math.PI * pct);
                ctx.strokeStyle = color || '#E3000F';
                ctx.lineWidth = canvasId === 'progress-circle' ? 10 : 6;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }
    };
})();
