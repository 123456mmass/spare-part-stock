import 'stock_movement.dart';
import '../config/app_config.dart';

class PartCategory {
  final String id;
  final String name;

  PartCategory({required this.id, required this.name});

  factory PartCategory.fromJson(Map<String, dynamic> json) {
    return PartCategory(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }
}

class PartBuilding {
  final String id;
  final String name;

  PartBuilding({required this.id, required this.name});

  factory PartBuilding.fromJson(Map<String, dynamic> json) {
    return PartBuilding(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }
}

String? _resolveUrl(String? url) {
  if (url == null || url.isEmpty) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return '${AppConfig.baseUrl}$url';
}

class Part {
  final String id;
  final String partNumber;
  final String partName;
  final String? description;
  final int quantity;
  final int minimumQuantity;
  final String unit;
  final String? location;
  final String? imageUrl;
  final String? qrCodeUrl;
  final String? barcodeValue;
  final String? subcategory;
  final String? plant;
  final String? createdBy;
  final bool isSpecialToolPart;
  final PartCategory? category;
  final PartBuilding? building;
  final List<StockMovement>? movements;

  Part({
    required this.id,
    required this.partNumber,
    required this.partName,
    this.description,
    required this.quantity,
    required this.minimumQuantity,
    required this.unit,
    this.location,
    this.imageUrl,
    this.qrCodeUrl,
    this.barcodeValue,
    this.subcategory,
    this.plant,
    this.createdBy,
    this.isSpecialToolPart = false,
    this.category,
    this.building,
    this.movements,
  });

  factory Part.fromJson(Map<String, dynamic> json) {
    final categoryJson = json['category'] as Map<String, dynamic>?;
    final buildingJson = json['building'] as Map<String, dynamic>?;
    final movementsJson = json['movements'] as List<dynamic>?;
    return Part(
      id: json['id'] as String,
      partNumber: json['partNumber'] as String,
      partName: json['partName'] as String,
      description: json['description'] as String?,
      quantity: json['quantity'] as int,
      minimumQuantity: json['minimumQuantity'] as int? ?? 0,
      unit: json['unit'] as String? ?? 'pcs',
      location: json['location'] as String?,
      imageUrl: _resolveUrl(json['imageUrl'] as String?),
      qrCodeUrl: _resolveUrl(json['qrCodeUrl'] as String?),
      barcodeValue: json['barcodeValue'] as String?,
      subcategory: json['subcategory'] as String?,
      plant: json['plant'] as String?,
      createdBy: json['createdBy'] as String?,
      isSpecialToolPart: json['isSpecialToolPart'] as bool? ?? false,
      category: categoryJson != null
          ? PartCategory.fromJson(categoryJson)
          : null,
      building: buildingJson != null
          ? PartBuilding.fromJson(buildingJson)
          : null,
      movements: movementsJson
          ?.map((e) => StockMovement.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  String get stockStatus {
    if (quantity == 0) return 'OUT_OF_STOCK';
    if (minimumQuantity > 0 && quantity <= minimumQuantity) return 'LOW_STOCK';
    return 'IN_STOCK';
  }

  String get stockStatusLabel {
    switch (stockStatus) {
      case 'OUT_OF_STOCK':
        return 'หมด';
      case 'LOW_STOCK':
        return 'ใกล้หมด';
      default:
        return 'มีอะไหล่';
    }
  }
}
