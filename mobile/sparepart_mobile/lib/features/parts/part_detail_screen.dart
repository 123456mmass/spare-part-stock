import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/auth/auth_store.dart';
import '../../core/models/part.dart';
import '../../core/models/stock_movement.dart';
import '../stock/stock_movement_sheet.dart';

class PartDetailScreen extends StatefulWidget {
  final String partId;
  final Part? initialPart;

  const PartDetailScreen({
    super.key,
    required this.partId,
    this.initialPart,
  });

  @override
  State<PartDetailScreen> createState() => _PartDetailScreenState();
}

class _PartDetailScreenState extends State<PartDetailScreen> {
  Part? _part;
  bool _isLoading = false;
  bool _didChange = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _part = widget.initialPart;
    _fetchPart();
  }

  Future<void> _fetchPart() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final part = await context.read<ApiClient>().getPart(widget.partId);
      setState(() => _part = part);
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'เกิดข้อผิดพลาด');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _close() => Navigator.of(context).pop(_didChange);

  Future<void> _confirmDelete() async {
    final part = _part;
    if (part == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ลบอะไหล่?'),
        content: const Text('ต้องการลบอะไหล่นี้หรือไม่'),
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
      await context.read<ApiClient>().deletePart(part.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ลบอะไหล่เรียบร้อย'), backgroundColor: Colors.green),
        );
        context.go('/parts');
      }
    } on ApiError catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showStockMovementSheet(String type) {
    final part = _part;
    if (part == null) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => StockMovementSheet(
        part: part,
        movementType: type,
        onDone: (newQty) {
          setState(() {
            _part = _copyWithQuantity(part, newQty);
            _didChange = true;
          });
        },
      ),
    );
  }

  Part _copyWithQuantity(Part part, int quantity) {
    return Part(
      id: part.id,
      partNumber: part.partNumber,
      partName: part.partName,
      description: part.description,
      quantity: quantity,
      minimumQuantity: part.minimumQuantity,
      unit: part.unit,
      location: part.location,
      imageUrl: part.imageUrl,
      qrCodeUrl: part.qrCodeUrl,
      barcodeValue: part.barcodeValue,
      category: part.category,
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
    final part = _part;

    return PopScope<bool>(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _close();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('รายละเอียดอะไหล่'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: _close,
          ),
          actions: [
            if (auth.isAdmin)
              PopupMenuButton<String>(
                onSelected: (value) {
                  if (value == 'edit') {
                    context.push('/parts/${Uri.encodeComponent(part!.id)}/edit', extra: part);
                  } else if (value == 'delete') {
                    _confirmDelete();
                  }
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(value: 'edit', child: Text('แก้ไข')),
                  if (part!.quantity == 0)
                    const PopupMenuItem(value: 'delete', child: Text('ลบ', style: TextStyle(color: Colors.red))),
                ],
              ),
          ],
        ),
        body: SafeArea(
          child: part == null && _isLoading
              ? const Center(child: CircularProgressIndicator())
              : part == null
                  ? _ErrorView(message: _error ?? 'ไม่พบอะไหล่นี้', onRetry: _fetchPart)
                  : RefreshIndicator(
                      onRefresh: _fetchPart,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          if (_error != null) ...[
                            _InlineError(message: _error!),
                            const SizedBox(height: 12),
                          ],
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 88,
                                        height: 88,
                                        decoration: BoxDecoration(
                                          color: Colors.grey[100],
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: part.imageUrl != null
                                            ? ClipRRect(
                                                borderRadius: BorderRadius.circular(8),
                                                child: Image.network(
                                                  part.imageUrl!,
                                                  fit: BoxFit.contain,
                                                  errorBuilder: (context, error, stackTrace) => const Icon(
                                                    Icons.inventory_2,
                                                    size: 40,
                                                    color: Colors.grey,
                                                  ),
                                                ),
                                              )
                                            : const Icon(Icons.inventory_2, size: 40, color: Colors.grey),
                                      ),
                                      const SizedBox(width: 16),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              part.partNumber,
                                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(part.partName),
                                            if (part.category != null) ...[
                                              const SizedBox(height: 8),
                                              Chip(
                                                label: Text(part.category!.name),
                                                visualDensity: VisualDensity.compact,
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 16),
                                  const Divider(),
                                  const SizedBox(height: 12),
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
                                                Text(
                                                  '${part.quantity}',
                                                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                ),
                                                const SizedBox(width: 4),
                                                Text(part.unit, style: TextStyle(color: Colors.grey[600])),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                        decoration: BoxDecoration(
                                          color: _statusColor(part.stockStatus).withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(16),
                                          border: Border.all(color: _statusColor(part.stockStatus)),
                                        ),
                                        child: Text(
                                          part.stockStatusLabel,
                                          style: TextStyle(
                                            color: _statusColor(part.stockStatus),
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 16),
                                  _InfoRow(label: 'ขั้นต่ำ', value: '${part.minimumQuantity} ${part.unit}'),
                                  if (part.location != null) _InfoRow(label: 'ที่เก็บ', value: part.location!),
                                  if (part.barcodeValue != null) _InfoRow(label: 'บาร์โค้ด', value: part.barcodeValue!),
                                  if (part.description != null && part.description!.isNotEmpty) ...[
                                    const SizedBox(height: 12),
                                    Text('รายละเอียด', style: TextStyle(color: Colors.grey[600])),
                                    const SizedBox(height: 4),
                                    Text(part.description!),
                                  ],
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          if (auth.isAuthenticated)
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Text(
                                      'จัดการสต็อก',
                                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                                    ),
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
                                            onPressed: part.quantity > 0 ? () => _showStockMovementSheet('STOCK_OUT') : null,
                                            icon: const Icon(Icons.arrow_upward, color: Colors.red),
                                            label: const Text('จ่ายออก'),
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (auth.isAdmin) ...[
                                      const SizedBox(height: 8),
                                      OutlinedButton.icon(
                                        onPressed: () => _showStockMovementSheet('ADJUSTMENT'),
                                        icon: const Icon(Icons.edit, color: Colors.blue),
                                        label: const Text('ปรับปรุงสต็อก'),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          if (part.movements != null && part.movements!.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          'ประวัติเคลื่อนไหว',
                                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                                        ),
                                        TextButton(
                                          onPressed: () => context.push('/movements/${Uri.encodeComponent(part.id)}'),
                                          child: const Text('ดูทั้งหมด'),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    ...part.movements!.take(5).map((m) => _MovementHistoryItem(movement: m)),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
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
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  final String message;

  const _InlineError({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
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
          Expanded(child: Text(message, style: const TextStyle(color: Colors.red))),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 40),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('ลองใหม่')),
          ],
        ),
      ),
    );
  }
}

class _MovementHistoryItem extends StatelessWidget {
  final StockMovement movement;

  const _MovementHistoryItem({required this.movement});

  Color get _typeColor {
    switch (movement.type) {
      case 'STOCK_IN': return Colors.green;
      case 'STOCK_OUT': return Colors.red;
      case 'ADJUSTMENT': return Colors.blue;
      default: return Colors.grey;
    }
  }

  IconData get _typeIcon {
    switch (movement.type) {
      case 'STOCK_IN': return Icons.arrow_downward;
      case 'STOCK_OUT': return Icons.arrow_upward;
      case 'ADJUSTMENT': return Icons.edit;
      default: return Icons.circle;
    }
  }

  String get _formattedDate {
    try {
      final d = DateTime.parse(movement.createdAt);
      return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return movement.createdAt;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPlus = movement.quantityChange >= 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: _typeColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Icon(_typeIcon, color: _typeColor, size: 16),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  movement.typeLabel,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
                Text(
                  '${movement.userName ?? ''} • $_formattedDate',
                  style: TextStyle(color: Colors.grey[600], fontSize: 12),
                ),
              ],
            ),
          ),
          Text(
            '${isPlus ? '+' : ''}${movement.quantityChange}',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: _typeColor,
            ),
          ),
        ],
      ),
    );
  }
}
