class Category {
  final String id;
  final String name;
  final int partsCount;

  Category({
    required this.id,
    required this.name,
    required this.partsCount,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] as String,
      name: json['name'] as String,
      partsCount: (json['_count'] as Map<String, dynamic>?)?['parts'] as int? ?? 0,
    );
  }
}
