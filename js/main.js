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
