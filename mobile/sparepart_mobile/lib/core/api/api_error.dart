class ApiError implements Exception {
  final int? statusCode;
  final String message;
  final String? code;

  ApiError({this.statusCode, required this.message, this.code});

  factory ApiError.fromResponse(int statusCode, Map<String, dynamic>? body) {
    final error = body?['error'] as String?;
    final code = body?['code'] as String?;

    if (statusCode == 401) {
      return ApiError(
        statusCode: 401,
        message: error ?? 'กรุณาเข้าสู่ระบบใหม่',
        code: code,
      );
    }
    if (statusCode == 403) {
      if (code == 'PASSWORD_CHANGE_REQUIRED') {
        return ApiError(
          statusCode: 403,
          message: body?['message'] as String? ?? 'กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน',
          code: 'PASSWORD_CHANGE_REQUIRED',
        );
      }
      return ApiError(
        statusCode: 403,
        message: error ?? 'คุณไม่มีสิทธิ์ดำเนินการนี้',
        code: code,
      );
    }
    if (statusCode == 404) {
      return ApiError(
        statusCode: 404,
        message: error ?? 'ไม่พบข้อมูล',
        code: code,
      );
    }
    if (statusCode == 400) {
      final details = body?['details'] as List<dynamic>?;
      String msg = error ?? 'ข้อมูลไม่ถูกต้อง';
      if (details != null && details.isNotEmpty) {
        final first = details.first as Map<String, dynamic>;
        final path = (first['path'] as List?)?.join('.') ?? '';
        final message = first['message'] as String? ?? 'ไม่ถูกต้อง';
        msg = path.isNotEmpty ? '$path: $message' : message;
      }
      return ApiError(
        statusCode: 400,
        message: msg,
        code: code,
      );
    }
    return ApiError(
      statusCode: statusCode,
      message: error ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่',
      code: code,
    );
  }

  factory ApiError.network() {
    return ApiError(
      message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่อ',
    );
  }

  @override
  String toString() => message;
}
