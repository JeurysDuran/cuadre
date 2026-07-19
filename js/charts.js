/* ==========================================================================
   CHARTS — envoltorios sobre Chart.js con la paleta de la app.
   ========================================================================== */

const Charts = (() => {
    const instances = {};
    const css = getComputedStyle(document.documentElement);
    const c = (name) => css.getPropertyValue(name).trim();

    const COLORS = {
        mint: c("--mint") || "#1E9E6B",
        coral: c("--coral") || "#D9503B",
        amber: c("--amber") || "#C98A1E",
        blue: c("--blue") || "#2F6FED",
        text: c("--text") || "#1B1F24",
        textDim: c("--text-dim") || "#666E79",
        line: c("--line") || "#E3E6EB",
        surface: c("--surface") || "#FFFFFF",
    };

    Chart.defaults.font.family = "'Open Sans', sans-serif";
    Chart.defaults.color = COLORS.textDim;
    Chart.defaults.borderColor = COLORS.line;

    const MES_ABR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    function destroy(id) {
        if (instances[id]) { instances[id].destroy();
            delete instances[id]; }
    }

    function ctxOf(id) {
        const el = document.getElementById(id);
        return el ? el.getContext("2d") : null;
    }

    function tooltipBase() {
        return {
            backgroundColor: COLORS.text,
            titleColor: COLORS.surface,
            bodyColor: COLORS.surface,
            padding: 10,
            cornerRadius: 6,
            displayColors: false,
        };
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
                    backgroundColor: COLORS.mint,
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
                    tooltip: {...tooltipBase(), callbacks: { label: (i) => "RD$ " + fmtMoney(i.parsed.y) } },
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
                    backgroundColor: COLORS.blue + "1f",
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
                    tooltip: {...tooltipBase(), callbacks: { label: (i) => "RD$ " + fmtMoney(i.parsed.y) } },
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
                    borderColor: COLORS.surface,
                    borderWidth: 3,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",
                plugins: {
                    legend: { display: false },
                    tooltip: {...tooltipBase(), callbacks: { label: (i) => `${i.label}: RD$ ${fmtMoney(i.parsed)}` } },
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
                    backgroundColor: COLORS.blue,
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
                    tooltip: {...tooltipBase(), callbacks: { label: (i) => "RD$ " + fmtMoney(i.parsed.x) } },
                },
                scales: {
                    x: { grid: { color: COLORS.line }, ticks: { callback: (v) => fmtMoneyShort(v) } },
                    y: { grid: { display: false } },
                },
            },
        });
    }

    // Gastos personales agrupados por categoría, un color distinto por cada una.
    function expensesByCategory(id, rows) {
        destroy(id);
        const ctx = ctxOf(id);
        if (!ctx) return;
        const top = rows.slice(0, 8);
        instances[id] = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: top.map((r) => r.categoria),
                datasets: [{
                    data: top.map((r) => r.total),
                    backgroundColor: top.map((_, i) => colorAt(i)),
                    borderColor: COLORS.surface,
                    borderWidth: 3,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "62%",
                plugins: {
                    legend: { display: false },
                    tooltip: {...tooltipBase(), callbacks: { label: (i) => `${i.label}: RD$ ${fmtMoney(i.parsed)}` } },
                },
            },
        });
    }

    return { monthlyIncome, balanceTrend, expensesBreakdown, topClients, expensesByCategory, destroy };
})();