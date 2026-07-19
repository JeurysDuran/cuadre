/* ==========================================================================
   VISTA — Saldo (equivalente a la hoja "Saldo" del Excel)
   ========================================================================== */

function renderSaldo() {
    const el = document.getElementById("view-saldo");
    const totalIng = Store.totalIngresos();
    const totalPer = Store.totalGastosPersonales();
    const totalCorp = Store.totalGastosCorporativos();
    const saldo = Store.saldoNeto();
    const porMes = Store.saldoAcumuladoPorMes();
    const ingMes = Store.ingresosPorMes();
    const gpMes = Store.gastosPersonalesPorMes();
    const gcMes = Store.gastosCorporativosPorMes();

    el.innerHTML = `
        <div class="panel">
            <div class="panel-head">
                <div>
                    <h3>Saldo total neto anual · ${Store.getState().anio}</h3>
                    <p>Ingresos totales menos gastos personales y corporativos</p>
                </div>
            </div>
            <div class="table-wrap"><table class="ledger">
                <tbody>
                    <tr><td>Total de ingresos anuales (+)</td><td class="num">${amountSpan(totalIng, { forceSign: "positive" })}</td></tr>
                    <tr><td>Total de gastos personales (−)</td><td class="num">${amountSpan(totalPer, { forceSign: "negative" })}</td></tr>
                    <tr><td>Total de gastos corporativos (−)</td><td class="num">${amountSpan(totalCorp, { forceSign: "negative" })}</td></tr>
                    <tr style="background:var(--surface-2)"><td><strong>Saldo total neto anual</strong></td><td class="num"><strong>${amountSpan(saldo, { forceSign: saldo >= 0 ? "positive" : "negative" })}</strong></td></tr>
                </tbody>
            </table></div>
        </div>

        <div class="panel chart-card">
            <div class="panel-head"><div><h3>Saldo acumulado por mes</h3><p>Cómo se mueve tu saldo a lo largo del año</p></div></div>
            <canvas id="chart-saldo-detalle" height="80"></canvas>
        </div>

        <div class="panel">
            <div class="panel-head"><div><h3>Detalle mensual</h3><p>Ingresos, gastos y saldo acumulado de cada mes</p></div></div>
            <div class="table-wrap"><table class="ledger">
                <thead><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Gastos personales</th><th class="num">Gastos corporativos</th><th class="num">Saldo acumulado</th></tr></thead>
                <tbody>
                    ${MESES.map((m, i) => `
                        <tr>
                            <td>${m}</td>
                            <td class="num">${amountSpan(ingMes[i], { forceSign: ingMes[i] > 0 ? "positive" : "neutral" })}</td>
                            <td class="num">${amountSpan(gpMes[i], { forceSign: gpMes[i] > 0 ? "negative" : "neutral" })}</td>
                            <td class="num">${amountSpan(gcMes[i], { forceSign: gcMes[i] > 0 ? "negative" : "neutral" })}</td>
                            <td class="num">${amountSpan(porMes[i], { forceSign: porMes[i] >= 0 ? "positive" : "negative" })}</td>
                        </tr>`).join("")}
                </tbody>
            </table></div>
        </div>
    `;

    Charts.balanceTrend("chart-saldo-detalle", porMes);
}
