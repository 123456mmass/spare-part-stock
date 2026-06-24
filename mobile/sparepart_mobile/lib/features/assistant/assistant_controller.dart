import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/models/chat_message.dart';

/// State controller for the AI assistant chat screen.
///
/// Mirrors the web assistant: streaming token-by-token, shared conversation
/// history (web + mobile use the same `web:<userId>` conversations), and
/// confirm/cancel for drafted stock actions.
class AssistantController extends ChangeNotifier {
  final ApiClient api;

  AssistantController({required this.api});

  final List<ChatMessage> _messages = [];
  List<ChatMessage> get messages => List.unmodifiable(_messages);

  String? conversationId;
  bool loading = false;
  bool sending = false;
  String? error;

  /// Load conversation history (most recent conversation by default).
  Future<void> loadHistory() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final data = await api.getChatHistory(conversationId: conversationId);
      conversationId = data['conversationId'] as String?;
      final rawMessages = (data['messages'] as List?) ?? [];
      _messages
        ..clear()
        ..addAll(
          rawMessages
              .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
              .toList(),
        );
      error = null;
    } catch (e) {
      error = 'ไม่สามารถโหลดประวัติแชทได้';
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Send a text message and stream the assistant reply.
  /// [imagePaths] are local file paths shown as thumbnails on the user
  /// bubble; [attachments] is the base64 payload sent to the API.
  Future<void> send(
    String text, {
    List<String>? imagePaths,
    List<Map<String, dynamic>>? attachments,
  }) async {
    final trimmed = text.trim();
    final hasImages = attachments != null && attachments.isNotEmpty;
    if ((trimmed.isEmpty && !hasImages) || sending) return;
    final message = trimmed.isEmpty ? 'วิเคราะห์รูปนี้' : trimmed;

    _messages.add(ChatMessage(
      role: 'user',
      content: message,
      localImages: imagePaths,
    ));
    // Placeholder assistant message that we mutate as tokens stream in.
    final assistant = ChatMessage(
      role: 'assistant',
      content: '',
      streaming: true,
    );
    _messages.add(assistant);
    sending = true;
    error = null;
    notifyListeners();

    final buffer = StringBuffer();

    await api.streamChat(
      message: message,
      conversationId: conversationId,
      attachments: attachments,
      onEvent: (event, data) {
        if (event == 'status') {
          _updateLastAssistant(
            assistant,
            status: data['message'] as String?,
          );
        } else if (event == 'delta') {
          final t = data['text'] as String?;
          if (t != null && t.isNotEmpty) {
            buffer.write(t);
            _updateLastAssistant(assistant, content: buffer.toString());
          }
        } else if (event == 'done') {
          final reply = data['reply'] as String?;
          final conv = data['conversationId'] as String?;
          if (conv != null && conv.isNotEmpty) conversationId = conv;
          final pending =
              (data['pendingActionIds'] as List?)?.whereType<String>().toList();
          _updateLastAssistant(
            assistant,
            content: (reply != null && reply.isNotEmpty) ? reply : buffer.toString(),
            streaming: false,
            status: null,
            metadata: (pending != null && pending.isNotEmpty)
                ? {'pendingActionIds': pending}
                : null,
          );
        } else if (event == 'error') {
          final msg = data['message'] as String? ?? 'เกิดข้อผิดพลาด';
          _updateLastAssistant(
            assistant,
            content: msg,
            streaming: false,
            status: null,
          );
        }
      },
      onError: (msg) {
        _updateLastAssistant(
          assistant,
          content: buffer.toString().isEmpty
              ? 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่'
              : buffer.toString(),
          streaming: false,
          status: null,
        );
        error = msg;
      },
      onDone: () {
        _updateLastAssistant(assistant, streaming: false, status: null);
      },
    );

    sending = false;
    notifyListeners();
  }

  void _updateLastAssistant(
    ChatMessage target, {
    String? content,
    bool? streaming,
    String? status,
    Map<String, dynamic>? metadata,
  }) {
    final i = _messages.indexOf(target);
    if (i < 0) return;
    _messages[i] = target.copyWith(
      content: content,
      streaming: streaming,
      status: status,
      metadata: metadata,
    );
    notifyListeners();
  }

  /// Confirm a drafted stock action. Appends the result message and clears
  /// the pending-action buttons on the originating message.
  Future<void> confirmAction(String actionId, ChatMessage origin) async {
    try {
      final res = await api.confirmAction(actionId);
      _clearPending(origin);
      _messages.add(ChatMessage(
        role: 'assistant',
        content: (res['message'] as String?) ?? 'ยืนยันรายการแล้ว',
      ));
    } catch (e) {
      error = 'ไม่สามารถยืนยันรายการได้';
    }
    notifyListeners();
  }

  Future<void> cancelAction(String actionId, ChatMessage origin) async {
    try {
      final res = await api.cancelAction(actionId);
      _clearPending(origin);
      _messages.add(ChatMessage(
        role: 'assistant',
        content: (res['message'] as String?) ?? 'ยกเลิกรายการแล้ว',
      ));
    } catch (e) {
      error = 'ไม่สามารถยกเลิกรายการได้';
    }
    notifyListeners();
  }

  void _clearPending(ChatMessage origin) {
    final i = _messages.indexOf(origin);
    if (i < 0) return;
    _messages[i] = origin.copyWith(metadata: {'pendingActionIds': const []});
  }

  /// Start a fresh conversation (keeps history on the server).
  void startNewChat() {
    conversationId = null;
    _messages.clear();
    error = null;
    notifyListeners();
  }

  Future<void> clearAllHistory() async {
    try {
      await api.deleteChatHistory();
      startNewChat();
    } catch (e) {
      error = 'ไม่สามารถลบประวัติแชทได้';
      notifyListeners();
    }
  }
}
