import 'package:dio/dio.dart';
import '../config/app_config.dart';
import '../models/user.dart';
import '../models/part.dart';
import '../models/stock_movement.dart';
import 'api_error.dart';

class ApiClient {
  late final Dio _dio;
  String? _token;

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.mobileApiBase,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
    ));
  }

  void setToken(String? token) {
    _token = token;
  }

  Map<String, String> get _authHeaders => {
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  // --- Public lookup (no auth) ---

  Future<Map<String, dynamic>> publicLookup(String code) async {
    try {
      final response = await _dio.get(
        '/public/parts/lookup',
        queryParameters: {'code': code},
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // --- Auth ---

  Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      final response = await _dio.post(
        '/auth/login',
        data: {'username': username, 'password': password},
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<User> me() async {
    try {
      final response = await _dio.get(
        '/auth/me',
        options: Options(headers: _authHeaders),
      );
      final data = response.data as Map<String, dynamic>;
      return User.fromJson(data['user'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> changePassword(
    String currentPassword,
    String newPassword,
    String confirmPassword,
  ) async {
    try {
      await _dio.post(
        '/auth/change-password',
        data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
          'confirmPassword': confirmPassword,
        },
        options: Options(headers: _authHeaders),
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> logout() async {
    try {
      await _dio.post(
        '/auth/logout',
        options: Options(headers: _authHeaders),
      );
    } catch (_) {
      // Best effort
    }
  }

  // --- Parts ---

  Future<({List<Part> parts, int total, int totalPages})> getParts({
    String? search,
    String? stockStatus,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final params = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (search != null && search.isNotEmpty) params['search'] = search;
      if (stockStatus != null) params['stockStatus'] = stockStatus;

      final response = await _dio.get(
        '/parts',
        queryParameters: params,
        options: Options(headers: _authHeaders),
      );
      final data = response.data as Map<String, dynamic>;
      final partsList = (data['parts'] as List)
          .map((e) => Part.fromJson(e as Map<String, dynamic>))
          .toList();
      return (
        parts: partsList,
        total: data['total'] as int,
        totalPages: data['totalPages'] as int,
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Part> lookupPartByCode(String code) async {
    try {
      final response = await _dio.get(
        '/parts/by-code/${Uri.encodeComponent(code)}',
        options: Options(headers: _authHeaders),
      );
      return Part.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // --- Movements ---

  Future<({StockMovement movement, int partQuantity})> createMovement({
    required String partId,
    required String type,
    required int quantity,
    String? note,
  }) async {
    try {
      final response = await _dio.post(
        '/movements',
        data: {
          'partId': partId,
          'type': type,
          'quantity': quantity,
          if (note != null && note.isNotEmpty) 'note': note,
        },
        options: Options(headers: _authHeaders),
      );
      final data = response.data as Map<String, dynamic>;
      return (
        movement: StockMovement.fromJson(data['movement'] as Map<String, dynamic>),
        partQuantity: data['partQuantity'] as int,
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // --- Error handling ---

  ApiError _handleError(DioException e) {
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return ApiError.network();
    }
    final statusCode = e.response?.statusCode;
    final body = e.response?.data as Map<String, dynamic>?;
    return ApiError.fromResponse(statusCode ?? 0, body);
  }
}
