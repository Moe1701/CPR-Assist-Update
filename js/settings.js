/**
 * CPR Assist - Settings Modul (V2.1 - Bulletproof)
 * Nutzt Event Delegation: Funktioniert garantiert immer, unabhängig von der Ladezeit!
 */

window.CPR = window.CPR || {};

window.CPR.Settings = (function() {
    
    function init() {
        // Standard-BPM sichern
        if (window.CPR.AppState && !window.CPR.AppState.bpm) {
            window.CPR.AppState.bpm = window.CPR.CONFIG?.BPM_DEFAULT || 110;
        }

        // Globaler Klick-Listener (Fängt den Klick ab, egal wann der Button gerendert wurde)
        document.addEventListener('click', function(e) {
            
            // 1. Settings MODAL ÖFFNEN
            const btnSettings = e.target.closest('#btn-settings');
            if (btnSettings) {
                e.stopPropagation();
                if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(20);
                const sm = document.getElementById('settings-modal');
                if (sm) sm.classList.replace('hidden', 'flex');
                if (window.CPR.UI && typeof window.CPR.UI.updateBpmUI === 'function') window.CPR.UI.updateBpmUI();
                return;
            }

            // 2. Settings MODAL SCHLIESSEN
            const btnCloseSettings = e.target.closest('#btn-close-settings-bottom');
            if (btnCloseSettings) {
                e.stopPropagation();
                if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(30);
                const sm = document.getElementById('settings-modal');
                if (sm) sm.classList.replace('flex', 'hidden');
                return;
            }

            // 3. BPM STEUERUNG
            const btnBpm = e.target.closest('.bpm-opt');
            if (btnBpm) {
                e.stopPropagation();
                if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(20);
                const newBpm = parseInt(btnBpm.dataset.bpm);
                if (!isNaN(newBpm)) {
                    window.CPR.AppState.bpm = newBpm;
                    if (window.CPR.UI && typeof window.CPR.UI.updateBpmUI === 'function') window.CPR.UI.updateBpmUI();
                    if (window.CPR.Utils && window.CPR.Utils.saveSession) window.CPR.Utils.saveSession();
                }
                return;
            }

            // 4. SYSTEM LOG (Fehlersuche)
            const btnSyslog = e.target.closest('#btn-show-syslog');
            if (btnSyslog) {
                e.stopPropagation();
                if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(20);
                const logs = window.CPR.Globals?.sysLogs || [];
                const msg = logs.length > 0 ? logs.join("\n") : "Keine Fehler protokolliert.";
                if (window.CPR.Utils && window.CPR.Utils.showDialog) {
                    window.CPR.Utils.showDialog('alert', 'System Log', msg);
                } else {
                    alert(msg);
                }
                return;
            }

            // 5. HARD RESET (App löschen)
            const btnReset = e.target.closest('#btn-hard-reset');
            if (btnReset) {
                e.stopPropagation();
                if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate([50, 100, 50]);
                const confirmed = confirm("ACHTUNG: Möchtest du die App wirklich komplett zurücksetzen? Alle aktuellen Daten, Einsätze und Protokolle gehen unwiderruflich verloren!");
                if (confirmed) {
                    if (window.CPR.Utils && window.CPR.Utils.resetApp) {
                        window.CPR.Utils.resetApp();
                    } else {
                        window.CPR.isResetting = true;
                        localStorage.clear();
                        window.location.href = window.location.pathname + '?reset=' + Date.now();
                    }
                }
                return;
            }
        });
    }

    return {
        init: init
    };

})();

// Startet sich selbst, sobald die Datei geladen ist
window.CPR.Settings.init();
