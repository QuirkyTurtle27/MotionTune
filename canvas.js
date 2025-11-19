// canvas.js
// Stage 2 - Canvas API implementation for MotionTune
// - Canvas unde desenezi curba de playback speed (slow motion / time-lapse)

(function () {
    document.addEventListener("DOMContentLoaded", initCanvas);

    function initCanvas() {
        const canvas = document.getElementById("speedCanvas");
        if (!canvas) return;

        const clearBtn = document.getElementById("clearCanvasBtn");
        const resetBtn = document.getElementById("resetCanvasBtn");

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let points = [];
        let isDrawing = false;
        let logicalWidth = 0;
        let logicalHeight = 0;

        setupCanvasSize();
        drawGrid();

        window.addEventListener("resize", () => {
            const oldPoints = normalizePoints(points);
            setupCanvasSize();
            drawGrid();
            points = denormalizePoints(oldPoints);
            redrawCurve();
        });

        canvas.addEventListener("mousedown", (e) => {
            const pos = getCanvasPos(e.clientX, e.clientY);
            beginStroke(pos.x, pos.y);
        });

        canvas.addEventListener("mousemove", (e) => {
            if (!isDrawing) return;
            const pos = getCanvasPos(e.clientX, e.clientY);
            continueStroke(pos.x, pos.y);
        });

        window.addEventListener("mouseup", stopDrawing);

        canvas.addEventListener("touchstart", (e) => {
            e.preventDefault();
            const t = e.touches[0];
            const pos = getCanvasPos(t.clientX, t.clientY);
            beginStroke(pos.x, pos.y);
        });

        canvas.addEventListener("touchmove", (e) => {
            e.preventDefault();
            if (!isDrawing) return;
            const t = e.touches[0];
            const pos = getCanvasPos(t.clientX, t.clientY);
            continueStroke(pos.x, pos.y);
        });

        window.addEventListener("touchend", stopDrawing);

        clearBtn?.addEventListener("click", () => {
            points = [];
            clearCanvas();
            drawGrid();
        });

        resetBtn?.addEventListener("click", () => {
            points = [];
            clearCanvas();
            drawGrid();
        });

        window.motionTuneCanvas = {
            getSpeedCurve: () => normalizePoints(points),
        };

        function setupCanvasSize() {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();

            logicalWidth = rect.width;
            logicalHeight = rect.height;

            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        }

        function clearCanvas() {
            ctx.clearRect(0, 0, logicalWidth, logicalHeight);
        }

        function drawGrid() {
            clearCanvas();

            ctx.fillStyle = "#020617";
            ctx.fillRect(0, 0, logicalWidth, logicalHeight);

            ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
            ctx.lineWidth = 1;

            const hLines = 4;
            const vLines = 8;

            for (let i = 1; i < vLines; i++) {
                const x = (logicalWidth / vLines) * i;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, logicalHeight);
                ctx.stroke();
            }

            for (let j = 1; j < hLines; j++) {
                const y = (logicalHeight / hLines) * j;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(logicalWidth, y);
                ctx.stroke();
            }

            const midY = logicalHeight / 2;
            ctx.strokeStyle = "#facc15";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, midY);
            ctx.lineTo(logicalWidth, midY);
            ctx.stroke();

            ctx.fillStyle = "#e5e7eb";
            ctx.font = "11px sans-serif";
            ctx.fillText("Speed", 8, 14);
            ctx.fillText("1x", 8, midY - 4);
        }

        function getCanvasPos(clientX, clientY) {
            const rect = canvas.getBoundingClientRect();
            return { x: clientX - rect.left, y: clientY - rect.top };
        }

        function beginStroke(x, y) {
            isDrawing = true;
            points.push({ x, y, moveTo: true });
            redrawCurve();
        }

        function continueStroke(x, y) {
            if (!isDrawing) return;
            points.push({ x, y, moveTo: false });
            redrawCurve();
        }

        function stopDrawing() {
            isDrawing = false;
        }

        function redrawCurve() {
            drawGrid();

            if (!points.length) return;

            ctx.lineWidth = 2.5;
            ctx.strokeStyle = "#38bdf8";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.beginPath();
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                p.moveTo ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }

        function normalizePoints(pts) {
            return pts.map((p) => ({
                t: p.x / logicalWidth,
                speed: (1 - p.y / logicalHeight) * 2,
                moveTo: p.moveTo,
            }));
        }

        function denormalizePoints(norm) {
            return norm.map((n) => ({
                x: n.t * logicalWidth,
                y: (1 - n.speed / 2) * logicalHeight,
                moveTo: n.moveTo,
            }));
        }
    }
})();

