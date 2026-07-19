/* ==========================================================================
   VISTA — Ingresos (equivalente a "Descripción de Ingresos mensual",
   "Total Ingresos Mensuales" y "Total Ingresos Anuales" del Excel)
   ========================================================================== */

let ingresosFiltro = { mes: "todos", clienteId: "todos" };

function renderIngresos() {
    const el = document.getElementById("view-ingresos");
    const state = Store.getState();

    el.innerHTML = `
        <div class="panel">
            <div class="panel-head">
                <div>
                    <h3>Registrar ingreso</h3>
                    <p>Cliente, mes, día y monto de cada entrada de dinero</p>
                </div>
            </div>
            <form id="form-ingreso">
                <div class="field-row">
                    <div class="field">
                        <label for="ing-cliente">Cliente</label>
                        <input id="ing-cliente" name="cliente" list="lista-clientes" placeholder="Nombre del cliente" required autocomplete="off">
                        <datalist id="lista-clientes">
                            ${state.clientes.map((c) => `<option value="${escapeHtml(c.nombre)}">`).join("")}
                        </datalist>
                    </div>
                    <div class="field">
                        <label for="ing-mes">Mes</label>
                        <select id="ing-mes" name="mes" required>
                            ${MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("")}
                        </select>
                    </div>
                </div>
                <div class="field-row">
                    <div class="field">
                        <label for="ing-dia">Día</label>
                        <input id="ing-dia" name="dia" type="number" min="1" max="31" placeholder="1–31">
                    </div>
                    <div class="field">
                        <label for="ing-monto">Monto (RD$)</label>
                        <input id="ing-monto" name="monto" type="number" min="0" step="0.01" placeholder="0.00" required>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                        Agregar ingreso
                    </button>
                </div>
            </form>
        </div>

        <div class="panel">
            <div class="panel-head">
                <div>
                    <h3>Todos los ingresos</h3>
                    <p>${state.ingresos.length} movimientos · RD$ ${fmtMoney(Store.totalIngresos())} en total</p>
                </div>
            </div>
            <div class="toolbar">
                <select id="filtro-mes">
                    <option value="todos">Todos los meses</option>
                    ${MESES.map((m, i) => `<option value="${i + 1}" ${ingresosFiltro.mes == i + 1 ? "selected" : ""}>${m}</option>`).join("")}
                </select>
                <select id="filtro-cliente">
                    <option value="todos">Todos los clientes</option>
                    ${state.clientes.map((c) => `<option value="${c.id}" ${ingresosFiltro.clienteId === c.id ? "selected" : ""}>${escapeHtml(c.nombre)}</option>`).join("")}
                </select>
                <span class="spacer"></span>
            </div>
            ${renderTablaIngresos(state)}
        </div>

        <div class="grid-2">
            <div class="panel">
                <div class="panel-head"><div><h3>Total por mes</h3><p>Suma de ingresos de todos los clientes</p></div></div>
                ${renderTotalesMes()}
            </div>
            <div class="panel">
                <div class="panel-head"><div><h3>Total por cliente</h3><p>Acumulado de todo lo registrado</p></div></div>
                ${renderTotalesCliente()}
            </div>
        </div>
    `;

    document.getElementById("form-ingreso").addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const cliente = f.get("cliente").trim();
        const monto = f.get("monto");
        if (!cliente || !monto) return;
        Store.addIngreso({ clienteNombre: cliente, mes: f.get("mes"), dia: f.get("dia"), monto });
        e.target.reset();
        document.getElementById("ing-mes").value = f.get("mes");
        showToast("Ingreso agregado", "success");
        renderIngresos();
    });

    document.getElementById("filtro-mes").addEventListener("change", (e) => {
        ingresosFiltro.mes = e.target.value;
        renderIngresos();
    });
    document.getElementById("filtro-cliente").addEventListener("change", (e) => {
        ingresosFiltro.clienteId = e.target.value;
        renderIngresos();
    });

    el.querySelectorAll("[data-edit-ingreso]").forEach((btn) => {
        btn.addEventListener("click", () => openEditIngreso(btn.dataset.editIngreso));
    });
    el.querySelectorAll("[data-delete-ingreso]").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (confirm("¿Eliminar este ingreso?")) {
                Store.deleteIngreso(btn.dataset.deleteIngreso);
                showToast("Ingreso eliminado");
                renderIngresos();
            }
        });
    });
}

function renderTablaIngresos(state) {
    let rows = [...state.ingresos].sort((a, b) => b.mes - a.mes || (b.dia || 0) - (a.dia || 0));
    if (ingresosFiltro.mes !== "todos") rows = rows.filter((r) => r.mes == ingresosFiltro.mes);
    if (ingresosFiltro.clienteId !== "todos") rows = rows.filter((r) => r.clienteId === ingresosFiltro.clienteId);

    if (!rows.length) {
        return `<div class="empty-state"><div class="glyph">·−·</div><strong>Nada por aquí todavía</strong><p>Registra un ingreso arriba para empezar tu cuadre.</p></div>`;
    }

    return `<div class="table-wrap"><table class="ledger">
        <thead><tr><th>Cliente</th><th>Mes</th><th>Día</th><th class="num">Monto</th><th></th></tr></thead>
        <tbody>
            ${rows.map((r) => `
                <tr>
                    <td>${escapeHtml(Store.clienteNombre(r.clienteId))}</td>
                    <td><span class="tag-chip">${MESES[r.mes - 1] || "—"}</span></td>
                    <td>${r.dia || "—"}</td>
                    <td class="num">${amountSpan(r.monto, { forceSign: "positive" })}</td>
                    <td>
                        <div class="row-actions">
                            <button class="icon-btn" data-edit-ingreso="${r.id}" title="Editar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                            </button>
                            <button class="icon-btn" data-delete-ingreso="${r.id}" title="Eliminar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>`).join("")}
        </tbody>
    </table></div>`;
}

function renderTotalesMes() {
    const totales = Store.ingresosPorMes();
    return `<div class="table-wrap"><table class="ledger">
        <thead><tr><th>Mes</th><th class="num">Total</th></tr></thead>
        <tbody>
            ${MESES.map((m, i) => `<tr><td>${m}</td><td class="num">${amountSpan(totales[i], { forceSign: totales[i] > 0 ? "positive" : "neutral" })}</td></tr>`).join("")}
        </tbody>
    </table></div>`;
}

function renderTotalesCliente() {
    const rows = Store.ingresosPorCliente();
    if (!rows.length) return `<div class="empty-state"><div class="glyph">·−·</div><p>Sin clientes registrados aún.</p></div>`;
    return `<div class="table-wrap"><table class="ledger">
        <thead><tr><th>Cliente</th><th class="num">Total</th></tr></thead>
        <tbody>
            ${rows.map((r) => `<tr><td>${escapeHtml(r.nombre)}</td><td class="num">${amountSpan(r.total, { forceSign: "positive" })}</td></tr>`).join("")}
        </tbody>
    </table></div>`;
}

function openEditIngreso(id) {
    const row = Store.getState().ingresos.find((i) => i.id === id);
    if (!row) return;
    openModal(`
        <h3>Editar ingreso</h3>
        <p class="modal-sub">Cliente: ${escapeHtml(Store.clienteNombre(row.clienteId))}</p>
        <form id="form-edit-ingreso">
            <div class="field">
                <label>Cliente</label>
                <input name="cliente" value="${escapeHtml(Store.clienteNombre(row.clienteId))}" required>
            </div>
            <div class="field-row">
                <div class="field">
                    <label>Mes</label>
                    <select name="mes">${MESES.map((m, i) => `<option value="${i + 1}" ${row.mes === i + 1 ? "selected" : ""}>${m}</option>`).join("")}</select>
                </div>
                <div class="field">
                    <label>Día</label>
                    <input name="dia" type="number" min="1" max="31" value="${row.dia || ""}">
                </div>
            </div>
            <div class="field">
                <label>Monto (RD$)</label>
                <input name="monto" type="number" min="0" step="0.01" value="${row.monto}" required>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" data-close-modal>Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar cambios</button>
            </div>
        </form>
    `);
    document.getElementById("form-edit-ingreso").addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        Store.updateIngreso(id, { clienteNombre: f.get("cliente"), mes: f.get("mes"), dia: f.get("dia"), monto: f.get("monto") });
        closeModal();
        showToast("Ingreso actualizado", "success");
        renderIngresos();
    });
}