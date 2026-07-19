/* ==========================================================================
   VISTA — Gastos personales / Gastos corporativos
   Misma estructura que en el Excel (Fecha, Detalles, Cantidad), generada
   una sola vez para ambas hojas.
   ========================================================================== */

function makeGastosView({ containerId, tone, titulo, subtitulo, addFn, updateFn, deleteFn, listKey }) {
    return function render() {
        const el = document.getElementById(containerId);
        const state = Store.getState();
        const rows = [...state[listKey]].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
        const total = rows.reduce((s, r) => s + r.monto, 0);

        el.innerHTML = `
            <div class="kpi-card tone-${tone}" style="max-width:320px;margin-bottom:20px;">
                <div class="kpi-label">Total ${titulo.toLowerCase()}</div>
                <div class="kpi-value">${amountSpan(total, { forceSign: "negative" })}</div>
                <div class="kpi-sub">${rows.length} movimientos</div>
            </div>

            <div class="panel">
                <div class="panel-head"><div><h3>Registrar gasto</h3><p>${subtitulo}</p></div></div>
                <form id="form-${containerId}">
                    <div class="field-row">
                        <div class="field">
                            <label>Fecha</label>
                            <input name="fecha" type="date" value="${todayISO()}" required>
                        </div>
                        <div class="field">
                            <label>Monto (RD$)</label>
                            <input name="monto" type="number" min="0" step="0.01" placeholder="0.00" required>
                        </div>
                    </div>
                    <div class="field">
                        <label>Detalle</label>
                        <input name="detalle" placeholder="¿En qué fue el gasto?" required>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                            Agregar gasto
                        </button>
                    </div>
                </form>
            </div>

            <div class="panel">
                <div class="panel-head"><div><h3>Historial</h3><p>${rows.length} movimientos registrados</p></div></div>
                ${rows.length ? `<div class="table-wrap"><table class="ledger">
                    <thead><tr><th>Fecha</th><th>Detalle</th><th class="num">Monto</th><th></th></tr></thead>
                    <tbody>
                        ${rows.map((r) => `
                            <tr>
                                <td>${fmtDateHuman(r.fecha)}</td>
                                <td>${escapeHtml(r.detalle)}</td>
                                <td class="num">${amountSpan(r.monto, { forceSign: "negative" })}</td>
                                <td>
                                    <div class="row-actions">
                                        <button class="icon-btn" data-edit="${r.id}" title="Editar">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                                        </button>
                                        <button class="icon-btn" data-delete="${r.id}" title="Eliminar">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>`).join("")}
                    </tbody>
                </table></div>` : `<div class="empty-state"><div class="glyph">·−·</div><strong>Sin movimientos</strong><p>Registra el primer gasto arriba.</p></div>`}
            </div>
        `;

        document.getElementById(`form-${containerId}`).addEventListener("submit", (e) => {
            e.preventDefault();
            const f = new FormData(e.target);
            addFn({ fecha: f.get("fecha"), detalle: f.get("detalle"), monto: f.get("monto") });
            showToast("Gasto agregado", "success");
            render();
        });

        el.querySelectorAll("[data-edit]").forEach((btn) => {
            btn.addEventListener("click", () => openEditGasto(btn.dataset.edit, listKey, updateFn, render));
        });
        el.querySelectorAll("[data-delete]").forEach((btn) => {
            btn.addEventListener("click", () => {
                if (confirm("¿Eliminar este gasto?")) {
                    deleteFn(btn.dataset.delete);
                    showToast("Gasto eliminado");
                    render();
                }
            });
        });
    };
}

function openEditGasto(id, listKey, updateFn, rerender) {
    const row = Store.getState()[listKey].find((g) => g.id === id);
    if (!row) return;
    openModal(`
        <h3>Editar gasto</h3>
        <p class="modal-sub">${escapeHtml(row.detalle)}</p>
        <form id="form-edit-gasto">
            <div class="field-row">
                <div class="field"><label>Fecha</label><input name="fecha" type="date" value="${row.fecha}" required></div>
                <div class="field"><label>Monto (RD$)</label><input name="monto" type="number" min="0" step="0.01" value="${row.monto}" required></div>
            </div>
            <div class="field"><label>Detalle</label><input name="detalle" value="${escapeHtml(row.detalle)}" required></div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" data-close-modal>Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar cambios</button>
            </div>
        </form>
    `);
    document.getElementById("form-edit-gasto").addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        updateFn(id, { fecha: f.get("fecha"), detalle: f.get("detalle"), monto: f.get("monto") });
        closeModal();
        showToast("Gasto actualizado", "success");
        rerender();
    });
}

const renderGastosPersonales = makeGastosView({
    containerId: "view-gastos-personales",
    tone: "coral",
    titulo: "Gastos personales",
    subtitulo: "Retiros y gastos de tu cuenta personal",
    addFn: (d) => Store.addGastoPersonal(d),
    updateFn: (id, d) => Store.updateGastoPersonal(id, d),
    deleteFn: (id) => Store.deleteGastoPersonal(id),
    listKey: "gastosPersonales",
});

const renderGastosCorporativos = makeGastosView({
    containerId: "view-gastos-corporativos",
    tone: "amber",
    titulo: "Gastos corporativos",
    subtitulo: "Gastos, mejoras y actualizaciones del negocio",
    addFn: (d) => Store.addGastoCorporativo(d),
    updateFn: (id, d) => Store.updateGastoCorporativo(id, d),
    deleteFn: (id) => Store.deleteGastoCorporativo(id),
    listKey: "gastosCorporativos",
});
