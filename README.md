# AutoScan

Prototipo web mobile-first de seguridad comunitaria. La ruta **Explorar demo** permite recorrer el flujo sin credenciales: crear/unirse a una comunidad, registrar vehículos, ver una detección automática cada ocho segundos, alcanzar el umbral de tres avistamientos en siete días, revisar el historial y activar una alarma con la respuesta `luna`.

## Ejecución local

```bash
npm install
npm run dev
```

Para activar Firebase, copia `.env.example` a `.env.local` y completa la configuración Web de tu proyecto. Luego habilita Authentication (correo, Google y teléfono), Firestore, Storage, Cloud Functions, Cloud Messaging y Vision API. El acceso por teléfono usa reCAPTCHA, como exige Firebase Auth.

```bash
cd functions
npm install
cd ..
firebase login
firebase use --add
firebase deploy
```

El gateway de la cámara debe autenticarse con una cuenta de servicio y subir los clips a `cameras/{communityId}/{archivo}`. Los clientes web no tienen permiso para leer o escribir clips crudos. `processCameraClip` extrae un frame con ffmpeg, usa Cloud Vision, deduplica el evento por archivo/generación/placa y registra el resultado. La URL RTSP se almacena en una colección privada accesible solo al backend.

## Modelo de Firestore

| Ruta | Campos principales | Acceso cliente |
|---|---|---|
| `users/{uid}` | `name`, `question`, `communityId` | Solo el usuario, lectura |
| `user_secrets/{uid}` | `salt`, `hash` | Backend únicamente |
| `communities/{id}` | `communityId`, `name`, `zone`, `camera` | Miembros, lectura |
| `communities/{id}/members/{uid}` | `role`, `communityId`, `uid` | Miembros, lectura |
| `invitations/{hash}` | `communityId` | Backend únicamente |
| `vehicles/{id}` | `communityId`, `plate`, `owner`, `model`, `color`, `photo` | Miembros; creación validada |
| `sighting_logs/{eventId}` | `communityId`, `plate`, `type`, `status` | Miembros, lectura |
| `unrecognized_sightings/{communityId_plate}` | `times`, `count`, `lastAlert` | Miembros, lectura |
| `alerts/{id}` | `communityId`, `type`, `status`, `notificationStatus` | Miembros; admin resuelve |
| `camera_secrets/{communityId}` | `url`, `name` | Backend únicamente |

Los documentos que pertenecen a un barrio incluyen `communityId`. Las Functions usan Admin SDK y validan membresía y rol en cada operación. Las reglas niegan por defecto cualquier ruta no declarada.

## Pruebas

```bash
npm test
node --test tests/backend.test.cjs
```

La aplicación compilada está en `dist/`. Para publicar en Firebase Hosting usa `firebase deploy`; la configuración incluye la reescritura SPA.
