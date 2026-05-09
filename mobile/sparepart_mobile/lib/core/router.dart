import 'package:go_router/go_router.dart';
import 'auth/auth_store.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/change_password_screen.dart';
import '../features/home/home_screen.dart';
import '../features/parts/public_lookup_screen.dart';
import '../features/parts/part_list_screen.dart';

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
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/parts',
        builder: (context, state) => const PartListScreen(),
      ),
    ],
  );
}