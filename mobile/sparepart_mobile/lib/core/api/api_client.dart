import 'package:dio/dio.dart';
import '../config/app_config.dart';
import '../models/user.dart';
import '../models/part.dart';
import '../models/stock_movement.dart';
import '../models/category.dart';
import '../models/user_model.dart';
import 'api_error.dart';

class ApiClient {
  late final Dio _dio;
  String? _token;

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.mobileApiBase,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AppConfig.apiKey,
      },
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
    String? categoryId,
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
      if (categoryId != null) params['categoryId'] = categoryId;

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

  Future<Part> getPart(String id) async {
    try {
      final response = await _dio.get(
        '/parts/${Uri.encodeComponent(id)}',
        options: Options(headers: _authHeaders),
      );
      return Part.fromJson(response.data as Map<String, dynamic>);
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

  // --- Dashboard ---

  Future<Map<String, dynamic>> getDashboard() async {
    try {
      final response = await _dio.get(
        '/dashboard',
        options: Options(headers: _authHeaders),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // --- Movements ---

  Future<({List<StockMovement> movements, int total})> getMovements({
    String? partId,
    String? type,
    int limit = 50,
  }) async {
    try {
      final params = <String, dynamic>{'limit': limit};
      if (partId != null) params['partId'] = partId;
      if (type != null) params['type'] = type;

      final response = await _dio.get(
        '/movements',
        queryParameters: params,
        options: Options(headers: _authHeaders),
      );
      final data = response.data as Map<String, dynamic>;
      final movementsList = (data['movements'] as List)
          .map((e) => StockMovement.fromJson(e as Map<String, dynamic>))
          .toList();
      return (
        movements: movementsList,
        total: data['total'] as int? ?? movementsList.length,
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // --- Categories ---

  Future<List<Category>> getCategories() async {
    try {
      final response = await _dio.get(
        '/categories',
        options: Options(headers: _authHeaders),
      );
      final data = response.data as List<dynamic>;
      return data.map((e) => Category.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Category> createCategory(String name) async {
    try {
      final response = await _dio.post(
        '/categories',
        data: {'name': name},
        options: Options(headers: _authHeaders),
      );
      return Category.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // --- Parts CRUD ---

  Future<Part> createPart(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post(
        '/parts',
        data: data,
        options: Options(headers: _authHeaders),
      );
      return Part.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Part> updatePart(String id, Map<String, dynamic> data) async {
    try {
      final response = await _dio.put(
        '/parts/${Uri.encodeComponent(id)}',
        data: data,
        options: Options(headers: _authHeaders),
      );
      return Part.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> deletePart(String id) async {
    try {
      await _dio.delete(
        '/parts/${Uri.encodeComponent(id)}',
        options: Options(headers: _authHeaders),
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<String> uploadPartImage(String partId, String filePath) async {
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath),
      });
      final response = await _dio.post(
        '/parts/${Uri.encodeComponent(partId)}/upload-image',
        data: formData,
        options: Options(headers: _authHeaders),
      );
      return (response.data as Map<String, dynamic>)['imageUrl'] as String;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> suggestPartFromImage(String filePath) async {
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath),
      });
      final response = await _dio.post(
        '/parts/ai-suggest',
        data: formData,
        options: Options(
          headers: _authHeaders,
          // AI processing takes longer — extend timeout to 60s
          receiveTimeout: const Duration(seconds: 60),
          sendTimeout: const Duration(seconds: 30),
        ),
      );
      final data = response.data as Map<String, dynamic>;
      return data['suggestion'] as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // --- Admin Users ---

  Future<List<UserModel>> getUsers() async {
    try {
      final response = await _dio.get(
        '/admin/users',
        options: Options(headers: _authHeaders),
      );
      final data = response.data as List<dynamic>;
      return data.map((e) => UserModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> createUser(String username, String name, String role) async {
    try {
      final response = await _dio.post(
        '/admin/users',
        data: {'username': username, 'name': name, 'role': role},
        options: Options(headers: _authHeaders),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> updateUser(String id, Map<String, dynamic> data) async {
    try {
      await _dio.patch(
        '/admin/users/${Uri.encodeComponent(id)}',
        data: data,
        options: Options(headers: _authHeaders),
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> deleteUser(String id) async {
    try {
      await _dio.delete(
        '/admin/users/${Uri.encodeComponent(id)}',
        options: Options(headers: _authHeaders),
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> resetUserPassword(String id) async {
    try {
      final response = await _dio.post(
        '/admin/users/${Uri.encodeComponent(id)}/reset-password',
        options: Options(headers: _authHeaders),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> activateUser(String id) async {
    try {
      await _dio.post(
        '/admin/users/${Uri.encodeComponent(id)}/activate',
        options: Options(headers: _authHeaders),
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> deactivateUser(String id) async {
    try {
      await _dio.post(
        '/admin/users/${Uri.encodeComponent(id)}/deactivate',
        options: Options(headers: _authHeaders),
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> clearDatabase({
    bool categories = false,
    bool parts = false,
    bool movements = false,
    bool users = false,
  }) async {
    try {
      await _dio.post(
        '/mobile/admin/clear-db',
        data: {
          'categories': categories,
          'parts': parts,
          'movements': movements,
          'users': users,
        },
        options: Options(headers: _authHeaders),
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // --- Import/Export ---

  Future<Map<String, dynamic>> importExcel(String filePath) async {
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath),
      });
      final response = await _dio.post(
        '/import',
        data: formData,
        options: Options(headers: _authHeaders),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> importExcelWithAi(String filePath) async {
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath),
      });
      final response = await _dio.post(
        '/import/ai',
        data: formData,
        options: Options(
          headers: _authHeaders,
          // AI processing takes longer — extend timeout to 120s
          receiveTimeout: const Duration(seconds: 120),
          sendTimeout: const Duration(seconds: 30),
        ),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<int>> exportParts() async {
    try {
      final response = await _dio.get(
        '/parts',
        queryParameters: {'export': 'true'},
        options: Options(
          headers: _authHeaders,
          responseType: ResponseType.bytes,
        ),
      );
      return response.data as List<int>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<int>> exportMovements() async {
    try {
      final response = await _dio.get(
        '/movements',
        queryParameters: {'export': 'true'},
        options: Options(
          headers: _authHeaders,
          responseType: ResponseType.bytes,
        ),
      );
      return response.data as List<int>;
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
