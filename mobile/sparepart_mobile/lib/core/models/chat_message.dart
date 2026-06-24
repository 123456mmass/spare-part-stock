/// Chat message model shared by the assistant feature.
///
/// Mirrors the shape returned by `/api/mobile/ai/chat/history` and the
/// `done` SSE event from `/api/mobile/ai/chat/stream`.
class ChatMessage {
  final String? id;
  final String role; // "user" | "assistant"
  final String content;
  final Map<String, dynamic>? metadata;
  final DateTime? createdAt;

  /// Transient: true while the assistant reply is still streaming.
  final bool streaming;

  /// Transient: optional status line shown while tools run ("กำลังค้นข้อมูล...").
  final String? status;

  /// Transient: local file paths of images attached to this user message
  /// (for thumbnail display only — not persisted by the server).
  final List<String>? localImages;

  ChatMessage({
    this.id,
    required this.role,
    required this.content,
    this.metadata,
    this.createdAt,
    this.streaming = false,
    this.status,
    this.localImages,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> j) {
    return ChatMessage(
      id: j['id'] as String?,
      role: (j['role'] as String?) ?? 'assistant',
      content: (j['content'] as String?) ?? '',
      metadata: j['metadata'] as Map<String, dynamic>?,
      createdAt: j['createdAt'] != null
          ? DateTime.tryParse(j['createdAt'] as String)
          : null,
      streaming: false,
    );
  }

  ChatMessage copyWith({
    String? id,
    String? role,
    String? content,
    Map<String, dynamic>? metadata,
    DateTime? createdAt,
    bool? streaming,
    String? status,
    List<String>? localImages,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      role: role ?? this.role,
      content: content ?? this.content,
      metadata: metadata ?? this.metadata,
      createdAt: createdAt ?? this.createdAt,
      streaming: streaming ?? this.streaming,
      status: status ?? this.status,
      localImages: localImages ?? this.localImages,
    );
  }

  bool get isUser => role == 'user';

  /// Pending action ids attached to this assistant message (from metadata).
  /// The history route already filters these to only active PENDING actions.
  List<String> get pendingActionIds {
    final m = metadata;
    if (m == null) return const [];
    final raw = m['pendingActionIds'];
    if (raw is List) {
      return raw.whereType<String>().toList();
    }
    return const [];
  }

  bool get hasPendingAction => pendingActionIds.isNotEmpty;
}
