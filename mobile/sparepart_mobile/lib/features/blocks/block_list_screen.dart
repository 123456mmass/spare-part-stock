import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';

class BlockListScreen extends StatefulWidget {
  const BlockListScreen({super.key});

  @override
  State<BlockListScreen> createState() => _BlockListScreenState();
}

class _BlockListScreenState extends State<BlockListScreen> {
  List<Map<String, dynamic>> _blocks = [];
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchBlocks();
  }

  Future<void> _fetchBlocks() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final blocks = await api.getBlocks();
      setState(() => _blocks = blocks);
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'เกิดข้อผิดพลาด');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showRenameDialog(String oldName) {
    final controller = TextEditingController(text: oldName);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('เปลี่ยนชื่อบล็อก'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'ชื่อใหม่',
            border: OutlineInputBorder(),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('ยกเลิก')),
          FilledButton(
            onPressed: () async {
              final newName = controller.text.trim();
              if (newName.isEmpty || newName == oldName) {
                Navigator.of(ctx).pop();
                return;
              }
              try {
                await context.read<ApiClient>().renameBlock(oldName, newName);
                if (ctx.mounted) Navigator.of(ctx).pop();
                _fetchBlocks();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('เปลี่ยนชื่อเป็น "$newName" สำเร็จ')),
                  );
                }
              } on ApiError catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.message), backgroundColor: Colors.red),
                  );
                }
              }
            },
            child: const Text('บันทึก'),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(String name, int count) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ลบบล็อก'),
        content: Text(
          count > 0
              ? 'ลบบล็อก "$name"?\n\nอะไหล่ $count รายการจะถูกปลดบล็อกออก (อะไหล่ไม่ถูกลบ)'
              : 'ลบบล็อก "$name"?',
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
      await context.read<ApiClient>().deleteBlock(name);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('ลบ "$name" สำเร็จ')),
        );
      }
      _fetchBlocks();
    } on ApiError catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showMergeSheet() {
    final selectedSources = <String>{};
    final targetController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 16, right: 16, top: 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('รวมบล็อก', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              const Text('เลือกบล็อกต้นทาง (อย่างน้อย 2)'),
              const SizedBox(height: 8),
              ..._blocks.map((b) {
                final name = b['name'] as String;
                final count = b['partCount'] as int;
                return CheckboxListTile(
                  title: Text('$name ($count รายการ)'),
                  value: selectedSources.contains(name),
                  onChanged: (v) {
                    setSheetState(() {
                      if (v == true) selectedSources.add(name);
                      else selectedSources.remove(name);
                    });
                  },
                  dense: true,
                );
              }),
              const SizedBox(height: 12),
              TextField(
                controller: targetController,
                decoration: const InputDecoration(
                  labelText: 'บล็อกเป้าหมาย',
                  hintText: 'ชื่อบล็อกที่จะรวมเข้า',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: selectedSources.length < 2 || targetController.text.trim().isEmpty
                      ? null
                      : () async {
                          try {
                            final result = await context.read<ApiClient>().mergeBlocks(
                              selectedSources.toList(),
                              targetController.text.trim(),
                            );
                            if (ctx.mounted) Navigator.of(ctx).pop();
                            _fetchBlocks();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('รวมบล็อกสำเร็จ (${result['updated']} รายการ)')),
                              );
                            }
                          } on ApiError catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(e.message), backgroundColor: Colors.red),
                              );
                            }
                          }
                        },
                  child: const Text('รวมบล็อก'),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('บล็อก / โรงงาน'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          if (_blocks.length >= 2)
            IconButton(
              icon: const Icon(Icons.merge),
              tooltip: 'รวมบล็อก',
              onPressed: _showMergeSheet,
            ),
        ],
      ),
      body: SafeArea(
        child: _isLoading && _blocks.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _blocks.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 12),
                        FilledButton(onPressed: _fetchBlocks, child: const Text('ลองใหม่')),
                      ],
                    ),
                  )
                : _blocks.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.business, size: 48, color: Colors.grey),
                            const SizedBox(height: 12),
                            Text('ยังไม่มีบล็อก', style: TextStyle(color: Colors.grey[600])),
                            const SizedBox(height: 4),
                            Text('บล็อกจะถูกสร้างเมื่อ import Excel พร้อมระบุบล็อก',
                                style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchBlocks,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _blocks.length,
                          itemBuilder: (context, index) {
                            final b = _blocks[index];
                            final name = b['name'] as String;
                            final count = b['partCount'] as int;
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                leading: Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: Colors.indigo.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.business, color: Colors.indigo, size: 20),
                                ),
                                title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                                subtitle: Text('$count รายการ'),
                                trailing: PopupMenuButton<String>(
                                  onSelected: (action) {
                                    switch (action) {
                                      case 'rename':
                                        _showRenameDialog(name);
                                      case 'delete':
                                        _confirmDelete(name, count);
                                    }
                                  },
                                  itemBuilder: (context) => [
                                    const PopupMenuItem(value: 'rename', child: Text('เปลี่ยนชื่อ')),
                                    const PopupMenuItem(value: 'delete', child: Text('ลบ', style: TextStyle(color: Colors.red))),
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
