import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class BarcodeScannerScreen extends StatefulWidget {
  const BarcodeScannerScreen({super.key});

  @override
  State<BarcodeScannerScreen> createState() => _BarcodeScannerScreenState();
}

class _BarcodeScannerScreenState extends State<BarcodeScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    autoStart: false,
  );
  StreamSubscription<BarcodeCapture>? _subscription;
  bool _hasScanned = false;

  @override
  void initState() {
    super.initState();
    _subscription = _controller.barcodes.listen(_onBarcode);
    unawaited(_controller.start());
  }

  void _onBarcode(BarcodeCapture capture) {
    if (_hasScanned) return;
    final barcode = capture.barcodes.firstOrNull;
    final raw = barcode?.rawValue;
    if (raw == null || raw.isEmpty) return;
    _hasScanned = true;
    unawaited(_subscription?.cancel());
    _subscription = null;
    unawaited(_controller.stop());
    Navigator.of(context).pop(raw);
  }

  @override
  Future<void> dispose() async {
    unawaited(_subscription?.cancel());
    _subscription = null;
    super.dispose();
    await _controller.dispose();
  }

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
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: null,
          ),
          Positioned(
            bottom: 24,
            left: 16,
            right: 16,
            child: FilledButton.tonal(
              onPressed: () => Navigator.of(context).pop(null),
              child: const Text('กรอกรหัสเอง'),
            ),
          ),
        ],
      ),
    );
  }
}
