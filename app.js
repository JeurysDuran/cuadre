/* ==========================================================================
   APP.JS — Todo el JavaScript de la app en un solo archivo.
   Orden de las secciones (importa por las dependencias entre ellas):
   1. CONFIG   2. Utilidades   3. Store   4. Drive   5. Auth
   6. Charts   7. Vistas (dashboard, gastos, ingresos, saldo)   8. Main
   ========================================================================== */

/* ==========================================================================
   CONFIGURACIÓN — edita esto con tus propios datos de Google Cloud Console.
   Instrucciones completas en README.md, sección "Configurar Google".
   ========================================================================== */

const CONFIG = {
    // Client ID de OAuth 2.0 (tipo "Aplicación web") creado en Google Cloud
    // Console. NO es un secreto: es seguro que quede visible en el código
    // del sitio (así funciona el login de Google en apps 100% estáticas).
    GOOGLE_CLIENT_ID: "705425213110-s3m9f574fefvvrgok10ncb8ph82g6qd8.apps.googleusercontent.com",

    // Alcance mínimo necesario: solo permite crear/leer archivos que la
    // propia app creó, dentro de una carpeta privada de la app en Drive.
    // La app NUNCA puede ver el resto de tu Google Drive.
    DRIVE_SCOPE: "https://www.googleapis.com/auth/drive.appdata",

    // Nombre del archivo donde se guardan tus datos dentro de esa carpeta.
    DRIVE_FILE_NAME: "cuadre-datos.json",

    // Año fiscal que muestra la app (puedes cambiarlo cada enero).
    ANIO_ACTIVO: 2026,
};

/* ==========================================================================
   UTILIDADES COMPARTIDAS
   ========================================================================== */

const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtMoney(n) {
    const v = Number(n) || 0;
    return v.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoneyShort(n) {
    const v = Number(n) || 0;
    const abs = Math.abs(v);
    if (abs >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return v.toFixed(0);
}

function amountSpan(n, { forceSign } = {}) {
    const v = Number(n) || 0;
    let cls = "is-neutral";
    if (forceSign === "positive" || (!forceSign && v > 0)) cls = "is-positive";
    if (forceSign === "negative") cls = "is-negative";
    const prefix = forceSign === "negative" ? "-" : "";
    return `<span class="amount ${cls}">RD$ ${prefix}${fmtMoney(Math.abs(v))}</span>`;
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function fmtDateHuman(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(str) {
    return String(str ? ? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[c]));
}

function debounce(fn, wait) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

function showToast(message, type = "default") {
    const host = document.getElementById("toast-host");
    if (!host) return;
    const el = document.createElement("div");
    el.className = "toast" + (type === "error" ? " is-error" : type === "success" ? " is-success" : "");
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => {
        el.style.opacity = "0";
        el.style.transition = "opacity .25s ease";
        setTimeout(() => el.remove(), 250);
    }, 3200);
}

function openModal(html) {
    const backdrop = document.getElementById("modal-backdrop");
    const box = document.getElementById("modal-box");
    box.innerHTML = html;
    backdrop.classList.add("is-open");
}

function closeModal() {
    document.getElementById("modal-backdrop").classList.remove("is-open");
    document.getElementById("modal-box").innerHTML = "";
}

document.addEventListener("click", (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
    if (e.target.closest("[data-close-modal]")) closeModal();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});


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
        clientes: [], // { id, nombre }
        ingresos: [], // { id, clienteId, mes(1-12), dia, monto }
        gastosPersonales: [], // { id, fecha, detalle, monto }
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
                anio: data ? .anio || CONFIG.ANIO_ACTIVO,
                clientes: data ? .clientes || [],
                ingresos: data ? .ingresos || [],
                gastosPersonales: data ? .gastosPersonales || [],
                gastosCorporativos: data ? .gastosCorporativos || [],
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
            return state.clientes.find((c) => c.id === id) ? .nombre || "Cliente eliminado";
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


/* ==========================================================================
   DRIVE — guarda y lee los datos como un único archivo JSON dentro de la
   carpeta oculta "appDataFolder" de Google Drive del propio usuario.
   Esa carpeta es privada por app: ni siquiera aparece en el Drive normal
   del usuario, y ninguna otra app (ni tú desde el navegador) puede leerla.
   No hace falta backend ni base de datos: todo corre en el navegador.
   ========================================================================== */

const Drive = (() => {
    const API = "https://www.googleapis.com/drive/v3/files";
    const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

    let accessToken = null;
    let fileId = null;
    let saveTimer = null;
    let saving = false;
    let pendingSave = null;

    function setAccessToken(token) {
        accessToken = token;
    }

    function authHeaders(extra = {}) {
        return { Authorization: `Bearer ${accessToken}`, ...extra };
    }

    async function findFile() {
        const q = encodeURIComponent(`name='${CONFIG.DRIVE_FILE_NAME}' and trashed=false`);
        const url = `${API}?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)`;
        const res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) throw new Error("No se pudo consultar Google Drive.");
        const data = await res.json();
        return data.files ? .[0] || null;
    }

    async function createFile(initialData) {
        const metadata = { name: CONFIG.DRIVE_FILE_NAME, parents: ["appDataFolder"] };
        const boundary = "cuadre_boundary_" + uid();
        const body =
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
            `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(initialData)}\r\n` +
            `--${boundary}--`;
        const res = await fetch(`${UPLOAD_API}?uploadType=multipart&fields=id`, {
            method: "POST",
            headers: authHeaders({ "Content-Type": `multipart/related; boundary=${boundary}` }),
            body,
        });
        if (!res.ok) throw new Error("No se pudo crear el archivo de datos en Drive.");
        const data = await res.json();
        return data.id;
    }

    async function readFile(id) {
        const res = await fetch(`${API}/${id}?alt=media`, { headers: authHeaders() });
        if (!res.ok) throw new Error("No se pudo leer tus datos desde Drive.");
        const text = await res.text();
        if (!text) return null;
        try { return JSON.parse(text); } catch { return null; }
    }

    async function writeFile(id, data) {
        const res = await fetch(`${UPLOAD_API}/${id}?uploadType=media`, {
            method: "PATCH",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("No se pudo guardar en Drive.");
        return res.json();
    }

    async function loadOrCreate() {
        const existing = await findFile();
        if (existing) {
            fileId = existing.id;
            const data = await readFile(fileId);
            return data;
        }
        const blank = { anio: CONFIG.ANIO_ACTIVO, clientes: [], ingresos: [], gastosPersonales: [], gastosCorporativos: [] };
        fileId = await createFile(blank);
        return blank;
    }

    function setSyncUi(status) {
        const pill = document.getElementById("sync-pill");
        const label = document.getElementById("sync-label");
        if (!pill || !label) return;
        pill.classList.remove("is-saving", "is-saved", "is-error");
        if (status === "saving") {
            pill.classList.add("is-saving");
            label.textContent = "Guardando en Drive…";
        } else if (status === "saved") {
            pill.classList.add("is-saved");
            label.textContent = "Guardado en Google Drive";
        } else if (status === "error") {
            pill.classList.add("is-error");
            label.textContent = "Error al guardar";
        } else { label.textContent = "Sincronizado"; }
    }

    async function saveNow(data) {
        if (!fileId || !accessToken) return;
        if (saving) { pendingSave = data; return; }
        saving = true;
        setSyncUi("saving");
        try {
            await writeFile(fileId, data);
            Store.clearDirty();
            setSyncUi("saved");
        } catch (e) {
            console.error(e);
            setSyncUi("error");
            showToast("No se pudo guardar en Google Drive. Revisa tu conexión.", "error");
        } finally {
            saving = false;
            if (pendingSave) {
                const next = pendingSave;
                pendingSave = null;
                saveNow(next);
            }
        }
    }

    const scheduleSave = debounce((data) => saveNow(data), 1400);

    return { setAccessToken, loadOrCreate, saveNow, scheduleSave, setSyncUi };
})();


/* ==========================================================================
   AUTH — inicio de sesión con Google (Google Identity Services).
   Un solo permiso cubre dos cosas: quién eres (nombre/foto/correo) y el
   acceso a tu carpeta privada de Drive donde se guardan tus datos.

   "Conectar automáticamente en este dispositivo": guardamos solo una
   bandera en localStorage (nunca el token). Si esa bandera existe, al
   abrir la app se pide un token en silencio (sin ventana emergente); si
   el navegador todavía tiene tu sesión de Google activa y ya diste el
   permiso antes, entras directo. Si no, se muestra el botón normal.
   ========================================================================== */

const Auth = (() => {
    const LOCAL_FLAG = "cuadre_had_session";
    const SCOPES = `openid email profile ${CONFIG.DRIVE_SCOPE}`;

    let tokenClient = null;
    let profile = null;
    let refreshTimer = null;
    let onReady = null;
    let currentToken = null;

    function googleLogoSvg() {
        return `<svg viewBox="0 0 48 48" width="18" height="18">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.9 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 6.1 29.5 4 24 4c-7.4 0-13.8 4.1-17.2 10.1z"/>
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.8 14-5.1l-6.5-5.4C29.5 35.4 26.9 36 24 36c-5.2 0-9.6-3.1-11.3-7.6l-6.5 5C9.9 39.8 16.4 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 3-3.2 5.4-6 6.9l6.5 5.4C39.4 37.6 44 31.6 44 24c0-1.3-.1-2.7-.4-3.5z"/>
        </svg>`;
    }

    function renderButton(container) {
        container.innerHTML = `
            <button type="button" class="btn btn-outline" id="google-signin-btn"
                style="width:100%;justify-content:center;padding:11px 16px;font-size:14px;">
                ${googleLogoSvg()} Continuar con Google
            </button>`;
        document.getElementById("google-signin-btn").addEventListener("click", () => signIn(true));
    }

    function setStatus(msg, isError) {
        const el = document.getElementById("login-status");
        if (!el) return;
        el.textContent = msg || "";
        el.classList.toggle("is-error", !!isError);
    }

    function init(readyCallback) {
        onReady = readyCallback;
        const slot = document.getElementById("google-btn-slot");

        if (!window.google ? .accounts ? .oauth2) {
            setStatus("No se pudo cargar el inicio de sesión de Google. Revisa tu conexión e intenta de nuevo.", true);
            return;
        }

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: handleTokenResponse,
            error_callback: (err) => {
                console.error(err);
                if (err.type === "popup_closed") { setStatus(""); return; }
                setStatus("No se pudo completar el inicio de sesión. Intenta de nuevo.", true);
            },
        });

        renderButton(slot);

        // Reconexión automática en este mismo dispositivo.
        if (localStorage.getItem(LOCAL_FLAG) === "1") {
            setStatus("Conectando tu cuenta…");
            signIn(false);
        }
    }

    function signIn(interactive) {
        if (!tokenClient) return;
        tokenClient.requestAccessToken({ prompt: interactive ? "consent" : "" });
    }

    async function handleTokenResponse(resp) {
        if (resp.error) {
            if (localStorage.getItem(LOCAL_FLAG) === "1") {
                // La reconexión silenciosa falló (sesión expirada, otro dispositivo, etc.)
                setStatus("");
                return;
            }
            setStatus("No se pudo iniciar sesión con Google.", true);
            return;
        }

        currentToken = resp.access_token;
        Drive.setAccessToken(resp.access_token);
        localStorage.setItem(LOCAL_FLAG, "1");
        scheduleRefresh(resp.expires_in);

        try {
            const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${resp.access_token}` },
            });
            profile = await res.json();
        } catch (e) {
            profile = null;
        }

        onReady ? .(profile);
    }

    function scheduleRefresh(expiresIn) {
        clearTimeout(refreshTimer);
        const ms = Math.max((Number(expiresIn) || 3000) - 180, 30) * 1000;
        refreshTimer = setTimeout(() => tokenClient ? .requestAccessToken({ prompt: "" }), ms);
    }

    function getProfile() { return profile; }

    function signOut() {
        clearTimeout(refreshTimer);
        localStorage.removeItem(LOCAL_FLAG);
        if (currentToken && window.google ? .accounts ? .oauth2 ? .revoke) {
            google.accounts.oauth2.revoke(currentToken, () => location.reload());
        } else {
            location.reload();
        }
    }

    return { init, getProfile, signOut };
})();


/* ==========================================================================
   CHARTS — envoltorios sobre Chart.js con la paleta de la app.
   ========================================================================== */

const Charts = (() => {
    const instances = {};
    const css = getComputedStyle(document.documentElement);
    const c = (name) => css.getPropertyValue(name).trim();

    const COLORS = {
        mint: c("--mint") || "#35D28A",
        coral: c("--coral") || "#FF6B5E",
        amber: c("--amber") || "#F2B84B",
        blue: c("--blue") || "#5B9BFF",
        text: c("--text") || "#ECEEF0",
        textDim: c("--text-dim") || "#9198A3",
        line: c("--line") || "#262C34",
        surface2: c("--surface-2") || "#181D24",
    };

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = COLORS.textDim;
    Chart.defaults.borderColor = COLORS.line;

    const MES_ABR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    function destroy(id) {
        if (instances[id]) {
            instances[id].destroy();
            delete instances[id];
        }
    }

    function ctxOf(id) {
        const el = document.getElementById(id);
        return el ? el.getContext("2d") : null;
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
                    backgroundColor: COLORS.mint + "cc",
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
                    tooltip: {
                        backgroundColor: COLORS.surface2,
                        borderColor: COLORS.line,
                        borderWidth: 1,
                        titleColor: COLORS.text,
                        bodyColor: COLORS.text,
                        padding: 10,
                        callbacks: { label: (i) => "RD$ " + fmtMoney(i.parsed.y) },
                    },
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
                    backgroundColor: COLORS.blue + "22",
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
                    tooltip: {
                        backgroundColor: COLORS.surface2,
                        borderColor: COLORS.line,
                        borderWidth: 1,
                        titleColor: COLORS.text,
                        bodyColor: COLORS.text,
                        padding: 10,
                        callbacks: { label: (i) => "RD$ " + fmtMoney(i.parsed.y) },
                    },
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
                    borderColor: COLORS.surface2,
                    borderWidth: 3,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: COLORS.surface2,
                        borderColor: COLORS.line,
                        borderWidth: 1,
                        titleColor: COLORS.text,
                        bodyColor: COLORS.text,
                        padding: 10,
                        callbacks: { label: (i) => `${i.label}: RD$ ${fmtMoney(i.parsed)}` },
                    },
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
                    backgroundColor: COLORS.blue + "cc",
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
                    tooltip: {
                        backgroundColor: COLORS.surface2,
                        borderColor: COLORS.line,
                        borderWidth: 1,
                        titleColor: COLORS.text,
                        bodyColor: COLORS.text,
                        padding: 10,
                        callbacks: { label: (i) => "RD$ " + fmtMoney(i.parsed.x) },
                    },
                },
                scales: {
                    x: { grid: { color: COLORS.line }, ticks: { callback: (v) => fmtMoneyShort(v) } },
                    y: { grid: { display: false } },
                },
            },
        });
    }

    return { monthlyIncome, balanceTrend, expensesBreakdown, topClients, destroy };
})();


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
                <div class="panel-head"><div><h3>Total anual por cliente</h3><p>Acumulado del año completo</p></div></div>
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
        <thead><tr><th>Cliente</th><th class="num">Total anual</th></tr></thead>
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


/* ==========================================================================
   MAIN — arranque de la app, enrutado entre vistas y acciones del perfil.
   ========================================================================== */

const VIEWS = {
    dashboard: { render: () => renderDashboard(), title: "Resumen", sub: "Cómo va tu negocio este año" },
    ingresos: { render: () => renderIngresos(), title: "Ingresos", sub: "Cada entrada de dinero, por cliente y por mes" },
    "gastos-personales": { render: () => renderGastosPersonales(), title: "Gastos personales", sub: "Retiros y gastos de tu cuenta" },
    "gastos-corporativos": { render: () => renderGastosCorporativos(), title: "Gastos corporativos", sub: "Inversión y mantenimiento del negocio" },
    saldo: { render: () => renderSaldo(), title: "Saldo", sub: "El cuadre final de tu año" },
};

let currentView = "dashboard";

function setView(name) {
    if (!VIEWS[name]) return;
    currentView = name;

    document.querySelectorAll(".view").forEach((v) => v.classList.remove("is-active"));
    document.getElementById(`view-${name}`).classList.add("is-active");

    document.querySelectorAll(".nav-link, .tabbar-btn").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.view === name);
    });

    document.getElementById("topbar-title").textContent = VIEWS[name].title;
    document.getElementById("topbar-sub").textContent = VIEWS[name].sub;

    VIEWS[name].render();
}

function bindNav() {
    document.querySelectorAll("[data-view]").forEach((btn) => {
        btn.addEventListener("click", () => setView(btn.dataset.view));
    });
}

function applyProfileToUi(profile) {
    const nameShort = profile?.given_name || profile?.name || "Cuenta";
    document.getElementById("profile-name").textContent = nameShort;
    document.getElementById("menu-name").textContent = profile?.name || "Cuenta de Google";
    document.getElementById("menu-email").textContent = profile?.email || "";

    const avatarSlot = document.getElementById("profile-avatar-slot");
    if (profile?.picture) {
        avatarSlot.innerHTML = `<img class="profile-avatar" src="${profile.picture}" alt="">`;
    } else {
        const initial = (nameShort || "?").trim().charAt(0).toUpperCase();
        avatarSlot.innerHTML = `<span class="profile-avatar-fallback">${initial}</span>`;
    }
}

function bindProfileMenu() {
    const btn = document.getElementById("profile-btn");
    const menu = document.getElementById("profile-menu");
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("is-open");
    });
    document.addEventListener("click", () => menu.classList.remove("is-open"));

    document.getElementById("btn-signout").addEventListener("click", () => {
        if (confirm("¿Cerrar sesión? Tus datos quedan guardados en tu Google Drive.")) Auth.signOut();
    });

    document.getElementById("btn-resync").addEventListener("click", () => {
        Drive.saveNow(Store.getExportable());
        showToast("Sincronizando con Google Drive…");
    });

    document.getElementById("btn-export").addEventListener("click", () => {
        const data = Store.getExportable();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `cuadre-${data.anio}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    });
}

async function bootAfterAuth(profile) {
    document.getElementById("login-screen").hidden = true;
    document.getElementById("app").hidden = false;
    document.getElementById("brand-year-tag").textContent = `Año ${CONFIG.ANIO_ACTIVO}`;

    applyProfileToUi(profile);

    try {
        const data = await Drive.loadOrCreate();
        Store.loadFromRemote(data);
        Drive.setSyncUi("saved");
    } catch (e) {
        console.error(e);
        showToast("No se pudieron cargar tus datos desde Google Drive.", "error");
        Drive.setSyncUi("error");
    }

    setView("dashboard");
}

document.addEventListener("DOMContentLoaded", () => {
    bindNav();
    bindProfileMenu();

    const startAuth = () => Auth.init(bootAfterAuth);

    if (window.google?.accounts?.oauth2) {
        startAuth();
    } else {
        // La librería de Google puede tardar un instante en cargar (script async).
        const t = setInterval(() => {
            if (window.google?.accounts?.oauth2) {
                clearInterval(t);
                startAuth();
            }
        }, 100);
        setTimeout(() => clearInterval(t), 8000);
    }
});