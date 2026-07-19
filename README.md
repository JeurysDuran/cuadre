# Cuadre

Web app para llevar el control de ingresos por cliente, gastos personales, gastos corporativos y el saldo neto de tu negocio — basada en tu Excel `Adm-Neg-Ingr-LC-2026-J.xlsx`, pero con gráficas, filtros y una interfaz pensada para usarse todos los días.

No usa ningún backend ni base de datos propia: cada usuario inicia sesión con su cuenta de Google y sus datos se guardan como un archivo JSON dentro de una carpeta privada de su propio Google Drive (la llamada `appDataFolder`), a la que **solo esta app puede acceder** — no aparece en el Drive normal del usuario ni la puede ver nadie más.

---

## 1. Qué contiene cada pantalla

| Pantalla | Equivalente en tu Excel |
|---|---|
| **Resumen** | KPIs + gráficas: ingresos por mes, clientes con más ingresos, gastos personal vs. corporativo, saldo acumulado |
| **Ingresos** | "Descripción de Ingresos mensual" + "Total Ingresos Mensuales" + "Total Ingresos Anuales" |
| **Gastos personales** | "Gastos Personales" |
| **Gastos corporativos** | "Gastos Corporativos" |
| **Saldo** | "Saldo" (ingresos − gastos personales − gastos corporativos) |

Todos los totales y el saldo se calculan siempre en el momento (como las fórmulas del Excel), así que nunca se pueden "romper" por accidente.

---

## 2. Configurar Google (obligatorio antes de usarla)

La app necesita un **Client ID de OAuth** propio, gratis, de tu cuenta de Google Cloud. Toma unos 5 minutos:

1. Entra a [console.cloud.google.com](https://console.cloud.google.com/) e inicia sesión con tu cuenta de Google.
2. Crea un proyecto nuevo (arriba a la izquierda → "Nuevo proyecto"). Ponle el nombre que quieras, por ejemplo `cuadre`.
3. Ve a **APIs y servicios → Pantalla de consentimiento OAuth**.
   - Tipo de usuario: **Externo**.
   - Completa nombre de la app (`Cuadre`), tu correo de soporte y tu correo de contacto de desarrollador.
   - En "Público" / "Audiencia", puedes dejarla en modo **Prueba** y agregarte a ti mismo (y a quien más vaya a usarla) como **usuario de prueba** — así evitas el proceso de verificación de Google, que no hace falta para uso personal.
4. Ve a **APIs y servicios → Biblioteca**, busca **Google Drive API** y actívala.
5. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
   - Tipo de aplicación: **Aplicación web**.
   - Nombre: el que quieras.
   - En **Orígenes autorizados de JavaScript**, agrega las URLs desde donde vas a abrir la app, por ejemplo:
     - `http://localhost:5500` (o el puerto que uses para probar en tu computadora)
     - `https://tu-sitio.netlify.app` (la URL que te dé Netlify)
     - Si luego conectas un dominio propio, agrégalo también.
   - No hace falta poner nada en "URI de redirección autorizados" (esta app no los usa).
   - Guarda y copia el **Client ID** que te genera (termina en `.apps.googleusercontent.com`).
6. Abre el archivo `js/config.js` de este proyecto y reemplaza:

   ```js
   GOOGLE_CLIENT_ID: "TU_CLIENT_ID_DE_GOOGLE.apps.googleusercontent.com",
   ```

   con tu Client ID real.

Ese Client ID **no es secreto** — es normal y seguro que quede visible en el código de una app 100% del lado del cliente como esta; así funciona el botón "Iniciar sesión con Google" en cualquier sitio estático.

Cada vez que abras la app desde una URL nueva (otro dominio, otro puerto), tienes que agregarla a "Orígenes autorizados de JavaScript" en el paso 5, o Google bloqueará el inicio de sesión desde ahí.

---

## 3. Probarla en tu computadora

No necesita build ni `npm install`, es HTML/CSS/JS puro. Solo necesitas servirla por HTTP (Google no permite el login desde `file://`):

- Con la extensión **Live Server** de VS Code: clic derecho en `index.html` → "Open with Live Server".
- O con Python: `python3 -m http.server 5500` dentro de la carpeta del proyecto, y abrir `http://localhost:5500`.

Recuerda agregar ese `http://localhost:PUERTO` en los orígenes autorizados (paso 2.5).

---

## 4. Subir a GitHub y desplegar en Netlify

1. Crea un repositorio en GitHub y sube esta carpeta completa (incluyendo `js/config.js` ya con tu Client ID).
2. Entra a [app.netlify.com](https://app.netlify.com/) → **Add new site → Import an existing project** → conecta tu cuenta de GitHub y elige el repositorio.
3. Como es un sitio estático, no hace falta build command ni carpeta de publicación especial — Netlify detecta el `index.html` en la raíz. Si te pide algo, deja **Build command** vacío y **Publish directory** en `.` (o `/`).
4. Despliega. Netlify te da una URL tipo `https://algo-al-azar.netlify.app`.
5. Copia esa URL y agrégala en **Orígenes autorizados de JavaScript** de tu Client ID (paso 2.5) — si no, el login fallará solo en producción.
6. (Opcional) En Netlify puedes cambiarle el nombre al sitio (Site configuration → Change site name) para tener una URL más bonita antes de conectar un dominio propio.

Cada vez que hagas `git push`, Netlify vuelve a publicar el sitio automáticamente.

---

## 5. Cómo funciona el guardado y la reconexión automática

- Al iniciar sesión, la app crea (o encuentra) un archivo `cuadre-datos.json` dentro de tu `appDataFolder` privado de Drive.
- Cada cambio que haces (agregar/editar/borrar un ingreso o gasto) se guarda ahí automáticamente unos segundos después, sin que tengas que hacer nada. El indicador de la esquina inferior izquierda ("Guardado en Google Drive") te confirma que ya quedó sincronizado.
- **Reconexión automática en el mismo dispositivo**: la app nunca guarda tu contraseña ni tu token de acceso en el navegador. Solo guarda una banderita ("ya inicié sesión antes aquí"). Cuando vuelves a abrir la app desde el mismo navegador, intenta reconectar en silencio usando tu sesión activa de Google — si tu navegador la mantiene activa y ya diste el permiso antes, entras directo sin tocar nada. Si Google no puede confirmarlo en silencio (cerraste sesión de Google, borraste cookies, es otro navegador o dispositivo), simplemente te muestra el botón de "Continuar con Google" otra vez.
- Puedes forzar una sincronización manual o exportar tus datos a un `.json` de respaldo desde el menú del perfil (ícono arriba a la derecha).

---

## 6. Estructura del proyecto

```
index.html              Estructura de toda la app (login + shell de la app)
css/
  tokens.css             Paleta, tipografías, variables
  login.css               Pantalla de acceso
  layout.css               Barra lateral, topbar, tab bar móvil
  components.css            Tarjetas, tablas, formularios, modal, gráficas
js/
  config.js               Client ID de Google y ajustes generales — edítalo tú
  utils.js                  Helpers de formato (dinero, fechas, toasts, modal)
  store.js                   Modelo de datos + todos los cálculos (equivalen a las fórmulas del Excel)
  drive.js                     Lectura/escritura del archivo JSON en Google Drive
  auth.js                       Login con Google + reconexión automática
  charts.js                      Gráficas (Chart.js)
  views/
    dashboard.js                 Vista "Resumen"
    ingresos.js                    Vista "Ingresos"
    gastos.js                       Vistas "Gastos personales" y "Gastos corporativos"
    saldo.js                         Vista "Saldo"
  main.js                    Arranque, enrutado entre vistas, menú de perfil
```

## 7. Cambiar el año

Cuando empiece 2027, cambia `ANIO_ACTIVO` en `js/config.js`. Si quieres guardar el histórico de 2026 en vez de sobreescribirlo, exporta primero tus datos desde el menú de perfil ("Exportar datos") y cambia también `DRIVE_FILE_NAME` a algo como `cuadre-datos-2027.json` para que la app empiece un archivo nuevo en Drive.
