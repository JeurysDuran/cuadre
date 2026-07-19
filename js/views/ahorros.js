/* ==========================================================================
   VISTA — Ahorros
   Metas de ahorro con un objetivo final (ej: RD$20,000 para un celular),
   a las que le vas agregando aportes (ej: +RD$2,000). La barra de progreso
   se va llenando según lo aportado. El ahorro NO se resta del saldo total
   en Resumen/Saldo — aquí puedes ver lo que te quedaría si lo separas.
   ========================================================================== */

function renderAhorros() {
    const el = document.getElementById("view-ahorros");
    const state = Store.getState();
    const metas = state.ahorros;
    const totalAhorrado = Store.totalAhorrado();
    const saldo = Store.saldoTotal();
    const saldoConAhorros = Store.saldoConAhorros();

    el.innerHTML = `
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
            <div class="kpi-card tone-blue">
                <div class="kpi-label">Apartado en metas</div>
                <div class="kpi-value">${amountSpan(totalAhorrado, { forceSign: "positive" })}</div>
                <div class="kpi-sub">${metas.length} ${metas.length === 1 ? "meta" : "metas"} activas</div>
            </div>
            <div class="kpi-card tone-mint">
                <div class="kpi-label">Saldo total (sin apartar)</div>
                <div class="kpi-value">${amountSpan(saldo, { forceSign: saldo >= 0 ? "positive" : "negative" })}</div>
                <div class="kpi-sub">Lo que tienes hoy en total</div>
            </div>
            <div class="kpi-card tone-coral">
                <div class="kpi-label">Saldo si separas los ahorros</div>
                <div class="kpi-value">${amountSpan(saldoConAhorros, { forceSign: saldoConAhorros >= 0 ? "positive" : "negative" })}</div>
                <div class="kpi-sub">Lo que te queda disponible</div>
            </div>
        </div>

        <div class="panel">
            <div class="panel-head">
                <div>
                    <h3>Nueva meta de ahorro</h3>
                    <p>Ponle nombre y el objetivo final que quieres alcanzar</p>
                </div>
            </div>
            <form id="form-nueva-meta">
                <div class="field-row">
                    <div class="field">
                        <label>Nombre de la meta</label>
                        <input name="nombre" placeholder="Ej: Comprar un celular" required>
                    </div>
                    <div class="field">
                        <label>Objetivo final (RD$)</label>
                        <input name="meta" type="number" min="0" step="0.01" placeholder="20000.00" required>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                        Crear meta
                    </button>
                </div>
            </form>
        </div>

        ${metas.length ? `<div class="savings-grid">${metas.map((m) => savingsCard(m)).join("")}</div>`
            : `<div class="panel"><div class="empty-state"><div class="glyph">·−·</div><strong>Todavía no tienes metas</strong><p>Crea tu primera meta arriba para empezar a apartar dinero.</p></div></div>`}
    `;

    document.getElementById("form-nueva-meta").addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        Store.addMetaAhorro({ nombre: f.get("nombre"), meta: f.get("meta") });
        showToast("Meta creada", "success");
        renderAhorros();
    });

    el.querySelectorAll("[data-aportar]").forEach((btn) => {
        btn.addEventListener("click", () => openAportarModal(btn.dataset.aportar));
    });
    el.querySelectorAll("[data-edit-meta]").forEach((btn) => {
        btn.addEventListener("click", () => openEditMeta(btn.dataset.editMeta));
    });
    el.querySelectorAll("[data-delete-meta]").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (confirm("¿Eliminar esta meta y todos sus aportes?")) {
                Store.deleteMetaAhorro(btn.dataset.deleteMeta);
                showToast("Meta eliminada");
                renderAhorros();
            }
        });
    });
}

function savingsCard(meta) {
    const ahorrado = Store.ahorradoDe(meta);
    const porcentaje = pct(ahorrado, meta.meta);
    const completa = meta.meta > 0 && ahorrado >= meta.meta;
    const aportesRecientes = [...meta.aportes].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).slice(0, 4);

    return `
        <div class="panel savings-card">
            <div class="panel-head">
                <div>
                    <h3>${escapeHtml(meta.nombre)}</h3>
                    <p>${completa ? "¡Meta alcanzada!" : `Objetivo: RD$ ${fmtMoney(meta.meta)}`}</p>
                </div>
                <div class="row-actions">
                    <button class="icon-btn" data-edit-meta="${meta.id}" title="Editar meta">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                    </button>
                    <button class="icon-btn" data-delete-meta="${meta.id}" title="Eliminar meta">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                </div>
            </div>

            <div class="savings-progress">
                <div class="savings-progress-bar">
                    <div class="savings-progress-fill ${completa ? "is-complete" : ""}" style="width:${porcentaje}%"></div>
                </div>
                <div class="savings-progress-labels">
                    <span>${amountSpan(ahorrado, { forceSign: "positive" })} ahorrado</span>
                    <span class="savings-pct">${porcentaje}%</span>
                </div>
            </div>

            <div class="form-actions" style="margin-top:14px;">
                <button class="btn btn-outline btn-sm" data-aportar="${meta.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                    Agregar aporte
                </button>
            </div>

            ${aportesRecientes.length ? `
                <div class="table-wrap" style="margin-top:14px;">
                    <table class="ledger">
                        <thead><tr><th>Fecha</th><th class="num">Aporte</th></tr></thead>
                        <tbody>
                            ${aportesRecientes.map((a) => `<tr><td>${fmtDateHuman(a.fecha)}</td><td class="num">${amountSpan(a.monto, { forceSign: "positive" })}</td></tr>`).join("")}
                        </tbody>
                    </table>
                </div>` : ""}
        </div>`;
}

function openAportarModal(metaId) {
    const meta = Store.getState().ahorros.find((a) => a.id === metaId);
    if (!meta) return;
    openModal(`
        <h3>Agregar aporte</h3>
        <p class="modal-sub">${escapeHtml(meta.nombre)}</p>
        <form id="form-aporte">
            <div class="field-row">
                <div class="field"><label>Fecha</label><input name="fecha" type="date" value="${todayISO()}" required></div>
                <div class="field"><label>Monto (RD$)</label><input name="monto" type="number" min="0" step="0.01" placeholder="2000.00" required></div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" data-close-modal>Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar aporte</button>
            </div>
        </form>
    `);
    document.getElementById("form-aporte").addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        Store.addAporteAhorro(metaId, { fecha: f.get("fecha"), monto: f.get("monto") });
        closeModal();
        showToast("Aporte agregado", "success");
        renderAhorros();
    });
}

function openEditMeta(metaId) {
    const meta = Store.getState().ahorros.find((a) => a.id === metaId);
    if (!meta) return;
    openModal(`
        <h3>Editar meta</h3>
        <form id="form-edit-meta">
            <div class="field"><label>Nombre de la meta</label><input name="nombre" value="${escapeHtml(meta.nombre)}" required></div>
            <div class="field"><label>Objetivo final (RD$)</label><input name="meta" type="number" min="0" step="0.01" value="${meta.meta}" required></div>
            <div class="form-actions">
                <button type="button" class="btn btn-outline" data-close-modal>Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar cambios</button>
            </div>
        </form>
    `);
    document.getElementById("form-edit-meta").addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        Store.updateMetaAhorro(metaId, { nombre: f.get("nombre"), meta: f.get("meta") });
        closeModal();
        showToast("Meta actualizada", "success");
        renderAhorros();
    });
}
