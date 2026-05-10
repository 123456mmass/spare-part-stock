class User {
  final String id;
  final String username;
  final String name;
  final String role;
  final bool mustChangePassword;

  User({
    required this.id,
    required this.username,
    required this.name,
    required this.role,
    this.mustChangePassword = false,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      username: json['username'] as String,
      name: json['name'] as String,
      role: json['role'] as String,
      mustChangePassword: json['mustChangePassword'] as bool? ?? false,
    );
  }

  bool get isAdmin => role == 'ADMIN';
  bool get isStaff => role == 'STAFF';
}
