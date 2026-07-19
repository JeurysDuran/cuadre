/* ==========================================================================
   VISTA — Visión
   Simulador rápido para responder preguntas de "¿qué pasaría si...?" sin
   afectar tus datos reales: ni se guarda ni se sincroniza con Drive.
   ========================================================================== */

function renderVision() {
    const el = document.getElementById("view-vision");

    el.innerHTML = `
        <div class="grid-2">
            <div class="panel">
                <div class="panel-head">
                    <div>
                        <h3>Simular un gasto</h3>
                        <p>¿Qué pasaría si gasto una cantidad fija en algo, de forma recurrente?</p>
                    </div>
                </div>
                <form id="form-sim-gasto">
                    <div class="field">
                        <label>¿En qué?</label>
                        <input name="concepto" placeholder="Ej: suscripción, pasaje, pastillas…" required>
                    </div>
                    <div class="field-row">
                        <div class="field">
                            <label>Monto (RD$)</label>
                            <input name="monto" type="number" min="0" step="0.01" placeholder="2000.00" required>
                        </div>
                        <div class="field">
                            <label>Frecuencia</label>
                            <select name="frecuencia">
                                <option value="mensual">Cada mes</option>
                                <option value="quincenal">Cada quincena</option>
                                <option value="semanal">Cada semana</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Calcular</button>
                    </div>
                </form>
                <div id="resultado-sim-gasto"></div>
            </div>

            <div class="panel">
                <div class="panel-head">
                    <div>
                        <h3>Simular ingresos</h3>
                        <p>¿Cuánto ganarías con cierta cantidad de clientes pagando lo mismo?</p>
                    </div>
                </div>
                <form id="form-sim-ingreso">
                    <div class="field-row">
                        <div class="field">
                            <label>Cantidad de clientes</label>
                            <input name="clientes" type="number" min="0" step="1" placeholder="20" required>
                        </div>
                        <div class="field">
                            <label>Pago por cliente (RD$)</label>
                            <input name="monto" type="number" min="0" step="0.01" placeholder="1500.00" required>
                        </div>
                    </div>
                    <div class="field">
                        <label>Frecuencia de pago</label>
                        <select name="frecuencia">
                            <option value="mensual">Cada mes</option>
                            <option value="quincenal">Cada quincena</option>
                            <option value="semanal">Cada semana</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Calcular</button>
                    </div>
                </form>
                <div id="resultado-sim-ingreso"></div>
            </div>
        </div>

        <div class="panel">
            <p class="modal-sub" style="margin:0;">Esto es solo una simulación: no se guarda ni afecta tus ingresos, gastos o saldo real.</p>
        </div>
    `;

    const vecesAlMes = { mensual: 1, quincenal: 2, semanal: 4.33 };

    document.getElementById("form-sim-gasto").addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const concepto = f.get("concepto").trim();
        const monto = Number(f.get("monto")) || 0;
        const frecuencia = f.get("frecuencia");
        const mensual = monto * vecesAlMes[frecuencia];
        const anual = mensual * 12;

        document.getElementById("resultado-sim-gasto").innerHTML = `
            <div class="table-wrap" style="margin-top:16px;"><table class="ledger">
                <tbody>
                    <tr><td>${escapeHtml(concepto)} — cada mes</td><td class="num">${amountSpan(mensual, { forceSign: "negative" })}</td></tr>
                    <tr style="background:var(--surface-2)"><td><strong>${escapeHtml(concepto)} — al año</strong></td><td class="num"><strong>${amountSpan(anual, { forceSign: "negative" })}</strong></td></tr>
                </tbody>
            </table></div>`;
    });

    document.getElementById("form-sim-ingreso").addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const clientes = Number(f.get("clientes")) || 0;
        const monto = Number(f.get("monto")) || 0;
        const frecuencia = f.get("frecuencia");
        const porCicloTotal = clientes * monto;
        const mensual = porCicloTotal * vecesAlMes[frecuencia];
        const anual = mensual * 12;

        document.getElementById("resultado-sim-ingreso").innerHTML = `
            <div class="table-wrap" style="margin-top:16px;"><table class="ledger">
                <tbody>
                    <tr><td>${clientes} clientes × RD$ ${fmtMoney(monto)}</td><td class="num">${amountSpan(porCicloTotal, { forceSign: "positive" })}</td></tr>
                    <tr><td>Total por mes</td><td class="num">${amountSpan(mensual, { forceSign: "positive" })}</td></tr>
                    <tr style="background:var(--surface-2)"><td><strong>Total por año</strong></td><td class="num"><strong>${amountSpan(anual, { forceSign: "positive" })}</strong></td></tr>
                </tbody>
            </table></div>`;
    });
}
