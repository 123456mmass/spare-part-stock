import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/auth/auth_store.dart';
import '../../core/models/category.dart';

class CategoryListScreen extends StatefulWidget {
  const CategoryListScreen({super.key});

  @override
  State<CategoryListScreen> createState() => _CategoryListScreenState();
}

class _CategoryListScreenState extends State<CategoryListScreen> {
  List<Category> _categories = [];
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchCategories();
  }

  Future<void> _fetchCategories() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final categories = await api.getCategories();
      setState(() => _categories = categories);
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'เกิดข้อผิดพลาด');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showAddDialog() {
    final controller = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('เพิ่มหมวดหมู่'),
          content: Form(
            key: formKey,
            child: TextFormField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'ชื่อหมวดหมู่',
                border: OutlineInputBorder(),
              ),
              autofocus: true,
              validator: (v) => v == null || v.trim().isEmpty ? 'กรุณากรอกชื่อหมวดหมู่' : null,
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
                        await context.read<ApiClient>().createCategory(controller.text.trim());
                        if (dialogContext.mounted) Navigator.of(dialogContext).pop();
                        _fetchCategories();
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

  Future<void> _confirmDelete(Category cat) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ลบหมวดหมู่'),
        content: Text(
          cat.partsCount > 0
              ? 'คุณต้องการลบ "${cat.name}" ใช่หรือไม่?\n\nอะไหล่ ${cat.partsCount} รายการจะถูกปลดหมวดหมู่ออก (อะไหล่ไม่ถูกลบ)'
              : 'คุณต้องการลบ "${cat.name}" ใช่หรือไม่?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('ยกเลิก')),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('ลบ'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      await context.read<ApiClient>().deleteCategory(cat.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('ลบ "${cat.name}" สำเร็จ')),
        );
      }
      _fetchCategories();
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
    final auth = context.watch<AuthStore>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('หมวดหมู่'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          if (auth.isAdmin)
            IconButton(
              icon: const Icon(Icons.add),
              tooltip: 'เพิ่มหมวดหมู่',
              onPressed: _showAddDialog,
            ),
        ],
      ),
      body: SafeArea(
        child: _isLoading && _categories.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _categories.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 12),
                        FilledButton(onPressed: _fetchCategories, child: const Text('ลองใหม่')),
                      ],
                    ),
                  )
                : _categories.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.category_outlined, size: 48, color: Colors.grey),
                            const SizedBox(height: 12),
                            Text('ยังไม่มีหมวดหมู่', style: TextStyle(color: Colors.grey[600])),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchCategories,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _categories.length,
                          itemBuilder: (context, index) {
                            final cat = _categories[index];
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                leading: Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: Colors.teal.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.category, color: Colors.teal, size: 20),
                                ),
                                title: Text(cat.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                                subtitle: Text('${cat.partsCount} รายการ'),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (auth.isAdmin)
                                      IconButton(
                                        icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                                        tooltip: 'ลบหมวดหมู่',
                                        onPressed: () => _confirmDelete(cat),
                                      ),
                                    const Icon(Icons.chevron_right),
                                  ],
                                ),
                                onTap: () {
                                  context.go('/parts?categoryId=${Uri.encodeComponent(cat.id)}');
                                },
                              ),
                            );
                          },
                        ),
                      ),
      ),
    );
  }
}
