class AppConfig {
  // For Android emulator: use 10.0.2.2 to reach host machine's localhost
  // For iOS simulator: use localhost or the actual IP
  // For real device or web: use the host machine's actual IP (e.g., http://192.168.x.x:3000)
  static const String defaultBaseUrl = 'https://spare.birdsphichitchai.dev';
  // API key must be injected at build time via --dart-define=API_KEY=...
  // Never hardcode production secrets in source code.
  static String get baseUrl {
    const fromDefine = String.fromEnvironment('API_BASE_URL');
    if (fromDefine.isNotEmpty) return fromDefine;
    return defaultBaseUrl;
  }

  static String get apiKey {
    const fromDefine = String.fromEnvironment('API_KEY');
    if (fromDefine.isNotEmpty) return fromDefine;
    throw Exception(
      'API_KEY is not set. Pass it via --dart-define=API_KEY=your-key-here '
      'when building for release.'
    );
  }

  static String get mobileApiBase => '$baseUrl/api/mobile';
}
