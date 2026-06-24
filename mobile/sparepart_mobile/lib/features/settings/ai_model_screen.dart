import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';

/// AI model selection screen — mirrors the web admin AI-model settings:
/// pick the main (text/tool) model and the vision model independently.
class AiModelScreen extends StatefulWidget {
  const AiModelScreen({super.key});

  @override
  State<AiModelScreen> createState() => _AiModelState();
}

class _AiModelState extends State<AiModelScreen> {
  bool _loading = true;
  bool _saving = false;
  String? _error;

  String? _currentModel;
  String? _currentVisionModel;
  List<String> _available = const [];
  Map<String, dynamic> _capabilities = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final data = await api.getAiModel();
      setState(() {
        _currentModel = data['currentModel'] as String?;
        _currentVisionModel = data['currentVisionModel'] as String?;
        _available = ((data['availableModels'] as List?) ?? [])
            .whereType<String>()
            .toList();
        _capabilities = (data['capabilities'] as Map<String, dynamic>?) ??
            const {};
      });
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'เกิดข้อผิดพลาด');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save({String? model, String? visionModel}) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final res = await api.setAiModel(model: model, visionModel: visionModel);
      if (model != null) _currentModel = model;
      if (visionModel != null) _currentVisionModel = visionModel;
      final avail =
          ((res['availableModels'] as List?) ?? []).whereType<String>().toList();
      if (avail.isNotEmpty) _available = avail;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] as String? ?? 'บันทึกสำเร็จ')),
        );
      }
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'เกิดข้อผิดพลาด');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('โมเดล AI')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 12),
                      FilledButton(onPressed: _load, child: const Text('ลองใหม่')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _sectionLabel('โมเดลหลัก (ข้อความ / Tool)'),
                      const SizedBox(height: 8),
                      _modelDropdown(
                        value: _currentModel,
                        onChanged: _saving
                            ? null
                            : (v) {
                                if (v != null && v != _currentModel) {
                                  _save(model: v);
                                }
                              },
                      ),
                      if (_currentModel != null) ...[
                        const SizedBox(height: 8),
                        _capabilityBadges(_currentModel!),
                      ],
                      const SizedBox(height: 24),
                      _sectionLabel('โมเดล Vision (วิเคราะห์รูป)'),
                      const SizedBox(height: 8),
                      _modelDropdown(
                        value: _currentVisionModel,
                        onChanged: _saving
                            ? null
                            : (v) {
                                if (v != null && v != _currentVisionModel) {
                                  _save(visionModel: v);
                                }
                              },
                      ),
                      if (_currentVisionModel != null) ...[
                        const SizedBox(height: 8),
                        _capabilityBadges(_currentVisionModel!),
                      ],
                      const SizedBox(height: 24),
                      const Card(
                        child: Padding(
                          padding: EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Icon(Icons.info_outline, size: 18),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Vision model ใช้ตอนอัปโหลดรูป/วิเคราะห์รูป ควรเลือกโมเดลที่รองรับรูป (Vision)',
                                  style: TextStyle(fontSize: 12, color: Colors.grey),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
    );
  }

  Widget _modelDropdown({
    required String? value,
    required ValueChanged<String?>? onChanged,
  }) {
    final items = _available.map((id) {
      return DropdownMenuItem<String>(
        value: id,
        child: Text(_displayName(id)),
      );
    }).toList();
    // Ensure current value is selectable even if not in the list.
    if (value != null && items.every((e) => e.value != value)) {
      items.insert(
        0,
        DropdownMenuItem<String>(value: value, child: Text(_displayName(value))),
      );
    }
    return DropdownButtonFormField<String>(
      value: value,
      items: items,
      onChanged: onChanged,
      decoration: const InputDecoration(
        border: OutlineInputBorder(),
        isDense: true,
      ),
    );
  }

  String _displayName(String id) {
    final c = _capabilities[id] as Map<String, dynamic>?;
    final name = c?['displayName'] as String?;
    return (name != null && name.isNotEmpty) ? '$name' : id;
  }

  Widget _capabilityBadges(String id) {
    final c = _capabilities[id] as Map<String, dynamic>?;
    if (c == null) return const SizedBox.shrink();
    final chips = <Widget>[];
    final vision = c['supportsVision'] == true;
    final tools = c['supportsTools'] == true;
    final thinking = c['hasThinking'] == true;
    chips.add(_badge(
      vision ? 'รองรับรูป' : 'ไม่รองรับรูป',
      vision ? Colors.green : Colors.grey,
    ));
    chips.add(_badge(
      tools ? 'เรียก Tool ได้' : 'Tool ไม่ได้',
      tools ? Colors.indigo : Colors.grey,
    ));
    if (thinking) chips.add(_badge('Reasoning', Colors.amber.shade700));
    return Wrap(spacing: 6, runSpacing: 6, children: chips);
  }

  Widget _badge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}
