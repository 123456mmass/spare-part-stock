import 'dart:convert';
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
    String? plant,
    String? buildingId,
    bool? specialTool,
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
      if (plant != null) params['plant'] = plant;
      if (buildingId != null) params['buildingId'] = buildingId;
      if (specialTool != null && specialTool) params['specialTool'] = true;

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

  Future<List<Map<String, dynamic>>> searchPartByImage(String filePath) async {
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath),
      });
      final response = await _dio.post(
        '/parts/search-by-image',
        data: formData,
        options: Options(
          headers: _authHeaders,
          receiveTimeout: const Duration(seconds: 45),
          sendTimeout: const Duration(seconds: 30),
        ),
      );
      final data = response.data as Map<String, dynamic>;
      final matches = (data['matches'] as List<dynamic>?) ?? [];
      return matches.cast<Map<String, dynamic>>();
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

  Future<Map<String, dynamic>> importExcel(String filePath, {String? plant}) async {
    try {
      final map = <String, dynamic>{
        'file': await MultipartFile.fromFile(filePath),
      };
      if (plant != null && plant.isNotEmpty) map['plant'] = plant;
      final formData = FormData.fromMap(map);
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

  Future<Map<String, dynamic>> importExcelWithAi(String filePath, {String? plant}) async {
    try {
      final map = <String, dynamic>{
        'file': await MultipartFile.fromFile(filePath),
      };
      if (plant != null && plant.isNotEmpty) map['plant'] = plant;
      final formData = FormData.fromMap(map);
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

  // --- Buildings ---

  Future<List<Map<String, dynamic>>> getBuildings() async {
    try {
      final response = await _dio.get(
        '/buildings',
        options: Options(headers: _authHeaders),
      );
      final data = response.data as List<dynamic>;
      return data.cast<Map<String, dynamic>>();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> updateBuilding(String id, String name) async {
    try {
      final response = await _dio.patch(
        '/buildings/${Uri.encodeComponent(id)}',
        data: {'name': name},
        options: Options(headers: _authHeaders),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // --- Blocks ---

  Future<List<Map<String, dynamic>>> getBlocks() async {
    try {
      final response = await _dio.get(
        '/blocks',
        options: Options(headers: _authHeaders),
      );
      final data = response.data as List<dynamic>;
      return data.cast<Map<String, dynamic>>();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> deleteCategory(String id) async {
    try {
      await _dio.delete(
        '/categories/${Uri.encodeComponent(id)}',
        options: Options(headers: _authHeaders),
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> renameBlock(String oldName, String newName) async {
    try {
      final response = await _dio.patch(
        '/blocks/${Uri.encodeComponent(oldName)}',
        data: {'newName': newName},
        options: Options(headers: _authHeaders),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> deleteBlock(String name) async {
    try {
      final response = await _dio.delete(
        '/blocks/${Uri.encodeComponent(name)}',
        options: Options(headers: _authHeaders),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> mergeBlocks(List<String> sourceNames, String target) async {
    try {
      final response = await _dio.post(
        '/blocks/merge',
        data: {'sourceNames': sourceNames, 'target': target},
        options: Options(headers: _authHeaders),
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

  // --- AI Assistant ---

  /// Stream an assistant reply via Server-Sent Events.
  /// Calls [onEvent] for each SSE event (event name + parsed JSON data),
  /// [onDone] when the stream closes, [onError] on failure.
  Future<void> streamChat({
    required String message,
    String? conversationId,
    List<Map<String, dynamic>>? attachments,
    required void Function(String event, Map<String, dynamic> data) onEvent,
    void Function(String errorMessage)? onError,
    void Function()? onDone,
  }) async {
    try {
      final response = await _dio.post(
        '/ai/chat/stream',
        data: {
          'message': message,
          if (conversationId != null) 'conversationId': conversationId,
          if (attachments != null && attachments.isNotEmpty)
            'attachments': attachments,
        },
        options: Options(
          headers: _authHeaders,
          responseType: ResponseType.stream,
          receiveTimeout: const Duration(minutes: 5),
          sendTimeout: const Duration(seconds: 30),
        ),
      );
      final body = response.data as ResponseBody;
      final stream = body.stream;

      final buffer = <int>[];
      await for (final chunk in stream) {
        buffer.addAll(chunk);
        // Find the last "\n\n" boundary (ASCII 0x0a 0x0a). UTF-8 multibyte
        // sequences never contain 0x0a, so splitting on byte boundaries is safe.
        int lastBoundary = -1;
        for (int i = buffer.length - 2; i >= 0; i--) {
          if (buffer[i] == 0x0a && buffer[i + 1] == 0x0a) {
            lastBoundary = i;
            break;
          }
        }
        if (lastBoundary < 0) continue;
        final complete = buffer.sublist(0, lastBoundary + 2);
        final remainder = buffer.sublist(lastBoundary + 2);
        buffer
          ..clear()
          ..addAll(remainder);
        final text = utf8.decode(complete, allowMalformed: true);
        for (final block in text.split('\n\n')) {
          if (block.trim().isNotEmpty) _dispatchSseBlock(block, onEvent);
        }
      }
      if (buffer.isNotEmpty) {
        final text = utf8.decode(buffer, allowMalformed: true);
        for (final block in text.split('\n\n')) {
          if (block.trim().isNotEmpty) _dispatchSseBlock(block, onEvent);
        }
      }
      onDone?.call();
    } on DioException catch (e) {
      onError?.call(_handleError(e).message);
    } catch (e) {
      onError?.call(e.toString());
    }
  }

  void _dispatchSseBlock(
    String block,
    void Function(String, Map<String, dynamic>) onEvent,
  ) {
    String? eventName;
    final dataLines = <String>[];
    for (final line in block.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.add(line.substring(5).trim());
      }
    }
    if (eventName == null) return;
    final dataStr = dataLines.join('\n');
    Map<String, dynamic> data = const {};
    if (dataStr.isNotEmpty && dataStr != '[DONE]') {
      try {
        data = jsonDecode(dataStr) as Map<String, dynamic>;
      } catch (_) {
        data = {'raw': dataStr};
      }
    }
    onEvent(eventName, data);
  }

  Future<Map<String, dynamic>> getChatHistory({String? conversationId}) async {
    try {
      final response = await _dio.get(
        '/ai/chat/history',
        queryParameters: {
          if (conversationId != null) 'conversationId': conversationId,
        },
        options: Options(headers: _authHeaders),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> deleteChatHistory({String? conversationId}) async {
    try {
      await _dio.delete(
        '/ai/chat/history',
        queryParameters: {
          if (conversationId != null) 'conversationId': conversationId,
        },
        options: Options(headers: _authHeaders),
      );
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> confirmAction(String id) async {
    try {
      final response = await _dio.post(
        '/ai/actions/${Uri.encodeComponent(id)}/confirm',
        options: Options(headers: _authHeaders),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> cancelAction(String id) async {
    try {
      final response = await _dio.post(
        '/ai/actions/${Uri.encodeComponent(id)}/cancel',
        options: Options(headers: _authHeaders),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> getAiModel() async {
    try {
      final response = await _dio.get(
        '/ai/model',
        options: Options(headers: _authHeaders),
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> setAiModel({
    String? model,
    String? visionModel,
  }) async {
    try {
      final response = await _dio.put(
        '/ai/model',
        data: {
          if (model != null) 'model': model,
          if (visionModel != null) 'visionModel': visionModel,
        },
        options: Options(headers: _authHeaders),
      );
      return response.data as Map<String, dynamic>;
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
