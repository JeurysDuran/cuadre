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

        if (!window.google?.accounts?.oauth2) {
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

        onReady?.(profile);
    }

    function scheduleRefresh(expiresIn) {
        clearTimeout(refreshTimer);
        const ms = Math.max((Number(expiresIn) || 3000) - 180, 30) * 1000;
        refreshTimer = setTimeout(() => tokenClient?.requestAccessToken({ prompt: "" }), ms);
    }

    function getProfile() { return profile; }

    function signOut() {
        clearTimeout(refreshTimer);
        localStorage.removeItem(LOCAL_FLAG);
        if (currentToken && window.google?.accounts?.oauth2?.revoke) {
            google.accounts.oauth2.revoke(currentToken, () => location.reload());
        } else {
            location.reload();
        }
    }

    return { init, getProfile, signOut };
})();
