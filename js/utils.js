window.CPR = window.CPR || {};

window.CPR.Utils = {
    sysLog: (msg) => { 
        const time = new Date().toLocaleTimeString(); 
        console.log("[SYS] " + time + ": " + msg); 
        window.CPR.Globals.sysLogs.push(time + ": " + msg); 
        if (window.CPR.Globals.sysLogs.length > 50) window.CPR.Globals.sysLogs.shift(); 
    },
    
    vibrate: (p) => { 
        try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} 
    },
    
    formatTime: (s) => { 
        const m = Math.floor(Math.abs(s) / 60).toString().padStart(2, '0'); 
        const sec = (Math.abs(s) % 60).toString().padStart(2, '0'); 
        return m + ":" + sec; 
    },
    
    formatRelative: (s) => { 
        return "+" + window.CPR.Utils.formatTime(s); 
    },
    
    safeSetItem: (k, v) => { 
        try { localStorage.setItem(k, v); } catch (e) {} 
    },
    
    safeGetItem: (k) => { 
        try { return localStorage.getItem(k); } catch (e) { return null; } 
    },
    
    safeRemoveItem: (k) => { 
        try { localStorage.removeItem(k); } catch (e) {} 
    },

    showDialog: (type, title, message, onConfirm = null) => {
        const modal = document.getElementById('custom-dialog');
        if (!modal) return;
        document.getElementById('dialog-title').innerText = title;
        document.getElementById('dialog-message').innerText = message;
        const icon = document.getElementById('dialog-icon');
        const btnCancel = document.getElementById('btn-dialog-cancel');
        const btnConfirm = document.getElementById('btn-dialog-confirm');

        if (type === 'alert') {
            icon.innerHTML = '<i class="fa-solid fa-circle-info text-blue-500"></i>';
            btnCancel.classList.add('hidden');
            btnConfirm.className = "flex-1 bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-xs active:scale-95 shadow-md";
            btnConfirm.innerText = "Verstanden";
            btnConfirm.onclick = () => { window.CPR.Utils.vibrate(30); modal.classList.replace('flex', 'hidden'); };
        } else {
            icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-red-500"></i>';
            btnCancel.classList.remove('hidden');
            btnConfirm.className = "flex-1 bg-[#E3000F] text-white py-3 rounded-xl font-black uppercase text-xs active:scale-95 shadow-md";
            btnConfirm.innerText = "Ja, Löschen";
            btnCancel.onclick = () => { window.CPR.Utils.vibrate(30); modal.classList.replace('flex', 'hidden'); };
            btnConfirm.onclick = () => { window.CPR.Utils.vibrate(50); modal.classList.replace('flex', 'hidden'); if (onConfirm) onConfirm(); };
        }
        modal.classList.replace('hidden', 'flex');
    },

    resetApp: () => {
        // Dieser Schalter verhindert, dass beim Neuladen die Session gerettet wird!
        window.CPR.isResetting = true; 
        try { localStorage.clear(); } catch(e) {}
        try { sessionStorage.clear(); } catch(e) {}
        // Wirft den Cache ab und erzwingt einen harten, sauberen Neustart
        window.location.href = window.location.pathname + '?reset=' + Date.now();
    },

    saveSession: () => {
        // BLOCKADE: Wenn wir gerade resetten, darf NICHTS mehr gespeichert werden!
        if (window.CPR.isResetting) return; 
        
        if (window.CPR.AppState.state === 'IDLE') return;
        window.CPR.Globals.lastSavedTimestamp = Date.now();
        const session = { 
            ...window.CPR.AppState, 
            lastSavedTimestamp: window.CPR.Globals.lastSavedTimestamp, 
            startTime: document.getElementById('start-time')?.innerText || '--:--', 
            airwayLabel: document.getElementById('airway-label')?.innerText, 
            zugangLabel: document.getElementById('zugang-label')?.innerText 
        };
        window.CPR.Utils.safeSetItem('cpr_assist_session', JSON.stringify(session));
    }
};

// Globaler Notfall-Alarm: Zeigt Fehler direkt auf dem Bildschirm an!
window.onerror = function(msg, url, line) {
    console.error("[SYS CRASH] " + msg + " (Zeile " + line + ")");
    window.CPR.Utils.showDialog('alert', 'Systemfehler', msg + "\nZeile: " + line);
    return false;
};
