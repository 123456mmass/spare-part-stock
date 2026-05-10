import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/api/api_client.dart';
import 'core/auth/auth_store.dart';
import 'core/router.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SparePartApp());
}

class SparePartApp extends StatefulWidget {
  const SparePartApp({super.key});

  @override
  State<SparePartApp> createState() => _SparePartAppState();
}

class _SparePartAppState extends State<SparePartApp> {
  late final ApiClient _api;
  late final AuthStore _authStore;
  late final AppRouter _appRouter;
  bool _booted = false;

  @override
  void initState() {
    super.initState();
    _api = ApiClient();
    _authStore = AuthStore(api: _api);
    _appRouter = AppRouter(auth: _authStore);
    _boot();
  }

  Future<void> _boot() async {
    await _authStore.boot();
    if (mounted) setState(() => _booted = true);
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: _api),
        ChangeNotifierProvider<AuthStore>.value(value: _authStore),
      ],
      child: MaterialApp.router(
        title: 'SparePart',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
          useMaterial3: true,
          inputDecorationTheme: const InputDecorationTheme(
            border: OutlineInputBorder(),
            isDense: true,
          ),
        ),
        routerConfig: _appRouter.router,
        builder: (context, child) {
          if (!_booted) {
            return const Scaffold(
              body: Center(
                child: CircularProgressIndicator(),
              ),
            );
          }
          return child!;
        },
      ),
    );
  }
}