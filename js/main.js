/* ==========================================================================
   MAIN — arranque de la app (funciona sin conexión desde el primer momento),
   enrutado entre vistas y el ícono de perfil que conecta con Google.
   ========================================================================== */

const VIEWS = {
    dashboard: { render: () => renderDashboard(), title: "Resumen", sub: "Cómo va tu negocio" },
    ingresos: { render: () => renderIngresos(), title: "Ingresos", sub: "Cada entrada de dinero, por cliente y por mes" },
    "gastos-personales": { render: () => renderGastosPersonales(), title: "Gastos personales", sub: "Retiros y gastos de tu cuenta, por categoría" },
    "gastos-corporativos": { render: () => renderGastosCorporativos(), title: "Gastos corporativos", sub: "Inversión y mantenimiento del negocio" },
    ahorros: { render: () => renderAhorros(), title: "Ahorros", sub: "Tus metas y cuánto llevas apartado" },
    vision: { render: () => renderVision(), title: "Visión", sub: "Simula gastos e ingresos antes de que pasen" },
    saldo: { render: () => renderSaldo(), title: "Saldo", sub: "El cuadre completo" },
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
    const nameShort = profile ?.given_name || profile ?.name || "Cuenta";
    document.getElementById("profile-name").textContent = nameShort;
    document.getElementById("menu-name").textContent = profile ?.name || "Cuenta de Google";
    document.getElementById("menu-email").textContent = profile ?.email || "";

    const avatarSlot = document.getElementById("profile-avatar-slot");
    if (profile ?.picture) {
        avatarSlot.innerHTML = `<img class="profile-avatar" src="${profile.picture}" alt="">`;
    } else {
        const initial = (nameShort || "?").trim().charAt(0).toUpperCase();
        avatarSlot.innerHTML = `<span class="profile-avatar-fallback">${initial}</span>`;
    }

    document.getElementById("profile-widget").classList.add("is-signed-in");
}

function profileIconGuest() {
    const avatarSlot = document.getElementById("profile-avatar-slot");
    avatarSlot.innerHTML = `
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1.4-3.8 4.2-5.6 7.5-5.6s6.1 1.8 7.5 5.6"/>
        </svg>`;
    document.getElementById("profile-name").textContent = "Iniciar sesión";
}

function bindProfileMenu() {
    const btn = document.getElementById("profile-btn");
    const menu = document.getElementById("profile-menu");

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!Auth.isSignedIn()) {
            Auth.signIn(true);
            return;
        }
        menu.classList.toggle("is-open");
    });
    document.addEventListener("click", () => menu.classList.remove("is-open"));

    document.getElementById("btn-signout").addEventListener("click", () => {
        if (confirm("¿Cerrar sesión? Tus datos quedan guardados en tu Google Drive.")) Auth.signOut();
    });

    document.getElementById("btn-resync").addEventListener("click", () => {
        if (!Auth.isSignedIn()) { Auth.signIn(true); return; }
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

async function onGoogleReady(profile) {
    applyProfileToUi(profile);
    Drive.setSyncUi("saving");
    try {
        const data = await Drive.loadOrCreate(Store.getExportable());
        Store.loadFromRemote(data);
        Drive.setSyncUi("saved");
    } catch (e) {
        console.error(e);
        showToast("No se pudieron cargar tus datos desde Google Drive.", "error");
        Drive.setSyncUi("error");
    }
    VIEWS[currentView].render();
}

document.addEventListener("DOMContentLoaded", () => {
    bindNav();
    bindProfileMenu();
    profileIconGuest();

    // La app funciona de inmediato, sin esperar el inicio de sesión.
    setView("dashboard");

    const startAuth = () => Auth.init(onGoogleReady);
    if (window.google ?.accounts ?.oauth2) {
        startAuth();
    } else {
        // La librería de Google puede tardar un instante en cargar (script async).
        const t = setInterval(() => {
            if (window.google ?.accounts ?.oauth2) {
                clearInterval(t);
                startAuth();
            }
        }, 100);
        setTimeout(() => clearInterval(t), 8000);
    }
});