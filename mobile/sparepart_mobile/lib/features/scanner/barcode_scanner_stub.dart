import 'package:flutter/material.dart';

class BarcodeScannerScreen extends StatelessWidget {
  const BarcodeScannerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('สแกนบาร์โค้ด / QR'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(null),
        ),
      ),
      body: const Center(
        child: Text('ไม่รองรับกล้องบนแพลตฟอร์มนี้ — กรุณากรอกรหัสเอง'),
      ),
    );
  }
}
