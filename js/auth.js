/* ==========================================================================
   AUTH — inicio de sesión con Google (Google Identity Services), disparado
   desde el ícono de perfil en la barra superior (no hay pantalla de
   bienvenida que tape la app). Un solo permiso cubre dos cosas: quién eres
   (nombre/foto/correo) y el acceso a tu carpeta privada de Drive donde se
   guardan tus datos.

   "Conectar automáticamente en este dispositivo": guardamos solo una
   bandera en localStorage (nunca el token). Si esa bandera existe, al
   abrir la app se pide un token en silencio (sin ventana emergente); si
   el navegador todavía tiene tu sesión de Google activa y ya diste el
   permiso antes, entras directo. Si no, el ícono de perfil queda listo
   para que lo toques cuando quieras conectar tu cuenta.
   ========================================================================== */

const Auth = (() => {
    const LOCAL_FLAG = "cuadre_had_session";
    const SCOPES = `openid email profile ${CONFIG.DRIVE_SCOPE}`;

    let tokenClient = null;
    let profile = null;
    let refreshTimer = null;
    let onReady = null;
    let currentToken = null;
    let ready = false;

    function init(readyCallback) {
        onReady = readyCallback;

        if (!window.google ? .accounts ? .oauth2) {
            showToast("No se pudo cargar el inicio de sesión de Google. Revisa tu conexión.", "error");
            return;
        }

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: handleTokenResponse,
            error_callback: (err) => {
                console.error(err);
                if (err.type === "popup_closed") return;
                showToast("No se pudo completar el inicio de sesión. Intenta de nuevo.", "error");
            },
        });
        ready = true;

        // Reconexión automática en este mismo dispositivo, en silencio.
        if (localStorage.getItem(LOCAL_FLAG) === "1") {
            signIn(false);
        }
    }

    function signIn(interactive = true) {
        if (!tokenClient) {
            if (interactive) showToast("Un momento, todavía está cargando el inicio de sesión…");
            return;
        }
        tokenClient.requestAccessToken({ prompt: interactive ? "consent" : "" });
    }

    async function handleTokenResponse(resp) {
        if (resp.error) {
            if (localStorage.getItem(LOCAL_FLAG) === "1") return; // reconexión silenciosa falló, sin ruido
            showToast("No se pudo iniciar sesión con Google.", "error");
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

    function isSignedIn() { return !!profile; }

    function signOut() {
        clearTimeout(refreshTimer);
        localStorage.removeItem(LOCAL_FLAG);
        if (currentToken && window.google ? .accounts ? .oauth2 ? .revoke) {
            google.accounts.oauth2.revoke(currentToken, () => location.reload());
        } else {
            location.reload();
        }
    }

    return { init, getProfile, isSignedIn, signOut, signIn };
})();