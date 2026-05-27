import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/models/stock_movement.dart';

class MovementListScreen extends StatefulWidget {
  final String? partId;
  final bool showBack;

  const MovementListScreen({
    super.key,
    this.partId,
    this.showBack = true,
  });

  @override
  State<MovementListScreen> createState() => _MovementListScreenState();
}

class _MovementListScreenState extends State<MovementListScreen> {
  List<StockMovement> _movements = [];
  bool _isLoading = false;
  String? _error;
  String? _selectedType;

  @override
  void initState() {
    super.initState();
    _fetchMovements();
  }

  Future<void> _fetchMovements() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final result = await api.getMovements(
        partId: widget.partId,
        type: _selectedType,
      );
      setState(() => _movements = result.movements);
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'เกิดข้อผิดพลาด');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.partId != null ? 'ประวัติเคลื่อนไหว' : 'ประวัติทั้งหมด'),
        automaticallyImplyLeading: widget.showBack ? false : true,
        leading: widget.showBack
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => context.pop(),
              )
            : null,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _FilterChip(
                      label: 'ทั้งหมด',
                      selected: _selectedType == null,
                      onSelected: () {
                        setState(() => _selectedType = null);
                        _fetchMovements();
                      },
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'รับเข้า',
                      selected: _selectedType == 'STOCK_IN',
                      onSelected: () {
                        setState(() => _selectedType = 'STOCK_IN');
                        _fetchMovements();
                      },
                      color: Colors.green,
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'จ่ายออก',
                      selected: _selectedType == 'STOCK_OUT',
                      onSelected: () {
                        setState(() => _selectedType = 'STOCK_OUT');
                        _fetchMovements();
                      },
                      color: Colors.red,
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'ปรับปรุง',
                      selected: _selectedType == 'ADJUSTMENT',
                      onSelected: () {
                        setState(() => _selectedType = 'ADJUSTMENT');
                        _fetchMovements();
                      },
                      color: Colors.blue,
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: _isLoading && _movements.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null && _movements.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(_error!, style: const TextStyle(color: Colors.red)),
                              const SizedBox(height: 12),
                              FilledButton(
                                onPressed: _fetchMovements,
                                child: const Text('ลองใหม่'),
                              ),
                            ],
                          ),
                        )
                      : _movements.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.history, size: 48, color: Colors.grey),
                                  const SizedBox(height: 12),
                                  Text(
                                    'ไม่มีประวัติการเคลื่อนไหว',
                                    style: TextStyle(color: Colors.grey[600]),
                                  ),
                                ],
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: _fetchMovements,
                              child: ListView.builder(
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                itemCount: _movements.length,
                                itemBuilder: (context, index) {
                                  final m = _movements[index];
                                  return _MovementCard(movement: m);
                                },
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onSelected;
  final Color? color;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onSelected(),
      visualDensity: VisualDensity.compact,
      selectedColor: (color ?? Colors.grey).withValues(alpha: 0.2),
      checkmarkColor: color ?? Colors.grey,
    );
  }
}

class _MovementCard extends StatelessWidget {
  final StockMovement movement;

  const _MovementCard({required this.movement});

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
      final d = DateTime.parse(movement.createdAt).toLocal();
      return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return movement.createdAt;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPlus = movement.quantityChange >= 0;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: _typeColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(_typeIcon, color: _typeColor, size: 20),
        ),
        title: Text(
          movement.partName ?? '',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(
          '${movement.partNumber ?? ''} • ${movement.typeLabel} • ${movement.userName ?? ''} • $_formattedDate',
        ),
        trailing: Text(
          '${isPlus ? '+' : ''}${movement.quantityChange}',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: _typeColor,
            fontSize: 16,
          ),
        ),
      ),
    );
  }
}
