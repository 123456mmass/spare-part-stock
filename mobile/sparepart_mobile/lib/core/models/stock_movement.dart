class StockMovement {
  final String id;
  final String type;
  final int quantityBefore;
  final int quantityAfter;
  final int quantityChange;
  final String? note;
  final String createdAt;
  final String? partNumber;
  final String? partName;
  final String? userName;

  StockMovement({
    required this.id,
    required this.type,
    required this.quantityBefore,
    required this.quantityAfter,
    required this.quantityChange,
    this.note,
    required this.createdAt,
    this.partNumber,
    this.partName,
    this.userName,
  });

  factory StockMovement.fromJson(Map<String, dynamic> json) {
    final part = json['part'] as Map<String, dynamic>?;
    final user = json['user'] as Map<String, dynamic>?;
    return StockMovement(
      id: json['id'] as String,
      type: json['type'] as String,
      quantityBefore: json['quantityBefore'] as int,
      quantityAfter: json['quantityAfter'] as int,
      quantityChange: json['quantityChange'] as int,
      note: json['note'] as String?,
      createdAt: json['createdAt'] as String,
      partNumber: part?['partNumber'] as String?,
      partName: part?['partName'] as String?,
      userName: user?['name'] as String?,
    );
  }

  String get typeLabel {
    switch (type) {
      case 'STOCK_IN':
        return 'รับเข้า';
      case 'STOCK_OUT':
        return 'จ่ายออก';
      case 'ADJUSTMENT':
        return 'ปรับปรุง';
      default:
        return type;
    }
  }
}
