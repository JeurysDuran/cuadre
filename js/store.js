/* ==========================================================================
   STORE — modelo de datos en memoria + cálculos derivados.
     - clientes + ingresos
     - gastosPersonales (con categoría)
     - gastosCorporativos
     - ahorros (metas de ahorro con aportes)
   Los totales se calculan siempre al vuelo para que nunca se puedan "romper".
   El "saldo total" es acumulado de todo lo registrado, no se limita a un
   año calendario (no hay filtro de año en los movimientos).
   ========================================================================== */

const Store = (() => {
    let state = {
        anio: CONFIG.ANIO_ACTIVO,
        clientes: [], // { id, nombre }
        ingresos: [], // { id, clienteId, mes(1-12), dia, monto }
        gastosPersonales: [], // { id, fecha, detalle, monto, categoria }
        gastosCorporativos: [], // { id, fecha, detalle, monto }
        ahorros: [], // { id, nombre, meta, aportes:[{id,fecha,monto}] }
    };

    const listeners = new Set();
    let dirty = false;

    function notify() {
        listeners.forEach((fn) => fn(state));
    }

    function markDirty() {
        dirty = true;
        notify();
        Drive.scheduleSave(getExportable());
    }

    return {
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        getState() { return state; },
        isDirty() { return dirty; },
        clearDirty() { dirty = false; },

        loadFromRemote(data) {
            state = {
                anio: data ?.anio || CONFIG.ANIO_ACTIVO,
                clientes: data ?.clientes || [],
                ingresos: data ?.ingresos || [],
                gastosPersonales: (data ?.gastosPersonales || []).map((g) => ({ categoria: "Sin categoría", ...g })),
                gastosCorporativos: data ?.gastosCorporativos || [],
                ahorros: (data ?.ahorros || []).map((a) => ({ aportes: [], ...a })),
            };
            dirty = false;
            notify();
        },

        getExportable() { return getExportable(); },

        // ---------- Clientes ----------
        upsertCliente(nombre) {
            const clean = nombre.trim();
            if (!clean) return null;
            const existing = state.clientes.find((c) => c.nombre.toLowerCase() === clean.toLowerCase());
            if (existing) return existing.id;
            const c = { id: uid(), nombre: clean };
            state.clientes.push(c);
            markDirty();
            return c.id;
        },

        renameCliente(id, nombre) {
            const c = state.clientes.find((c) => c.id === id);
            if (!c) return;
            c.nombre = nombre.trim();
            markDirty();
        },

        deleteCliente(id) {
            state.clientes = state.clientes.filter((c) => c.id !== id);
            state.ingresos = state.ingresos.filter((i) => i.clienteId !== id);
            markDirty();
        },

        clienteNombre(id) {
            return state.clientes.find((c) => c.id === id) ?.nombre || "Cliente eliminado";
        },

        // ---------- Ingresos ----------
        addIngreso({ clienteNombre, mes, dia, monto }) {
            const clienteId = this.upsertCliente(clienteNombre);
            if (!clienteId) return;
            state.ingresos.push({
                id: uid(),
                clienteId,
                mes: Number(mes),
                dia: Number(dia) || null,
                monto: Number(monto) || 0,
            });
            markDirty();
        },

        updateIngreso(id, patch) {
            const row = state.ingresos.find((i) => i.id === id);
            if (!row) return;
            if (patch.clienteNombre !== undefined) row.clienteId = this.upsertCliente(patch.clienteNombre);
            if (patch.mes !== undefined) row.mes = Number(patch.mes);
            if (patch.dia !== undefined) row.dia = Number(patch.dia) || null;
            if (patch.monto !== undefined) row.monto = Number(patch.monto) || 0;
            markDirty();
        },

        deleteIngreso(id) {
            state.ingresos = state.ingresos.filter((i) => i.id !== id);
            markDirty();
        },

        // ---------- Gastos personales ----------
        addGastoPersonal({ fecha, detalle, monto, categoria }) {
            state.gastosPersonales.push({
                id: uid(),
                fecha: fecha || todayISO(),
                detalle: detalle.trim(),
                monto: Number(monto) || 0,
                categoria: (categoria || "Sin categoría").trim() || "Sin categoría",
            });
            markDirty();
        },
        updateGastoPersonal(id, patch) {
            const row = state.gastosPersonales.find((g) => g.id === id);
            if (!row) return;
            Object.assign(row, patch, {
                monto: patch.monto !== undefined ? Number(patch.monto) || 0 : row.monto,
                categoria: patch.categoria !== undefined ? ((patch.categoria || "Sin categoría").trim() || "Sin categoría") : row.categoria,
            });
            markDirty();
        },
        deleteGastoPersonal(id) {
            state.gastosPersonales = state.gastosPersonales.filter((g) => g.id !== id);
            markDirty();
        },
        categoriasPersonalesUsadas() {
            const set = new Set(state.gastosPersonales.map((g) => g.categoria || "Sin categoría"));
            return [...set].sort((a, b) => a.localeCompare(b));
        },
        gastosPersonalesPorCategoria() {
            const map = new Map();
            state.gastosPersonales.forEach((g) => {
                const cat = g.categoria || "Sin categoría";
                map.set(cat, (map.get(cat) || 0) + g.monto);
            });
            return [...map.entries()]
                .map(([categoria, total]) => ({ categoria, total }))
                .sort((a, b) => b.total - a.total);
        },

        // ---------- Gastos corporativos ----------
        addGastoCorporativo({ fecha, detalle, monto }) {
            state.gastosCorporativos.push({ id: uid(), fecha: fecha || todayISO(), detalle: detalle.trim(), monto: Number(monto) || 0 });
            markDirty();
        },
        updateGastoCorporativo(id, patch) {
            const row = state.gastosCorporativos.find((g) => g.id === id);
            if (!row) return;
            Object.assign(row, patch, { monto: patch.monto !== undefined ? Number(patch.monto) || 0 : row.monto });
            markDirty();
        },
        deleteGastoCorporativo(id) {
            state.gastosCorporativos = state.gastosCorporativos.filter((g) => g.id !== id);
            markDirty();
        },

        // ---------- Ahorros (metas) ----------
        addMetaAhorro({ nombre, meta }) {
            const clean = (nombre || "").trim();
            if (!clean) return null;
            const m = { id: uid(), nombre: clean, meta: Number(meta) || 0, aportes: [] };
            state.ahorros.push(m);
            markDirty();
            return m.id;
        },
        updateMetaAhorro(id, patch) {
            const m = state.ahorros.find((a) => a.id === id);
            if (!m) return;
            if (patch.nombre !== undefined) m.nombre = patch.nombre.trim();
            if (patch.meta !== undefined) m.meta = Number(patch.meta) || 0;
            markDirty();
        },
        deleteMetaAhorro(id) {
            state.ahorros = state.ahorros.filter((a) => a.id !== id);
            markDirty();
        },
        addAporteAhorro(metaId, { monto, fecha }) {
            const m = state.ahorros.find((a) => a.id === metaId);
            if (!m) return;
            m.aportes.push({ id: uid(), fecha: fecha || todayISO(), monto: Number(monto) || 0 });
            markDirty();
        },
        deleteAporteAhorro(metaId, aporteId) {
            const m = state.ahorros.find((a) => a.id === metaId);
            if (!m) return;
            m.aportes = m.aportes.filter((ap) => ap.id !== aporteId);
            markDirty();
        },
        ahorradoDe(meta) {
            return (meta.aportes || []).reduce((s, a) => s + a.monto, 0);
        },
        totalAhorrado() {
            return state.ahorros.reduce((s, m) => s + this.ahorradoDe(m), 0);
        },

        // ---------- Cálculos derivados ----------
        ingresosPorMes() {
            const arr = Array(12).fill(0);
            state.ingresos.forEach((i) => { if (i.mes >= 1 && i.mes <= 12) arr[i.mes - 1] += i.monto; });
            return arr;
        },

        ingresosPorCliente() {
            const map = new Map();
            state.ingresos.forEach((i) => {
                map.set(i.clienteId, (map.get(i.clienteId) || 0) + i.monto);
            });
            return [...map.entries()]
                .map(([clienteId, total]) => ({ clienteId, nombre: this.clienteNombre(clienteId), total }))
                .sort((a, b) => b.total - a.total);
        },

        totalIngresos() {
            return state.ingresos.reduce((s, i) => s + i.monto, 0);
        },

        totalGastosPersonales() {
            return state.gastosPersonales.reduce((s, g) => s + g.monto, 0);
        },

        totalGastosCorporativos() {
            return state.gastosCorporativos.reduce((s, g) => s + g.monto, 0);
        },

        // Saldo total: todo lo que ha entrado menos todo lo que ha salido.
        // No resta los ahorros: lo apartado sigue siendo tuyo, solo está
        // separado con un propósito.
        saldoTotal() {
            return this.totalIngresos() - this.totalGastosPersonales() - this.totalGastosCorporativos();
        },
        // Alias por compatibilidad con vistas antiguas.
        saldoNeto() {
            return this.saldoTotal();
        },
        // Saldo disponible si además apartas lo que ya está en tus metas de ahorro.
        saldoConAhorros() {
            return this.saldoTotal() - this.totalAhorrado();
        },

        gastosPersonalesPorMes() {
            const arr = Array(12).fill(0);
            state.gastosPersonales.forEach((g) => {
                const m = new Date(g.fecha + "T00:00:00").getMonth();
                if (!isNaN(m)) arr[m] += g.monto;
            });
            return arr;
        },

        gastosCorporativosPorMes() {
            const arr = Array(12).fill(0);
            state.gastosCorporativos.forEach((g) => {
                const m = new Date(g.fecha + "T00:00:00").getMonth();
                if (!isNaN(m)) arr[m] += g.monto;
            });
            return arr;
        },

        saldoAcumuladoPorMes() {
            const ing = this.ingresosPorMes();
            const gp = this.gastosPersonalesPorMes();
            const gc = this.gastosCorporativosPorMes();
            let acc = 0;
            return ing.map((_, m) => {
                acc += ing[m] - gp[m] - gc[m];
                return acc;
            });
        },
    };

    function getExportable() {
        return JSON.parse(JSON.stringify(state));
    }
})();