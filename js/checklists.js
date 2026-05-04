/**
 * CPR Assist - Dynamisches Checklisten Modul (V1.2)
 * Baut HITS, das vollständige SAMPLER-UI (mit Toggles) und das ROSC-Bündel auf.
 */
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. DIE MEDIZINISCHEN DATEN
    // ==========================================
    
    const hitsData = [
        { id: 'hypoxie', label: 'Hypoxie', type: 'H', color: 'blue' },
        { id: 'hypovolaemie', label: 'Hypovolämie', type: 'H', color: 'blue' },
        { id: 'kaliaemie', label: 'Hypo- / Hyperkaliämie', type: 'H', color: 'blue' },
        { id: 'hypothermie', label: 'Hypothermie', type: 'H', color: 'blue' },
        { id: 'tamponade', label: 'Herzbeuteltamponade', type: 'T', color: 'red' },
        { id: 'toxine', label: 'Toxine (Intoxikation)', type: 'T', color: 'red' },
        { id: 'thrombose', label: 'Thrombose (LE / MI)', type: 'T', color: 'red' },
        { id: 'tension', label: 'Tension (Spannungspneu)', type: 'T', color: 'red' }
    ];

    const leitfragenData = [
        { id: 'beobachtet', label: 'Beobachteter Arrest?', options: ['Ja', 'Nein', '?'] },
        { id: 'laienrea', label: 'Laien-Rea?', options: ['Ja', 'Nein'] },
        { id: 'brustschmerz', label: 'Brustbeschwerden?', options: ['Ja', 'Nein', '?'] },
        { id: 'therapie', label: 'Therapie-Einschränkung?', options: ['Ja', 'Nein'] }
    ];

    const samplerData = [
        { id: 's', label: 'S', name: 'Symptome...' },
        { id: 'a', label: 'A', name: 'Allergien...' },
        { id: 'm', label: 'M', name: 'Medikamente...' },
        { id: 'p', label: 'P', name: 'Patientengeschichte (Vorerkrankungen)...' },
        { id: 'l', label: 'L', name: 'Letzte Mahlzeit / Stuhlgang...' },
        { id: 'e', label: 'E', name: 'Ereignis vor dem Stillstand...' },
        { id: 'r', label: 'R', name: 'Risikofaktoren...' }
    ];

    const roscData = [
        { cat: 'A', title: 'Airway', items: [{ label: 'Atemweg & Cuffdruck (20-30 cmH2O)' }, { label: 'Magensonde (Dekompressions)' }] },
        { cat: 'B', title: 'Breathing', items: [{ label: 'Auskultation (Seitengleich?)' }, { label: 'Oxygenierung', sub: 'SpO2 Ziel: 94-98%' }, { label: 'Normoventilation', sub: 'etCO2 Ziel: 35-45 mmHg' }, { label: 'Oberkörper 30° hochlagern' }] },
        { cat: 'C', title: 'Circulation', items: [{ label: '12-Kanal EKG', sub: 'Suche nach STEMI / Ischämie' }, { label: 'Blutdruck stabilisieren', sub: 'Ziel: MAP > 65 mmHg | syst > 100' }, { label: 'Rekap-Zeit prüfen (< 2 Sek.)' }, { label: 'Zugänge prüfen & Katecholamine' }] },
        { cat: 'D', title: 'Disability (Neuro)', items: [{ label: 'Pupillen kontrollieren' }, { label: 'GCS ermitteln' }, { label: 'Analgosedierung sichern' }, { label: 'Blutzucker messen', sub: 'Ziel: 140 - 180 mg/dl' }] },
        { cat: 'E', title: 'Exposure & Environment', items: [{ label: 'Bodycheck', sub: 'Keine Diagnose durch die Hose!' }, { label: 'Temperaturmanagement', sub: 'Ziel: 36 °C (Fieber strikt meiden!)' }, { label: 'Ursachenforschung (HITS) re-evaluieren' }, { label: 'Zielklinik / CAC anmelden', sub: 'Vorab-Info über EKG & Status' }, { label: 'Angehörige informieren / betreuen' }] }
    ];

    // ==========================================
    // 2. DAS AUTO-RENDERING (HTML Bündeln)
    // ==========================================

    // A. HITS (4H / 4T) rendern
    const hitsContainer = document.getElementById('view-hits');
    if (hitsContainer) {
        let html = '';
        hitsData.forEach(item => {
            const colorClass = item.color === 'blue' ? 'text-blue-600 bg-blue-50' : 'text-red-600 bg-red-50';
            html += `
                <button class="dyn-hits-btn bg-white border border-slate-200 p-3 rounded-xl flex items-center active:scale-95 transition-all text-left shadow-sm w-full gap-4" data-cause="${item.label}">
                    <div class="w-8 h-8 rounded-full ${colorClass} flex items-center justify-center font-black text-sm shrink-0 pointer-events-none">${item.type}</div>
                    <div class="flex-1 pointer-events-none"><span class="font-bold text-sm text-slate-700 leading-tight">${item.label}</span></div>
                    <i class="fa-solid fa-check hidden text-emerald-600 text-xl shrink-0 pointer-events-none check-icon"></i>
                </button>
            `;
        });
        hitsContainer.innerHTML = html;
    }

    // B. SAMPLER & LEITFRAGEN rendern (Genau wie im Screenshot!)
    const anamneseContainer = document.getElementById('view-anamnese');
    if (anamneseContainer) {
        let html = `<div class="flex flex-col w-full">`;
        
        // --- Leitfragen ---
        html += `<h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">Leitfragen</h4>`;
        html += `<div class="grid grid-cols-2 gap-y-4 gap-x-3 mb-6">`;
        leitfragenData.forEach(q => {
            html += `<div class="flex flex-col">`;
            html += `<span class="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">${q.label}</span>`;
            html += `<div class="flex bg-slate-200 p-1 rounded-xl w-full gap-0.5">`;
            q.options.forEach(opt => {
                html += `<button class="dyn-ana-btn flex-1 py-2 rounded-lg text-[10px] font-black uppercase text-slate-500 border border-transparent transition-all shadow-none" data-cat="${q.id}" data-val="${opt}">${opt}</button>`;
            });
            html += `</div></div>`;
        });
        html += `</div>`;

        // --- SAMPLER Inputs ---
        html += `<h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">SAMPLER + S</h4>`;
        html += `<div class="flex flex-col gap-2 mb-4">`;
        samplerData.forEach(item => {
            html += `
                <div class="flex items-center bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm">
                    <span class="w-7 h-7 rounded-full bg-slate-800 text-white font-black flex items-center justify-center text-[11px] shrink-0">${item.label}</span>
                    <input type="text" id="dyn-samp-${item.id}" class="dyn-samp-input flex-1 bg-transparent border-none px-3 text-xs font-bold text-slate-700 outline-none placeholder-slate-300" placeholder="${item.name}">
                </div>
            `;
        });
        html += `</div>`;

        html += `<button id="btn-save-dyn-anamnese" class="w-full bg-indigo-50 border border-indigo-200 text-indigo-700 py-3.5 rounded-xl font-black uppercase tracking-widest text-xs shadow-sm active:scale-95 mt-2">SAMPLER Speichern</button>`;
        html += `</div>`;
        
        anamneseContainer.innerHTML = html;
    }

    // C. ROSC Bündel (ABCDE) rendern
    const roscContainer = document.getElementById('rosc-container');
    if (roscContainer) {
        let html = '';
        roscData.forEach(cat => {
            html += `<h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 mb-2 pl-1">${cat.cat} - ${cat.title}</h4><div class="flex flex-col gap-1.5">`;
            cat.items.forEach(item => {
                const label = item.label;
                const sub = item.sub ? `<span class="block text-[9px] font-normal text-slate-400 mt-0.5">${item.sub}</span>` : '';
                html += `
                    <button class="dyn-rosc-btn bg-white border border-slate-200 p-3 rounded-xl flex justify-between items-center active:scale-95 transition-all text-left shadow-sm" data-log="${label}">
                        <div class="flex flex-col pointer-events-none pr-4">
                            <span class="font-bold text-xs text-slate-700 leading-tight">${label}</span>
                            ${sub}
                        </div>
                        <i class="fa-solid fa-check hidden text-emerald-600 text-lg pointer-events-none check-icon shrink-0"></i>
                    </button>
                `;
            });
            html += `</div>`;
        });
        roscContainer.innerHTML = html;
    }

    // ==========================================
    // 3. EVENT LISTENER & LOGIK
    // ==========================================
    
    // HITS Klicks
    document.querySelectorAll('.dyn-hits-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            if(window.CPR && window.CPR.Utils) window.CPR.Utils.vibrate(20);
            const t = e.currentTarget;
            t.classList.toggle('bg-emerald-50'); 
            t.classList.toggle('border-emerald-200'); 
            t.classList.toggle('bg-white'); 
            t.classList.toggle('border-slate-200');
            t.querySelector('.check-icon')?.classList.toggle('hidden');
            
            const cause = t.dataset.cause;
            if(window.addLogEntry) {
                window.addLogEntry(t.classList.contains('bg-emerald-50') ? `HITS: ${cause} gecheckt/behandelt` : `HITS: ${cause} offen`);
            }
        });
    });

    // ROSC Klicks
    document.querySelectorAll('.dyn-rosc-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            if(window.CPR && window.CPR.Utils) window.CPR.Utils.vibrate(20);
            const t = e.currentTarget;
            t.classList.toggle('bg-emerald-100'); 
            t.classList.toggle('border-emerald-300'); 
            t.classList.toggle('bg-white'); 
            t.classList.toggle('border-slate-200');
            t.querySelector('.check-icon')?.classList.toggle('hidden');
            
            const logText = t.dataset.log;
            if(window.addLogEntry) {
                window.addLogEntry(t.classList.contains('bg-emerald-100') ? `ROSC: ${logText}` : `ROSC: ${logText} (widerrufen)`);
            }
        });
    });

    // --- LEITFRAGEN TOGGLE LOGIK ---
    document.querySelectorAll('.dyn-ana-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if(window.CPR && window.CPR.Utils) window.CPR.Utils.vibrate(20);
            
            const cat = btn.dataset.cat;
            const val = btn.dataset.val;

            // AppState aktualisieren
            if(window.CPR && window.CPR.AppState && window.CPR.AppState.anamneseData) {
                window.CPR.AppState.anamneseData[cat] = val;
                if(window.CPR.Utils && window.CPR.Utils.saveSession) window.CPR.Utils.saveSession();
            }

            // Alle in dieser Kategorie zurücksetzen
            document.querySelectorAll(`.dyn-ana-btn[data-cat="${cat}"]`).forEach(b => {
                b.classList.remove('bg-white', 'text-slate-800', 'shadow-sm', 'border-slate-200');
                b.classList.add('text-slate-500', 'border-transparent');
            });

            // Aktiven Button hervorheben
            btn.classList.remove('text-slate-500', 'border-transparent');
            btn.classList.add('bg-white', 'text-slate-800', 'shadow-sm', 'border-slate-200');
        });
    });

    // --- SAMPLER INPUT LIVE SPEICHERN ---
    document.querySelectorAll('.dyn-samp-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = e.target.id.replace('dyn-samp-', '');
            if(window.CPR && window.CPR.AppState && window.CPR.AppState.anamneseData) {
                window.CPR.AppState.anamneseData.sampler[id] = e.target.value;
                if(window.CPR.Utils && window.CPR.Utils.saveSession) window.CPR.Utils.saveSession();
            }
        });
    });

    // --- SAMPLER SPEICHERN (Button unten) ---
    document.getElementById('btn-save-dyn-anamnese')?.addEventListener('click', (e) => {
        e.stopPropagation(); 
        if(window.CPR && window.CPR.Utils) window.CPR.Utils.vibrate(40);
        
        let logText = "Anamnese erfasst:"; 
        let parts = [];
        let sampStr = [];

        const data = window.CPR?.AppState?.anamneseData;
        if (data) {
            if (data.beobachtet) parts.push("Beobachtet: " + data.beobachtet);
            if (data.laienrea) parts.push("Laien-REA: " + data.laienrea);
            if (data.brustschmerz) parts.push("Brustschmerz: " + data.brustschmerz);
            if (data.therapie) parts.push("Therapie-Einschränkung: " + data.therapie);
        }
        
        samplerData.forEach(k => {
            let el = document.getElementById('dyn-samp-' + k.id);
            if (el && el.value.trim() !== '') {
                sampStr.push(`${k.label}: ${el.value.trim()}`);
            }
        });

        if (parts.length > 0) logText += " " + parts.join(" | ");
        if (sampStr.length > 0) logText += ". SAMPLER: " + sampStr.join(", ");

        if (parts.length > 0 || sampStr.length > 0) {
            if(window.addLogEntry) window.addLogEntry(logText);
        }
        
        document.getElementById('hits-panel')?.classList.add('translate-y-full');
    });

    // ==========================================
    // 4. DATEN WIEDERHERSTELLEN (SESSION LOAD)
    // ==========================================
    function restoreDynAnamnese() {
        if (!window.CPR || !window.CPR.AppState || !window.CPR.AppState.anamneseData) return;
        const data = window.CPR.AppState.anamneseData;

        // Toggles wiederherstellen
        ['beobachtet', 'laienrea', 'brustschmerz', 'therapie'].forEach(cat => {
            const val = data[cat];
            if (val) {
                document.querySelectorAll(`.dyn-ana-btn[data-cat="${cat}"]`).forEach(b => {
                    b.classList.remove('bg-white', 'text-slate-800', 'shadow-sm', 'border-slate-200');
                    b.classList.add('text-slate-500', 'border-transparent');
                });
                const activeBtn = document.querySelector(`.dyn-ana-btn[data-cat="${cat}"][data-val="${val}"]`);
                if (activeBtn) {
                    activeBtn.classList.remove('text-slate-500', 'border-transparent');
                    activeBtn.classList.add('bg-white', 'text-slate-800', 'shadow-sm', 'border-slate-200');
                }
            }
        });

        // Texte wiederherstellen
        if (data.sampler) {
            ['s', 'a', 'm', 'p', 'l', 'e', 'r'].forEach(k => {
                const el = document.getElementById(`dyn-samp-${k}`);
                if (el && el.value === '') el.value = data.sampler[k] || '';
            });
        }
    }

    // Synchronisiert die Ansicht automatisch, wenn die App Session geladen wurde 
    // oder wenn der User den Tab anklickt.
    setTimeout(restoreDynAnamnese, 500);
    document.getElementById('btn-tab-anamnese')?.addEventListener('click', restoreDynAnamnese);

});


