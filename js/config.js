// Initialisiere den globalen Namensraum für unsere App
window.CPR = window.CPR || {};

// Feste Grundeinstellungen
window.CPR.CONFIG = {
    CYCLE_SEC: 120,
    ADR_SEC: 240,
    PAUSE_WARN_SEC: 10,
    BPM_DEFAULT: 110,
    VENT_INTERVAL_ADULT: 6.0,
    VENT_INTERVAL_PED: 2.4,
    VENT_DURATION: 1.0,
    VENT_DURATION_SYNC: 2.0,
    PRECHARGE_WARN_SEC: 15,
    PREPARE_WARN_SEC: 30
};

// Globale Variablen (Intervall-Timer etc.)
window.CPR.Globals = {
    sysLogs: [],
    wakeLock: null,
    mainInterval: null,
    cycleInterval: null,
    pauseInterval: null,
    roscInterval: null,
    adrTimerInterval: null,
    roscSeconds: 0,
    pauseSeconds: window.CPR.CONFIG.PAUSE_WARN_SEC,
    lastSavedTimestamp: Date.now(),
    tempAirwayType: ''
};

// Der aktuelle Zustand der App (wird im LocalStorage gespeichert)
window.CPR.AppState = {
    totalSeconds: 0, 
    arrestSeconds: 0, 
    compressingSeconds: 0, 
    cycleSeconds: window.CPR.CONFIG.CYCLE_SEC,
    state: 'IDLE', 
    previousState: 'IDLE', 
    isCompressing: false, 
    cprMode: '30:2', 
    protocolData: [],
    adrCount: 0, 
    amioCount: 0, 
    shockCount: 0, 
    isPediatric: false, 
    patientWeight: null, 
    adrSeconds: 0,
    bpm: window.CPR.CONFIG.BPM_DEFAULT, 
    isSoundActive: true, 
    protocolViewMode: 'timeline', 
    airwayEstablished: false,
    compressionCount: 0, 
    isVentilationPhase: false, 
    ventilationEndTime: 0, 
    ventCycleStartTime: 0, 
    continuousBeatCount: 0,
    anamneseData: { 
        beobachtet: null, laienrea: null, brustschmerz: null, therapie: null, 
        sampler: { s: '', a: '', m: '', p: '', l: '', e: '', r: '', 'plus-s': '' } 
    }
};

// Die Broselow/PALS Datenstruktur
window.CPR.broselowData = [
    {color:'grau', minKg:3, maxKg:5, avgKg:4, cm:55, ageStr: '< 1 J.', airway:{tubus:'3.0-3.5', tiefe:'9-10', sga:'1', guedel:'000', wendel:'12 CH'}},
    {color:'rosa', minKg:6, maxKg:7, avgKg:6.5, cm:65, ageStr: '< 1 J.', airway:{tubus:'3.5', tiefe:'10-11', sga:'1.5', guedel:'00', wendel:'14 CH'}},
    {color:'rot', minKg:8, maxKg:9, avgKg:8.5, cm:70, ageStr: '< 1 J.', airway:{tubus:'3.5-4.0', tiefe:'11-12', sga:'1.5', guedel:'0', wendel:'16 CH'}},
    {color:'lila', minKg:10, maxKg:11, avgKg:10.5, cm:80, ageStr: '1-2 J.', airway:{tubus:'4.0', tiefe:'12', sga:'1.5-2.0', guedel:'1', wendel:'18 CH'}},
    {color:'gelb', minKg:12, maxKg:14, avgKg:13, cm:90, ageStr: '2-3 J.', airway:{tubus:'4.0-4.5', tiefe:'13', sga:'2.0', guedel:'1', wendel:'20 CH'}},
    {color:'weiss', minKg:15, maxKg:18, avgKg:16.5, cm:100, ageStr: '4-5 J.', airway:{tubus:'4.5', tiefe:'14', sga:'2.0', guedel:'2', wendel:'22 CH'}},
    {color:'blau', minKg:19, maxKg:23, avgKg:21, cm:110, ageStr: '6-7 J.', airway:{tubus:'5.0', tiefe:'15', sga:'2.0-2.5', guedel:'2', wendel:'24 CH'}},
    {color:'orange', minKg:24, maxKg:29, avgKg:26.5, cm:120, ageStr: '8-9 J.', airway:{tubus:'5.5', tiefe:'16-17', sga:'2.5', guedel:'2-3', wendel:'26 CH'}},
    {color:'gruen', minKg:30, maxKg:36, avgKg:33, cm:135, ageStr: '10-12 J.', airway:{tubus:'6.0', tiefe:'18', sga:'3.0', guedel:'3', wendel:'28 CH'}}
];
