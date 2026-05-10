import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/models/part.dart';

class StockMovementSheet extends StatefulWidget {
  final Part part;
  final String movementType;
  final void Function(int newQty) onDone;

  const StockMovementSheet({
    super.key,
    required this.part,
    required this.movementType,
    required this.onDone,
  });

  @override
  State<StockMovementSheet> createState() => _StockMovementSheetState();
}

class _StockMovementSheetState extends State<StockMovementSheet> {
  final _formKey = GlobalKey<FormState>();
  final _quantityController = TextEditingController();
  final _noteController = TextEditingController();
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _quantityController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  String get _title {
    switch (widget.movementType) {
      case 'STOCK_IN': return 'รับเข้าสต็อก';
      case 'STOCK_OUT': return 'จ่ายออกสต็อก';
      case 'ADJUSTMENT': return 'ปรับปรุงสต็อก';
      default: return 'ดำเนินการ';
    }
  }

  String get _label {
    return widget.movementType == 'ADJUSTMENT' ? 'จำนวนใหม่' : 'จำนวน';
  }

  String? _validateQty(String? v) {
    if (v == null || v.isEmpty) return 'กรุณากรอกจำนวน';
    final qty = int.tryParse(v);
    if (qty == null) return 'กรุณากรอกจำนวนเต็ม';
    if (widget.movementType == 'ADJUSTMENT') {
      if (qty < 0) return 'จำนวนใหม่ต้องไม่น้อยกว่า 0';
    } else {
      if (qty < 1) return 'จำนวนต้องมากกว่า 0';
    }
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final api = context.read<ApiClient>();
      final result = await api.createMovement(
        partId: widget.part.id,
        type: widget.movementType,
        quantity: int.parse(_quantityController.text),
        note: _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
      );
      if (mounted) {
        widget.onDone(result.partQuantity);
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.movementType == 'STOCK_IN'
                  ? 'รับเข้าสต็อกเรียบร้อย'
                  : widget.movementType == 'STOCK_OUT'
                      ? 'จ่ายออกสต็อกเรียบร้อย'
                      : 'ปรับปรุงสต็อกเรียบร้อย',
            ),
            backgroundColor: Colors.green,
          ),
        );
      }
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
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 16,
        right: 16,
        top: 16,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(_title, style: Theme.of(context).textTheme.titleLarge),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${widget.part.partNumber} — ${widget.part.partName}',
              style: TextStyle(color: Colors.grey[600]),
            ),
            Text(
              'คงเหลือ: ${widget.part.quantity} ${widget.part.unit}',
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _quantityController,
              decoration: InputDecoration(
                labelText: _label,
                hintText: widget.movementType == 'ADJUSTMENT'
                    ? 'กรอกจำนวนสต็อกใหม่'
                    : 'กรอกจำนวน',
                border: const OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              validator: _validateQty,
              autofocus: true,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _noteController,
              decoration: const InputDecoration(
                labelText: 'หมายเหตุ (ถ้ามี)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('ยกเลิก'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _isLoading ? null : _submit,
                    child: _isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('บันทึก'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}