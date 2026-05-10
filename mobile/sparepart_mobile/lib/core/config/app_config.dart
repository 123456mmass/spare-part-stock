class AppConfig {
  // For Android emulator: use 10.0.2.2 to reach host machine's localhost
  // For iOS simulator: use localhost or the actual IP
  // For real device or web: use the host machine's actual IP (e.g., http://192.168.x.x:3000)
  static const String defaultBaseUrl = 'https://spare.birdsphichitchai.dev';
  static const String defaultApiKey = '20557da01a920d06d2d64f880d888746abdea9a0c428f6487f114efb2e9b88ac';

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
