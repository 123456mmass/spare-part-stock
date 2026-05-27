import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ImageSearchResultsScreen extends StatelessWidget {
  final List<Map<String, dynamic>> matches;
  final String? queryImagePath;

  const ImageSearchResultsScreen({super.key, required this.matches, this.queryImagePath});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('ผลการค้นหาด้วยรูป'),
      ),
      body: Column(
        children: [
          if (queryImagePath != null)
            Container(
              padding: const EdgeInsets.all(12),
              color: Colors.grey[100],
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.file(
                      File(queryImagePath!),
                      width: 72,
                      height: 72,
                      fit: BoxFit.cover,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('รูปที่ค้นหา', style: TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text(
                          matches.isEmpty
                              ? 'ไม่พบอะไหล่ที่ตรง'
                              : 'พบ ${matches.length} รายการที่ใกล้เคียง',
                          style: TextStyle(color: Colors.grey[700], fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          Expanded(
            child: matches.isEmpty
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.image_not_supported, size: 64, color: Colors.grey),
                          SizedBox(height: 16),
                          Text('ไม่พบอะไหล่ที่ตรง', style: TextStyle(fontSize: 16)),
                          SizedBox(height: 4),
                          Text('ลองถ่ายมุมอื่นหรือใกล้ขึ้น', style: TextStyle(color: Colors.grey)),
                        ],
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: matches.length,
                    itemBuilder: (context, index) {
                      final m = matches[index];
                      final part = (m['part'] as Map<String, dynamic>);
                      final similarity = (m['similarity'] as num).toDouble();
                      final partId = part['id'] as String;
                      final imageUrl = part['imageUrl'] as String?;
                      final partName = part['partName'] as String? ?? '';
                      final partNumber = part['partNumber'] as String? ?? '';
                      final quantity = part['quantity'];
                      final unit = part['unit'] as String? ?? 'pcs';
                      final location = part['location'] as String?;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: InkWell(
                          onTap: () {
                            Navigator.of(context).pop();
                            context.push('/parts/$partId');
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                Container(
                                  width: 64,
                                  height: 64,
                                  decoration: BoxDecoration(
                                    color: Colors.grey[100],
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: imageUrl != null
                                      ? ClipRRect(
                                          borderRadius: BorderRadius.circular(8),
                                          child: Image.network(
                                            imageUrl,
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, __, ___) => const Icon(Icons.inventory_2, color: Colors.grey),
                                          ),
                                        )
                                      : const Icon(Icons.inventory_2, color: Colors.grey),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(partName, style: const TextStyle(fontWeight: FontWeight.bold), maxLines: 2, overflow: TextOverflow.ellipsis),
                                      Text(partNumber, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                                      Text('คงเหลือ $quantity $unit', style: TextStyle(color: Colors.grey[700], fontSize: 12)),
                                      if (location != null && location.isNotEmpty)
                                        Text('ตำแหน่ง: $location', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      '${(similarity * 100).round()}%',
                                      style: const TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.blue,
                                      ),
                                    ),
                                    const Text('ใกล้เคียง', style: TextStyle(fontSize: 11, color: Colors.grey)),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
