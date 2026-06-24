import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/auth/auth_store.dart';
import '../../core/models/part.dart';
import '../scanner/scanner_entry.dart';
import 'image_search_results_screen.dart';
import 'image_search_loading_screen.dart';

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
  String? _categoryFilter;
  String? _plantFilter;
  String? _buildingIdFilter;
  bool _specialToolFilter = false;
  List<Map<String, dynamic>> _buildings = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final qp = GoRouterState.of(context).uri.queryParameters;
      if (qp['plant'] != null) _plantFilter = qp['plant'];
      if (qp['buildingId'] != null) _buildingIdFilter = qp['buildingId'];
      _fetchBuildings();
      _fetchParts();
    });
  }

  Future<void> _fetchBuildings() async {
    try {
      final data = await context.read<ApiClient>().getBuildings();
      if (mounted) setState(() => _buildings = data);
    } catch (_) {}
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
        stockStatus: status ?? _stockStatusFilter,
        plant: _plantFilter,
        buildingId: _buildingIdFilter,
        specialTool: _specialToolFilter ? true : null,
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

  List<String> _getUniqueCategories() {
    return _parts.map((p) => p.category?.name).where((c) => c != null && c.isNotEmpty).cast<String>().toSet().toList()..sort();
  }

  List<String> _getUniquePlants() {
    return _parts.map((p) => p.plant).where((p) => p != null && p.isNotEmpty).cast<String>().toSet().toList()..sort();
  }

  List<Part> get _filteredParts {
    return _parts.where((p) {
      if (_categoryFilter != null && p.category?.name != _categoryFilter) return false;
      return true;
    }).toList();
  }

  Future<void> _searchByImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 90);
    if (picked == null || !mounted) return;

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ImageSearchLoadingScreen(imagePath: picked.path),
      ),
    );

    try {
      final api = context.read<ApiClient>();
      final matches = await api.searchPartByImage(picked.path);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => ImageSearchResultsScreen(matches: matches, queryImagePath: picked.path),
        ),
      );
    } on ApiError catch (e) {
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: Colors.red),
      );
    } catch (_) {
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('เกิดข้อผิดพลาด'), backgroundColor: Colors.red),
      );
    }
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
            icon: const Icon(Icons.image_search),
            tooltip: 'ค้นหาด้วยรูป',
            onPressed: _searchByImage,
          ),
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
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
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
                      ),
                      const SizedBox(width: 8),
                      IconButton.filled(
                        icon: const Icon(Icons.add),
                        tooltip: 'เพิ่มอะไหล่',
                        onPressed: () => context.push('/parts/new'),
                      ),
                    ],
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
                        _FilterChip(label: 'มีอะไหล่', selected: _stockStatusFilter == 'in-stock', onSelected: () {
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
                        _FilterChip(label: '🔧 Special Tool', selected: _specialToolFilter, onSelected: () {
                          setState(() => _specialToolFilter = !_specialToolFilter);
                          _fetchParts(page: 1, status: _stockStatusFilter);
                        }),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _categoryFilter,
                          decoration: const InputDecoration(
                            labelText: 'หมวดหมู่',
                            border: OutlineInputBorder(),
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          ),
                          items: [
                            const DropdownMenuItem(value: null, child: Text('ทั้งหมด')),
                            ..._getUniqueCategories().map((c) => DropdownMenuItem(value: c, child: Text(c))),
                          ],
                          onChanged: (v) => setState(() => _categoryFilter = v),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _plantFilter,
                          decoration: const InputDecoration(
                            labelText: 'Block',
                            border: OutlineInputBorder(),
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          ),
                          items: [
                            const DropdownMenuItem(value: null, child: Text('ทั้งหมด')),
                            ..._getUniquePlants().map((p) => DropdownMenuItem(value: p, child: Text('Block $p'))),
                          ],
                          onChanged: (v) {
                            setState(() => _plantFilter = v);
                            _fetchParts(page: 1);
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: _buildingIdFilter,
                    decoration: const InputDecoration(
                      labelText: 'อาคาร',
                      border: OutlineInputBorder(),
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('ทุกอาคาร')),
                      const DropdownMenuItem(value: '__none__', child: Text('ไม่ระบุอาคาร')),
                      ..._buildings.map((b) => DropdownMenuItem(
                        value: b['id'] as String,
                        child: Text(b['name']?.toString() ?? '-'),
                      )),
                    ],
                    onChanged: (v) {
                      setState(() => _buildingIdFilter = v);
                      _fetchParts(page: 1);
                    },
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
                            itemCount: _filteredParts.length,
                            itemBuilder: (context, index) {
                              final part = _filteredParts[index];
                              return Card(
                                margin: const EdgeInsets.only(bottom: 8),
                                child: InkWell(
                                  onTap: () => context.push('/parts/${part.id}', extra: part),
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
                                              Text(part.partName, style: const TextStyle(fontWeight: FontWeight.bold)),
                                              Text(part.partNumber, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                                              if (part.category != null)
                                                Padding(
                                                  padding: const EdgeInsets.only(top: 4),
                                                  child: Chip(
                                                    label: Text(part.category!.name, style: const TextStyle(fontSize: 11)),
                                                    visualDensity: VisualDensity.compact,
                                                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                                  ),
                                                ),
                                              if (part.isSpecialToolPart)
                                                Padding(
                                                  padding: const EdgeInsets.only(top: 4),
                                                  child: Chip(
                                                    label: const Text('🔧 Special Tool', style: TextStyle(fontSize: 11)),
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