import 'package:flutter_test/flutter_test.dart';

import 'package:sparepart_mobile/main.dart';

void main() {
  testWidgets('App boots', (WidgetTester tester) async {
    await tester.pumpWidget(const SparePartApp());
    await tester.pump();
    // Just verify the app builds without crashing
    expect(find.byType(SparePartApp), findsOneWidget);
  });
}