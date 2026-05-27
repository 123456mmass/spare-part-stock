import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _isLoading = false;
  String? _error;
  Map<String, dynamic>? _stats;

  @override
  void initState() {
    super.initState();
    _fetchStats();
  }

  Future<void> _fetchStats() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final response = await api.getDashboard();
      setState(() => _stats = response);
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
        title: const Text('แดชบอร์ด'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: _isLoading && _stats == null
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _stats == null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: _fetchStats,
                          child: const Text('ลองใหม่'),
                        ),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _fetchStats,
                    child: ListView(
                      padding: const EdgeInsets.all(12),
                      children: [
                        GridView.count(
                          crossAxisCount: 2,
                          mainAxisSpacing: 8,
                          crossAxisSpacing: 8,
                          childAspectRatio: 1.3,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          children: [
                            _StatCard(
                              icon: Icons.inventory_2,
                              label: 'อะไหล่ทั้งหมด',
                              value: '${_stats?['totalParts'] ?? 0}',
                              color: Colors.blue,
                            ),
                            _StatCard(
                              icon: Icons.warning_amber,
                              label: 'ใกล้หมด',
                              value: '${_stats?['lowStockCount'] ?? 0}',
                              color: Colors.amber,
                            ),
                            _StatCard(
                              icon: Icons.remove_shopping_cart,
                              label: 'หมดสต็อก',
                              value: '${_stats?['outOfStockCount'] ?? 0}',
                              color: Colors.red,
                            ),
                            _StatCard(
                              icon: Icons.category,
                              label: 'หมวดหมู่',
                              value: '${_stats?['categoriesCount'] ?? 0}',
                              color: Colors.teal,
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Text(
                              'วันนี้: ${_stats?['todayMovements'] ?? 0} รายการ',
                              style: TextStyle(color: Colors.grey[600]),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        if ((_stats?['lowStockParts'] as List? ?? []).isNotEmpty) ...[
                          Text(
                            'อะไหล่ใกล้หมด',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          ...((_stats?['lowStockParts'] as List).map((p) => _LowStockItem(
                            partNumber: p['partNumber'] ?? '',
                            partName: p['partName'] ?? '',
                            quantity: p['quantity'] ?? 0,
                            minimumQuantity: p['minimumQuantity'] ?? 0,
                            onTap: () => context.push('/parts/${p['id']}', extra: p),
                          ))),
                          const SizedBox(height: 16),
                        ],
                        if ((_stats?['recentMovements'] as List? ?? []).isNotEmpty) ...[
                          Text(
                            'กิจกรรมล่าสุด',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          ...((_stats?['recentMovements'] as List).map((m) => _MovementItem(
                            type: m['type'] ?? '',
                            partNumber: m['part']?['partNumber'] ?? '',
                            partName: m['part']?['partName'] ?? '',
                            quantityChange: m['quantityChange'] ?? 0,
                            userName: m['user']?['name'] ?? '',
                            createdAt: m['createdAt'] ?? '',
                          ))),
                        ],
                      ],
                    ),
                  ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 28, color: color),
            const SizedBox(height: 8),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _LowStockItem extends StatelessWidget {
  final String partNumber;
  final String partName;
  final int quantity;
  final int minimumQuantity;
  final VoidCallback onTap;

  const _LowStockItem({
    required this.partNumber,
    required this.partName,
    required this.quantity,
    required this.minimumQuantity,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isOut = quantity == 0;
    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: ListTile(
        onTap: onTap,
        leading: Icon(
          isOut ? Icons.remove_shopping_cart : Icons.warning_amber,
          color: isOut ? Colors.red : Colors.amber,
        ),
        title: Text(partName),
        subtitle: Text(partNumber),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '$quantity',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isOut ? Colors.red : Colors.amber,
              ),
            ),
            Text(
              'ขั้นต่ำ $minimumQuantity',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MovementItem extends StatelessWidget {
  final String type;
  final String partNumber;
  final String partName;
  final int quantityChange;
  final String userName;
  final String createdAt;

  const _MovementItem({
    required this.type,
    required this.partNumber,
    required this.partName,
    required this.quantityChange,
    required this.userName,
    required this.createdAt,
  });

  String get _typeLabel {
    switch (type) {
      case 'STOCK_IN': return 'รับเข้า';
      case 'STOCK_OUT': return 'จ่ายออก';
      case 'ADJUSTMENT': return 'ปรับปรุง';
      default: return type;
    }
  }

  Color get _typeColor {
    switch (type) {
      case 'STOCK_IN': return Colors.green;
      case 'STOCK_OUT': return Colors.red;
      case 'ADJUSTMENT': return Colors.blue;
      default: return Colors.grey;
    }
  }

  String get _formattedDate {
    try {
      final d = DateTime.parse(createdAt).toLocal();
      return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return createdAt;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPlus = quantityChange >= 0;
    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: _typeColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            type == 'STOCK_IN'
                ? Icons.arrow_downward
                : type == 'STOCK_OUT'
                    ? Icons.arrow_upward
                    : Icons.edit,
            color: _typeColor,
            size: 20,
          ),
        ),
        title: Text(partName, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text('$partNumber • $_typeLabel • $userName • $_formattedDate'),
        trailing: Text(
          '${isPlus ? '+' : ''}$quantityChange',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: _typeColor,
          ),
        ),
      ),
    );
  }
}
