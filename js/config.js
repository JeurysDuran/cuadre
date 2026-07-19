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

    // Año que se muestra en la marca de la app (solo decorativo).
    ANIO_ACTIVO: 2026,
};