class AppConfig {
  // For Android emulator: use 10.0.2.2 to reach host machine's localhost
  // For iOS simulator: use localhost or the actual IP
  // For real device or web: use the host machine's actual IP (e.g., http://192.168.x.x:3000)
  static const String defaultBaseUrl = 'https://spare.birdsphichitchai.dev';
  static const String defaultApiKey = 'd3dbe09f74dd9bc0cd7f3bc444d0eb4b18aeda0ea2c1c70ffe7152f114656f97';

  static String get baseUrl {
    const fromDefine = String.fromEnvironment('API_BASE_URL');
    if (fromDefine.isNotEmpty) return fromDefine;
    return defaultBaseUrl;
  }

  static String get apiKey {
    const fromDefine = String.fromEnvironment('API_KEY');
    if (fromDefine.isNotEmpty) return fromDefine;
    return defaultApiKey;
  }

  static String get mobileApiBase => '$baseUrl/api/mobile';
}
