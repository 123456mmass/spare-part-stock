# Spare Part Stock — Mobile (Flutter)

Flutter app for warehouse staff to manage spare parts inventory on mobile.

## Quick Start After Installing Flutter

1. **Restart your terminal** after adding Flutter to PATH
2. Run `flutter doctor` — fix any red ❌ items
3. Create the project:
   ```bash
   cd mobile
   flutter create sparepart_mobile
   cd sparepart_mobile
   ```
4. Add packages:
   ```bash
   flutter pub add dio flutter_secure_storage go_router provider
   ```
5. Then ask Claude/Codex to continue Flutter MVP implementation from the existing `mobile/API_CHECKLIST.md`

## Flutter SDK Setup (Windows)

### 1. Download Flutter SDK

- Go to: https://docs.flutter.dev/get-started/install/windows
- Download the latest stable release (zip)
- Minimum version: 3.x stable

### 2. Extract

Extract to `C:\flutter` (or any path you prefer).

### 3. Add to PATH

**Temporary (current session):**
```powershell
$env:PATH += ";C:\flutter\bin"
```

**Permanent:**
1. Open System Settings → Environment Variables
2. Under "User variables", edit `Path`
3. Add `C:\flutter\bin`
4. Click OK

### 4. Verify Installation

```bash
flutter --version
flutter doctor
```

`flutter doctor` shows what else you need. Minimum for this project:
- Flutter SDK ✓
- At least one device target: Chrome (web) or Android SDK (emulator)

### 5. Android Setup (for mobile testing)

1. Install Android Studio: https://developer.android.com/studio
2. Open Android Studio → Settings → SDK Manager → install latest Android SDK
3. Accept licenses:
   ```bash
   flutter doctor --android-licenses
   ```
4. Create an emulator: Tools → Device Manager → Create Device

### 6. Create the Project

```bash
cd mobile
flutter create sparepart_mobile
cd sparepart_mobile
flutter pub add dio flutter_secure_storage go_router provider
```

## Run Commands

```bash
# Android emulator (backend must be running on host)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000

# Chrome (web, same machine)
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000

# Physical Android device (same WiFi as PC)
flutter run --dart-define=API_BASE_URL=http://<your-pc-ip>:3000

# Build debug APK for direct install
flutter build apk --debug
# Install to connected device
adb install -r build\app\outputs\flutter-apk\app-debug.apk
```

To find your PC's IP:
```powershell
ipconfig
```
Look for `IPv4 Address` under your active WiFi/Ethernet adapter.

## Android APK Build (Thai Windows Locale Fix)

On Windows machines with Thai locale, `flutter build apk --debug` may fail at `:app:mergeDebugJavaResource` with:

```
Execution failed for task ':app:mergeDebugJavaResource'.
  com.google.common.base.VerifyException
```

**Root cause:** Java under Thai locale uses `sun.util.BuddhistCalendar` (year 2569), which Android `apkzlib` rejects when packing ZIP timestamps.

**Fix:** Force Gradle JVM locale to en-US in `android/gradle.properties`:

```properties
org.gradle.jvmargs=-Xmx8G -XX:MaxMetaspaceSize=4G -XX:ReservedCodeCacheSize=512m -XX:+HeapDumpOnOutOfMemoryError -Duser.language=en -Duser.country=US
```

This is a build-time issue only, not app runtime behavior. Do not remove the locale flags unless AGP/apkzlib is verified fixed upstream.

## Network Requirements

The mobile device must be able to reach the backend server:

| Device | URL to use | Notes |
|--------|-----------|-------|
| Android emulator | `http://10.0.2.2:3000` | `10.0.2.2` maps to host machine |
| iOS simulator | `http://localhost:3000` | Same machine |
| Physical phone | `http://<PC-LAN-IP>:3000` | Phone and PC must be on same WiFi network |

**The backend must be running:**
```bash
# In the project root (C:\Internship\spare-part-stock)
npm run dev
```

Test connectivity:
```bash
curl http://localhost:3000/api/mobile/public/parts/lookup?code=103625710
```

## MVP File Structure

```
sparepart_mobile/
  lib/
    main.dart
    core/
      api/
        api_client.dart        # Dio HTTP client with Bearer token
        api_error.dart         # Error parsing and Thai messages
      config/
        app_config.dart        # Base URL from --dart-define
      auth/
        auth_store.dart        # Token storage, login/logout, /me
      models/
        user.dart              # User model
        part.dart              # Part model
        stock_movement.dart    # StockMovement model
    features/
      auth/
        login_screen.dart      # Username/password login
        change_password_screen.dart  # Forced password change
      home/
        home_screen.dart       # Quick actions: lookup, search, logout
      parts/
        public_lookup_screen.dart  # Anonymous stock check
        part_detail_screen.dart    # Part info + stock actions
      stock/
        stock_movement_sheet.dart  # Stock in/out/adjustment bottom sheet
```

## Key Reference Files

- `docs/mobile-architecture.md` — Full API contract with request/response examples
- `mobile/API_CHECKLIST.md` — API contract checklist for Flutter developers

## Supported Flows

| Flow | Auth Required | Description |
|------|:---:|-------------|
| Public stock lookup | No | Check stock by part number / QR / barcode |
| Login | — | Username + password → Bearer token |
| Token validation | Yes | Check token on app resume via `/me` |
| Forced password change | Yes | Redirect when `PASSWORD_CHANGE_REQUIRED` |
| Part search | Yes | Search and browse parts list |
| Barcode/QR scan | Yes/No | Camera scan via `mobile_scanner`, manual fallback |
| Stock In/Out | Yes | Create stock movement (STAFF + ADMIN) |
| Adjustment | Yes (ADMIN) | Set exact stock quantity |

## Device Testing Checklist

Before release, verify on a physical Android device:

- [ ] App opens and connects to backend
- [ ] Public lookup (manual code input) works without login
- [ ] Public scan works without login
- [ ] Login with valid credentials
- [ ] Authenticated scan from Home screen
- [ ] Authenticated scan from Parts list
- [ ] Scanned code resolves to correct part detail
- [ ] Stock IN movement works
- [ ] Stock OUT movement works
- [ ] ADJUSTMENT movement only visible for ADMIN role
- [ ] Forced password change redirects correctly
- [ ] No-camera fallback allows manual input on unsupported platforms

## Known TODOs

- [ ] Offline sync (queue movements, sync on reconnect)
- [ ] Image capture for parts
- [ ] Push notifications for low-stock alerts
- [ ] Token refresh mechanism (current tokens expire in 7 days)
- [ ] Server-side token revocation

## Authentication

The mobile app uses Bearer JWT tokens (not httpOnly cookies). See `docs/mobile-architecture.md` for the full auth flow and token security notes.
