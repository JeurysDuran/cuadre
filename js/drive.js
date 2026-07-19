/* ==========================================================================
   DRIVE — guarda y lee los datos como un único archivo JSON dentro de la
   carpeta oculta "appDataFolder" de Google Drive del propio usuario.
   Esa carpeta es privada por app: ni siquiera aparece en el Drive normal
   del usuario, y ninguna otra app (ni tú desde el navegador) puede leerla.
   No hace falta backend ni base de datos: todo corre en el navegador.
   Si no has conectado tu cuenta todavía, la app sigue funcionando y
   guardando en memoria; en cuanto conectes tu cuenta, se sincroniza.
   ========================================================================== */

const Drive = (() => {
    const API = "https://www.googleapis.com/drive/v3/files";
    const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

    let accessToken = null;
    let fileId = null;
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

    async function loadOrCreate(localSnapshot) {
        const existing = await findFile();
        if (existing) {
            fileId = existing.id;
            const data = await readFile(fileId);
            return data;
        }
        const blank = localSnapshot || { anio: CONFIG.ANIO_ACTIVO, clientes: [], ingresos: [], gastosPersonales: [], gastosCorporativos: [], ahorros: [] };
        fileId = await createFile(blank);
        return blank;
    }

    function setSyncUi(status) {
        const pill = document.getElementById("sync-pill");
        const label = document.getElementById("sync-label");
        if (!pill || !label) return;
        pill.classList.remove("is-saving", "is-saved", "is-error");
        if (status === "saving") { pill.classList.add("is-saving");
            label.textContent = "Guardando en Drive…"; } else if (status === "saved") { pill.classList.add("is-saved");
            label.textContent = "Guardado en Google Drive"; } else if (status === "error") { pill.classList.add("is-error");
            label.textContent = "Error al guardar"; } else { label.textContent = "Guardado solo en este dispositivo"; }
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

    function isConnected() {
        return !!accessToken;
    }

    return { setAccessToken, loadOrCreate, saveNow, scheduleSave, setSyncUi, isConnected };
})();