/* ==========================================================================
   VISTA — Resumen (dashboard)
   ========================================================================== */

function renderDashboard() {
    const el = document.getElementById("view-dashboard");
    const totalIng = Store.totalIngresos();
    const totalPer = Store.totalGastosPersonales();
    const totalCorp = Store.totalGastosCorporativos();
    const saldo = Store.saldoNeto();
    const topClientes = Store.ingresosPorCliente();

    el.innerHTML = `
        <div class="kpi-grid">
            <div class="kpi-card tone-mint">
                <div class="kpi-label">Ingresos totales · ${Store.getState().anio}</div>
                <div class="kpi-value">${amountSpan(totalIng, { forceSign: "positive" })}</div>
                <div class="kpi-sub">${Store.getState().ingresos.length} movimientos registrados</div>
            </div>
            <div class="kpi-card tone-coral">
                <div class="kpi-label">Gastos personales</div>
                <div class="kpi-value">${amountSpan(totalPer, { forceSign: "negative" })}</div>
                <div class="kpi-sub">${Store.getState().gastosPersonales.length} movimientos</div>
            </div>
            <div class="kpi-card tone-amber">
                <div class="kpi-label">Gastos corporativos</div>
                <div class="kpi-value">${amountSpan(totalCorp, { forceSign: "negative" })}</div>
                <div class="kpi-sub">${Store.getState().gastosCorporativos.length} movimientos</div>
            </div>
            <div class="kpi-card tone-blue">
                <div class="kpi-label">Saldo neto anual</div>
                <div class="kpi-value">${amountSpan(saldo, { forceSign: saldo >= 0 ? "positive" : "negative" })}</div>
                <div class="kpi-sub">Ingresos − gastos personales − gastos corporativos</div>
            </div>
        </div>

        <div class="grid-2">
            <div class="panel chart-card">
                <div class="panel-head">
                    <div>
                        <h3>Ingresos por mes</h3>
                        <p>Suma de todos los clientes, mes a mes</p>
                    </div>
                </div>
                <canvas id="chart-ingresos-mes" height="90"></canvas>
            </div>
            <div class="panel chart-card">
                <div class="panel-head">
                    <div>
                        <h3>Gastos: personal vs. corporativo</h3>
                        <p>Distribución del año</p>
                    </div>
                </div>
                ${totalPer + totalCorp > 0
                    ? `<canvas id="chart-gastos-breakdown" height="90"></canvas>
                       <div class="chart-legend-custom">
                            <span><span class="dot" style="background:var(--coral)"></span>Personales</span>
                            <span><span class="dot" style="background:var(--amber)"></span>Corporativos</span>
                       </div>`
                    : emptyState("Sin gastos todavía", "Registra un gasto para ver la distribución aquí.")}
            </div>
        </div>

        <div class="grid-2">
            <div class="panel chart-card">
                <div class="panel-head">
                    <div>
                        <h3>Clientes con más ingresos</h3>
                        <p>Top 6 del año</p>
                    </div>
                </div>
                ${topClientes.length
                    ? `<canvas id="chart-top-clientes" height="90"></canvas>`
                    : emptyState("Aún no hay clientes", "Registra tu primer ingreso para verlos aquí.")}
            </div>
            <div class="panel chart-card">
                <div class="panel-head">
                    <div>
                        <h3>Saldo acumulado</h3>
                        <p>Evolución del saldo neto mes a mes</p>
                    </div>
                </div>
                <canvas id="chart-saldo-trend" height="90"></canvas>
            </div>
        </div>
    `;

    Charts.monthlyIncome("chart-ingresos-mes", Store.ingresosPorMes());
    if (totalPer + totalCorp > 0) Charts.expensesBreakdown("chart-gastos-breakdown", { personal: totalPer, corporativo: totalCorp });
    if (topClientes.length) Charts.topClients("chart-top-clientes", topClientes);
    Charts.balanceTrend("chart-saldo-trend", Store.saldoAcumuladoPorMes());
}

function emptyState(title, sub) {
    return `<div class="empty-state"><div class="glyph">·−·</div><strong>${title}</strong><p>${sub}</p></div>`;
}
