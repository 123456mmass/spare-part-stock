import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'manual_code_dialog.dart';
import 'barcode_scanner_stub.dart'
    if (dart.library.io) 'barcode_scanner_screen_native.dart';

Future<String?> scanCode(BuildContext context) async {
  final isMobile = !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.android);

  if (isMobile) {
    final result = await Navigator.of(context).push<String?>(
      MaterialPageRoute(
        builder: (_) => const BarcodeScannerScreen(),
      ),
    );
    if (result != null && result.isNotEmpty) return result;
    return null;
  }

  return showManualCodeDialog(context);
}
