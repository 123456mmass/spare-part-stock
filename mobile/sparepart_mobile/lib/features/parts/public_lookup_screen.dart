import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/auth/auth_store.dart';
import '../../core/models/part.dart';
import '../scanner/scanner_entry.dart';
import '../stock/stock_movement_sheet.dart';

class PublicLookupScreen extends StatefulWidget {
  final String? initialCode;
  final bool autoLookup;

  const PublicLookupScreen({
    super.key,
    this.initialCode,
    this.autoLookup = false,
  });

  @override
  State<PublicLookupScreen> createState() => _PublicLookupScreenState();
}

class _PublicLookupScreenState extends State<PublicLookupScreen> {
  final _codeController = TextEditingController();
  Part? _part;
  bool _isLoading = false;
  String? _error;
  bool _isScanning = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialCode != null) {
      _codeController.text = widget.initialCode!;
      if (widget.autoLookup) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _lookup());
      }
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) return;

    setState(() {
      _isLoading = true;
      _error = null;
      _part = null;
    });

    try {
      final api = context.read<ApiClient>();
      final auth = context.read<AuthStore>();
      Part part;

      if (auth.isAuthenticated) {
        part = await api.lookupPartByCode(code);
      } else {
        final result = await api.publicLookup(code);
        final partData = result['part'] as Map<String, dynamic>;
        part = Part.fromJson(partData);
      }

      setState(() => _part = part);
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _scanAndLookup() async {
    if (_isScanning) return;
    setState(() => _isScanning = true);
    try {
      final code = await scanCode(context);
      if (code == null || code.isEmpty) return;
      _codeController.text = code;
      await _lookup();
    } finally {
      if (mounted) setState(() => _isScanning = false);
    }
  }

  void _showStockMovementSheet(String type) {
    if (_part == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => StockMovementSheet(
        part: _part!,
        movementType: type,
        onDone: (newQty) {
          setState(() => _part = Part(
            id: _part!.id,
            partNumber: _part!.partNumber,
            partName: _part!.partName,
            description: _part!.description,
            quantity: newQty,
            minimumQuantity: _part!.minimumQuantity,
            unit: _part!.unit,
            location: _part!.location,
            imageUrl: _part!.imageUrl,
            qrCodeUrl: _part!.qrCodeUrl,
            barcodeValue: _part!.barcodeValue,
            category: _part!.category,
          ));
        },
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'IN_STOCK':
        return Colors.green;
      case 'LOW_STOCK':
        return Colors.amber;
      case 'OUT_OF_STOCK':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final isAuth = auth.isAuthenticated;

    return Scaffold(
      appBar: AppBar(
        title: const Text('ตรวจสอบสต็อก'),
        actions: [
          if (!isAuth)
            TextButton.icon(
              onPressed: () => context.go('/login'),
              icon: const Icon(Icons.login, size: 18),
              label: const Text('เข้าสู่ระบบ'),
            )
          else
            PopupMenuButton<String>(
              onSelected: (value) async {
                if (value == 'home') { context.go('/home'); }
                if (value == 'logout') {
                  await auth.logout();
                  if (context.mounted) context.go('/lookup');
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'home', child: Text('หน้าหลัก')),
                const PopupMenuItem(value: 'logout', child: Text('ออกจากระบบ')),
              ],
            ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              // Search input
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _codeController,
                      decoration: const InputDecoration(
                        hintText: 'กรอกรหัสอะไหล่ / บาร์โค้ด / QR',
                        prefixIcon: Icon(Icons.search),
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      textInputAction: TextInputAction.search,
                      onSubmitted: (_) => _lookup(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 48,
                    child: FilledButton(
                      onPressed: _isLoading ? null : _lookup,
                      child: _isLoading
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('ค้นหา'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              // Scanner button
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: _isScanning ? null : _scanAndLookup,
                  icon: _isScanning
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.qr_code_scanner, size: 18),
                  label: Text(_isScanning ? 'กำลังเปิดสแกนเนอร์...' : 'สแกนบาร์โค้ด / QR'),
                ),
              ),
              const SizedBox(height: 16),
              // Error
              if (_error != null)
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
              // Part detail
              if (_part != null)
                Expanded(
                  child: Card(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              // Image
                              Container(
                                width: 80,
                                height: 80,
                                decoration: BoxDecoration(
                                  color: Colors.grey[100],
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: _part!.imageUrl != null
                                    ? ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: Image.network(
                                          '${_part!.imageUrl}',
                                          fit: BoxFit.contain,
                                          errorBuilder: (context, error, stackTrace) => const Icon(Icons.inventory_2, size: 40, color: Colors.grey),
                                        ),
                                      )
                                    : const Icon(Icons.inventory_2, size: 40, color: Colors.grey),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(_part!.partNumber, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                                    Text(_part!.partName, style: Theme.of(context).textTheme.bodyMedium),
                                    if (_part!.category != null) ...[
                                      const SizedBox(height: 4),
                                      Chip(label: Text(_part!.category!.name), visualDensity: VisualDensity.compact),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          const Divider(),
                          const SizedBox(height: 12),
                          // Stock quantity
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('จำนวนคงเหลือ', style: TextStyle(color: Colors.grey[600])),
                                    const SizedBox(height: 4),
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.baseline,
                                      textBaseline: TextBaseline.alphabetic,
                                      children: [
                                        Text('${_part!.quantity}', style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold)),
                                        const SizedBox(width: 4),
                                        Text(_part!.unit, style: TextStyle(color: Colors.grey[600])),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: _statusColor(_part!.stockStatus).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: _statusColor(_part!.stockStatus)),
                                ),
                                child: Text(
                                  _part!.stockStatusLabel,
                                  style: TextStyle(
                                    color: _statusColor(_part!.stockStatus),
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          _InfoRow(label: 'ขั้นต่ำ', value: '${_part!.minimumQuantity} ${_part!.unit}'),
                          if (_part!.location != null) _InfoRow(label: 'ที่เก็บ', value: _part!.location!),
                          if (_part!.barcodeValue != null) _InfoRow(label: 'บาร์โค้ด', value: _part!.barcodeValue!),
                          if (_part!.description != null && _part!.description!.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text('รายละเอียด', style: TextStyle(color: Colors.grey[600])),
                            const SizedBox(height: 4),
                            Text(_part!.description!),
                          ],
                          // Authenticated actions
                          if (isAuth) ...[
                            const SizedBox(height: 20),
                            const Divider(),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () => _showStockMovementSheet('STOCK_IN'),
                                    icon: const Icon(Icons.arrow_downward, color: Colors.green),
                                    label: const Text('รับเข้า'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: _part!.quantity > 0 ? () => _showStockMovementSheet('STOCK_OUT') : null,
                                    icon: const Icon(Icons.arrow_upward, color: Colors.red),
                                    label: const Text('จ่ายออก'),
                                  ),
                                ),
                                if (auth.isAdmin) ...[
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      onPressed: () => _showStockMovementSheet('ADJUSTMENT'),
                                      icon: const Icon(Icons.edit, color: Colors.blue),
                                      label: const Text('ปรับปรุง'),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ] else ...[
                            const SizedBox(height: 20),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.blue[50],
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Row(
                                children: [
                                  Icon(Icons.info_outline, color: Colors.blue),
                                  SizedBox(width: 8),
                                  Expanded(child: Text('เข้าสู่ระบบเพื่อรับเข้า/จ่ายออกสต็อก')),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600])),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
