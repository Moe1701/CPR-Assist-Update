/**
 * CPR Assist - Audio Engine (Medical Grade)
 * FEATURE: Realistische Atem-Simulation (White Noise + Filter Envelope)
 * LEITLINIEN-KORREKTUR: Exakt 1.0 Sekunde Gesamtdauer pro Beatmung.
 */

window.CPR = window.CPR || {};
window.CPR.AudioContext = window.CPR.AudioContext || { ctx: null, nextNoteTime: 0 };

window.CPR.Audio = (function() {
    let timerID = null;

    function init() {
        if (!window.CPR.AudioContext.ctx) {
            window.CPR.AudioContext.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (window.CPR.AudioContext.ctx.state === 'suspended') {
            window.CPR.AudioContext.ctx.resume();
        }
    }

    function playMetronomeTick(time) {
        if (!window.CPR.AppState || !window.CPR.AppState.isSoundActive) return;
        const ctx = window.CPR.AudioContext.ctx;
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, time);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(1.0, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.05);
    }

    function scheduler() {
        const ctx = window.CPR.AudioContext.ctx;
        if (!ctx) return;
        
        while (window.CPR.AudioContext.nextNoteTime < ctx.currentTime + 0.1) {
            if (window.CPR.AppState && window.CPR.AppState.isCompressing && window.CPR.AppState.isRunning) {
                playMetronomeTick(window.CPR.AudioContext.nextNoteTime);
                if (typeof window.CPR.onBeat === 'function') window.CPR.onBeat();
            }
            
            const bpm = (window.CPR.AppState && window.CPR.AppState.bpm) ? window.CPR.AppState.bpm : 110;
            const secondsPerBeat = 60.0 / bpm;
            window.CPR.AudioContext.nextNoteTime += secondsPerBeat;
        }
        timerID = setTimeout(scheduler, 25);
    }

    function playAlert() {
        if (!window.CPR.AppState?.isSoundActive || !window.CPR.AudioContext.ctx) return;
        const ctx = window.CPR.AudioContext.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.2);
        osc.frequency.setValueAtTime(400, ctx.currentTime + 0.4);
        
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
    }

    function playBeep(freq = 800) {
        if (!window.CPR.AppState?.isSoundActive || !window.CPR.AudioContext.ctx) return;
        const ctx = window.CPR.AudioContext.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    }

    // 🌟 LEITLINIEN-KORREKTUR: Authentische Atem-Simulation (Exakt 1 Sekunde) 🌟
    function playVentilationSound() {
        if (!window.CPR.AppState?.isSoundActive || !window.CPR.AudioContext.ctx) return;
        const ctx = window.CPR.AudioContext.ctx;

        const duration = 1.0; // Leitlinie: Exakt 1 Sekunde pro Beatmung

        // 1. Weißes Rauschen (White Noise) erzeugen (Simuliert die strömende Luft)
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1; // Rauschen generieren
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // 2. Biquad-Filter (Lowpass): Formt das Kratz-Rauschen zu einem weichen Luftstrom
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        
        // Frequenz-Sweep: Öffnet sich beim Einatmen, schließt sich beim Ausatmen
        filter.frequency.setValueAtTime(200, ctx.currentTime); // Start tief und dumpf
        filter.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.4); // INSPIRATION Peak (helles Rauschen)
        filter.frequency.linearRampToValueAtTime(150, ctx.currentTime + 1.0);  // EXSPIRATION Ende (dumpf ausklingend bei 1.0s)

        // 3. Lautstärke (Gain) Envelope: Anschwellen und weich Abschwellen
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.4); // Einatmen Peak Volume auf 1.0 (sehr deutlich)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);   // Ausatmen weich auf 0 bei exakt 1.0s

        // Audiosignal-Kette verbinden und abfeuern
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(ctx.currentTime);
        noise.stop(ctx.currentTime + duration);
    }

    return {
        init: init,
        scheduler: scheduler,
        playAlert: playAlert,
        playBeep: playBeep,
        playVentilationSound: playVentilationSound
    };
})();
