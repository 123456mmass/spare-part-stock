# Mobile API Checklist for Flutter Developers

This is a quick reference for the `/api/mobile/*` endpoints. For full details, see `docs/mobile-architecture.md`.

---

## 1. Public Lookup (No Auth Required)

Scan a QR code or barcode to view stock level without logging in.

```dart
// GET /api/mobile/public/parts/lookup?code={code}
final response = await dio.get(
  '/api/mobile/public/parts/lookup',
  queryParameters: {'code': scannedCode},
);

// Returns:
// {
//   "part": { "id", "partNumber", "partName", "quantity", "minimumQuantity", "unit", "location", "category": {...}, "stockStatus": "IN_STOCK" },
//   "canEdit": false,
//   "requiresLoginFor": ["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "EDIT_PART"]
// }
```

**States:**
- 400: Missing `code` parameter
- 404: Part not found

---

## 2. Login Flow

```dart
// POST /api/mobile/auth/login
final response = await dio.post('/api/mobile/auth/login', data: {
  'username': username,
  'password': password,
});

// Returns: { "token": "...", "expiresAt": "2026-05-16T...", "user": { "id", "username", "name", "role" } }
// Store token:
await secureStorage.write(key: 'auth_token', value: response.data['token']);
await secureStorage.write(key: 'token_expires_at', value: response.data['expiresAt']);
```

**States:**
- 200: Success
- 401: Invalid credentials

---

## 3. Token Validation (App Resume)

```dart
// GET /api/mobile/auth/me
// Authorization: Bearer <token>
final response = await dio.get(
  '/api/mobile/auth/me',
  options: Options(headers: {'Authorization': 'Bearer $token'}),
);

// Returns: { "user": { "id", "username", "name", "role" } }
```

**States:**
- 200: Token valid
- 401: Token expired/invalid → re-login

---

## 4. Forced Password Change Flow

Triggered when a user with `mustChangePassword: true` tries to access a protected endpoint.

```dart
// All protected endpoints can return 403 with:
{
  "error": "PASSWORD_CHANGE_REQUIRED",
  "code": "PASSWORD_CHANGE_REQUIRED",
  "message": "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน"
}

// To change password:
// POST /api/mobile/auth/change-password
// Authorization: Bearer <token>
await dio.post(
  '/api/mobile/auth/change-password',
  data: {
    'currentPassword': currentPassword,
    'newPassword': newPassword,
  },
);

// After success, user must re-login with new password.
```

---

## 5. Protected Stock Movement Flow

All movement endpoints require `Authorization: Bearer <token>`.

### Search Parts
```dart
// GET /api/mobile/parts?search=...&categoryId=...&stockStatus=...&page=1&limit=20
final response = await dio.get('/api/mobile/parts', queryParameters: {
  'search': 'bearing',
  'stockStatus': 'in-stock', // out-of-stock | low-stock | in-stock
  'page': 1,
  'limit': 20,
});

// Returns: { "parts": [...], "total", "page", "limit", "totalPages" }
```

### Create Stock Movement
```dart
// POST /api/mobile/movements
// Authorization: Bearer <token>
final response = await dio.post(
  '/api/mobile/movements',
  data: {
    'partId': partId,
    'type': 'STOCK_OUT', // STOCK_IN | STOCK_OUT | ADJUSTMENT
    'quantity': 3,
    'note': 'ใช้งานจริง',
  },
);

// Returns:
// {
//   "movement": { "id", "type", "quantityBefore", "quantityAfter", "quantityChange", "note", "createdAt", "part": {...}, "user": {...} },
//   "partQuantity": 7
// }
```

**Error codes:**
- 400 `PART_NOT_FOUND`: Part does not exist
- 400 `INSUFFICIENT_STOCK`: Cannot remove more than available
- 400 `NEGATIVE_STOCK`: Would result in negative stock
- 403: STAFF attempting ADJUSTMENT

### Recent Movements
```dart
// GET /api/mobile/movements?limit=20&partId=...
final response = await dio.get('/api/mobile/movements', queryParameters: {
  'limit': 20,
  'partId': partId, // optional
});
```

---

## 6. Error Handling Reference

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Process response |
| 201 | Created | Process response |
| 400 | Validation / business logic error | Show error message |
| 401 | Token invalid/expired | Re-login |
| 403 | Forbidden / PASSWORD_CHANGE_REQUIRED | Show password change screen |
| 404 | Not found | Show "not found" message |
| 500 | Server error | Show generic error |

---

## 7. Dio Client Setup

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final storage = SecureStorage();
final dio = Dio(BaseOptions(
  baseUrl: 'http://10.0.2.2:3000/api/mobile', // Android emulator
  connectTimeout: Duration(seconds: 10),
  receiveTimeout: Duration(seconds: 10),
));

// Add auth interceptor
dio.interceptors.add(InterceptorsWrapper(
  onRequest: (options, handler) async {
    final token = await storage.read(key: 'auth_token');
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  },
  onError: (error, handler) {
    if (error.response?.statusCode == 401) {
      // Token expired — redirect to login
      storage.delete(key: 'auth_token');
      // Navigate to login
    } else if (error.response?.statusCode == 403) {
      final body = error.response?.data;
      if (body?['code'] == 'PASSWORD_CHANGE_REQUIRED') {
        // Navigate to password change screen
      }
    }
    handler.next(error);
  },
));
```

---

## 8. Role Permissions

| Action | STAFF | ADMIN |
|--------|-------|-------|
| View parts | ✓ | ✓ |
| Scan code | ✓ | ✓ |
| Public lookup | ✓ | ✓ |
| STOCK_IN | ✓ | ✓ |
| STOCK_OUT | ✓ | ✓ |
| ADJUSTMENT | ✗ | ✓ |
| Create/Edit/Delete part | ✗ | ✓ |
| Import Excel | ✗ | ✓ |
| Manage categories | ✗ | ✓ |

Server always enforces role — never trust `role` from client.