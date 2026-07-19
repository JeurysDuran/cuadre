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
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
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
