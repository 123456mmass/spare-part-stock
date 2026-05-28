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

  String _fmt(dynamic n) {
    if (n == null) return '0';
    return n.toString().replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (m) => '${m[1]},',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('แดชบอร์ด'),
        automaticallyImplyLeading: false,
        backgroundColor: Colors.transparent,
        elevation: 0,
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
                        FilledButton(onPressed: _fetchStats, child: const Text('ลองใหม่')),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _fetchStats,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      children: [
                        _HeroCard(stats: _stats, fmt: _fmt),
                        const SizedBox(height: 20),
                        _SectionTitle(icon: Icons.apartment, title: 'สรุปตามอาคาร'),
                        const SizedBox(height: 10),
                        ..._buildingCards(),
                        _unassignedBanner(),
                        const SizedBox(height: 20),
                        _SectionTitle(icon: Icons.factory_outlined, title: 'สรุปตาม Block'),
                        const SizedBox(height: 10),
                        ..._blockCards(),
                        if ((_stats?['recentMovements'] as List? ?? []).isNotEmpty) ...[
                          const SizedBox(height: 20),
                          _SectionTitle(icon: Icons.history, title: 'กิจกรรมล่าสุด'),
                          const SizedBox(height: 8),
                          ..._movementItems(),
                        ],
                      ],
                    ),
                  ),
      ),
    );
  }

  List<Widget> _buildingCards() {
    final buildings = (_stats?['byBuilding'] as List?) ?? [];
    final gradients = [
      [const Color(0xFF4F46E5), const Color(0xFF7C3AED)],
      [const Color(0xFF059669), const Color(0xFF0891B2)],
      [const Color(0xFFD97706), const Color(0xFFEA580C)],
    ];
    return buildings.asMap().entries.map((entry) {
      final idx = entry.key;
      final b = entry.value as Map<String, dynamic>;
      final colors = gradients[idx % gradients.length];
      final byBlock = (b['byBlock'] as List?) ?? [];
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: _GradientStorageCard(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: colors,
          ),
          title: b['name']?.toString() ?? '-',
          subtitle: 'อาคารที่เก็บ',
          partCount: _fmt(b['partCount']),
          totalQty: _fmt(b['totalQuantity']),
          breakdown: byBlock.map((bb) {
            final m = bb as Map<String, dynamic>;
            return 'Block ${m['block']}: ${_fmt(m['partCount'])} รายการ · ${_fmt(m['totalQuantity'])} ชิ้น';
          }).toList(),
          onTap: () => context.go('/parts?buildingId=${b['id']}'),
        ),
      );
    }).toList();
  }

  Widget _unassignedBanner() {
    final u = _stats?['unassignedBuilding'] as Map<String, dynamic>?;
    if (u == null || (u['partCount'] as int? ?? 0) == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Material(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => context.go('/parts?buildingId=__none__'),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFCD34D)),
            ),
            child: Row(
              children: [
                const Icon(Icons.help_outline, color: Color(0xFFB45309), size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'ยังไม่ระบุอาคาร: ${_fmt(u['partCount'])} รายการ · ${_fmt(u['totalQuantity'])} ชิ้น',
                    style: const TextStyle(color: Color(0xFF92400E), fontWeight: FontWeight.w500),
                  ),
                ),
                const Icon(Icons.chevron_right, color: Color(0xFFB45309)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _blockCards() {
    final blocks = (_stats?['byBlock'] as List?) ?? [];
    final maxQty = blocks.fold<int>(0, (max, b) {
      final q = (b as Map)['totalQuantity'] as int? ?? 0;
      return q > max ? q : max;
    });
    return blocks.map((raw) {
      final b = raw as Map<String, dynamic>;
      final qty = b['totalQuantity'] as int? ?? 0;
      final pct = maxQty > 0 ? qty / maxQty : 0.0;
      final block = b['block']?.toString() ?? '-';
      final plantParam = block == 'ไม่ระบุ' ? '__none__' : block;
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => context.go('/parts?plant=$plantParam'),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF2FF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.factory_outlined, size: 18, color: Color(0xFF4F46E5)),
                      ),
                      const SizedBox(width: 10),
                      Text('Block $block', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _MiniStat(label: 'รายการ', value: _fmt(b['partCount'])),
                      const SizedBox(width: 24),
                      _MiniStat(label: 'ชิ้น', value: _fmt(qty), accent: true),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: pct,
                      minHeight: 6,
                      backgroundColor: Colors.grey.shade100,
                      color: const Color(0xFF6366F1),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }).toList();
  }

  List<Widget> _movementItems() {
    return (_stats?['recentMovements'] as List).map((raw) {
      final m = raw as Map<String, dynamic>;
      final part = m['part'] as Map<String, dynamic>? ?? {};
      final change = m['quantityChange'] as int? ?? 0;
      final type = m['type']?.toString() ?? '';
      return Card(
        margin: const EdgeInsets.only(bottom: 6),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: Colors.grey.shade200),
        ),
        child: ListTile(
          dense: true,
          leading: Icon(
            type == 'STOCK_IN'
                ? Icons.arrow_downward
                : type == 'STOCK_OUT'
                    ? Icons.arrow_upward
                    : Icons.edit,
            color: change >= 0 ? Colors.green : Colors.red,
            size: 20,
          ),
          title: Text(part['partName']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(part['partNumber']?.toString() ?? ''),
          trailing: Text(
            '${change >= 0 ? '+' : ''}$change',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: change >= 0 ? Colors.green : Colors.red,
            ),
          ),
        ),
      );
    }).toList();
  }
}

class _HeroCard extends StatelessWidget {
  final Map<String, dynamic>? stats;
  final String Function(dynamic) fmt;

  const _HeroCard({required this.stats, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final totals = stats?['totals'] as Map<String, dynamic>? ?? {};
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0F172A), Color(0xFF1E1B4B), Color(0xFF312E81)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4F46E5).withValues(alpha: 0.25),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'สรุปสต็อก',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13),
          ),
          const SizedBox(height: 4),
          const Text(
            'ภาพรวมอะไหล่',
            style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _HeroStat(label: 'รายการ', value: fmt(totals['partCount']), icon: Icons.inventory_2_outlined)),
              const SizedBox(width: 8),
              Expanded(child: _HeroStat(label: 'ชิ้นรวม', value: fmt(totals['totalQuantity']), icon: Icons.layers_outlined)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _HeroStat(label: 'หมวดหมู่', value: fmt(totals['categoriesCount']), icon: Icons.category_outlined)),
              const SizedBox(width: 8),
              Expanded(child: _HeroStat(label: 'วันนี้', value: fmt(totals['todayMovements']), icon: Icons.swap_horiz)),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const _HeroStat({required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Colors.white70, size: 18),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
          Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.65), fontSize: 11)),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final IconData icon;
  final String title;

  const _SectionTitle({required this.icon, required this.title});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: const Color(0xFF4F46E5)),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
      ],
    );
  }
}

class _GradientStorageCard extends StatelessWidget {
  final Gradient gradient;
  final String title;
  final String subtitle;
  final String partCount;
  final String totalQty;
  final List<String> breakdown;
  final VoidCallback onTap;

  const _GradientStorageCard({
    required this.gradient,
    required this.title,
    required this.subtitle,
    required this.partCount,
    required this.totalQty,
    required this.breakdown,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            gradient: gradient,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(subtitle, style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 11)),
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(child: _GlassStat(value: partCount, label: 'รายการ')),
                  const SizedBox(width: 10),
                  Expanded(child: _GlassStat(value: totalQty, label: 'ชิ้น')),
                ],
              ),
              if (breakdown.isNotEmpty) ...[
                const SizedBox(height: 12),
                ...breakdown.map(
                  (line) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(line, style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _GlassStat extends StatelessWidget {
  final String value;
  final String label;

  const _GlassStat({required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
          Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 11)),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final bool accent;

  const _MiniStat({required this.label, required this.value, this.accent = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: accent ? const Color(0xFF4F46E5) : Colors.black87,
          ),
        ),
        Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
      ],
    );
  }
}
