/* ==========================================================================
   CHARTS — envoltorios sobre Chart.js con la paleta de la app.
   ========================================================================== */

const Charts = (() => {
    const instances = {};
    const css = getComputedStyle(document.documentElement);
    const c = (name) => css.getPropertyValue(name).trim();

    const COLORS = {
        mint: c("--mint") || "#35D28A",
        coral: c("--coral") || "#FF6B5E",
        amber: c("--amber") || "#F2B84B",
        blue: c("--blue") || "#5B9BFF",
        text: c("--text") || "#ECEEF0",
        textDim: c("--text-dim") || "#9198A3",
        line: c("--line") || "#262C34",
        surface2: c("--surface-2") || "#181D24",
    };

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = COLORS.textDim;
    Chart.defaults.borderColor = COLORS.line;

    const MES_ABR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    function destroy(id) {
        if (instances[id]) { instances[id].destroy(); delete instances[id]; }
    }

    function ctxOf(id) {
        const el = document.getElementById(id);
        return el ? el.getContext("2d") : null;
    }

    function monthlyIncome(id, data) {
        destroy(id);
        const ctx = ctxOf(id);
        if (!ctx) return;
        instances[id] = new Chart(ctx, {
            type: "bar",
            data: {
                labels: MES_ABR,
                datasets: [{
                    label: "Ingresos",
                    data,
                    backgroundColor: COLORS.mint + "cc",
                    hoverBackgroundColor: COLORS.mint,
                    borderRadius: 5,
                    maxBarThickness: 30,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: COLORS.surface2,
                        borderColor: COLORS.line,
                        borderWidth: 1,
                        titleColor: COLORS.text,
                        bodyColor: COLORS.text,
                        padding: 10,
                        callbacks: { label: (i) => "RD$ " + fmtMoney(i.parsed.y) },
                    },
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: COLORS.line }, ticks: { callback: (v) => fmtMoneyShort(v) } },
                },
            },
        });
    }

    function balanceTrend(id, data) {
        destroy(id);
        const ctx = ctxOf(id);
        if (!ctx) return;
        instances[id] = new Chart(ctx, {
            type: "line",
            data: {
                labels: MES_ABR,
                datasets: [{
                    label: "Saldo acumulado",
                    data,
                    borderColor: COLORS.blue,
                    backgroundColor: COLORS.blue + "22",
                    fill: true,
                    tension: .35,
                    pointRadius: 3,
                    pointBackgroundColor: COLORS.blue,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: COLORS.surface2,
                        borderColor: COLORS.line,
                        borderWidth: 1,
                        titleColor: COLORS.text,
                        bodyColor: COLORS.text,
                        padding: 10,
                        callbacks: { label: (i) => "RD$ " + fmtMoney(i.parsed.y) },
                    },
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: COLORS.line }, ticks: { callback: (v) => fmtMoneyShort(v) } },
                },
            },
        });
    }

    function expensesBreakdown(id, { personal, corporativo }) {
        destroy(id);
        const ctx = ctxOf(id);
        if (!ctx) return;
        instances[id] = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ["Gastos personales", "Gastos corporativos"],
                datasets: [{
                    data: [personal, corporativo],
                    backgroundColor: [COLORS.coral, COLORS.amber],
                    borderColor: COLORS.surface2,
                    borderWidth: 3,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: COLORS.surface2,
                        borderColor: COLORS.line,
                        borderWidth: 1,
                        titleColor: COLORS.text,
                        bodyColor: COLORS.text,
                        padding: 10,
                        callbacks: { label: (i) => `${i.label}: RD$ ${fmtMoney(i.parsed)}` },
                    },
                },
            },
        });
    }

    function topClients(id, rows) {
        destroy(id);
        const ctx = ctxOf(id);
        if (!ctx) return;
        const top = rows.slice(0, 6);
        instances[id] = new Chart(ctx, {
            type: "bar",
            data: {
                labels: top.map((r) => r.nombre),
                datasets: [{
                    data: top.map((r) => r.total),
                    backgroundColor: COLORS.blue + "cc",
                    hoverBackgroundColor: COLORS.blue,
                    borderRadius: 5,
                    maxBarThickness: 22,
                }],
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: COLORS.surface2,
                        borderColor: COLORS.line,
                        borderWidth: 1,
                        titleColor: COLORS.text,
                        bodyColor: COLORS.text,
                        padding: 10,
                        callbacks: { label: (i) => "RD$ " + fmtMoney(i.parsed.x) },
                    },
                },
                scales: {
                    x: { grid: { color: COLORS.line }, ticks: { callback: (v) => fmtMoneyShort(v) } },
                    y: { grid: { display: false } },
                },
            },
        });
    }

    return { monthlyIncome, balanceTrend, expensesBreakdown, topClients, destroy };
})();
