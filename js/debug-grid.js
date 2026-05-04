/**
 * UI/UX Debug Grid - Isoliertes Messwerkzeug (Safeguard Checkpoint B)
 */
(function() {
    // 1. Canvas-Folie über die gesamte App legen (fängt keine Klicks ab)
    const canvas = document.createElement('canvas');
    canvas.id = 'debug-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '999999';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);

    function drawGrid() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 2. Den oberen Ankerpunkt (Top-Stats) suchen
        const topStats = document.getElementById('top-stats-container');
        const header = document.querySelector('header');
        
        // Wenn Top-Stats sichtbar sind, nimm deren Unterkante, sonst den Header
        let topY = header ? header.getBoundingClientRect().bottom : 0;
        if (topStats && !topStats.classList.contains('hidden')) {
            topY = topStats.getBoundingClientRect().bottom;
        }

        // 3. Den unteren Ankerpunkt (Bildschirmrand) definieren
        const bottomY = window.innerHeight;
        
        // 4. Die exakte mathematische Mitte ausrechnen (0,0 Koordinaten-Ursprung)
        const originY = topY + ((bottomY - topY) / 2);
        const originX = window.innerWidth / 2;

        // Styling für die Linien und Zahlen
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)';
        ctx.fillStyle = 'rgba(255, 0, 255, 0.9)';
        ctx.font = 'bold 10px monospace';
        ctx.lineWidth = 1.5;

        // X-Achse zeichnen
        ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(canvas.width, originY); ctx.stroke();
        // Y-Achse zeichnen
        ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, canvas.height); ctx.stroke();

        const step = 10; // Alle 10 Pixel ein kleiner Strich

        // X-Achse beschriften
        for(let x = originX; x < canvas.width; x += step) {
            ctx.beginPath(); ctx.moveTo(x, originY - 4); ctx.lineTo(x, originY + 4); ctx.stroke();
            if((x - originX) % 50 === 0 && x !== originX) {
                ctx.fillText(`+${x - originX}`, x + 2, originY - 8);
            }
        }
        for(let x = originX; x > 0; x -= step) {
            ctx.beginPath(); ctx.moveTo(x, originY - 4); ctx.lineTo(x, originY + 4); ctx.stroke();
            if((originX - x) % 50 === 0 && x !== originX) {
                ctx.fillText(`-${originX - x}`, x - 25, originY - 8);
            }
        }

        // Y-Achse beschriften (Nach unten positiv = wie in CSS translate)
        for(let y = originY; y < canvas.height; y += step) {
            ctx.beginPath(); ctx.moveTo(originX - 4, y); ctx.lineTo(originX + 4, y); ctx.stroke();
            if((y - originY) % 50 === 0 && y !== originY) {
                ctx.fillText(`+${y - originY}`, originX + 8, y + 4);
            }
        }
        for(let y = originY; y > 0; y -= step) {
            ctx.beginPath(); ctx.moveTo(originX - 4, y); ctx.lineTo(originX + 4, y); ctx.stroke();
            if((originY - y) % 50 === 0 && y !== originY) {
                ctx.fillText(`-${originY - y}`, originX + 8, y + 4);
            }
        }
        
        // Markiere den Nullpunkt fett
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillText("0,0", originX + 8, originY - 8);
    }

    // Grid bei jedem Resize und alle 500ms neu zeichnen (falls die Top-Stats aufploppen)
    window.addEventListener('resize', drawGrid);
    setInterval(drawGrid, 500);
})();
