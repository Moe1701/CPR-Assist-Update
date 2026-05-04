/**
 * CPR Assist - User Interface Controller
 * Handhabt die Navigation zwischen den Views, dynamische UI-Updates und das Zeichnen der Canvas-Kreise.
 */

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
                
                if(targetId === 'view-timer' || targetId === 'view-meds-menu' || targetId === 'view-airway' || targetId === 'view-airway-doc' || targetId === 'view-zugang' || targetId === 'view-abbruch-reason') {
                    targetEl.classList.add('flex', 'flex-col');
                } else {
                    targetEl.classList.add('flex');
                }
            }
        },

        setCenterSize: function(size) {
            if (size === 'small') {
                document.body.classList.add('cpr-mode-small');
                document.body.classList.remove('center-menu-open');
            } else if (size === 'large') {
                document.body.classList.remove('cpr-mode-small');
                document.body.classList.add('center-menu-open');
            }
            this.updateOrbitGeometry(size);
        },

        updateOrbitGeometry: function(size) {
            const centerBtn = document.getElementById('main-btn-area');
            if (!centerBtn) return;
            if (size === 'small') {
                centerBtn.style.width = '85px';
                centerBtn.style.height = '85px';
                centerBtn.style.borderRadius = '50%';
            } else {
                centerBtn.style.width = '224px';
                centerBtn.style.height = '224px';
                centerBtn.style.borderRadius = '50%';
            }
        },

        updateBpmUI: function() {
            if (!window.CPR.AppState) return;
            const bpm = window.CPR.AppState.bpm || 110;
            const el = document.getElementById('bpm-display');
            if (el) el.innerText = bpm;
        },

        updatePediatricUI: function() {
            if (!window.CPR.AppState) return;
            const pedEl = document.getElementById('pediatric-badge');
            if (pedEl) {
                if (window.CPR.AppState.isPediatric) {
                    pedEl.innerText = window.CPR.AppState.patientWeight ? `Kind (${window.CPR.AppState.patientWeight}kg)` : 'Kind';
                    pedEl.classList.remove('hidden');
                } else {
                    pedEl.classList.add('hidden');
                }
            }
        },

        updateCprModeUI: function() {
            if (!window.CPR.AppState) return;
            const modeEl = document.getElementById('cpr-mode-badge');
            if (modeEl) {
                modeEl.innerText = window.CPR.AppState.cprMode === 'continuous' ? 'KONT.' : window.CPR.AppState.cprMode;
            }
        },

        updateAdrenalinBadge: function() {
            if (!window.CPR.AppState) return;
            const badge = document.getElementById('adr-count-badge');
            if (badge && window.CPR.AppState.adrCount > 0) {
                badge.innerText = window.CPR.AppState.adrCount + 'x';
                badge.classList.remove('hidden');
            }
        },

        updateSmartMedsButton: function() {
            const state = window.CPR.AppState;
            const btn = document.getElementById('btn-meds-menu');
            if (!btn || !state) return;

            const count = state.amioCount || 0;

            if (state.isShockable && count < 2) {
                let doseText = "";
                if (state.isPediatric && state.patientWeight) {
                    doseText = Math.round(state.patientWeight * 5) + " mg";
                } else {
                    doseText = count === 0 ? "300 mg" : "150 mg";
                }
                
                btn.dataset.smartMode = "amio";
                btn.dataset.amioDose = doseText;
                
                btn.innerHTML = `
                    <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none relative z-10">
                        <i class="fa-solid fa-syringe text-[24px] mb-1"></i>
                        <span class="text-[11px] font-black uppercase tracking-wider text-center leading-tight">Amio.<br><span class="text-[14px]">${doseText}</span></span>
                    </div>
                    <div class="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full opacity-10"></div>
                `;
                btn.classList.remove('bg-white', 'text-slate-800', 'border-slate-200');
                btn.classList.add('bg-indigo-50', 'text-indigo-700', 'border-indigo-300', 'shadow-[0_0_15px_rgba(99,102,241,0.4)]');
            } else {
                btn.dataset.smartMode = "menu";
                btn.innerHTML = `
                    <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none relative z-10">
                        <i class="fa-solid fa-pills text-[24px] mb-1"></i>
                        <span class="text-[11px] font-black uppercase tracking-wider">Medis</span>
                    </div>
                `;
                btn.classList.remove('bg-indigo-50', 'text-indigo-700', 'border-indigo-300', 'shadow-[0_0_15px_rgba(99,102,241,0.4)]');
                btn.classList.add('bg-white', 'text-slate-800', 'border-slate-200');
            }
        },

        recalcMeds: function() {
            const awGrid = document.querySelector('#view-airway .grid');
            if (awGrid) {
                // 🌟 BEUTEL-MASKE UPDATE: col-span-2 w-full Button unten angehängt!
                if (window.CPR.AppState.isPediatric) {
                    awGrid.innerHTML = 
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="ETI">ETI<br><span class="text-[8px] font-bold opacity-70">Tubus</span></button>' +
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="i-gel">i-gel<br><span class="text-[8px] font-bold opacity-70">SGA</span></button>' +
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="LAMA">LAMA<br><span class="text-[8px] font-bold opacity-70">Larynxmaske</span></button>' +
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="Guedel">Guedel<br><span class="text-[8px] font-bold opacity-70">SGA</span></button>' +
                        '<button class="btn-airway-opt col-span-2 w-full mt-2 bg-indigo-50 border border-indigo-200 text-indigo-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95 transition-all" data-short="Beutel-Maske">Beutel-Maske<br><span class="text-[8px] font-bold opacity-70">15:2 Modus</span></button>';
                } else {
                    awGrid.innerHTML = 
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="ETI">ETI<br><span class="text-[8px] font-bold opacity-70">Tubus</span></button>' +
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="i-gel">i-gel<br><span class="text-[8px] font-bold opacity-70">SGA</span></button>' +
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="LAMA">LAMA<br><span class="text-[8px] font-bold opacity-70">Larynxmaske</span></button>' +
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="LTS">LTS<br><span class="text-[8px] font-bold opacity-70">Larynxtubus</span></button>' +
                        '<button class="btn-airway-opt col-span-2 w-full mt-2 bg-indigo-50 border border-indigo-200 text-indigo-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95 transition-all" data-short="Beutel-Maske">Beutel-Maske<br><span class="text-[8px] font-bold opacity-70">30:2 Modus</span></button>';
                }
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
                ctx.arc(center, center, r, -Math.PI / 2, (-Math.PI / 2) + (2 * Math.PI * pct), false);
                ctx.lineWidth = 6;
                ctx.strokeStyle = color;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }
    };
})();
