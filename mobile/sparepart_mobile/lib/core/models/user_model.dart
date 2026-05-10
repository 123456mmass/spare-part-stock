class UserModel {
  final String id;
  final String username;
  final String name;
  final String role;
  final bool isActive;
  final bool mustChangePassword;
  final int movementsCount;

  UserModel({
    required this.id,
    required this.username,
    required this.name,
    required this.role,
    required this.isActive,
    required this.mustChangePassword,
    required this.movementsCount,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      username: json['username'] as String,
      name: json['name'] as String,
      role: json['role'] as String,
      isActive: json['isActive'] as bool? ?? true,
      mustChangePassword: json['mustChangePassword'] as bool? ?? false,
      movementsCount: (json['_count'] as Map<String, dynamic>?)?['movements'] as int? ?? 0,
    );
  }

  bool get isAdmin => role == 'ADMIN';
}
