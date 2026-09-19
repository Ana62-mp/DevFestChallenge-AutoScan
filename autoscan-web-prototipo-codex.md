# AutoScan — Prototipo funcional (Web App con React) para Codex

## Decisión de arquitectura: React Web App, no Expo/React Native
La automatización real (cámara detecta movimiento → sube clip → el sistema lee la placa solo, sin que nadie mire nada) ocurre en el **backend**, no en el teléfono de nadie. Por eso el frontend no necesita ser una app nativa con módulos de cámara on-device: puede ser una **web app en React**, responsive para celular, desplegada en **Firebase Hosting**. Esto evita el problema de Expo Dev Client (necesario solo si quisieras ML Kit corriendo en el dispositivo) y permite compartir un link directo para que cualquiera —incluido el jurado— la pruebe desde su celular sin instalar nada.

En el pitch, aclara: "la versión de producción sería también una app nativa descargable; hoy mostramos el prototipo web porque la inteligencia real vive en el servidor, no en el celular".

## Qué es de Google (mencionar explícitamente en el pitch)
| Herramienta | Uso |
|---|---|
| **Google Cloud Vision API** | OCR real de las placas, corriendo en el backend (Cloud Functions) sobre los fotogramas que llegan de la cámara |
| **Firebase Cloud Functions** | Lógica automática: se dispara sola cuando llega un video nuevo, sin intervención humana |
| **Firebase Authentication** | Registro por correo, celular (SMS) o cuenta de Google |
| **Cloud Firestore** | Catálogo de vehículos, comunidades, alertas, patrones de avistamiento |
| **Firebase Storage** | Recibe los clips de video que la cámara sube automáticamente |
| **Firebase Cloud Messaging (Web Push)** | Notifica a los vecinos cuando hay una alerta, sin que tengan la app abierta |
| **Firebase Hosting** | Publica la web app con un link compartible |
| **Google Maps Platform** (opcional) | Ubicar la comunidad en un mapa al crearla |

## Flujo automático real (el corazón de la idea)

```
Cámara IP (ONVIF/RTSP) detecta movimiento
        ↓
Cámara sube automáticamente un clip corto a Firebase Storage
        ↓
Cloud Function se dispara sola (trigger onFinalize del Storage)
        ↓
La función extrae un fotograma del video y llama a Google Cloud Vision API (TEXT_DETECTION)
        ↓
Se filtra el texto con regex de formato de placa
        ↓
¿La placa está en la colección "vehicles" de esa comunidad?
   → SÍ: no pasa nada (es de la casa), se guarda solo como log silencioso
   → NO: se crea/actualiza un documento en "unrecognized_sightings" con contador +1
        ↓
¿El contador de esa placa desconocida llegó a un umbral (ej. 3 veces en 7 días)?
   → SÍ: se crea automáticamente un documento en "alerts" (type: "pattern_detected")
         y se dispara notificación push a todos los vecinos de la comunidad
   → NO: solo queda registrado, visible en el historial, sin notificar todavía
```

**Nadie tuvo que mirar una cámara ni presionar un botón.** Eso es lo que hace que la propuesta sea realmente "automatización" y no solo una app de reportes manuales como las que ya existen.

## Roles del sistema
1. **Admin de comunidad**: crea el barrio, invita vecinos, configura la cámara (URL RTSP), ve reportes globales.
2. **Vecino/residente**: se une con código de invitación, ve el catálogo, recibe alertas automáticas, puede activar la alarma de emergencia manual.

## Pantallas a construir (React, componentes en /src/pages o /src/screens)

### 1. Register.jsx
Registro con 3 opciones: correo/contraseña, celular (SMS), Google Sign-In — todo con Firebase Authentication (Web SDK). Incluye también configurar una **pregunta y respuesta secreta personal** (se guarda hasheada en Firestore, colección `users`) — reemplaza al masterkey compartido para la alarma de emergencia.

### 2. Login.jsx
Login con las mismas 3 opciones.

### 3. CreateCommunity.jsx
Formulario: nombre del barrio, zona/dirección. Crea documento en `communities` con `communityId` único, agrega al creador como `role: admin` en la subcolección `members`, genera un código de invitación (guardado hasheado).

### 4. JoinCommunity.jsx
Input de código de invitación → valida contra el hash → agrega al usuario como `role: resident` en `members`.

### 5. ConnectCamera.jsx (solo Admin)
Input de URL RTSP de la cámara IP de la comunidad (ej. compatible con Reolink, Hikvision, Dahua, TP-Link Tapo, EZVIZ, Intelbras). **Para el prototipo de hoy, este campo puede quedar sin conexión real funcional** — solo guarda el dato en Firestore como referencia, y deja un comentario en el código explicando que en producción esto dispararía la ingesta real del stream.

### 6. Dashboard.jsx (Home)
Muestra: nombre de la comunidad activa, feed en tiempo real (listener de Firestore) de los últimos avistamientos y alertas, botón grande "🚨 Activar alarma de emergencia", acceso a Catálogo e Historial.

### 7. VehicleCatalog.jsx
Lista de vehículos registrados de la comunidad + formulario para agregar uno nuevo (placa, nombre del dueño, foto opcional subida a Firebase Storage).

### 8. MonitoringDemo.jsx (para la DEMO de hoy, simula el flujo automático)
En vez de un botón de "escanear", esta pantalla **reproduce sola** un video descargado (el clip de prueba con placas visibles) como si fuera la transmisión de la cámara. Cada cierto intervalo (simulando un "evento de movimiento"), dispara automáticamente (sin que el usuario haga clic) una llamada a una Cloud Function que procesa un frame simulado y muestra el resultado en pantalla: "🎥 Movimiento detectado → 🔍 Leyendo placa... → ✅ Reconocido / ⚠️ No reconocido, 3ra vez esta semana → 🔔 Alerta enviada automáticamente". Esto comunica la automatización real sin necesitar una cámara física conectada hoy.

### 9. AlarmScreen.jsx
Muestra la pregunta secreta del usuario logueado, input de respuesta. Si coincide con el hash guardado, crea alerta manual en `alerts` (type: "manual_alarm") y dispara notificación push a todos los miembros vía Firebase Cloud Messaging (Web Push, usando el Service Worker de Firebase).

### 10. History.jsx
Lista de todas las alertas y avistamientos no reconocidos de la comunidad, con fecha, tipo y estado.

## Cloud Function principal (backend, Node.js — Firebase Functions)

```javascript
// functions/index.js (esqueleto que Codex debe completar)
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");
admin.initializeApp();
const visionClient = new vision.ImageAnnotatorClient();

exports.processCameraClip = functions.storage.object().onFinalize(async (object) => {
  // 1. Descargar/extraer un frame del video subido (usar ffmpeg si es video, o tratarlo como imagen si ya viene como frame)
  // 2. Llamar a visionClient.textDetection() sobre el frame
  // 3. Filtrar el texto detectado con regex de placa (formato ABC-1234)
  // 4. Buscar la placa en la colección "vehicles" de la comunidad correspondiente (el communityId debe venir en el path del archivo subido, ej. cameras/{communityId}/clip123.mp4)
  // 5. Si no existe, incrementar/crear documento en "unrecognized_sightings/{communityId}_{placa}"
  // 6. Si el contador llega al umbral (ej. 3), crear documento en "alerts" y enviar notificación FCM a los "members" de esa comunidad
});
```

## Seguridad
- **Firestore Security Rules**: todo documento debe incluir `communityId`; un usuario solo puede leer/escribir si figura en la subcolección `members` de esa comunidad.
- **Storage Security Rules**: solo Cloud Functions (con permisos de admin) puede leer los clips subidos; los usuarios normales no acceden directamente al video crudo, solo a los resultados ya procesados.
- **Códigos de invitación y respuestas secretas**: siempre hasheados, nunca en texto plano.
- **Autenticación**: delegada 100% a Firebase Auth.

## Prioridad de implementación para HOY (de más a menos importante)
1. Login/registro (Firebase Auth) — aunque sea solo correo, mencionar Google Sign-In en el pitch si no alcanza
2. Crear comunidad + unirse con código
3. Dashboard con feed en tiempo real de Firestore
4. **MonitoringDemo.jsx** — esta es la pantalla más importante para el video/carrusel, es la que muestra la automatización
5. Alarma con pregunta secreta
6. Historial
7. Cloud Function real conectada a Cloud Vision (si sobra tiempo; si no, se explica en el pitch como el mecanismo real de producción y se muestra el código en una slide)

---

## PROMPT PARA PEGAR EN CODEX

```
Actúa como desarrollador senior full-stack especializado en React y Firebase. Vamos a construir el prototipo funcional de una WEB APP (no app nativa, no Expo) llamada "AutoScan", optimizada para verse bien en celular (mobile-first, responsive).

CONTEXTO: AutoScan es una plataforma de seguridad comunitaria donde cada barrio es una "comunidad" creada por un Admin. La innovación central es que el sistema detecta automáticamente vehículos desconocidos a partir de cámaras de seguridad (vía Google Cloud Vision API corriendo en el backend cuando la cámara sube un clip por movimiento), sin que ningún vecino tenga que revisar cámaras manualmente. Si una placa desconocida se repite varias veces, el sistema alerta solo a la comunidad.

STACK:
- Frontend: React (Vite), diseño mobile-first, estilo Material Design de Google (colores: fondo blanco/gris claro #F5F5F5, azul #4285F4 para acciones, rojo #EA4335 para alertas, verde #34A853 para confirmaciones), sin librería de componentes pesada, usa CSS plano o Tailwind si prefieres.
- Backend/BaaS: Firebase completo — Authentication (email/password, phone, Google Sign-In), Firestore, Storage, Cloud Functions (Node.js), Cloud Messaging (Web Push), Hosting.
- OCR: Google Cloud Vision API (@google-cloud/vision), usado del lado del servidor en una Cloud Function, NO en el navegador.

PASO 1 — Setup: dame los comandos para crear el proyecto con Vite + React, instalar el SDK de Firebase (v9 modular) para web, configurar Firebase Hosting, y crear la carpeta /functions para Cloud Functions con el SDK de Google Cloud Vision.

PASO 2 — Páginas (cada una en /src/pages):

1. Register.jsx: formulario de registro con 3 métodos (correo/contraseña, teléfono con verificación SMS, botón "Continuar con Google") usando Firebase Auth Web SDK. Incluye un paso adicional: el usuario escribe una pregunta de seguridad personalizada y su respuesta; la respuesta se guarda hasheada (usa una función simple de hash, o bcrypt si es viable en el entorno) en Firestore, colección "users", documento con su uid.

2. Login.jsx: login con los mismos 3 métodos.

3. CreateCommunity.jsx: formulario (nombre del barrio, zona) que crea un documento en Firestore "communities" con un ID autogenerado, agrega al usuario actual a la subcolección "members" con role: "admin", y genera un código de invitación aleatorio de 6 caracteres (guardado hasheado en el documento de la comunidad).

4. JoinCommunity.jsx: input de código de invitación, lo compara (hash) contra las comunidades existentes, si coincide agrega al usuario a "members" con role: "resident".

5. Dashboard.jsx: pantalla principal tras login. Muestra el nombre de la comunidad activa, un feed en tiempo real (usa onSnapshot de Firestore) de los últimos documentos de las colecciones "alerts" y "unrecognized_sightings" de esa comunidad, ordenados por fecha descendente. Incluye un botón grande "🚨 Activar alarma de emergencia" que navega a AlarmScreen, y accesos a VehicleCatalog, MonitoringDemo y History.

6. VehicleCatalog.jsx: lista de vehículos de la comunidad (colección "vehicles" filtrada por communityId) y formulario para agregar uno nuevo (placa, nombre del dueño, foto subida a Firebase Storage).

7. MonitoringDemo.jsx: esta es la pantalla de demo de la automatización. Reproduce un archivo de video local (asume que tengo un archivo car-clip.mp4 en /public) con la etiqueta <video> de HTML, autoplay y loop. Cada 8 segundos (simulando un evento de "movimiento detectado"), sin que el usuario haga clic en nada, dispara automáticamente una secuencia visual con estados: "🎥 Movimiento detectado" (1seg) → "🔍 Leyendo placa..." (1.5seg) → resultado aleatorio o fijo: "✅ Vehículo reconocido: [nombre mock]" en verde, o "⚠️ Vehículo no reconocido — placa ABC-1234 — 3ra vez esta semana" en ámbar, seguido de "🔔 Alerta enviada automáticamente a los vecinos" en rojo si es la 3ra vez. Usa useEffect con setInterval para el ciclo automático. Esto debe verse como que el sistema está vigilando solo, sin intervención humana.

8. AlarmScreen.jsx: muestra la pregunta secreta guardada del usuario logueado (tráela de Firestore), input para la respuesta. Si el hash coincide, crea un documento en "alerts" (communityId, triggeredBy: uid del usuario, timestamp, type: "manual_alarm") y muestra confirmación "Alarma enviada a los vecinos de [nombre comunidad]" (puedes simular el envío de FCM con un console.log si configurar Web Push completo toma mucho tiempo, y dejarlo como comentario "aquí iría el trigger de Firebase Cloud Messaging").

9. History.jsx: lista completa de "alerts" y "unrecognized_sightings" de la comunidad activa, con fecha, tipo, y estado, ordenada por fecha.

PASO 3 — Backend (Cloud Function):
Dame el esqueleto de functions/index.js con una función `processCameraClip` que se dispare con el trigger `functions.storage.object().onFinalize()`, explique en comentarios paso a paso cómo: extraer un frame del video subido, llamar a Google Cloud Vision API con textDetection, filtrar el resultado con regex de placa, buscar en Firestore si la placa existe en "vehicles" de la comunidad (el communityId debe venir del path del archivo, ej. cameras/{communityId}/clip.mp4), y si no existe, incrementar un contador en "unrecognized_sightings", creando una alerta automática en "alerts" si el contador llega a 3. No hace falta que esté 100% funcional con una cámara real hoy, pero el código debe ser real y correcto, listo para conectar con una cámara de producción después.

PASO 4 — Dame también:
- Firestore Security Rules completas que impidan que un usuario lea o escriba datos de una comunidad donde no figure en "members".
- El archivo de configuración firebaseConfig.js con placeholders.
- Estructura completa de colecciones de Firestore con ejemplos de documentos.
- Comandos para desplegar todo en Firebase Hosting al final (`firebase deploy`), para tener un link que pueda compartir con el jurado del concurso.

Empieza dándome el setup y las páginas de autenticación (Register, Login), y yo te voy diciendo "continúa" para las siguientes.
```
RECUERDA QUE ES PRINCIPALMENTE PARA CELULAR, ENTONCES QUE SEA BIEN ADAPTABLE A ESTE DISPOTIVOS QUE ES CELULAR