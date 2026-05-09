import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/auth/auth_store.dart';
import '../../core/models/part.dart';
import '../scanner/scanner_entry.dart';
import '../stock/stock_movement_sheet.dart';

class PartListScreen extends StatefulWidget {
  const PartListScreen({super.key});

  @override
  State<PartListScreen> createState() => _PartListScreenState();
}

class _PartListScreenState extends State<PartListScreen> {
  final _searchController = TextEditingController();
  List<Part> _parts = [];
  int _total = 0;
  int _currentPage = 1;
  int _totalPages = 1;
  bool _isLoading = false;
  String? _error;
  String? _stockStatusFilter;

  @override
  void initState() {
    super.initState();
    _fetchParts();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchParts({int page = 1, String? status}) async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final api = context.read<ApiClient>();
      final result = await api.getParts(
        search: _searchController.text.trim().isEmpty ? null : _searchController.text.trim(),
        stockStatus: status,
        page: page,
      );
      setState(() {
        _parts = result.parts;
        _total = result.total;
        _totalPages = result.totalPages;
        _currentPage = page;
      });
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'เกิดข้อผิดพลาด');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _onRefresh() => _fetchParts(page: _currentPage, status: _stockStatusFilter);

  void _showMovementSheet(Part part, String type) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => StockMovementSheet(
        part: part,
        movementType: type,
        onDone: (newQty) {
          setState(() {
            final idx = _parts.indexWhere((p) => p.id == part.id);
            if (idx != -1) {
              _parts[idx] = Part(
                id: part.id,
                partNumber: part.partNumber,
                partName: part.partName,
                description: part.description,
                quantity: newQty,
                minimumQuantity: part.minimumQuantity,
                unit: part.unit,
                location: part.location,
                imageUrl: part.imageUrl,
                qrCodeUrl: part.qrCodeUrl,
                barcodeValue: part.barcodeValue,
                category: part.category,
              );
            }
          });
        },
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'IN_STOCK': return Colors.green;
      case 'LOW_STOCK': return Colors.amber;
      case 'OUT_OF_STOCK': return Colors.red;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    // ignore: unused_local_variable
    context.watch<AuthStore>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('รายการอะไหล่'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/home'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            tooltip: 'สแกนบาร์โค้ด',
            onPressed: () async {
              final code = await scanCode(context);
              if (code != null && code.isNotEmpty && context.mounted) {
                context.go('/lookup?code=${Uri.encodeComponent(code)}&auto=1');
              }
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'ค้นหารหัสอะไหล่ ชื่อ...',
                      prefixIcon: const Icon(Icons.search),
                      border: const OutlineInputBorder(),
                      isDense: true,
                      suffixIcon: IconButton(
                        icon: const Icon(Icons.search),
                        onPressed: () => _fetchParts(page: 1),
                      ),
                    ),
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _fetchParts(page: 1),
                  ),
                  const SizedBox(height: 8),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _FilterChip(label: 'ทั้งหมด', selected: _stockStatusFilter == null, onSelected: () {
                          setState(() => _stockStatusFilter = null);
                          _fetchParts(page: 1, status: null);
                        }),
                        _FilterChip(label: 'มีสินค้า', selected: _stockStatusFilter == 'in-stock', onSelected: () {
                          setState(() => _stockStatusFilter = 'in-stock');
                          _fetchParts(page: 1, status: 'in-stock');
                        }),
                        _FilterChip(label: 'ใกล้หมด', selected: _stockStatusFilter == 'low-stock', onSelected: () {
                          setState(() => _stockStatusFilter = 'low-stock');
                          _fetchParts(page: 1, status: 'low-stock');
                        }),
                        _FilterChip(label: 'หมด', selected: _stockStatusFilter == 'out-of-stock', onSelected: () {
                          setState(() => _stockStatusFilter = 'out-of-stock');
                          _fetchParts(page: 1, status: 'out-of-stock');
                        }),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('$_total รายการ', style: TextStyle(color: Colors.grey[600])),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _isLoading && _parts.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null && _parts.isEmpty
                      ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                      : RefreshIndicator(
                          onRefresh: _onRefresh,
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            itemCount: _parts.length,
                            itemBuilder: (context, index) {
                              final part = _parts[index];
                              return Card(
                                margin: const EdgeInsets.only(bottom: 8),
                                child: InkWell(
                                  onTap: () {
                                    // Quick actions from list
                                    _showMovementSheet(part, 'STOCK_IN');
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Row(
                                      children: [
                                        Container(
                                          width: 56,
                                          height: 56,
                                          decoration: BoxDecoration(
                                            color: Colors.grey[100],
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: part.imageUrl != null
                                              ? ClipRRect(
                                                  borderRadius: BorderRadius.circular(8),
                                                  child: Image.network(
                                                    '${part.imageUrl}',
                                                    fit: BoxFit.contain,
                                                    errorBuilder: (context, error, stackTrace) => const Icon(Icons.inventory_2, color: Colors.grey),
                                                  ),
                                                )
                                              : const Icon(Icons.inventory_2, color: Colors.grey),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(part.partNumber, style: const TextStyle(fontWeight: FontWeight.bold)),
                                              Text(part.partName, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                                              if (part.category != null)
                                                Padding(
                                                  padding: const EdgeInsets.only(top: 4),
                                                  child: Chip(
                                                    label: Text(part.category!.name, style: const TextStyle(fontSize: 11)),
                                                    visualDensity: VisualDensity.compact,
                                                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            Text('${part.quantity}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                                            Text(part.unit, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                                            const SizedBox(height: 4),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: _statusColor(part.stockStatus).withValues(alpha: 0.1),
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: Text(
                                                part.stockStatusLabel,
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  color: _statusColor(part.stockStatus),
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
            ),
            // Pagination
            if (_totalPages > 1)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left),
                      onPressed: _currentPage > 1 ? () => _fetchParts(page: _currentPage - 1) : null,
                    ),
                    Text('หน้า $_currentPage / $_totalPages'),
                    IconButton(
                      icon: const Icon(Icons.chevron_right),
                      onPressed: _currentPage < _totalPages ? () => _fetchParts(page: _currentPage + 1) : null,
                    ),
                  ],
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

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onSelected(),
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}