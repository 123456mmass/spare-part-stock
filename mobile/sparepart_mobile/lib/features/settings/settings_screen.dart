import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/auth/auth_store.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isChangingPassword = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _changePassword() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isChangingPassword = true;
      _error = null;
      _success = null;
    });

    try {
      final api = context.read<ApiClient>();
      await api.changePassword(
        _currentController.text,
        _newController.text,
        _confirmController.text,
      );
      setState(() => _success = 'เปลี่ยนรหัสผ่านเรียบร้อย');
      _currentController.clear();
      _newController.clear();
      _confirmController.clear();
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'เกิดข้อผิดพลาด');
    } finally {
      if (mounted) setState(() => _isChangingPassword = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('ตั้งค่า'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                      radius: 28,
                      child: Text(
                        user?.name.substring(0, 1).toUpperCase() ?? 'U',
                        style: TextStyle(
                          fontSize: 24,
                          color: Theme.of(context).colorScheme.onPrimaryContainer,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user?.name ?? 'ผู้ใช้',
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            user?.username ?? '',
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                          const SizedBox(height: 4),
                          Chip(
                            label: Text(
                              user?.role == 'ADMIN' ? 'ผู้ดูแลระบบ' : 'พนักงาน',
                              style: const TextStyle(fontSize: 12),
                            ),
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (auth.isAdmin) ...[
              Card(
                child: ListTile(
                  leading: const Icon(Icons.people),
                  title: const Text('จัดการผู้ใช้'),
                  subtitle: const Text('เพิ่ม แก้ไข รีเซ็ตรหัสผ่านผู้ใช้'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/users'),
                ),
              ),
              const SizedBox(height: 8),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.import_export),
                  title: const Text('นำเข้า/ส่งออก Excel'),
                  subtitle: const Text('นำเข้าอะไหล่จากไฟล์ หรือส่งออกข้อมูล'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/import-export'),
                ),
              ),
              const SizedBox(height: 8),
            ],
            Card(
              child: ListTile(
                leading: const Icon(Icons.history),
                title: const Text('ประวัติการเคลื่อนไหว'),
                subtitle: const Text('ดูรายการเคลื่อนไหวทั้งหมด'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/movements'),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'เปลี่ยนรหัสผ่าน',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            if (_success != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green[200]!),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, color: Colors.green),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_success!, style: const TextStyle(color: Colors.green))),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red[200]!),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!, style: const TextStyle(color: Colors.red))),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _currentController,
                        decoration: const InputDecoration(
                          labelText: 'รหัสผ่านปัจจุบัน',
                          border: OutlineInputBorder(),
                        ),
                        obscureText: true,
                        validator: (v) =>
                            v == null || v.isEmpty ? 'กรุณากรอกรหัสผ่านปัจจุบัน' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _newController,
                        decoration: const InputDecoration(
                          labelText: 'รหัสผ่านใหม่',
                          border: OutlineInputBorder(),
                        ),
                        obscureText: true,
                        validator: (v) =>
                            v == null || v.isEmpty ? 'กรุณากรอกรหัสผ่านใหม่' :
                            v.length < 6 ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _confirmController,
                        decoration: const InputDecoration(
                          labelText: 'ยืนยันรหัสผ่านใหม่',
                          border: OutlineInputBorder(),
                        ),
                        obscureText: true,
                        validator: (v) =>
                            v == null || v.isEmpty ? 'กรุณายืนยันรหัสผ่านใหม่' :
                            v != _newController.text ? 'รหัสผ่านไม่ตรงกัน' : null,
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: FilledButton(
                          onPressed: _isChangingPassword ? null : _changePassword,
                          child: _isChangingPassword
                              ? const SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text('เปลี่ยนรหัสผ่าน'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: () async {
                await auth.logout();
                if (context.mounted) {
                  context.go('/lookup');
                }
              },
              icon: const Icon(Icons.logout, color: Colors.red),
              label: const Text('ออกจากระบบ', style: TextStyle(color: Colors.red)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.red),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
