/**
 * CPR Assist - Press & Hold Hilfe Overlay
 * Baut dynamisch Hilfetexte mit Pfeilen über die aktuellen Button-Positionen.
 */

document.addEventListener('DOMContentLoaded', () => {
    const btnHelp = document.getElementById('btn-help');
    if (!btnHelp) return;

    // 1. Das Overlay-Element dynamisch ins HTML einfügen
    const overlay = document.createElement('div');
    overlay.id = 'help-overlay';
    // Startet unsichtbar (opacity-0) und fängt alle Klicks ab (z-[9999])
    overlay.className = 'fixed inset-0 bg-slate-900/85 backdrop-blur-sm z-[9999] opacity-0 pointer-events-none transition-opacity duration-300 flex items-center justify-center';
    document.body.appendChild(overlay);

    const container = document.createElement('div');
    container.className = 'w-full h-full relative';
    overlay.appendChild(container);

    // 2. Die Datenbasis (Was wird wo erklärt?)
    // pos = Wo steht der Text relativ zum Button? (top = Text oben, Pfeil zeigt nach unten)
    const helpItems = [
        { id: 'btn-cpr', text: 'Kompression\n& Pausen-Warnung', pos: 'top' },
        { id: 'btn-airway', text: 'Atemweg-Doku\n& Beatmung', pos: 'top' },
        { id: 'main-btn-area', text: 'Master-Zyklus\n& Rhythmus-Check', pos: 'center' },
        { id: 'btn-adrenalin', text: 'Adrenalin\n(3-5 Min)', pos: 'bottom' },
        { id: 'btn-meds-menu', text: 'Amiodaron\n& Co.', pos: 'bottom' },
        { id: 'btn-toggle-hits', text: 'Ursachen\n(SAMPLER)', pos: 'top' },
        { id: 'btn-rosc-end', text: 'ROSC-Bündel\n& Ende', pos: 'top' },
        { id: 'btn-toggle-protocol', text: 'Protokoll\n& Zeitstrahl', pos: 'top' },
        { id: 'btn-zugang-menu', text: 'Zugang\ni.v. / i.o.', pos: 'bottom' }
    ];

    // 3. Render-Logik (Sucht die Buttons und baut die Schilder)
    function renderTooltips() {
        container.innerHTML = ''; // Altes aufräumen

        // Info-Text oben mittig
        const title = document.createElement('div');
        title.className = 'absolute top-16 left-0 w-full text-center text-white/50 text-xs font-black uppercase tracking-widest pointer-events-none animate-pulse';
        title.innerHTML = 'Loslassen zum Schließen';
        container.appendChild(title);

        helpItems.forEach(item => {
            const el = document.getElementById(item.id);
            // Ignoriere Buttons, die gerade ausgeblendet sind (z.B. im Menü)
            if (!el || el.classList.contains('hidden') || getComputedStyle(el).opacity === '0') return;

            // Holt die absolut exakten Pixel-Koordinaten des Buttons vom Handydisplay
            const rect = el.getBoundingClientRect();
            
            const tooltip = document.createElement('div');
            tooltip.className = 'absolute flex flex-col items-center justify-center text-center pointer-events-none drop-shadow-xl';
            
            let html = '';
            let x = 0;
            let y = 0;
            const gap = 12; // Abstand zwischen Button und Pfeil

            const textStyle = 'text-white text-[10px] font-bold leading-tight bg-slate-800/90 px-3 py-2 rounded-xl border border-slate-600 backdrop-blur-md';
            const arrowStyle = 'text-white/80 text-xl';

            // Baue Text und Pfeil je nach Richtung zusammen
            if (item.pos === 'top') {
                html = `<div class="${textStyle}">${item.text.replace('\n', '<br>')}</div><i class="fa-solid fa-arrow-down ${arrowStyle} mt-1"></i>`;
                tooltip.innerHTML = html;
                container.appendChild(tooltip);
                x = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
                y = rect.top - tooltip.offsetHeight - gap;
            } else if (item.pos === 'bottom') {
                html = `<i class="fa-solid fa-arrow-up ${arrowStyle} mb-1"></i><div class="${textStyle}">${item.text.replace('\n', '<br>')}</div>`;
                tooltip.innerHTML = html;
                container.appendChild(tooltip);
                x = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
                y = rect.bottom + gap;
            } else if (item.pos === 'center') {
                html = `<div class="text-white text-[13px] font-black leading-tight bg-[#E3000F]/90 px-4 py-3 rounded-2xl border-2 border-red-400 backdrop-blur-md uppercase tracking-wide drop-shadow-2xl">${item.text.replace('\n', '<br>')}</div>`;
                tooltip.innerHTML = html;
                container.appendChild(tooltip);
                x = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
                y = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2);
            }

            // Sicherheits-Check: Verhindert, dass Tooltips aus dem Bildschirmrand ragen
            if (x < 10) x = 10;
            if (x + tooltip.offsetWidth > window.innerWidth - 10) x = window.innerWidth - tooltip.offsetWidth - 10;

            // Setze die finalen Koordinaten
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        });
    }

    // 4. Die Event-Listener ("Press & Hold")
    const showOverlay = (e) => {
        e.preventDefault(); // Verhindert das Standard-Touch-Verhalten (z.B. Lupe oder Markieren)
        renderTooltips();
        overlay.classList.remove('pointer-events-none', 'opacity-0');
        overlay.classList.add('opacity-100');
    };

    const hideOverlay = (e) => {
        e.preventDefault();
        overlay.classList.remove('opacity-100');
        overlay.classList.add('pointer-events-none', 'opacity-0');
    };

    // Touch-Geräte (Handy/Tablet)
    btnHelp.addEventListener('touchstart', showOverlay, { passive: false });
    btnHelp.addEventListener('touchend', hideOverlay);
    btnHelp.addEventListener('touchcancel', hideOverlay);

    // Maus-Geräte (Desktop Fallback)
    btnHelp.addEventListener('mousedown', showOverlay);
    btnHelp.addEventListener('mouseup', hideOverlay);
    btnHelp.addEventListener('mouseleave', hideOverlay);
    
    // Verhindert das nervige "Rechtsklick/Teilen"-Menü vom Browser beim langen Drücken
    btnHelp.addEventListener('contextmenu', e => e.preventDefault());
});
