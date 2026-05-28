import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'auth/auth_store.dart';
import '../core/models/part.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/change_password_screen.dart';
import '../features/home/dashboard_screen.dart';
import '../features/parts/public_lookup_screen.dart';
import '../features/parts/part_list_screen.dart';
import '../features/parts/part_detail_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/movements/movement_list_screen.dart';
import '../features/categories/category_list_screen.dart';
import '../features/parts/part_form_screen.dart';
import '../features/admin/user_list_screen.dart';
import '../features/import/import_export_screen.dart';
import '../features/blocks/block_list_screen.dart';
import '../features/buildings/building_list_screen.dart';
import '../features/scanner/scanner_entry.dart';

class AppRouter {
  final AuthStore auth;

  AppRouter({required this.auth});

  late final GoRouter router = GoRouter(
    initialLocation: '/lookup',
    refreshListenable: auth,
    redirect: (context, state) {
      final status = auth.status;
      final loc = state.uri.path;

      if (status == AuthStatus.mustChangePassword && loc != '/change-password') {
        return '/change-password';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/lookup',
        builder: (context, state) => PublicLookupScreen(
          initialCode: state.uri.queryParameters['code'],
          autoLookup: state.uri.queryParameters['auto'] == '1',
        ),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/change-password',
        builder: (context, state) => const ChangePasswordScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return ScaffoldWithNavBar(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                builder: (context, state) => const DashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/parts',
                builder: (context, state) => const PartListScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/scan',
                builder: (context, state) => const _ScanPlaceholderScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/menu',
                builder: (context, state) => const SettingsScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/parts/new',
        builder: (context, state) => const PartFormScreen(),
      ),
      GoRoute(
        path: '/parts/:id',
        builder: (context, state) => PartDetailScreen(
          partId: state.pathParameters['id']!,
          initialPart: state.extra as Part?,
        ),
      ),
      GoRoute(
        path: '/parts/:id/edit',
        builder: (context, state) => PartFormScreen(
          part: state.extra as Part?,
        ),
      ),
      GoRoute(
        path: '/movements',
        builder: (context, state) => const MovementListScreen(),
      ),
      GoRoute(
        path: '/movements/:partId',
        builder: (context, state) => MovementListScreen(
          partId: state.pathParameters['partId'],
        ),
      ),
      GoRoute(
        path: '/categories',
        builder: (context, state) => const CategoryListScreen(),
      ),
      GoRoute(
        path: '/users',
        builder: (context, state) => const UserListScreen(),
      ),
      GoRoute(
        path: '/import-export',
        builder: (context, state) => const ImportExportScreen(),
      ),
      GoRoute(
        path: '/blocks',
        builder: (context, state) => const BlockListScreen(),
      ),
      GoRoute(
        path: '/buildings',
        builder: (context, state) => const BuildingListScreen(),
      ),
    ],
  );
}

class ScaffoldWithNavBar extends StatelessWidget {
  final StatefulNavigationShell navigationShell;

  const ScaffoldWithNavBar({
    super.key,
    required this.navigationShell,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) {
          navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          );
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'แดชบอร์ด',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: 'อะไหล่',
          ),
          NavigationDestination(
            icon: Icon(Icons.qr_code_scanner),
            selectedIcon: Icon(Icons.qr_code_scanner),
            label: 'สแกน',
          ),
          NavigationDestination(
            icon: Icon(Icons.menu_outlined),
            selectedIcon: Icon(Icons.menu),
            label: 'เมนู',
          ),
        ],
      ),
    );
  }
}

class _ScanPlaceholderScreen extends StatelessWidget {
  const _ScanPlaceholderScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('สแกน'),
        automaticallyImplyLeading: false,
      ),
      body: const _ScanTabContent(),
    );
  }
}

class _ScanTabContent extends StatefulWidget {
  const _ScanTabContent();

  @override
  State<_ScanTabContent> createState() => _ScanTabContentState();
}

class _ScanTabContentState extends State<_ScanTabContent> {
  bool _isScanning = false;

  Future<void> _scan() async {
    if (_isScanning) return;
    setState(() => _isScanning = true);
    try {
      final code = await scanCode(context);
      if (code == null || code.isEmpty) return;
      // Navigate to lookup with the scanned code, auto-search
      context.go('/lookup?code=$code&auto=1');
    } finally {
      if (mounted) setState(() => _isScanning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.qr_code_scanner,
              size: 100,
              color: Colors.indigo[300],
            ),
            const SizedBox(height: 24),
            Text(
              'สแกนบาร์โค้ด หรือ QR Code',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'กดปุ่มด้านล่างเพื่อเปิดกล้องสแกน',
              style: TextStyle(color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: FilledButton.icon(
                onPressed: _isScanning ? null : _scan,
                icon: _isScanning
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.camera_alt),
                label: Text(_isScanning ? 'กำลังเปิดสแกนเนอร์...' : 'เปิดกล้องสแกน'),
              ),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: _isScanning
                  ? null
                  : () => context.go('/lookup'),
              child: const Text('ค้นหาด้วยรหัสแทน'),
            ),
          ],
        ),
      ),
    );
  }
}
