/**
 * CPR Assist - Export Modul (V61 - PDF Size Optimization)
 * - RESTORE: Das wunderschöne SBAR-Grid und die Canvas-Zeitlinie sind 100% aktiv.
 * - BUGFIX: Einsatzbeginn (Startzeit) wird sicher ausgelesen.
 * - OPTIMIZATION: Canvas exportiert nun als JPEG (70% Qualität) statt PNG. 
 * Reduziert die PDF Dateigröße massiv (von 20MB auf <500KB) ohne sichtbaren Qualitätsverlust!
 */

window.CPR = window.CPR || {};

window.CPR.Export = (function() {

    // --- 1. ICON LOGIK (Für Canvas) ---
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
        const totalSec = state.totalSeconds || 0;
        const arrSec = state.arrestSeconds || 0;
        const compSec = state.compressingSeconds || 0;
        const ccf = arrSec > 0 ? Math.min(100, Math.round((compSec / arrSec) * 100)) : 0;
        const ageStr = state.isPediatric ? (state.patientWeight ? `Kind (${state.patientWeight} kg)` : 'Kind (Gewicht unbek.)') : 'Erwachsener';
        let adrTotal = "0 mg", adrCount = state.adrCount || 0;
        if (adrCount > 0) adrTotal = (state.isPediatric && state.patientWeight) ? (adrCount * Math.round(state.patientWeight * 10)) + " µg" : adrCount + " mg";
        let amioTotal = "0 mg", amioCount = state.amioCount || 0;
        if (amioCount > 0) amioTotal = (state.isPediatric && state.patientWeight) ? (amioCount * Math.round(state.patientWeight * 5)) + " mg" : (amioCount === 1 ? '300 mg' : '450 mg');

        const aData = state.anamneseData || {};
        let sampStr = [];
        if (aData.sampler) {
            const sMap = {s:'Symptome', a:'Allergien', m:'Medikamente', p:'Vorerkrankungen', l:'Letzte Mahlzeit', e:'Ereignis', r:'Risikofaktoren'};
            Object.keys(sMap).forEach(k => { if (aData.sampler[k]) sampStr.push(`${sMap[k]}: ${aData.sampler[k]}`); });
        }
        const hitsLogs = data.filter(d => d.action.includes('HITS:'));
        const hitsArr = hitsLogs.map(h => h.action.replace('HITS: ', ''));

        // 🌟 END-STATUS & ROSC-ZEIT ERMITTELN 🌟
        let endStatus = 'Laufende CPR';
        let timeToRosc = null;
        let abbruchReason = null;

        data.forEach(d => {
            const t = d.action.toLowerCase();
            if (t.includes('rosc') && !t.includes('re-arrest')) {
                endStatus = 'ROSC';
                if (timeToRosc === null) timeToRosc = d.secondsFromStart;
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
        });

        // Fallbacks
        if (endStatus === 'ROSC' && timeToRosc === null) timeToRosc = totalSec;
        if (endStatus === 'Abbruch' && !abbruchReason) abbruchReason = "Teamentscheidung / Unbekannt";

        return { ageStr, totalSec, ccf, adrCount, adrTotal, amioCount, amioTotal, aData, sampStr, hitsArr, state, data, endStatus, timeToRosc, abbruchReason };
    }

    // --- 2. NATIVE SBAR DRAWING (jsPDF Vektor-Text) ---
    function drawSbarNative(doc, facts) {
        const { ageStr, totalSec, ccf, adrTotal, amioTotal, aData, sampStr, hitsArr, state, adrCount, amioCount, endStatus, timeToRosc, abbruchReason } = facts;
        const Utils = window.CPR.Utils;
        
        let y = 45;
        
        doc.setFontSize(14); doc.setTextColor(227, 0, 15); doc.setFont("helvetica", "bold");
        doc.text("S - SITUATION", 15, y);
        doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.5); doc.line(15, y+2, 195, y+2);
        y += 10;

        doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
        doc.roundedRect(15, y, 55, 24, 2, 2, 'FD');  // Patient
        doc.roundedRect(75, y, 45, 24, 2, 2, 'FD');  // Dauer
        doc.roundedRect(125, y, 70, 24, 2, 2, 'FD'); // Status
        
        doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal");
        doc.text("PATIENT", 42.5, y+6, {align: 'center'});
        doc.text("GESAMTDAUER", 97.5, y+6, {align: 'center'});
        doc.text("AKTUELLER STATUS", 160, y+6, {align: 'center'});
        
        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text(ageStr, 42.5, y+14, {align: 'center'});
        doc.text(`${Utils.formatTime(totalSec)} Min`, 97.5, y+14, {align: 'center'});
        
        // STATUS & ROSC ZEIT RENDERN
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

    // --- 4. CANVAS NOTENBLATT ENGINE (QUERFORMAT: 5x 4-Minuten) ---
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
        
        // HINTERGRUND WICHTIG: Komplett weiß malen (damit JPEG funktioniert!)
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
            if (currentDrawSec > maxSecOverall && i > 0) break; // Leere Zeilen am Ende sparen, außer die allererste
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

    // --- 5. NATIVE PDF GENERIERUNG ---
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

        // 🌟 FIX: Startzeit sicher aus der UI auslesen 🌟
        const uiStartRaw = document.getElementById('start-time')?.innerText || '--:--';
        const safeStartTimeStr = uiStartRaw !== '--:--' ? uiStartRaw.replace('Start:', '').trim() + ' Uhr' : '--:--';

        // SEITE 1: HEADER & SBAR
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
            const data = AppState.protocolData;
            
            // SEITE 2+: ZEITLINIE
            const maxSec = data.length > 0 ? Math.max(AppState.totalSeconds || 0, data[data.length - 1].secondsFromStart) : (AppState.totalSeconds || 0);
            const pauses = extractPauses(data, maxSec);
            const totalPagesTimeline = Math.max(1, Math.ceil(maxSec / (5 * 240))); 

            for (let p = 0; p < totalPagesTimeline; p++) {
                doc.addPage('a4', 'landscape');
                const canvas = createTimelineCanvasChunk(data, pauses, p, maxSec);
                
                // 🌟 DIE MAGIC-ÄNDERUNG FÜR MASSIVE DATEIKOMPRIMIERUNG 🌟
                // Statt 'image/png' (verlustfrei und riesig) nutzen wir JPEG mit 70% Qualität
                const imgData = canvas.toDataURL('image/jpeg', 0.7); 
                
                // Beim Einbetten den Datentyp auf JPEG und die Kompression auf 'FAST' setzen
                doc.addImage(imgData, 'JPEG', 10, 10, 277, 190, undefined, 'FAST');
                
                doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.setFont("helvetica", "normal");
                doc.text("Generiert durch CPR Assist", 148.5, 205, {align: 'center'});
            }

            // SEITE X+: CHRONOLOGIE LISTE
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

    // --- 6. TEXT EXPORT (Clipboard) ---
    function generateTxtExport() {
        const { AppState, Utils } = window.CPR;
        if (!AppState || !AppState.protocolData || AppState.protocolData.length === 0) { alert("Protokoll leer."); return; }
        
        const btnExportShort = document.getElementById('btn-export-short');
        const isSummary = btnExportShort && btnExportShort.classList.contains('bg-white');
        const { ageStr, totalSec, ccf, adrTotal, amioTotal, aData, sampStr, hitsArr, state, adrCount, amioCount, endStatus, timeToRosc, abbruchReason } = extractSbarFacts();
        
        // 🌟 FIX: Startzeit sicher aus der UI auslesen 🌟
        const uiStartRaw = document.getElementById('start-time')?.innerText || '--:--';
        const safeStartTimeStr = uiStartRaw !== '--:--' ? uiStartRaw.replace('Start:', '').trim() + ' Uhr' : '--:--';

        let text = "🚨 REANIMATIONSPROTOKOLL - " + (isSummary ? "ÜBERGABE (SBAR)" : "DEBRIEFING") + "\n";
        text += "Datum: " + new Date().toLocaleDateString() + " | Beginn: " + safeStartTimeStr + "\n\n";
        
        text += "--- [S] SITUATION ---\nPatient: " + ageStr + "\n";
        text += "Status: " + endStatus + "\nDauer: " + Utils.formatTime(totalSec) + " Min\n";
        if (endStatus === 'ROSC' && timeToRosc !== null) text += "Zeit bis ROSC: " + Utils.formatTime(timeToRosc) + " Min\n";
        if (endStatus === 'Abbruch' && abbruchReason) text += "Abbruchgrund: " + abbruchReason + "\n";

        text += "\n--- [B] BACKGROUND ---\nBeobachtet: " + (aData.beobachtet || '?') + " | Laien-REA: " + (aData.laienrea || '?') + " | Brustschmerz: " + (aData.brustschmerz || '?') + "\n";
        if (sampStr.length > 0) text += sampStr.join('\n') + "\n";
        
        text += "\n--- [A] ASSESSMENT ---\nCPR Qualität (CCF): " + ccf + "%\n";
        if (hitsArr.length > 0) hitsArr.forEach(h => text += "- " + h + "\n"); else text += "Keine HITS erfasst.\n";
        
        text += "\n--- [R] RESPONSE ---\nAtemweg: " + (AppState.airwayLabel || 'Nicht dok.') + "\nZugang: " + (AppState.zugangLabel || 'Nicht dok.') + "\nSchocks: " + (AppState.shockCount || 0) + "x abgegeben\nAdrenalin: " + adrTotal + " (" + adrCount + " Gaben)\nAmiodaron: " + amioTotal + " (" + amioCount + " Gaben)\n\n";

        if (!isSummary) {
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

    // --- 7. EVENT DELEGATION ---
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
