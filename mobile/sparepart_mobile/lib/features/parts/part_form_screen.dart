import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/models/part.dart';
import '../../core/models/category.dart';
import '../scanner/scanner_entry.dart';

class PartFormScreen extends StatefulWidget {
  final Part? part;

  const PartFormScreen({super.key, this.part});

  @override
  State<PartFormScreen> createState() => _PartFormScreenState();
}

class _PartFormScreenState extends State<PartFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _partNumberController = TextEditingController();
  final _partNameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _locationController = TextEditingController();
  final _barcodeController = TextEditingController();
  final _quantityController = TextEditingController();
  final _minimumQuantityController = TextEditingController();
  final _unitController = TextEditingController(text: 'pcs');
  final _imagePicker = ImagePicker();

  List<Category> _categories = [];
  String? _selectedCategoryId;
  bool _isLoading = false;
  bool _isSubmitting = false;
  bool _isUploadingImage = false;
  bool _isAiSuggesting = false;
  bool _isScanning = false;
  String? _error;
  String? _currentImageUrl;
  String? _pendingImagePath;

  bool get _isEditing => widget.part != null;

  @override
  void initState() {
    super.initState();
    if (_isEditing) {
      final p = widget.part!;
      _partNumberController.text = p.partNumber;
      _partNameController.text = p.partName;
      _descriptionController.text = p.description ?? '';
      _locationController.text = p.location ?? '';
      _barcodeController.text = p.barcodeValue ?? '';
      _quantityController.text = '${p.quantity}';
      _minimumQuantityController.text = '${p.minimumQuantity}';
      _unitController.text = p.unit;
      _selectedCategoryId = p.category?.id;
      _currentImageUrl = p.imageUrl;
    }
    _fetchCategories();
  }

  @override
  void dispose() {
    _partNumberController.dispose();
    _partNameController.dispose();
    _descriptionController.dispose();
    _locationController.dispose();
    _barcodeController.dispose();
    _quantityController.dispose();
    _minimumQuantityController.dispose();
    _unitController.dispose();
    super.dispose();
  }

  Future<void> _fetchCategories() async {
    setState(() => _isLoading = true);
    try {
      final cats = await context.read<ApiClient>().getCategories();
      setState(() {
        _categories = cats;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      final api = context.read<ApiClient>();
      final quantity = int.tryParse(_quantityController.text) ?? 0;
      final minimumQuantity = int.tryParse(_minimumQuantityController.text) ?? 0;

      Part? savedPart;
      if (_isEditing) {
        await api.updatePart(widget.part!.id, {
          'partNumber': _partNumberController.text.trim(),
          'partName': _partNameController.text.trim(),
          'description': _descriptionController.text.trim(),
          'categoryId': _selectedCategoryId,
          'location': _locationController.text.trim(),
          'barcodeValue': _barcodeController.text.trim(),
          'minimumQuantity': minimumQuantity,
          'unit': _unitController.text.trim(),
        });
      } else {
        savedPart = await api.createPart({
          'partNumber': _partNumberController.text.trim(),
          'partName': _partNameController.text.trim(),
          'description': _descriptionController.text.trim(),
          'categoryId': _selectedCategoryId,
          'location': _locationController.text.trim(),
          'barcodeValue': _barcodeController.text.trim(),
          'quantity': quantity,
          'minimumQuantity': minimumQuantity,
          'unit': _unitController.text.trim(),
        });

        if (_pendingImagePath != null) {
          await api.uploadPartImage(savedPart.id, _pendingImagePath!);
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_isEditing ? 'แก้ไขอะไหล่เรียบร้อย' : 'เพิ่มอะไหล่เรียบร้อย'),
            backgroundColor: Colors.green,
          ),
        );
        context.pop(true);
      }
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'เกิดข้อผิดพลาด');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _delete() async {
    if (!_isEditing) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ลบอะไหล่?'),
        content: const Text('ต้องการลบอะไหล่นี้หรือไม่ การกระทำนี้ไม่สามารถย้อนกลับได้'),
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
    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      await context.read<ApiClient>().deletePart(widget.part!.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ลบอะไหล่เรียบร้อย'), backgroundColor: Colors.green),
        );
        context.go('/parts');
      }
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'เกิดข้อผิดพลาด');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _pickImage() async {
    final source = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('ถ่ายรูป'),
              onTap: () => Navigator.pop(ctx, 'camera'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('เลือกจากแกลลอรี'),
              onTap: () => Navigator.pop(ctx, 'gallery'),
            ),
          ],
        ),
      ),
    );

    if (source == null) return;

    try {
      final picked = await _imagePicker.pickImage(
        source: source == 'camera' ? ImageSource.camera : ImageSource.gallery,
        maxWidth: 1200,
        maxHeight: 1200,
        imageQuality: 85,
      );
      if (picked == null) return;

      setState(() => _isUploadingImage = true);
      final imageUrl = await context.read<ApiClient>().uploadPartImage(widget.part!.id, picked.path);
      setState(() => _currentImageUrl = imageUrl);
    } on ApiError catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('อัปโหลดรูปล้มเหลว: ${e.message}'), backgroundColor: Colors.red),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('เกิดข้อผิดพลาดในการอัปโหลดรูป'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploadingImage = false);
    }
  }

  Future<XFile?> _pickImageSource() async {
    final source = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('ถ่ายรูป'),
              onTap: () => Navigator.pop(ctx, 'camera'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('เลือกจากแกลเลอรี'),
              onTap: () => Navigator.pop(ctx, 'gallery'),
            ),
          ],
        ),
      ),
    );

    if (source == null) return null;
    return _imagePicker.pickImage(
      source: source == 'camera' ? ImageSource.camera : ImageSource.gallery,
      maxWidth: 1200,
      maxHeight: 1200,
      imageQuality: 85,
    );
  }

  int _intFromSuggestion(Object? value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  void _applyAiSuggestion(Map<String, dynamic> suggestion) {
    String stringValue(String key) => (suggestion[key] as String?)?.trim() ?? '';

    final partNumber = stringValue('partNumber');
    final partName = stringValue('partName');
    final description = stringValue('description');
    final location = stringValue('location');
    final unit = stringValue('unit');
    final barcodeValue = stringValue('barcodeValue');
    final categoryId = stringValue('categoryId');

    if (partNumber.isNotEmpty) _partNumberController.text = partNumber;
    if (partName.isNotEmpty) _partNameController.text = partName;
    if (description.isNotEmpty) _descriptionController.text = description;
    if (location.isNotEmpty) _locationController.text = location;
    if (unit.isNotEmpty) _unitController.text = unit;
    if (barcodeValue.isNotEmpty) _barcodeController.text = barcodeValue;
    if (categoryId.isNotEmpty) _selectedCategoryId = categoryId;

    _quantityController.text = '${_intFromSuggestion(suggestion['quantity'])}';
    _minimumQuantityController.text = '${_intFromSuggestion(suggestion['minimumQuantity'])}';
  }

  Future<void> _pickImageAndSuggest() async {
    if (_isAiSuggesting) return;
    final picked = await _pickImageSource();
    if (picked == null || !mounted) return;

    setState(() {
      _pendingImagePath = picked.path;
      _isAiSuggesting = true;
      _error = null;
    });

    try {
      final suggestion = await context.read<ApiClient>().suggestPartFromImage(picked.path);
      if (!mounted) return;
      setState(() => _applyAiSuggestion(suggestion));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('AI เติมข้อมูลจากรูปแล้ว กรุณาตรวจสอบก่อนบันทึก'),
          backgroundColor: Colors.green,
        ),
      );
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'AI วิเคราะห์รูปไม่สำเร็จ');
    } finally {
      if (mounted) setState(() => _isAiSuggesting = false);
    }
  }

  Future<void> _scanBarcode() async {
    if (_isScanning) return;
    setState(() => _isScanning = true);
    try {
      final code = await scanCode(context);
      if (code != null && code.isNotEmpty) {
        setState(() => _barcodeController.text = code);
      }
    } finally {
      if (mounted) setState(() => _isScanning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'แก้ไขอะไหล่' : 'เพิ่มอะไหล่ใหม่'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
        actions: [
          if (_isEditing && widget.part!.quantity == 0)
            IconButton(
              icon: const Icon(Icons.delete, color: Colors.red),
              tooltip: 'ลบอะไหล่',
              onPressed: _isSubmitting ? null : _delete,
            ),
        ],
      ),
      body: SafeArea(
        child: _isLoading && _categories.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
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
                      const SizedBox(height: 16),
                    ],
                    if (!_isEditing) ...[
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              Container(
                                width: 72,
                                height: 72,
                                decoration: BoxDecoration(
                                  color: Colors.grey[100],
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.grey[300]!),
                                ),
                                child: _pendingImagePath != null
                                    ? ClipRRect(
                                        borderRadius: BorderRadius.circular(12),
                                        child: Image.file(
                                          File(_pendingImagePath!),
                                          fit: BoxFit.cover,
                                        ),
                                      )
                                    : const Icon(Icons.auto_awesome, color: Colors.grey),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'เพิ่มอะไหล่ด้วย AI จากรูป',
                                      style: TextStyle(fontWeight: FontWeight.bold),
                                    ),
                                    const SizedBox(height: 4),
                                    const Text(
                                      'ถ่ายรูปหรือเลือกไฟล์ แล้วให้ AI เติมรหัส ชื่อ รายละเอียด และจำนวนเริ่มต้น',
                                      style: TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                    const SizedBox(height: 8),
                                    FilledButton.icon(
                                      onPressed: _isAiSuggesting ? null : _pickImageAndSuggest,
                                      icon: _isAiSuggesting
                                          ? const SizedBox(
                                              width: 16,
                                              height: 16,
                                              child: CircularProgressIndicator(strokeWidth: 2),
                                            )
                                          : const Icon(Icons.auto_awesome),
                                      label: Text(_isAiSuggesting ? 'กำลังวิเคราะห์...' : 'เลือกรูปและเติมอัตโนมัติ'),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    if (_isEditing) ...[
                      Center(
                        child: GestureDetector(
                          onTap: _isUploadingImage ? null : _pickImage,
                          child: Container(
                            width: 120,
                            height: 120,
                            decoration: BoxDecoration(
                              color: Colors.grey[100],
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.grey[300]!),
                            ),
                            child: _isUploadingImage
                                ? const Center(child: CircularProgressIndicator())
                                : _currentImageUrl != null
                                    ? ClipRRect(
                                        borderRadius: BorderRadius.circular(12),
                                        child: Image.network(
                                          _currentImageUrl!,
                                          fit: BoxFit.cover,
                                          width: 120,
                                          height: 120,
                                          errorBuilder: (_, __, ___) => const Icon(Icons.camera_alt, size: 40, color: Colors.grey),
                                        ),
                                      )
                                    : const Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(Icons.camera_alt, size: 32, color: Colors.grey),
                                          SizedBox(height: 4),
                                          Text('เพิ่มรูป', style: TextStyle(fontSize: 12, color: Colors.grey)),
                                        ],
                                      ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Center(
                        child: TextButton.icon(
                          onPressed: _isUploadingImage ? null : _pickImage,
                          icon: const Icon(Icons.edit, size: 16),
                          label: Text(_currentImageUrl != null ? 'เปลี่ยนรูป' : 'เพิ่มรูป'),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextFormField(
                      controller: _partNumberController,
                      decoration: const InputDecoration(
                        labelText: 'รหัสอะไหล่ *',
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) => v == null || v.isEmpty ? 'กรุณากรอกรหัสอะไหล่' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _partNameController,
                      decoration: const InputDecoration(
                        labelText: 'ชื่ออะไหล่ *',
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) => v == null || v.isEmpty ? 'กรุณากรอกชื่ออะไหล่' : null,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedCategoryId,
                      decoration: const InputDecoration(
                        labelText: 'หมวดหมู่',
                        border: OutlineInputBorder(),
                      ),
                      items: [
                        const DropdownMenuItem(value: null, child: Text('- ไม่ระบุ -')),
                        ..._categories.map((c) => DropdownMenuItem(
                          value: c.id,
                          child: Text(c.name),
                        )),
                      ],
                      onChanged: (v) => setState(() => _selectedCategoryId = v),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _descriptionController,
                      decoration: const InputDecoration(
                        labelText: 'รายละเอียด',
                        border: OutlineInputBorder(),
                      ),
                      maxLines: 3,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _quantityController,
                            decoration: const InputDecoration(
                              labelText: 'จำนวน',
                              border: OutlineInputBorder(),
                            ),
                            keyboardType: TextInputType.number,
                            validator: (v) {
                              if (v == null || v.isEmpty) return 'กรุณากรอกจำนวน';
                              if (int.tryParse(v) == null) return 'ต้องเป็นตัวเลข';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            controller: _minimumQuantityController,
                            decoration: const InputDecoration(
                              labelText: 'ขั้นต่ำ',
                              border: OutlineInputBorder(),
                            ),
                            keyboardType: TextInputType.number,
                            validator: (v) {
                              if (v == null || v.isEmpty) return 'กรุณากรอก';
                              if (int.tryParse(v) == null) return 'ต้องเป็นตัวเลข';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            controller: _unitController,
                            decoration: const InputDecoration(
                              labelText: 'หน่วย',
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _locationController,
                      decoration: const InputDecoration(
                        labelText: 'ที่เก็บ',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _barcodeController,
                            decoration: const InputDecoration(
                              labelText: 'บาร์โค้ด',
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          height: 56,
                          child: IconButton.filled(
                            onPressed: _isScanning ? null : _scanBarcode,
                            icon: _isScanning
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Icon(Icons.qr_code_scanner),
                            tooltip: 'สแกนบาร์โค้ด',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      height: 48,
                      child: FilledButton(
                        onPressed: _isSubmitting ? null : _submit,
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : Text(_isEditing ? 'บันทึกการแก้ไข' : 'เพิ่มอะไหล่'),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
