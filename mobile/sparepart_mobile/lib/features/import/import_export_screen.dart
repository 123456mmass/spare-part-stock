import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';

class ImportExportScreen extends StatefulWidget {
  const ImportExportScreen({super.key});

  @override
  State<ImportExportScreen> createState() => _ImportExportScreenState();
}

class _ImportExportScreenState extends State<ImportExportScreen> {
  bool _isImporting = false;
  bool _isExportingParts = false;
  bool _isExportingMovements = false;
  String? _resultMessage;
  bool _isError = false;

  List<Map<String, dynamic>> _blocks = [];
  String? _selectedBlock;
  final _newBlockController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchBlocks();
  }

  Future<void> _fetchBlocks() async {
    try {
      final api = context.read<ApiClient>();
      final blocks = await api.getBlocks();
      if (mounted) setState(() => _blocks = blocks);
    } catch (_) {}
  }

  String? get _plantValue {
    final nb = _newBlockController.text.trim();
    if (nb.isNotEmpty) return nb;
    return _selectedBlock;
  }

  Future<void> _pickAndImportExcel({required bool useAi}) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'xls'],
    );
    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    if (file.path == null) {
      setState(() {
        _resultMessage = 'ไม่สามารถอ่านไฟล์ได้';
        _isError = true;
      });
      return;
    }

    setState(() {
      _isImporting = true;
      _resultMessage = null;
    });

    try {
      if (!mounted) return;
      final api = context.read<ApiClient>();
      final apiResult = useAi
          ? await api.importExcelWithAi(file.path!, plant: _plantValue)
          : await api.importExcel(file.path!, plant: _plantValue);
      final imported = apiResult['imported'] as int? ?? 0;
      final updated = apiResult['updated'] as int? ?? 0;
      final errors = (apiResult['errors'] as List<dynamic>?) ?? [];
      final aiUsed = apiResult['aiUsed'] == true;

      if (!mounted) return;
      setState(() {
        _resultMessage = errors.isEmpty
            ? '${aiUsed ? 'AI ' : ''}นำเข้าเรียบร้อย: $imported รายการใหม่, $updated แก้ไข'
            : 'นำเข้าได้ $imported รายการ, แก้ไข $updated รายการ, มีข้อผิดพลาด ${errors.length} รายการ';
        _isError = errors.isNotEmpty && imported + updated == 0;
      });
      // refresh blocks after import
      _fetchBlocks();
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _resultMessage = e.message;
        _isError = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _resultMessage = 'เกิดข้อผิดพลาด';
        _isError = true;
      });
    } finally {
      if (mounted) setState(() => _isImporting = false);
    }
  }

  Future<void> _downloadTemplate() async {
    try {
      const template =
          'Part Number,Part Name,Description,Category,Location,Quantity,Minimum Quantity,Unit\n'
          'SP-001,Oil filter,Oil filter for machine,Consumable,Shelf A-1,10,5,pcs\n'
          'SP-002,Relay,Electrical relay module,Electrical,Shelf B-2,20,10,pcs';

      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/template.csv');
      await file.writeAsString(template);
      await OpenFilex.open(file.path);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('เกิดข้อผิดพลาด'), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _exportParts() async {
    setState(() {
      _isExportingParts = true;
      _resultMessage = null;
    });

    try {
      final bytes = await context.read<ApiClient>().exportParts();
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/parts.xlsx');
      await file.writeAsBytes(bytes);
      await OpenFilex.open(file.path);
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _resultMessage = e.message;
        _isError = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _resultMessage = 'เกิดข้อผิดพลาด';
        _isError = true;
      });
    } finally {
      if (mounted) setState(() => _isExportingParts = false);
    }
  }

  Future<void> _exportMovements() async {
    setState(() {
      _isExportingMovements = true;
      _resultMessage = null;
    });

    try {
      final bytes = await context.read<ApiClient>().exportMovements();
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/movements.xlsx');
      await file.writeAsBytes(bytes);
      await OpenFilex.open(file.path);
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _resultMessage = e.message;
        _isError = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _resultMessage = 'เกิดข้อผิดพลาด';
        _isError = true;
      });
    } finally {
      if (mounted) setState(() => _isExportingMovements = false);
    }
  }

  @override
  void dispose() {
    _newBlockController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('นำเข้า/ส่งออก'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_resultMessage != null)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _isError ? Colors.red[50] : Colors.green[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _isError ? Colors.red[200]! : Colors.green[200]!),
                ),
                child: Row(
                  children: [
                    Icon(_isError ? Icons.error_outline : Icons.check_circle,
                        color: _isError ? Colors.red : Colors.green),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _resultMessage!,
                        style: TextStyle(color: _isError ? Colors.red[900] : Colors.green[900]),
                      ),
                    ),
                  ],
                ),
              ),
            // Block/Plant selection
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('เลือกบล็อก/โรงงาน (ไม่บังคับ)',
                        style: TextStyle(fontWeight: FontWeight.w500)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedBlock,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'บล็อกที่มีอยู่',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      items: [
                        const DropdownMenuItem(value: null, child: Text('-- ไม่ระบุบล็อก --')),
                        ..._blocks.map((b) {
                          final name = b['name'] as String;
                          final count = b['partCount'] as int;
                          return DropdownMenuItem(
                            value: name,
                            child: Text('$name ($count รายการ)'),
                          );
                        }),
                      ],
                      onChanged: (v) {
                        setState(() {
                          _selectedBlock = v;
                          if (v != null) _newBlockController.clear();
                        });
                      },
                    ),
                    const SizedBox(height: 8),
                    const Text('หรือพิมพ์ชื่อบล็อกใหม่', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 4),
                    TextField(
                      controller: _newBlockController,
                      decoration: const InputDecoration(
                        hintText: 'เช่น โรงงาน A',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      onChanged: (v) {
                        if (v.isNotEmpty) setState(() => _selectedBlock = null);
                      },
                    ),
                    if (_plantValue != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'ทุกแถวจะถูกกำหนดบล็อกเป็น "${_plantValue}"',
                          style: const TextStyle(fontSize: 12, color: Colors.blue),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.upload_file),
                        const SizedBox(width: 8),
                        Text(
                          'นำเข้าจาก Excel',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'เลือกไฟล์ .xlsx หรือ .xls เพื่อนำเข้าอะไหล่ โหมด AI จะช่วยอ่านหัวตารางและเติมรายละเอียดให้อัตโนมัติ',
                      style: TextStyle(color: Colors.grey),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        OutlinedButton.icon(
                          onPressed: _isImporting ? null : _downloadTemplate,
                          icon: const Icon(Icons.download),
                          label: const Text('ดาวน์โหลดแม่แบบ CSV'),
                        ),
                        FilledButton.icon(
                          onPressed: _isImporting ? null : () => _pickAndImportExcel(useAi: false),
                          icon: _isImporting
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.upload),
                          label: const Text('นำเข้า Excel ปกติ'),
                        ),
                        FilledButton.icon(
                          onPressed: _isImporting ? null : () => _pickAndImportExcel(useAi: true),
                          icon: _isImporting
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.auto_awesome),
                          label: const Text('AI วิเคราะห์และนำเข้า'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.download),
                        const SizedBox(width: 8),
                        Text(
                          'ส่งออกเป็น Excel',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: _isExportingParts
                          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.inventory_2),
                      title: const Text('ส่งออกรายการอะไหล่'),
                      subtitle: const Text('ไฟล์ .xlsx พร้อมข้อมูลทั้งหมด'),
                      trailing: FilledButton(
                        onPressed: _isExportingParts || _isExportingMovements ? null : _exportParts,
                        child: const Text('ดาวน์โหลด'),
                      ),
                    ),
                    const Divider(),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: _isExportingMovements
                          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.history),
                      title: const Text('ส่งออกประวัติการเคลื่อนไหว'),
                      subtitle: const Text('ไฟล์ .xlsx พร้อมข้อมูลทั้งหมด'),
                      trailing: FilledButton(
                        onPressed: _isExportingParts || _isExportingMovements ? null : _exportMovements,
                        child: const Text('ดาวน์โหลด'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              color: Colors.blue[50],
              child: const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'คำแนะนำ\n'
                  '- โหมดปกติต้องมี Part Number, Part Name/Description และ Quantity\n'
                  '- โหมด AI เหมาะกับไฟล์ตัวอย่างเช่น NBK1.xlsx ที่มี Part no., Description, Quantity\n'
                  '- ถ้าไฟล์ใหญ่ ระบบจะเริ่มจาก 100 แถวแรกก่อน',
                  style: TextStyle(fontSize: 13),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
