# 📱 Guía de Configuración — Entorno de Desarrollo Móvil

Todo lo que necesita **otra computadora** para trabajar con la app mobile (`catalogo-app`).

---

## 1. Software Requerido

| Herramienta | Versión mínima | Instalación |
|---|---|---|
| **Node.js** | 20 LTS | [nodejs.org](https://nodejs.org/) |
| **npm** | 10+ | Viene con Node.js |
| **Java JDK** | 17+ | [adoptium.net](https://adoptium.net/) |
| **Android SDK** | API 34+ | Via Android Studio o Command Line Tools |
| **Git** | Cualquier versión reciente | [git-scm.com](https://git-scm.com/) |

> [!IMPORTANT]
> Android Studio es la forma más fácil de obtener el Android SDK + emulador. Solo necesitás instalarlo y abrir un proyecto para que descargue el SDK automáticamente.

---

## 2. Variables de Entorno (Windows)

Agregá estas variables de entorno del sistema:

```
ANDROID_HOME = C:\Users\<tu-usuario>\AppData\Local\Android\Sdk
JAVA_HOME    = C:\Program Files\Eclipse Adoptium\jdk-17...  (o donde esté tu JDK)
```

Agregar al `PATH`:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
%JAVA_HOME%\bin
```

### Verificar instalación
```powershell
node -v        # → v20.x.x o superior
npm -v         # → 10.x o superior
java -version  # → openjdk 17.x.x o superior
adb --version  # → debe responder (viene con el SDK)
```

---

## 3. Clonar y preparar el proyecto

```powershell
git clone <URL-del-repositorio> minisuper-erp
cd minisuper-erp\catalogo-app
npm install
```

> [!NOTE]
> El `postinstall` ejecuta `patch-package` automáticamente, que aplica el patch de `zustand` ubicado en `patches/zustand+4.3.9.patch`. No hace falta hacer nada manual.

---

## 4. Configurar el SDK de Android

Crear el archivo `catalogo-app/android/local.properties` con la ruta a tu SDK:

```properties
sdk.dir=C\:\\Users\\<tu-usuario>\\AppData\\Local\\Android\\Sdk
```

> Reemplazá `<tu-usuario>` con tu nombre de usuario de Windows. Respetá el formato de escape (`\\`).

---

## 5. Generar el proyecto nativo Android (Prebuild)

Si la carpeta `android/` no existe o necesitás regenerarla:

```powershell
cd d:\minisuper-erp\catalogo-app
npx expo prebuild --platform android --clean
```

Esto genera toda la estructura nativa de Android a partir de `app.json`.

---

## 6. Modo Desarrollo

### Iniciar el servidor de desarrollo
```powershell
cd d:\minisuper-erp\catalogo-app
npx expo start
```

- Presionar `a` para abrir en emulador Android
- Presionar `w` para abrir en navegador web
- Escanear QR con **Expo Go** en celular real (misma red WiFi)

### Con dev-client (para módulos nativos)
```powershell
npx expo start --dev-client
```

---

## 7. Compilar APK (Release)

### Opción A: Build Local con Gradle

```powershell
# 1. Generar proyecto nativo (si no existe android/)
cd d:\minisuper-erp\catalogo-app
npx expo prebuild --platform android --clean

# 2. Compilar APK release
cd android
.\gradlew.bat assembleRelease
```

📂 APK generada en: `android/app/build/outputs/apk/release/app-release.apk`

### Opción B: Build con EAS (en la nube)

```powershell
# Instalar EAS CLI (una sola vez)
npm install -g eas-cli

# Login en Expo
eas login

# Build de producción
cd d:\minisuper-erp\catalogo-app
eas build --platform android --profile production
```

> [!NOTE]
> EAS project ID: `7d9d4755-ca54-4fb5-8223-0369bb9d5afa`, owner: `minisuper2`. Ya están configurados en `app.json` y `eas.json`.

---

## 8. Instalar APK en dispositivo

```powershell
# Via USB con ADB
adb install android/app/build/outputs/apk/release/app-release.apk

# O copiar manualmente el archivo .apk al celular
```

---

## 9. Stack Técnico — Referencia Rápida

| Tecnología | Versión | Uso |
|---|---|---|
| **Expo SDK** | 54 | Framework base |
| **React Native** | 0.81.5 | Engine móvil |
| **expo-router** | 5.0 | Navegación (file-based routing) |
| **TypeScript** | 5.9 | Tipado |
| **Zustand** | 4.3.9 | State management (con patch) |
| **Axios** | 1.7 | HTTP client |
| **Hermes** | Habilitado | Engine JS optimizado para Android |

---

## 10. Estructura del Proyecto

```
catalogo-app/
├── app/                    # Pantallas (expo-router file-based routing)
│   ├── _layout.tsx         # Layout raíz + navegación
│   ├── index.tsx           # Catálogo principal
│   ├── cart.tsx            # Carrito de compras
│   ├── checkout.tsx        # Checkout + mapa + pagos
│   ├── login.tsx           # Autenticación (OTP / password)
│   ├── orders.tsx          # Historial de pedidos
│   ├── ofertas.tsx         # Ofertas vigentes
│   ├── chat.tsx            # Asesor virtual
│   ├── config_setup.tsx    # Selección de tenant
│   ├── kiosk.tsx           # Modo kiosko
│   └── product/[id].tsx    # Detalle de producto
├── components/             # Componentes reutilizables
│   ├── LocationPickerMap.tsx      # Mapa Leaflet (nativo)
│   ├── LocationPickerMap.web.tsx  # Mapa Leaflet (web)
│   ├── ProductCard.tsx
│   ├── CategoryChips.tsx
│   ├── SearchBar.tsx
│   └── ...
├── services/
│   └── api.ts              # Cliente API (Axios + interceptors)
├── stores/                 # Zustand stores
│   ├── authStore.ts        # Autenticación y sesión
│   ├── cartStore.ts        # Carrito de compras
│   ├── catalogStore.ts     # Productos y categorías
│   ├── configStore.ts      # Configuración tenant
│   └── kioskStore.ts       # Estado del kiosko
├── patches/
│   └── zustand+4.3.9.patch # Patch para compatibilidad
├── android/                # Proyecto nativo Android (generado por prebuild)
├── app.json                # Configuración Expo
├── eas.json                # Configuración EAS Build
├── Dockerfile              # Build para versión web (Docker + Nginx)
└── package.json            # Dependencias
```

---

## 11. Configuración del Backend (API)

La app se conecta a:
```
https://facilgestion.site/public/v1/{tenant-slug}/...
```

El `tenant-slug` se selecciona en la pantalla `config_setup` al iniciar la app por primera vez. No requiere configuración manual del backend para desarrollo móvil — la API de producción está siempre disponible.

---

## 12. Build Web con Docker

Para servir la versión web de la app:

```powershell
cd d:\minisuper-erp\catalogo-app
docker build -t catalogo-web .
docker run -p 8080:80 catalogo-web
```

Acceder en `http://localhost:8080`.

---

## 13. Troubleshooting Común

| Problema | Solución |
|---|---|
| `SDK location not found` | Crear/corregir `android/local.properties` (ver paso 4) |
| `Could not determine java version` | Verificar `JAVA_HOME` apunte a JDK 17+ |
| Error en `patch-package` | Ejecutar `npm install` de nuevo |
| `No_Tenant_Selected` en la app | Desinstalar la app y volver a abrir para elegir tenant |
| Cambios nativos no reflejados | Ejecutar `npx expo prebuild --platform android --clean` |
| APK muy grande (~170MB debug) | Compilar con `assembleRelease` que produce ~85MB |
| Metro bundler no conecta al celular | Verificar que PC y celular estén en la misma red WiFi |

---

## 14. Identificadores de la App

```
Package Android:  com.facilgestion.catalogo
Bundle iOS:       com.facilgestion.catalogo
Expo slug:        catalogo-app
EAS Project ID:   7d9d4755-ca54-4fb5-8223-0369bb9d5afa
EAS Owner:        minisuper2
```
