/* ==========================================================================
   STORE — modelo de datos en memoria + cálculos derivados.
   Refleja las hojas del Excel original:
     - clientes + ingresos (Descripción de Ingresos mensual)
     - gastosPersonales (Gastos Personales)
     - gastosCorporativos (Gastos Corporativos)
   Los totales mensuales, anuales y el saldo se calculan siempre al vuelo,
   igual que las fórmulas del Excel, para que nunca se puedan "romper".
   ========================================================================== */

const Store = (() => {
    let state = {
        anio: CONFIG.ANIO_ACTIVO,
        clientes: [],           // { id, nombre }
        ingresos: [],           // { id, clienteId, mes(1-12), dia, monto }
        gastosPersonales: [],   // { id, fecha, detalle, monto }
        gastosCorporativos: [], // { id, fecha, detalle, monto }
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
                anio: data?.anio || CONFIG.ANIO_ACTIVO,
                clientes: data?.clientes || [],
                ingresos: data?.ingresos || [],
                gastosPersonales: data?.gastosPersonales || [],
                gastosCorporativos: data?.gastosCorporativos || [],
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
            return state.clientes.find((c) => c.id === id)?.nombre || "Cliente eliminado";
        },

        // ---------- Ingresos ----------
        addIngreso({ clienteNombre, mes, dia, monto }) {
            const clienteId = this.upsertCliente(clienteNombre);
            if (!clienteId) return;
            state.ingresos.push({
                id: uid(), clienteId, mes: Number(mes), dia: Number(dia) || null, monto: Number(monto) || 0,
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
        addGastoPersonal({ fecha, detalle, monto }) {
            state.gastosPersonales.push({ id: uid(), fecha: fecha || todayISO(), detalle: detalle.trim(), monto: Number(monto) || 0 });
            markDirty();
        },
        updateGastoPersonal(id, patch) {
            const row = state.gastosPersonales.find((g) => g.id === id);
            if (!row) return;
            Object.assign(row, patch, { monto: patch.monto !== undefined ? Number(patch.monto) || 0 : row.monto });
            markDirty();
        },
        deleteGastoPersonal(id) {
            state.gastosPersonales = state.gastosPersonales.filter((g) => g.id !== id);
            markDirty();
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

        // ---------- Cálculos derivados (equivalentes a las fórmulas del Excel) ----------
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

        saldoNeto() {
            return this.totalIngresos() - this.totalGastosPersonales() - this.totalGastosCorporativos();
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
