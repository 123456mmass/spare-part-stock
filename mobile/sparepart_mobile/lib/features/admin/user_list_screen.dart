import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/models/user_model.dart';

class UserListScreen extends StatefulWidget {
  const UserListScreen({super.key});

  @override
  State<UserListScreen> createState() => _UserListScreenState();
}

class _UserListScreenState extends State<UserListScreen> {
  List<UserModel> _users = [];
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  Future<void> _fetchUsers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final users = await context.read<ApiClient>().getUsers();
      setState(() => _users = users);
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'เกิดข้อผิดพลาด');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showCreateDialog() {
    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController();
    final usernameController = TextEditingController();
    String selectedRole = 'STAFF';
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('เพิ่มผู้ใช้'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'ชื่อ-นามสกุล', border: OutlineInputBorder()),
                  validator: (v) => v == null || v.isEmpty ? 'กรุณากรอกชื่อ' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: usernameController,
                  decoration: const InputDecoration(labelText: 'ชื่อผู้ใช้', border: OutlineInputBorder()),
                  validator: (v) => v == null || v.length < 3 ? 'อย่างน้อย 3 ตัวอักษร' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: selectedRole,
                  decoration: const InputDecoration(labelText: 'สิทธิ์', border: OutlineInputBorder()),
                  items: const [
                    DropdownMenuItem(value: 'STAFF', child: Text('พนักงาน')),
                    DropdownMenuItem(value: 'ADMIN', child: Text('ผู้ดูแลระบบ')),
                  ],
                  onChanged: (v) => setDialogState(() => selectedRole = v ?? 'STAFF'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('ยกเลิก'),
            ),
            FilledButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      if (!formKey.currentState!.validate()) return;
                      setDialogState(() => isSubmitting = true);
                      try {
                        final result = await context.read<ApiClient>().createUser(
                          usernameController.text.trim(),
                          nameController.text.trim(),
                          selectedRole,
                        );
                        if (dialogContext.mounted) Navigator.of(dialogContext).pop();
                        _showTempPasswordDialog(result['tempPassword'] as String, usernameController.text.trim());
                        _fetchUsers();
                      } on ApiError catch (e) {
                        setDialogState(() => isSubmitting = false);
                        if (dialogContext.mounted) {
                          ScaffoldMessenger.of(dialogContext).showSnackBar(
                            SnackBar(content: Text(e.message), backgroundColor: Colors.red),
                          );
                        }
                      }
                    },
              child: isSubmitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('เพิ่ม'),
            ),
          ],
        ),
      ),
    );
  }

  void _showTempPasswordDialog(String tempPassword, String username) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('สร้างผู้ใช้เรียบร้อย'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('ชื่อผู้ใช้: $username'),
            const SizedBox(height: 8),
            const Text('รหัสผ่านชั่วคราว:'),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber[200]!),
              ),
              child: Row(
                children: [
                  Expanded(child: Text(tempPassword, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18))),
                  IconButton(
                    icon: const Icon(Icons.copy),
                    onPressed: () {
                      // Flutter doesn't have clipboard by default in this context
                      // The user can manually copy
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Text('ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก', style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('ตกลง'),
          ),
        ],
      ),
    );
  }

  void _showEditDialog(UserModel user) {
    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController(text: user.name);
    String selectedRole = user.role;
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('แก้ไข ${user.username}'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'ชื่อ-นามสกุล', border: OutlineInputBorder()),
                  validator: (v) => v == null || v.isEmpty ? 'กรุณากรอกชื่อ' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: selectedRole,
                  decoration: const InputDecoration(labelText: 'สิทธิ์', border: OutlineInputBorder()),
                  items: const [
                    DropdownMenuItem(value: 'STAFF', child: Text('พนักงาน')),
                    DropdownMenuItem(value: 'ADMIN', child: Text('ผู้ดูแลระบบ')),
                  ],
                  onChanged: (v) => setDialogState(() => selectedRole = v ?? 'STAFF'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('ยกเลิก'),
            ),
            FilledButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      if (!formKey.currentState!.validate()) return;
                      setDialogState(() => isSubmitting = true);
                      try {
                        await context.read<ApiClient>().updateUser(user.id, {
                          'name': nameController.text.trim(),
                          'role': selectedRole,
                        });
                        if (dialogContext.mounted) Navigator.of(dialogContext).pop();
                        _fetchUsers();
                      } on ApiError catch (e) {
                        setDialogState(() => isSubmitting = false);
                        if (dialogContext.mounted) {
                          ScaffoldMessenger.of(dialogContext).showSnackBar(
                            SnackBar(content: Text(e.message), backgroundColor: Colors.red),
                          );
                        }
                      }
                    },
              child: isSubmitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('บันทึก'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _resetPassword(UserModel user) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('รีเซ็ตรหัสผ่าน?'),
        content: Text('รีเซ็ตรหัสผ่านของ ${user.username}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('ยกเลิก'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('รีเซ็ต'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      final result = await context.read<ApiClient>().resetUserPassword(user.id);
      if (mounted) {
        _showTempPasswordDialog(result['tempPassword'] as String, user.username);
      }
    } on ApiError catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _toggleActive(UserModel user, bool newActive) async {
    try {
      if (newActive) {
        await context.read<ApiClient>().activateUser(user.id);
      } else {
        await context.read<ApiClient>().deactivateUser(user.id);
      }
      _fetchUsers();
    } on ApiError catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _deleteUser(UserModel user) async {
    if (user.movementsCount > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ไม่สามารถลบผู้ใช้ที่มีประวัติการเคลื่อนไหว'), backgroundColor: Colors.red),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ลบผู้ใช้?'),
        content: Text('ลบ ${user.username}? การกระทำนี้ไม่สามารถย้อนกลับได้'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('ยกเลิก'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('ลบ'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await context.read<ApiClient>().deleteUser(user.id);
      _fetchUsers();
    } on ApiError catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('จัดการผู้ใช้'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'เพิ่มผู้ใช้',
            onPressed: _showCreateDialog,
          ),
        ],
      ),
      body: SafeArea(
        child: _isLoading && _users.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _users.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 12),
                        FilledButton(onPressed: _fetchUsers, child: const Text('ลองใหม่')),
                      ],
                    ),
                  )
                : _users.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.people_outline, size: 48, color: Colors.grey),
                            const SizedBox(height: 12),
                            Text('ยังไม่มีผู้ใช้', style: TextStyle(color: Colors.grey[600])),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchUsers,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _users.length,
                          itemBuilder: (context, index) {
                            final user = _users[index];
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: user.isAdmin
                                      ? Colors.purple.withValues(alpha: 0.1)
                                      : Colors.blue.withValues(alpha: 0.1),
                                  child: Text(
                                    user.name.substring(0, 1).toUpperCase(),
                                    style: TextStyle(
                                      color: user.isAdmin ? Colors.purple : Colors.blue,
                                    ),
                                  ),
                                ),
                                title: Text(
                                  user.name,
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(user.username),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        Chip(
                                          label: Text(
                                            user.isAdmin ? 'ผู้ดูแล' : 'พนักงาน',
                                            style: const TextStyle(fontSize: 11),
                                          ),
                                          visualDensity: VisualDensity.compact,
                                          padding: EdgeInsets.zero,
                                        ),
                                        const SizedBox(width: 6),
                                        if (!user.isActive)
                                          const Chip(
                                            label: Text('ปิดใช้งาน', style: TextStyle(fontSize: 11)),
                                            visualDensity: VisualDensity.compact,
                                            padding: EdgeInsets.zero,
                                            backgroundColor: Colors.red,
                                          ),
                                        if (user.mustChangePassword)
                                          const Chip(
                                            label: Text('ต้องเปลี่ยนรหัส', style: TextStyle(fontSize: 11)),
                                            visualDensity: VisualDensity.compact,
                                            padding: EdgeInsets.zero,
                                            backgroundColor: Colors.amber,
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                                trailing: PopupMenuButton<String>(
                                  onSelected: (value) {
                                    switch (value) {
                                      case 'edit':
                                        _showEditDialog(user);
                                        break;
                                      case 'reset':
                                        _resetPassword(user);
                                        break;
                                      case 'toggle':
                                        _toggleActive(user, !user.isActive);
                                        break;
                                      case 'delete':
                                        _deleteUser(user);
                                        break;
                                    }
                                  },
                                  itemBuilder: (context) => [
                                    const PopupMenuItem(value: 'edit', child: Text('แก้ไข')),
                                    const PopupMenuItem(value: 'reset', child: Text('รีเซ็ตรหัสผ่าน')),
                                    PopupMenuItem(
                                      value: 'toggle',
                                      child: Text(user.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'),
                                    ),
                                    if (user.movementsCount == 0)
                                      const PopupMenuItem(
                                        value: 'delete',
                                        child: Text('ลบ', style: TextStyle(color: Colors.red)),
                                      ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
      ),
    );
  }
}
