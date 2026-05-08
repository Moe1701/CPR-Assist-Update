/**
 * CPR Assist - Export Modul (V64 - SAMPLER Alter/Gewicht Integration)
 * - FEATURE: Neues "PERFORMANCE INSIGHTS" Blatt (Seite 2) im Debriefing-Modus.
 * - UX: Manuell erfasstes Alter und Gewicht aus der Anamnese wird nahtlos in die PDF Übergabe injiziert.
 */

window.CPR = window.CPR || {};

window.CPR.Export = (function() {

    function getIconData(txt) {
        if (!txt) return null;
        const t = txt.toLowerCase();
        
        if (t.includes('schock') && !t.includes('schockbar')) {
            const match = t.match(/(\d+)\s*[jJ]/);
            if (match) return { icon: match[1] + 'J', isText: true, type: 'shock' };
            return { icon: '⚡', type: 'shock' };
        }
        if (t.includes('nicht schockbar')) return { icon: '🚫⚡', type: 'analysis-no' };
        if (t.includes('schockbar')) return { icon: '⚡', type: 'analysis-yes' };

        if (t.includes('hits') || t.includes('sampler') || t.includes('anamnese')) return { icon: '📋', type: 'info' };
        if (t.includes('adrenalin')) return { icon: '💉', type: 'adr' };
        if (t.includes('amiodaron') || t.includes('amio')) return { icon: '💊', type: 'amio' };
        if (t.includes('atemweg:') || t.includes('beatmungen durchge')) return { icon: '🫁', type: 'airway' };
        if (t.includes('zugang:')) return { icon: '🩸', type: 'access' };
        if (t.includes('start rea')) return { icon: '▶️', type: 'start' };
        if (t.includes('rosc!')) return { icon: '❤️', type: 'rosc' };
        if (t.includes('re-arrest')) return { icon: '💔', type: 'arrest' };
        if (t.includes('abbruch') || t.includes('beendet')) return { icon: '🛑', type: 'end' };
        
        if (t.includes('kompression pause') || t.includes('kompression fortgesetzt') || 
            t.includes('beatmungen übersprungen') || t.includes('modus manuell') || t.includes('atemweg entfernt')) return null;
        return { icon: '🔹', type: 'default' };
    }

    function extractPauses(data, maxSec) {
        let pauses = [];
        let currentStart = null;
        data.forEach(d => {
            const t = d.action.toLowerCase();
            if ( ((t.includes('kompression') || t.includes('cpr')) && (t.includes('paus') || t.includes('stop') || t.includes('unterbroch'))) || t.includes('analyse') || t.includes('schockbar') ) {
                if (currentStart === null) currentStart = d.secondsFromStart;
            }
            else if ((t.includes('kompression') || t.includes('cpr')) && (t.includes('fortgesetzt') || t.includes('start') || t.includes('weiter'))) {
                if (currentStart !== null) {
                    pauses.push({ start: currentStart, end: d.secondsFromStart, duration: d.secondsFromStart - currentStart });
                    currentStart = null;
                }
            }
        });
        if (currentStart !== null) pauses.push({ start: currentStart, end: maxSec, duration: maxSec - currentStart, ongoing: true });
        return pauses;
    }

    function extractSbarFacts() {
        const state = window.CPR.AppState || {};
        const data = state.protocolData || [];
        const aData = state.anamneseData || {};

        const totalSec = state.totalSeconds || 0;
        const arrSec = state.arrestSeconds || 0;
        const compSec = state.compressingSeconds || 0;
        const ccf = arrSec > 0 ? Math.min(100, Math.round((compSec / arrSec) * 100)) : 0;
        
        // 🌟 NEU: Integriert Alter & Gewicht aus den SAMPLER Leitfragen 🌟
        let ageStr = state.isPediatric ? (state.patientWeight ? `Kind (${state.patientWeight} kg)` : 'Kind (Gewicht unbek.)') : 'Erwachsener';
        if (aData.alter || aData.gewicht) {
            let zusatz = [];
            if (aData.alter) zusatz.push(`${aData.alter} J.`);
            if (aData.gewicht) zusatz.push(`${aData.gewicht} kg`);
            ageStr += ` (${zusatz.join(' | ')})`;
        }

        let adrTotal = "0 mg", adrCount = state.adrCount || 0;
        if (adrCount > 0) adrTotal = (state.isPediatric && state.patientWeight) ? (adrCount * Math.round(state.patientWeight * 10)) + " µg" : adrCount + " mg";
        let amioTotal = "0 mg", amioCount = state.amioCount || 0;
        if (amioCount > 0) amioTotal = (state.isPediatric && state.patientWeight) ? (amioCount * Math.round(state.patientWeight * 5)) + " mg" : (amioCount === 1 ? '300 mg' : '450 mg');

        let sampStr = [];
        if (aData.sampler) {
            const sMap = {s:'Symptome', a:'Allergien', m:'Medikamente', p:'Vorerkrankungen', l:'Letzte Mahlzeit', e:'Ereignis', r:'Risikofaktoren'};
            Object.keys(sMap).forEach(k => { if (aData.sampler[k]) sampStr.push(`${sMap[k]}: ${aData.sampler[k]}`); });
        }
        const hitsLogs = data.filter(d => d.action.includes('HITS:'));
        const hitsArr = hitsLogs.map(h => h.action.replace('HITS: ', ''));

        let endStatus = 'Laufende CPR';
        let timeToRosc = null;
        let abbruchReason = null;

        let firstCPR = null, firstShock = null, firstAdr = null, firstAccess = null;
        let firstAirway = null, definitiveAirway = null;
        let adrTimes = [], amioTimes = [], analyses = [];
        let totalJoule = 0, shockCountStats = 0;
        
        let anaToShockIntervals = [];
        let lastAnalysisTime = null;

        data.forEach(d => {
            const t = d.action.toLowerCase();
            const sec = d.secondsFromStart;

            if (t.includes('rosc') && !t.includes('re-arrest')) {
                endStatus = 'ROSC';
                if (timeToRosc === null) timeToRosc = sec;
            } else if (t.includes('re-arrest') || t.includes('start rea')) {
                endStatus = 'Laufende CPR';
            } else if (t.includes('abbruch') || t.includes('beendet')) {
                endStatus = 'Abbruch';
                const splitChar = t.includes(':') ? ':' : (t.includes('-') ? '-' : null);
                if (splitChar) {
                    const parts = d.action.split(splitChar);
                    if (parts.length > 1) abbruchReason = parts[1].trim();
                }
            }

            if (!firstCPR && (t.includes('start rea') || t.includes('kompression begonnen'))) firstCPR = sec;
            if (!firstShock && t.includes('schock abgegeben')) firstShock = sec;
            if (!firstAdr && t.includes('adrenalin')) firstAdr = sec;
            if (!firstAccess && t.includes('zugang:')) firstAccess = sec;

            if (t.includes('atemweg:') && !t.includes('entfernt')) {
                const awType = d.action.split(':')[1]?.split('(')[0]?.trim() || 'Unbekannt';
                if (!firstAirway) firstAirway = { time: sec, type: awType };
                if (!t.includes('beutel-maske') && !definitiveAirway) definitiveAirway = { time: sec, type: awType };
            }

            if (t.includes('adrenalin')) adrTimes.push(sec);
            if (t.includes('amiodaron') || t.includes('amio')) amioTimes.push(sec);
            if (t.includes('rhythmusanalyse') || t.includes('schockbar') || t.includes('nicht schockbar')) {
                analyses.push(sec);
                lastAnalysisTime = sec;
            }

            if (t.includes('schock abgegeben')) {
                shockCountStats++;
                const match = d.action.match(/(\d+)\s*[jJ]/);
                if (match) totalJoule += parseInt(match[1], 10);
                
                if (lastAnalysisTime !== null) {
                    anaToShockIntervals.push(sec - lastAnalysisTime);
                    lastAnalysisTime = null;
                }
            }
        });

        if (endStatus === 'ROSC' && timeToRosc === null) timeToRosc = totalSec;
        if (endStatus === 'Abbruch' && !abbruchReason) abbruchReason = "Teamentscheidung / Unbekannt";

        const maxSec = data.length > 0 ? Math.max(totalSec, data[data.length - 1].secondsFromStart) : totalSec;
        const pausesObj = extractPauses(data, maxSec);
        
        const maxPause = pausesObj.length > 0 ? Math.max(...pausesObj.map(p => p.duration)) : 0;
        const totalHandsOff = Math.max(0, arrSec - compSec);

        let adrIntervals = []; for (let i = 1; i < adrTimes.length; i++) adrIntervals.push(adrTimes[i] - adrTimes[i-1]);
        const avgAdrInt = adrIntervals.length > 0 ? Math.round(adrIntervals.reduce((a, b) => a + b, 0) / adrIntervals.length) : 0;
        
        let amioIntervals = []; for (let i = 1; i < amioTimes.length; i++) amioIntervals.push(amioTimes[i] - amioTimes[i-1]);
        const avgAmioInt = amioIntervals.length > 0 ? Math.round(amioIntervals.reduce((a, b) => a + b, 0) / amioIntervals.length) : 0;

        let anaIntervals = []; for (let i = 1; i < analyses.length; i++) anaIntervals.push(analyses[i] - analyses[i-1]);
        const avgAnaInt = anaIntervals.length > 0 ? Math.round(anaIntervals.reduce((a, b) => a + b, 0) / anaIntervals.length) : 0;

        const avgAnaToShock = anaToShockIntervals.length > 0 ? Math.round(anaToShockIntervals.reduce((a,b)=>a+b,0)/anaToShockIntervals.length) : 0;
        const minAnaToShock = anaToShockIntervals.length > 0 ? Math.min(...anaToShockIntervals) : 0;
        const maxAnaToShock = anaToShockIntervals.length > 0 ? Math.max(...anaToShockIntervals) : 0;

        return { 
            ageStr, totalSec, ccf, adrCount, adrTotal, amioCount, amioTotal, aData, sampStr, hitsArr, state, data, 
            endStatus, timeToRosc, abbruchReason, maxSec, pausesObj, 
            firstCPR, firstShock, firstAdr, firstAccess, firstAirway, definitiveAirway, 
            maxPause, totalHandsOff, avgAdrInt, avgAmioInt, avgAnaInt,
            shockCountStats, totalJoule, avgAnaToShock, minAnaToShock, maxAnaToShock
        };
    }

    function drawSbarNative(doc, facts) {
        const { ageStr, totalSec, ccf, adrTotal, amioTotal, aData, sampStr, hitsArr, state, adrCount, amioCount, endStatus, timeToRosc, abbruchReason } = facts;
        const Utils = window.CPR.Utils;
        
        let y = 45;
        
        doc.setFontSize(14); doc.setTextColor(227, 0, 15); doc.setFont("helvetica", "bold");
        doc.text("S - SITUATION", 15, y);
        doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.5); doc.line(15, y+2, 195, y+2);
        y += 10;

        doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
        doc.roundedRect(15, y, 65, 24, 2, 2, 'FD');  // Patient (Breiter gemacht für Alter & Gewicht)
        doc.roundedRect(85, y, 35, 24, 2, 2, 'FD');  // Dauer
        doc.roundedRect(125, y, 70, 24, 2, 2, 'FD'); // Status
        
        doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal");
        doc.text("PATIENT", 47.5, y+6, {align: 'center'});
        doc.text("GESAMTDAUER", 102.5, y+6, {align: 'center'});
        doc.text("AKTUELLER STATUS", 160, y+6, {align: 'center'});
        
        doc.setFontSize(11); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text(ageStr, 47.5, y+14, {align: 'center'});
        doc.setFontSize(12);
        doc.text(`${Utils.formatTime(totalSec)} Min`, 102.5, y+14, {align: 'center'});
        
        if(endStatus === 'ROSC') doc.setTextColor(16, 185, 129);
        else if(endStatus === 'Abbruch') doc.setTextColor(15, 23, 42);
        
        doc.text(endStatus.toUpperCase(), 160, y+14, {align: 'center'});

        if (endStatus === 'ROSC' && timeToRosc !== null) {
            doc.setFontSize(9); doc.setTextColor(4, 120, 87); doc.setFont("helvetica", "normal");
            doc.text(`Zeit bis ROSC: ${Utils.formatTime(timeToRosc)} Min`, 160, y+20, {align: 'center'});
        } else if (endStatus === 'Abbruch' && abbruchReason) {
            doc.setFontSize(8); doc.setTextColor(71, 85, 105); doc.setFont("helvetica", "normal");
            const splitReason = doc.splitTextToSize(`Grund: ${abbruchReason}`, 65);
            doc.text(splitReason, 160, y+20, {align: 'center'});
        }
        
        y += 35;

        doc.setFontSize(14); doc.setTextColor(227, 0, 15); doc.setFont("helvetica", "bold");
        doc.text("B - BACKGROUND (ANAMNESE)", 15, y);
        doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.5); doc.line(15, y+2, 195, y+2);
        y += 8;

        doc.roundedRect(15, y, 180, 40, 2, 2, 'S');
        doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text("Beobachtet:", 20, y+8); doc.setFont("helvetica", "normal"); doc.text(aData.beobachtet || '?', 45, y+8);
        doc.setFont("helvetica", "bold"); doc.text("Laien-REA:", 80, y+8); doc.setFont("helvetica", "normal"); doc.text(aData.laienrea || '?', 105, y+8);
        doc.setFont("helvetica", "bold"); doc.text("Brustschmerz:", 140, y+8); doc.setFont("helvetica", "normal"); doc.text(aData.brustschmerz || '?', 170, y+8);
        
        doc.setDrawColor(203, 213, 225); doc.setLineDashPattern([2, 2], 0); doc.line(20, y+14, 190, y+14); doc.setLineDashPattern([], 0);
        
        doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "bold");
        doc.text("SAMPLER:", 20, y+20);
        doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "normal");
        if(sampStr.length > 0) {
            let sy = y+25;
            sampStr.forEach(s => { doc.text(s, 20, sy); sy += 5; });
        } else {
            doc.setFont("helvetica", "italic"); doc.setTextColor(148, 163, 184); doc.text("Keine SAMPLER-Daten erfasst.", 20, y+25);
        }
        
        y += 50;

        doc.setFontSize(14); doc.setTextColor(227, 0, 15); doc.setFont("helvetica", "bold");
        doc.text("A - ASSESSMENT (DIAGNOSTIK)", 15, y);
        doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.5); doc.line(15, y+2, 195, y+2);
        y += 8;

        doc.roundedRect(15, y, 180, 35, 2, 2, 'S');
        doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "bold");
        doc.text("Reversible Ursachen (HITS):", 20, y+8);
        
        doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "normal");
        if(hitsArr.length > 0) {
            let hy = y+14;
            hitsArr.forEach(h => { doc.text("- " + h, 20, hy); hy += 6; });
        } else {
            doc.setFont("helvetica", "italic"); doc.setTextColor(148, 163, 184); doc.text("Keine Ursachen (HITS) erfasst.", 20, y+14);
        }

        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.line(135, y+2, 135, y+33);
        doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "bold");
        doc.text("CPR Qualität (CCF):", 165, y+10, {align: 'center'});
        
        doc.setFontSize(24); doc.setFont("helvetica", "bold");
        if (ccf >= 80) doc.setTextColor(16, 185, 129); else doc.setTextColor(227, 0, 15);
        doc.text(`${ccf}%`, 165, y+22, {align: 'center'});
        doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.text("Zielwert: > 80%", 165, y+28, {align: 'center'});
        
        y += 45;

        doc.setFontSize(14); doc.setTextColor(227, 0, 15); doc.setFont("helvetica", "bold");
        doc.text("R - RESPONSE (MAßNAHMEN)", 15, y);
        doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.5); doc.line(15, y+2, 195, y+2);
        y += 8;

        const drawRow = (yPos, label, val, isRed=false, isPurp=false) => {
            doc.setFillColor(isRed ? 254 : (isPurp ? 250 : 248), isRed ? 242 : (isPurp ? 245 : 250), isRed ? 242 : (isPurp ? 255 : 252));
            doc.rect(15, yPos, 60, 8, 'FD'); doc.rect(75, yPos, 120, 8, 'S');
            doc.setFontSize(10); doc.setFont("helvetica", "bold");
            doc.setTextColor(100, 116, 139); if(isRed) doc.setTextColor(227, 0, 15); if(isPurp) doc.setTextColor(126, 34, 206);
            doc.text(label, 20, yPos+5.5);
            doc.setTextColor(15, 23, 42); if(isRed) doc.setTextColor(227, 0, 15); if(isPurp) doc.setTextColor(126, 34, 206);
            doc.text(val, 80, yPos+5.5);
        };

        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
        drawRow(y, "Atemweg", state.airwayLabel || 'Nicht dokumentiert');
        drawRow(y+8, "Zugang", state.zugangLabel || 'Nicht dokumentiert');
        drawRow(y+16, "Defibrillationen", `${state.shockCount || 0}x Schocks abgegeben`);
        drawRow(y+24, "Adrenalin", `Gesamt: ${adrTotal} (${adrCount} Gaben)`, true, false);
        drawRow(y+32, "Amiodaron", `Gesamt: ${amioTotal} (${amioCount} Gaben)`, false, true);
    }

    function drawStatsNative(doc, facts) {
        const { totalHandsOff, maxPause, avgAdrInt, avgAmioInt, avgAnaInt, firstCPR, firstShock, firstAdr, firstAccess, firstAirway, definitiveAirway, shockCountStats, totalJoule, avgAnaToShock, minAnaToShock, maxAnaToShock, timeToRosc } = facts;
        const Utils = window.CPR.Utils;
        const format = Utils.formatTime;

        let y = 20;

        doc.setFontSize(22); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text("PERFORMANCE INSIGHTS", 15, y);
        
        doc.setFontSize(10); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal");
        doc.text("DETAILLIERTE KPI-AUSWERTUNG FÜR DAS DEBRIEFING", 15, y+6);
        
        y += 10;
        doc.setDrawColor(227, 0, 15); doc.setLineWidth(1); doc.line(15, y, 195, y);
        y += 10; 

        doc.setFontSize(12); doc.setTextColor(227, 0, 15); doc.setFont("helvetica", "bold");
        doc.text("1. CPR QUALITÄT & PAUSEN", 15, y);
        y += 4;
        
        doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
        doc.roundedRect(15, y, 56, 18, 2, 2, 'FD');
        doc.roundedRect(77, y, 56, 18, 2, 2, 'FD');
        doc.roundedRect(139, y, 56, 18, 2, 2, 'FD');

        doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "bold");
        doc.text("CCF (CPR-ANTEIL)", 43, y+5, {align: 'center'});
        doc.text("HANDS-OFF GESAMT", 105, y+5, {align: 'center'});
        doc.text("LÄNGSTE PAUSE", 167, y+5, {align: 'center'});

        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        if (facts.ccf >= 80) doc.setTextColor(16, 185, 129); else doc.setTextColor(227, 0, 15);
        doc.text(`${facts.ccf}%`, 43, y+14, {align: 'center'});

        doc.setTextColor(15, 23, 42);
        doc.text(`${format(totalHandsOff)} Min`, 105, y+14, {align: 'center'});

        if (maxPause > 10) doc.setTextColor(227, 0, 15); else doc.setTextColor(16, 185, 129);
        doc.text(`${maxPause} s`, 167, y+14, {align: 'center'});

        y += 26;

        doc.setFontSize(12); doc.setTextColor(227, 0, 15); doc.setFont("helvetica", "bold");
        doc.text("2. SCHOCK-THERAPIE & RHYTHMUS", 15, y);
        y += 4;
        
        doc.setFillColor(248, 250, 252); 
        doc.roundedRect(15, y, 56, 18, 2, 2, 'FD');
        doc.roundedRect(77, y, 56, 18, 2, 2, 'FD');
        doc.roundedRect(139, y, 56, 18, 2, 2, 'FD');

        doc.setFontSize(7); doc.setTextColor(100, 116, 139);
        doc.text("DEFIBRILLATIONEN", 43, y+5, {align: 'center'});
        doc.text("PRE-SHOCK PAUSE", 105, y+5, {align: 'center'});
        doc.text("ZEIT BIS ROSC", 167, y+5, {align: 'center'});

        doc.setFontSize(12); doc.setTextColor(15, 23, 42);
        doc.text(shockCountStats > 0 ? `${shockCountStats}x (${totalJoule} J)` : '0x', 43, y+12, {align: 'center'});
        
        doc.setTextColor(227, 0, 15); 
        doc.text(avgAnaToShock > 0 ? `${avgAnaToShock} s` : '--', 105, y+11, {align: 'center'});
        doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
        if (avgAnaToShock > 0) doc.text(`Min: ${minAnaToShock}s | Max: ${maxAnaToShock}s`, 105, y+16, {align: 'center'});
        
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(16, 185, 129);
        doc.text(timeToRosc !== null ? format(timeToRosc) : '--:--', 167, y+14, {align: 'center'});

        y += 26; 

        doc.setFontSize(12); doc.setTextColor(227, 0, 15); doc.setFont("helvetica", "bold");
        doc.text("3. MEDIKAMENTE & INTERVALLE", 15, y);
        y += 4;
        
        doc.setFillColor(248, 250, 252); 
        doc.roundedRect(15, y, 56, 18, 2, 2, 'FD');
        doc.roundedRect(77, y, 56, 18, 2, 2, 'FD');
        doc.roundedRect(139, y, 56, 18, 2, 2, 'FD');

        doc.setFontSize(7); doc.setTextColor(100, 116, 139);
        doc.text("Ø ADRENALIN-INTERVALL", 43, y+5, {align: 'center'});
        doc.text("Ø AMIODARON-INTERVALL", 105, y+5, {align: 'center'});
        doc.text("Ø RHYTHMUS-ANALYSE", 167, y+5, {align: 'center'});

        doc.setFontSize(14); doc.setTextColor(15, 23, 42);
        doc.text(avgAdrInt > 0 ? format(avgAdrInt) : '--:--', 43, y+14, {align: 'center'});
        doc.text(avgAmioInt > 0 ? format(avgAmioInt) : '--:--', 105, y+14, {align: 'center'});
        doc.text(avgAnaInt > 0 ? format(avgAnaInt) : '--:--', 167, y+14, {align: 'center'});

        y += 26;

        doc.setFontSize(12); doc.setTextColor(227, 0, 15); doc.setFont("helvetica", "bold");
        doc.text("4. ATEMWEGS-MANAGEMENT", 15, y);
        y += 4;
        
        doc.setFillColor(248, 250, 252); 
        doc.roundedRect(15, y, 87, 18, 2, 2, 'FD');
        doc.roundedRect(108, y, 87, 18, 2, 2, 'FD');

        doc.setFontSize(7); doc.setTextColor(100, 116, 139);
        doc.text(`1. MASSNAHME (${firstAirway ? firstAirway.type.toUpperCase() : '-'})`, 58.5, y+5, {align: 'center'});
        doc.text(`SICHERUNG (${definitiveAirway ? definitiveAirway.type.toUpperCase() : '-'})`, 151.5, y+5, {align: 'center'});

        doc.setFontSize(14); doc.setTextColor(15, 23, 42);
        doc.text(firstAirway ? format(firstAirway.time) : '--:--', 58.5, y+14, {align: 'center'});
        doc.text(definitiveAirway ? format(definitiveAirway.time) : '--:--', 151.5, y+14, {align: 'center'});

        y += 26;

        doc.setFontSize(12); doc.setTextColor(227, 0, 15); doc.setFont("helvetica", "bold");
        doc.text("5. REAKTIONSZEITEN (AB START REA)", 15, y);
        y += 4;
        
        doc.setFillColor(248, 250, 252); 
        doc.roundedRect(15, y, 42, 18, 2, 2, 'FD');
        doc.roundedRect(61, y, 42, 18, 2, 2, 'FD');
        doc.roundedRect(107, y, 42, 18, 2, 2, 'FD');
        doc.roundedRect(153, y, 42, 18, 2, 2, 'FD');

        doc.setFontSize(7); doc.setTextColor(100, 116, 139);
        doc.text("1. KOMPRESSION", 36, y+5, {align: 'center'});
        doc.text("1. SCHOCK", 82, y+5, {align: 'center'});
        doc.text("1. SUPRA", 128, y+5, {align: 'center'});
        doc.text("1. ZUGANG", 174, y+5, {align: 'center'});

        doc.setFontSize(14); doc.setTextColor(15, 23, 42);
        doc.text(firstCPR !== null ? format(firstCPR) : '--:--', 36, y+14, {align: 'center'});
        doc.text(firstShock !== null ? format(firstShock) : '--:--', 82, y+14, {align: 'center'});
        doc.text(firstAdr !== null ? format(firstAdr) : '--:--', 128, y+14, {align: 'center'});
        doc.text(firstAccess !== null ? format(firstAccess) : '--:--', 174, y+14, {align: 'center'});
        
        doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.setFont("helvetica", "normal");
        doc.text("Dieses Protokoll wurde maschinell durch CPR Assist erstellt. Alle Angaben sind fachlich zu prüfen.", 105, 285, {align: 'center'});
    }


    function drawSafeRoundRect(ctx, x, y, w, h, r) {
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); } else {
            ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
        }
    }

    function createTimelineCanvasChunk(data, pauses, pageIndex, maxSecOverall) {
        const events = data.map(d => ({ ...d, iconData: getIconData(d.action), timeStr: window.CPR.Utils.formatRelative(d.secondsFromStart) })).filter(d => d.iconData !== null);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = 2; 
        
        const baseWidth = 1400; 
        const baseHeight = 900; 
        
        canvas.width = baseWidth * scale;
        canvas.height = baseHeight * scale;
        ctx.scale(scale, scale);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, baseWidth, baseHeight);

        ctx.fillStyle = '#64748b'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`GRAFISCHES ZEITLINIEN-GRID (Seite ${pageIndex + 1})`, baseWidth / 2, 40);
        
        ctx.fillStyle = '#334155'; ctx.font = 'bold 12px Arial';
        const legendText = "▶ START  |  ❤️ ROSC  |  ⚡ SCHOCKBAR  |  🚫⚡ NICHT SCHOCKBAR  |  SCHOCK (Joule in Rot)  |  💉 ADRENALIN  |  💊 AMIO  |  🫁 ATEMWEG  |  🩸 ZUGANG  |  CPR PAUSE (Roter Balken)";
        ctx.fillText(legendText, baseWidth / 2, 70);

        const paddingX = 80;
        const usableWidth = baseWidth - (paddingX * 2);
        
        const cycleDuration = 240; 
        const startSecForPage = pageIndex * 5 * cycleDuration;

        for (let i = 0; i < 5; i++) {
            const currentDrawSec = startSecForPage + (i * cycleDuration);
            if (currentDrawSec > maxSecOverall && i > 0) break;
            const cycleEndSec = currentDrawSec + cycleDuration;
            const lineY = 160 + (i * 150);

            ctx.beginPath(); ctx.moveTo(paddingX, lineY); ctx.lineTo(baseWidth - paddingX, lineY);
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
            
            for (let t = 15; t < cycleDuration; t += 15) {
                const tickSec = currentDrawSec + t;
                const pct = t / cycleDuration;
                const xTick = paddingX + pct * usableWidth;
                let tickH = (t % 60 === 0) ? 14 : 6;
                
                ctx.beginPath(); ctx.moveTo(xTick, lineY - tickH/2); ctx.lineTo(xTick, lineY + tickH/2);
                ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; ctx.stroke();

                if (t % 60 === 0) {
                    ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                    ctx.fillText(window.CPR.Utils.formatTime(tickSec), xTick, lineY + 10);
                }
            }
            
            pauses.forEach(p => {
                const pStart = Math.max(p.start, currentDrawSec);
                const pEnd = Math.min(p.end, cycleEndSec);
                if (pStart < pEnd) {
                    const pctStart = (pStart - currentDrawSec) / cycleDuration;
                    const pctEnd = (pEnd - currentDrawSec) / cycleDuration;
                    const xStart = paddingX + pctStart * usableWidth;
                    const xEnd = paddingX + pctEnd * usableWidth;
                    const pWidth = xEnd - xStart;

                    ctx.fillStyle = '#ef4444'; 
                    ctx.fillRect(xStart, lineY - 5, pWidth, 10);

                    if (pWidth > 20) {
                        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillText(p.duration + 's', xStart + pWidth/2, lineY);
                    }
                }
            });

            ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillRect(paddingX - 1, lineY - 8, 2, 16);
            ctx.fillText(window.CPR.Utils.formatTime(currentDrawSec), paddingX, lineY - 12);
            ctx.fillRect(paddingX + usableWidth - 1, lineY - 8, 2, 16);
            ctx.fillText(window.CPR.Utils.formatTime(cycleEndSec), paddingX + usableWidth, lineY - 12);

            const cycleEvents = events.filter(e => e.secondsFromStart >= currentDrawSec && e.secondsFromStart < cycleEndSec);

            cycleEvents.forEach((ev, index) => {
                const secInCycle = ev.secondsFromStart - currentDrawSec;
                const pct = secInCycle / cycleDuration;
                const x = paddingX + (pct * usableWidth);

                const yOffsets = [15, -15, 35, -35, 55, -55];
                const yOff = yOffsets[index % yOffsets.length];
                const boxHeight = 28;
                const boxY = lineY + yOff - boxHeight/2;

                const actionText = ev.action.length > 35 ? ev.action.substring(0, 35) + '...' : ev.action;
                const textWidth = ctx.measureText(actionText).width;
                const timeWidth = ctx.measureText(`[${ev.timeStr}]`).width;
                const boxWidth = textWidth + timeWidth + 40;
                const boxHalf = boxWidth / 2;

                ctx.beginPath(); ctx.moveTo(x, lineY); ctx.lineTo(x, lineY + yOff);
                ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; ctx.stroke();

                ctx.shadowColor = 'rgba(0,0,0,0.05)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
                ctx.fillStyle = '#ffffff';
                drawSafeRoundRect(ctx, x - boxHalf, boxY, boxWidth, boxHeight, 6); 
                ctx.fill(); ctx.shadowColor = 'transparent';

                let borderColor = '#e2e8f0';
                if (ev.iconData.type === 'adr' || ev.iconData.type === 'shock') borderColor = '#fca5a5';
                if (ev.iconData.type === 'amio') borderColor = '#d8b4fe';
                if (ev.iconData.type === 'analysis-yes') borderColor = '#fde047';
                
                ctx.strokeStyle = borderColor; ctx.lineWidth = 2; ctx.stroke();

                ctx.fillStyle = '#E3000F'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillText(`[${ev.timeStr}]`, x - boxHalf + 10, boxY + boxHeight/2);
                ctx.fillStyle = '#334155'; ctx.font = 'bold 12px Arial';
                ctx.fillText(`${ev.iconData.icon} ${actionText}`, x - boxHalf + 10 + timeWidth + 5, boxY + boxHeight/2);

                ctx.beginPath(); ctx.arc(x, lineY, 4, 0, 2 * Math.PI); ctx.fillStyle = '#334155'; ctx.fill();
            });
        }
        return canvas;
    }

    function generatePdfExport() {
        const { AppState, Utils } = window.CPR;
        if (!AppState || !AppState.protocolData || AppState.protocolData.length === 0) { alert("Das Protokoll ist leer."); return; }

        if (!window.jspdf) {
            alert("Fehler: jsPDF Bibliothek nicht gefunden. Bitte index.html prüfen.");
            return;
        }

        const btnPdf = document.getElementById('btn-run-pdf-export');
        const origContent = btnPdf ? btnPdf.innerHTML : '';
        if (btnPdf) btnPdf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ERSTELLE PDF...';

        const btnExportShort = document.getElementById('btn-export-short');
        const isSummary = btnExportShort && btnExportShort.classList.contains('bg-white');
        
        const now = new Date();
        const dateStr = now.toLocaleDateString('de-DE');
        const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }).replace(':', '');
        const filename = `CPR_Protokoll_${dateStr.replace(/\./g, '-')}_${timeStr}.pdf`;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        
        const facts = extractSbarFacts();

        const uiStartRaw = document.getElementById('start-time')?.innerText || '--:--';
        const safeStartTimeStr = uiStartRaw !== '--:--' ? uiStartRaw.replace('Start:', '').trim() + ' Uhr' : '--:--';

        doc.setFontSize(22); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text("REANIMATIONSPROTOKOLL", 15, 20);
        
        doc.setFontSize(10); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal");
        doc.text(`MODUS: ${isSummary ? 'SCHOCKRAUM ÜBERGABE' : 'DEBRIEFING & AUDIT'}`, 15, 26);
        
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
        doc.text(`Datum: ${dateStr}`, 195, 20, {align: 'right'});
        doc.text(`Einsatzbeginn: ${safeStartTimeStr}`, 195, 26, {align: 'right'});
        
        doc.setDrawColor(227, 0, 15); doc.setLineWidth(1); doc.line(15, 30, 195, 30);
        
        drawSbarNative(doc, facts);

        doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.setFont("helvetica", "normal");
        doc.text("Dieses Protokoll wurde maschinell durch CPR Assist erstellt. Alle Angaben sind fachlich zu prüfen.", 105, 285, {align: 'center'});

        if (!isSummary) {
            
            doc.addPage('a4', 'portrait');
            drawStatsNative(doc, facts);

            const data = AppState.protocolData;
            const maxSec = facts.maxSec;
            const pauses = facts.pausesObj;
            const totalPagesTimeline = Math.max(1, Math.ceil(maxSec / (5 * 240))); 

            for (let p = 0; p < totalPagesTimeline; p++) {
                doc.addPage('a4', 'landscape');
                const canvas = createTimelineCanvasChunk(data, pauses, p, maxSec);
                const imgData = canvas.toDataURL('image/jpeg', 0.7); 
                doc.addImage(imgData, 'JPEG', 10, 10, 277, 190, undefined, 'FAST');
                
                doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.setFont("helvetica", "normal");
                doc.text("Generiert durch CPR Assist", 148.5, 205, {align: 'center'});
            }

            doc.addPage('a4', 'portrait');
            let listY = 20;
            
            doc.setFontSize(14); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "bold");
            doc.text("MINUTENGENAUE CHRONOLOGIE (LISTENPROTOKOLL)", 15, listY);
            listY += 4;
            doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.line(15, listY, 195, listY);
            listY += 8;

            doc.setFillColor(241, 245, 249); doc.rect(15, listY-6, 180, 10, 'F');
            doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
            doc.text("Uhrzeit", 20, listY);
            doc.text("Dauer", 50, listY);
            doc.text("Aktion / Maßnahme", 80, listY);
            doc.line(15, listY+4, 195, listY+4);
            listY += 10;

            data.forEach(item => {
                const relTime = Utils.formatRelative(item.secondsFromStart);
                const plainAction = item.action.replace(/[\u1000-\uFFFF]+/g, '').trim(); 
                
                const splitText = doc.splitTextToSize(plainAction, 110);
                const rowHeight = splitText.length * 5;

                if (listY + rowHeight > 275) {
                    doc.addPage('a4', 'portrait');
                    listY = 20;
                    doc.setFillColor(241, 245, 249); doc.rect(15, listY-6, 180, 10, 'F');
                    doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
                    doc.text("Uhrzeit", 20, listY); doc.text("Dauer", 50, listY); doc.text("Aktion / Maßnahme", 80, listY);
                    doc.line(15, listY+4, 195, listY+4);
                    listY += 10;
                }

                doc.setFontSize(9); doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 116, 139); doc.text(item.time, 20, listY);
                doc.setTextColor(227, 0, 15); doc.setFont("helvetica", "bold"); doc.text(relTime, 50, listY);
                doc.setTextColor(51, 65, 85); doc.text(splitText, 80, listY);
                
                listY += rowHeight + 3;
                doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.2); doc.line(15, listY-2, 195, listY-2);
            });
            
            doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.setFont("helvetica", "normal");
            doc.text("Dieses Protokoll wurde maschinell durch CPR Assist erstellt. Alle Angaben sind fachlich zu prüfen.", 105, 285, {align: 'center'});
        }

        try {
            doc.save(filename);
            if (Utils.vibrate) Utils.vibrate(30);
        } catch (e) {
            alert("Fehler beim Erstellen des PDFs.");
        }
        
        if (btnPdf) btnPdf.innerHTML = origContent;
        const em = document.getElementById('export-modal');
        if (em) em.classList.replace('flex', 'hidden');
    }

    function generateTxtExport() {
        const { AppState, Utils } = window.CPR;
        if (!AppState || !AppState.protocolData || AppState.protocolData.length === 0) { alert("Protokoll leer."); return; }
        
        const btnExportShort = document.getElementById('btn-export-short');
        const isSummary = btnExportShort && btnExportShort.classList.contains('bg-white');
        const facts = extractSbarFacts();
        
        const uiStartRaw = document.getElementById('start-time')?.innerText || '--:--';
        const safeStartTimeStr = uiStartRaw !== '--:--' ? uiStartRaw.replace('Start:', '').trim() + ' Uhr' : '--:--';

        let text = "🚨 REANIMATIONSPROTOKOLL - " + (isSummary ? "ÜBERGABE (SBAR)" : "DEBRIEFING") + "\n";
        text += "Datum: " + new Date().toLocaleDateString() + " | Beginn: " + safeStartTimeStr + "\n\n";
        
        text += "--- [S] SITUATION ---\nPatient: " + facts.ageStr + "\n";
        text += "Status: " + facts.endStatus + "\nDauer: " + Utils.formatTime(facts.totalSec) + " Min\n";
        if (facts.endStatus === 'ROSC' && facts.timeToRosc !== null) text += "Zeit bis ROSC: " + Utils.formatTime(facts.timeToRosc) + " Min\n";
        if (facts.endStatus === 'Abbruch' && facts.abbruchReason) text += "Abbruchgrund: " + facts.abbruchReason + "\n";

        text += "\n--- [B] BACKGROUND ---\nBeobachtet: " + (facts.aData.beobachtet || '?') + " | Laien-REA: " + (facts.aData.laienrea || '?') + " | Brustschmerz: " + (facts.aData.brustschmerz || '?') + "\n";
        if (facts.sampStr.length > 0) text += facts.sampStr.join('\n') + "\n";
        
        text += "\n--- [A] ASSESSMENT ---\nCPR Qualität (CCF): " + facts.ccf + "%\n";
        if (facts.hitsArr.length > 0) facts.hitsArr.forEach(h => text += "- " + h + "\n"); else text += "Keine HITS erfasst.\n";
        
        text += "\n--- [R] RESPONSE ---\nAtemweg: " + (AppState.airwayLabel || 'Nicht dok.') + "\nZugang: " + (AppState.zugangLabel || 'Nicht dok.') + "\nSchocks: " + (facts.shockCountStats || 0) + "x abgegeben (Gesamt: " + facts.totalJoule + " J)\nAdrenalin: " + facts.adrTotal + " (" + facts.adrCount + " Gaben)\nAmiodaron: " + facts.amioTotal + " (" + facts.amioCount + " Gaben)\n\n";

        if (!isSummary) {
            text += "--- PERFORMANCE INSIGHTS ---\n";
            text += "Hands-Off Gesamt: " + Utils.formatTime(facts.totalHandsOff) + " Min\n";
            text += "Längste Pause: " + facts.maxPause + " s\n";
            if (facts.avgAnaToShock > 0) text += "Ø Pre-Shock Pause: " + facts.avgAnaToShock + " s (Min: " + facts.minAnaToShock + "s | Max: " + facts.maxAnaToShock + "s)\n";
            text += "Ø Adrenalin-Intervall: " + (facts.avgAdrInt > 0 ? Utils.formatTime(facts.avgAdrInt) : '--:--') + "\n";
            text += "Ø Amiodaron-Intervall: " + (facts.avgAmioInt > 0 ? Utils.formatTime(facts.avgAmioInt) : '--:--') + "\n";
            text += "Atemweg 1. Maßnahme: " + (facts.firstAirway ? Utils.formatTime(facts.firstAirway.time) + " (" + facts.firstAirway.type + ")" : "--:--") + "\n";
            text += "Atemweg Sicherung: " + (facts.definitiveAirway ? Utils.formatTime(facts.definitiveAirway.time) + " (" + facts.definitiveAirway.type + ")" : "--:--") + "\n\n";

            text += "--- CHRONOLOGIE ---\n";
            AppState.protocolData.forEach(item => { text += `[+${Utils.formatTime(item.secondsFromStart)}] ${item.time} | ${item.action.replace(/[\u1000-\uFFFF]+/g, '').trim()}\n`; });
        }
        text += "\n-- Generiert durch CPR Assist --";

        function fallbackCopy(t) {
            const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); updateTxtButton(); } catch(err) { alert("Fehler beim Kopieren."); }
            document.body.removeChild(ta);
        }

        function updateTxtButton() {
            if(Utils.vibrate) Utils.vibrate(30);
            const btnTxt = document.getElementById('btn-run-txt-export');
            if(btnTxt) {
                const oldHtml = btnTxt.innerHTML; btnTxt.innerHTML = '<i class="fa-solid fa-check text-lg"></i> KOPIERT!';
                btnTxt.classList.replace('bg-blue-50', 'bg-emerald-50'); btnTxt.classList.replace('text-blue-700', 'text-emerald-700');
                setTimeout(() => { btnTxt.innerHTML = oldHtml; btnTxt.classList.replace('bg-emerald-50', 'bg-blue-50'); btnTxt.classList.replace('text-emerald-700', 'text-blue-700'); }, 2000);
            }
        }

        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(updateTxtButton).catch(() => fallbackCopy(text));
        else fallbackCopy(text);
    }

    function init() {
        document.addEventListener('click', function(e) {
            const btnPdf = e.target.closest('#btn-run-pdf-export');
            if (btnPdf) { e.preventDefault(); e.stopPropagation(); generatePdfExport(); return; }

            const btnTxt = e.target.closest('#btn-run-txt-export');
            if (btnTxt) { e.preventDefault(); e.stopPropagation(); generateTxtExport(); return; }

            const btnShort = e.target.closest('#btn-export-short');
            if (btnShort) {
                e.preventDefault(); e.stopPropagation();
                const btnLong = document.getElementById('btn-export-long');
                if (btnLong) {
                    btnShort.className = 'flex-1 py-2 rounded-lg text-[10px] font-black uppercase bg-white text-slate-800 shadow-sm border border-slate-200 transition-all';
                    btnLong.className = 'flex-1 py-2 rounded-lg text-[10px] font-black uppercase text-slate-500 border border-transparent transition-all';
                }
                if (window.CPR.AppState) window.CPR.AppState.protocolViewMode = 'summary';
                return;
            }

            const btnLong = e.target.closest('#btn-export-long');
            if (btnLong) {
                e.preventDefault(); e.stopPropagation();
                const btnShortLocal = document.getElementById('btn-export-short');
                if (btnShortLocal) {
                    btnLong.className = 'flex-1 py-2 rounded-lg text-[10px] font-black uppercase bg-white text-slate-800 shadow-sm border border-slate-200 transition-all';
                    btnShortLocal.className = 'flex-1 py-2 rounded-lg text-[10px] font-black uppercase text-slate-500 border border-transparent transition-all';
                }
                if (window.CPR.AppState) window.CPR.AppState.protocolViewMode = 'timeline';
                return;
            }

            const btnCancel = e.target.closest('#btn-cancel-export');
            if (btnCancel) {
                e.preventDefault(); e.stopPropagation();
                const em = document.getElementById('export-modal');
                if (em) em.classList.replace('flex', 'hidden');
                return;
            }

            const btnExportLog = e.target.closest('#btn-export-log');
            if (btnExportLog) { e.preventDefault(); e.stopPropagation(); document.getElementById('export-modal')?.classList.replace('hidden', 'flex'); return; }
            
            const btnDebriefExport = e.target.closest('#btn-debrief-export');
            if (btnDebriefExport) { e.preventDefault(); e.stopPropagation(); document.getElementById('export-modal')?.classList.replace('hidden', 'flex'); return; }
        });
    }

    return { init: init };

})();

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { if (window.CPR && window.CPR.Export) window.CPR.Export.init(); }, 150); });
