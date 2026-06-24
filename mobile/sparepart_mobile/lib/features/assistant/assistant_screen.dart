import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/models/chat_message.dart';
import 'assistant_controller.dart';

class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key});

  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  late final AssistantController _controller;
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  final ImagePicker _imagePicker = ImagePicker();
  final List<XFile> _pendingImages = [];
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _controller = AssistantController(api: context.read<ApiClient>());
    _controller.addListener(_onChange);
    WidgetsBinding.instance.addPostFrameCallback((_) => _controller.loadHistory());
  }

  @override
  void dispose() {
    _controller.removeListener(_onChange);
    _controller.dispose();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onChange() {
    if (mounted) setState(() {});
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _send() async {
    final text = _input.text;
    final hasImages = _pendingImages.isNotEmpty;
    if (text.trim().isEmpty && !hasImages) return;

    List<Map<String, dynamic>>? attachments;
    List<String>? imagePaths;
    if (hasImages) {
      attachments = await _buildAttachments();
      if (attachments == null) return;
      imagePaths = _pendingImages.map((f) => f.path).toList();
    }

    _input.clear();
    _pendingImages.clear();
    setState(() => _sending = true);
    try {
      await _controller.send(
        text,
        imagePaths: imagePaths,
        attachments: attachments,
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<List<Map<String, dynamic>>?> _buildAttachments() async {
    final out = <Map<String, dynamic>>[];
    try {
      for (final f in _pendingImages) {
        final bytes = await f.readAsBytes();
        final b64 = base64Encode(bytes);
        final name = f.name.toLowerCase();
        final mediaType = name.endsWith('.png')
            ? 'image/png'
            : name.endsWith('.webp')
                ? 'image/webp'
                : name.endsWith('.gif')
                    ? 'image/gif'
                    : 'image/jpeg';
        out.add({
          'type': 'image',
          'imageBase64': b64,
          'mediaType': mediaType,
        });
      }
      return out;
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('อ่านไฟล์รูปไม่ได้')),
        );
      }
      return null;
    }
  }

  Future<void> _pickImage() async {
    final source = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('ถ่ายรูป'),
              onTap: () => Navigator.pop(ctx, 'camera'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('เลือกจากแกลเลอรี'),
              onTap: () => Navigator.pop(ctx, 'gallery'),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    if (_pendingImages.length >= 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('แนบรูปได้สูงสุด 3 รูป')),
      );
      return;
    }
    final picked = await _imagePicker.pickImage(
      source: source == 'camera' ? ImageSource.camera : ImageSource.gallery,
      maxWidth: 1200,
      maxHeight: 1200,
      imageQuality: 85,
    );
    if (picked == null) return;
    setState(() => _pendingImages.add(picked));
  }

  @override
  Widget build(BuildContext context) {
    final msgs = _controller.messages;
    return Scaffold(
      appBar: AppBar(
        title: const Text('ผู้ช่วย AI'),
        actions: [
          IconButton(
            tooltip: 'แชตใหม่',
            icon: const Icon(Icons.add_comment_outlined),
            onPressed: _controller.sending ? null : _controller.startNewChat,
          ),
          PopupMenuButton<String>(
            onSelected: (v) async {
              if (v == 'clear') {
                final ok = await _confirmClear();
                if (ok == true) await _controller.clearAllHistory();
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'clear', child: Text('ล้างประวัติแชท')),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _controller.loading
                ? const Center(child: CircularProgressIndicator())
                : msgs.isEmpty
                    ? _emptyState()
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 16),
                        itemCount: msgs.length,
                        itemBuilder: (_, i) => _messageBubble(msgs[i]),
                      ),
          ),
          if (_controller.error != null)
            Container(
              width: double.infinity,
              color: Colors.red.shade50,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Text(
                _controller.error!,
                style: TextStyle(color: Colors.red.shade800, fontSize: 12),
              ),
            ),
          _inputBar(),
        ],
      ),
    );
  }

  Widget _emptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.smart_toy_outlined,
              size: 72, color: Colors.indigo.shade200),
          const SizedBox(height: 16),
          Text(
            'ถามอะไรเกี่ยวกับสต็อกก็ได้',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 4),
          const Text(
            'เช่น "สรุปสต็อก", "มี bearing ไหม", "เบิก หลอดไฟ 2 ตัว"',
            style: TextStyle(color: Colors.grey),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _messageBubble(ChatMessage m) {
    final isUser = m.isUser;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
        margin: const EdgeInsets.symmetric(vertical: 5),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          color: isUser
              ? Colors.indigo.shade500
              : Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(14),
            topRight: const Radius.circular(14),
            bottomLeft: Radius.circular(isUser ? 14 : 4),
            bottomRight: Radius.circular(isUser ? 4 : 14),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (m.isUser &&
                m.localImages != null &&
                m.localImages!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: m.localImages!
                      .map((p) => ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.file(File(p),
                                width: 72, height: 72, fit: BoxFit.cover),
                          ))
                      .toList(),
                ),
              ),
            if (m.content.isEmpty && m.streaming)
              _streamingRow(m.status)
            else
              _content(m),
            if (m.hasPendingAction) ...[
              const SizedBox(height: 8),
              _actionButtons(m),
            ],
          ],
        ),
      ),
    );
  }

  Widget _streamingRow(String? status) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (status != null)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Text(status,
                style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ),
        const SizedBox(
          width: 14,
          height: 14,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ],
    );
  }

  Widget _content(ChatMessage m) {
    return RichText(
      text: TextSpan(
        style: TextStyle(
          color: m.isUser ? Colors.white : Colors.black87,
          fontSize: 14.5,
          height: 1.35,
        ),
        children: [
          TextSpan(text: m.content),
          if (m.streaming)
            const TextSpan(text: '▍', style: TextStyle(fontSize: 12)),
        ],
      ),
    );
  }

  Widget _actionButtons(ChatMessage m) {
    return Wrap(
      spacing: 8,
      children: [
        FilledButton.icon(
          onPressed: _controller.sending
              ? null
              : () => _controller.confirmAction(m.pendingActionIds.first, m),
          icon: const Icon(Icons.check, size: 18),
          label: const Text('ยืนยัน'),
          style: FilledButton.styleFrom(
            backgroundColor: Colors.green,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
          ),
        ),
        OutlinedButton.icon(
          onPressed: _controller.sending
              ? null
              : () => _controller.cancelAction(m.pendingActionIds.first, m),
          icon: const Icon(Icons.close, size: 18),
          label: const Text('ยกเลิก'),
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.red,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
          ),
        ),
      ],
    );
  }

  Widget _inputBar() {
    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_pendingImages.isNotEmpty)
            SizedBox(
              height: 76,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(10, 6, 10, 0),
                scrollDirection: Axis.horizontal,
                itemCount: _pendingImages.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  return Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(
                          File(_pendingImages[i].path),
                          width: 64,
                          height: 64,
                          fit: BoxFit.cover,
                        ),
                      ),
                      Positioned(
                        right: -2,
                        top: -2,
                        child: GestureDetector(
                          onTap: () =>
                              setState(() => _pendingImages.removeAt(i)),
                          child: Container(
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.close,
                                size: 16, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(6, 6, 6, 6),
            child: Row(
              children: [
                IconButton(
                  onPressed: _sending ? null : _pickImage,
                  icon: const Icon(Icons.image_outlined),
                  tooltip: 'แนบรูป',
                ),
                Expanded(
                  child: TextField(
                    controller: _input,
                    minLines: 1,
                    maxLines: 5,
                    textInputAction: TextInputAction.send,
                    decoration: InputDecoration(
                      hintText: 'ถามอะไรเกี่ยวกับสต็อกก็ได้',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                      isDense: true,
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 6),
                IconButton.filled(
                  onPressed: _sending ? null : _send,
                  icon: _sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.send),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<bool?> _confirmClear() {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ล้างประวัติแชท'),
        content: const Text('จะลบประวัติแชททั้งหมด ไม่สามารถกู้คืนได้'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('ยกเลิก')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('ลบ')),
        ],
      ),
    );
  }
}
