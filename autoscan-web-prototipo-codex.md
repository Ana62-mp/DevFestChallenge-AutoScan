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
