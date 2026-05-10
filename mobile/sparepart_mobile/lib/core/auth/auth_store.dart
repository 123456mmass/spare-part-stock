import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';
import '../api/api_error.dart';
import '../models/user.dart';

enum AuthStatus { unknown, unauthenticated, authenticated, mustChangePassword }

class AuthStore extends ChangeNotifier {
  final ApiClient api;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  User? _user;
  AuthStatus _status = AuthStatus.unknown;
  String? _error;

  AuthStore({required this.api});

  User? get user => _user;
  AuthStatus get status => _status;
  String? get error => _error;
  bool get isAuthenticated => _user != null;
  bool get isAdmin => _user?.isAdmin ?? false;

  Future<void> boot() async {
    final token = await _storage.read(key: 'auth_token');
    if (token == null) {
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }

    api.setToken(token);
    try {
      _user = await api.me();
      if (_user!.mustChangePassword) {
        _status = AuthStatus.mustChangePassword;
      } else {
        _status = AuthStatus.authenticated;
      }
    } on ApiError catch (e) {
      if (e.statusCode == 401 || e.code == 'PASSWORD_CHANGE_REQUIRED') {
        await _clearToken();
        if (e.code == 'PASSWORD_CHANGE_REQUIRED') {
          _status = AuthStatus.mustChangePassword;
        } else {
          _status = AuthStatus.unauthenticated;
        }
      } else {
        await _clearToken();
        _status = AuthStatus.unauthenticated;
      }
    } catch (_) {
      await _clearToken();
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    _error = null;
    try {
      final data = await api.login(username, password);
      final token = data['token'] as String;
      final userJson = data['user'] as Map<String, dynamic>;

      await _storage.write(key: 'auth_token', value: token);
      api.setToken(token);
      _user = User.fromJson(userJson);

      if (_user!.mustChangePassword) {
        _status = AuthStatus.mustChangePassword;
      } else {
        _status = AuthStatus.authenticated;
      }
      notifyListeners();
      return true;
    } on ApiError catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    }
  }

  Future<bool> changePassword(
    String currentPassword,
    String newPassword,
    String confirmPassword,
  ) async {
    _error = null;
    try {
      await api.changePassword(currentPassword, newPassword, confirmPassword);
      // After changing password, refresh user
      _user = await api.me();
      _status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } on ApiError catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await api.logout();
    await _clearToken();
    _user = null;
    _status = AuthStatus.unauthenticated;
    _error = null;
    notifyListeners();
  }

  Future<void> _clearToken() async {
    await _storage.delete(key: 'auth_token');
    api.setToken(null);
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
