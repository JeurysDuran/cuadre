/* ==========================================================================
   VISTA — Resumen (dashboard)
   ========================================================================== */

function renderDashboard() {
    const el = document.getElementById("view-dashboard");
    const totalIng = Store.totalIngresos();
    const totalPer = Store.totalGastosPersonales();
    const totalCorp = Store.totalGastosCorporativos();
    const saldo = Store.saldoTotal();
    const totalAhorrado = Store.totalAhorrado();
    const saldoConAhorros = Store.saldoConAhorros();
    const topClientes = Store.ingresosPorCliente();

    el.innerHTML = `
        <div class="kpi-grid">
            <div class="kpi-card tone-mint">
                <div class="kpi-label">Ingresos totales</div>
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
                <div class="kpi-label">Saldo total</div>
                <div class="kpi-value">${amountSpan(saldo, { forceSign: saldo >= 0 ? "positive" : "negative" })}</div>
                <div class="kpi-sub">Lo que tienes hoy: ingresos − gastos</div>
            </div>
        </div>

        <div class="panel">
            <div class="panel-head">
                <div>
                    <h3>Tu saldo, con y sin ahorros apartados</h3>
                    <p>Lo apartado en tus metas sigue siendo tuyo — aquí ves las dos formas de mirarlo</p>
                </div>
                <button class="btn btn-outline btn-sm" data-view="ahorros">Ver ahorros</button>
            </div>
            <div class="table-wrap"><table class="ledger">
                <tbody>
                    <tr><td>Saldo total (sin apartar nada)</td><td class="num">${amountSpan(saldo, { forceSign: saldo >= 0 ? "positive" : "negative" })}</td></tr>
                    <tr><td>Apartado en metas de ahorro (−)</td><td class="num">${amountSpan(totalAhorrado, { forceSign: totalAhorrado > 0 ? "negative" : "neutral" })}</td></tr>
                    <tr style="background:var(--surface-2)"><td><strong>Saldo disponible si separas tus ahorros</strong></td><td class="num"><strong>${amountSpan(saldoConAhorros, { forceSign: saldoConAhorros >= 0 ? "positive" : "negative" })}</strong></td></tr>
                </tbody>
            </table></div>
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
                        <p>Distribución de todo lo registrado</p>
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
                        <p>Top 6 acumulado</p>
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
                        <p>Evolución del saldo mes a mes</p>
                    </div>
                </div>
                <canvas id="chart-saldo-trend" height="90"></canvas>
            </div>
        </div>
    `;

    el.querySelectorAll("[data-view]").forEach((btn) => {
        btn.addEventListener("click", () => setView(btn.dataset.view));
    });

    Charts.monthlyIncome("chart-ingresos-mes", Store.ingresosPorMes());
    if (totalPer + totalCorp > 0) Charts.expensesBreakdown("chart-gastos-breakdown", { personal: totalPer, corporativo: totalCorp });
    if (topClientes.length) Charts.topClients("chart-top-clientes", topClientes);
    Charts.balanceTrend("chart-saldo-trend", Store.saldoAcumuladoPorMes());
}

function emptyState(title, sub) {
    return `<div class="empty-state"><div class="glyph">·−·</div><strong>${title}</strong><p>${sub}</p></div>`;
}