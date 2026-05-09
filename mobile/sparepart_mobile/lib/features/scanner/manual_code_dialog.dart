import 'package:flutter/material.dart';

Future<String?> showManualCodeDialog(BuildContext context) {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('กรอกรหัสเอง'),
      content: TextField(
        controller: controller,
        decoration: const InputDecoration(
          hintText: 'รหัสอะไหล่ / บาร์โค้ด / QR',
          border: OutlineInputBorder(),
          isDense: true,
        ),
        autofocus: true,
        textInputAction: TextInputAction.search,
        onSubmitted: (value) => Navigator.of(context).pop(value.trim()),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(null),
          child: const Text('ยกเลิก'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(controller.text.trim()),
          child: const Text('ค้นหา'),
        ),
      ],
    ),
  );
}
