import 'dart:async';

import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

/// Entry point of the TMJ patient companion application.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final cameras = await availableCameras();
  final primaryCamera = cameras.isNotEmpty ? cameras.first : null;

  runApp(TmjPatientApp(primaryCamera: primaryCamera));
}

class TmjPatientApp extends StatelessWidget {
  const TmjPatientApp({super.key, required this.primaryCamera});

  final CameraDescription? primaryCamera;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TMJ Therapy Coach',
      theme: ThemeData(primarySwatch: Colors.indigo),
      home: DashboardScreen(primaryCamera: primaryCamera),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.primaryCamera});

  final CameraDescription? primaryCamera;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<List<PrescriptionSummary>> _prescriptionsFuture;

  @override
  void initState() {
    super.initState();
    _prescriptionsFuture = fetchPrescriptions();
  }

  Future<List<PrescriptionSummary>> fetchPrescriptions() async {
    final response = await http.get(Uri.parse('http://localhost:8000/patients/123456-1234567/progress'));
    if (response.statusCode != 200) {
      throw Exception('Failed to load prescriptions');
    }

    final data = jsonDecode(response.body) as List<dynamic>;
    // In a real build, the backend would return aggregated data. Here we fake it.
    final summaries = <String, PrescriptionSummary>{};
    for (final item in data) {
      final exerciseId = item['exercise_id'] as String;
      final success = item['success'] as bool;
      final summary = summaries.putIfAbsent(
        exerciseId,
        () => PrescriptionSummary(
          exerciseId: exerciseId,
          completed: 0,
          target: 10,
          displayName: 'Exercise $exerciseId',
        ),
      );
      if (success) summary.completed += 1;
    }
    return summaries.values.toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('나의 TMJ 처방')),
      body: FutureBuilder<List<PrescriptionSummary>>(
        future: _prescriptionsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('오류: ${snapshot.error}'));
          }
          final prescriptions = snapshot.data ?? [];
          return ListView.builder(
            itemCount: prescriptions.length,
            itemBuilder: (context, index) {
              final item = prescriptions[index];
              return ListTile(
                title: Text(item.displayName),
                subtitle: Text('진행도 ${item.completed}/${item.target}'),
                trailing: const Icon(Icons.play_arrow),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => GuidanceScreen(
                        prescription: item,
                        camera: widget.primaryCamera,
                      ),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}

class PrescriptionSummary {
  PrescriptionSummary({
    required this.exerciseId,
    required this.completed,
    required this.target,
    required this.displayName,
  });

  final String exerciseId;
  int completed;
  final int target;
  final String displayName;
}

class GuidanceScreen extends StatefulWidget {
  const GuidanceScreen({super.key, required this.prescription, required this.camera});

  final PrescriptionSummary prescription;
  final CameraDescription? camera;

  @override
  State<GuidanceScreen> createState() => _GuidanceScreenState();
}

class _GuidanceScreenState extends State<GuidanceScreen> {
  CameraController? controller;
  StreamSubscription<CoachingFeedback>? feedbackSubscription;
  List<CoachingMessage> feedbackMessages = [];
  bool isPerforming = false;

  @override
  void initState() {
    super.initState();
    if (widget.camera != null) {
      controller = CameraController(widget.camera!, ResolutionPreset.medium);
      controller!.initialize().then((_) => setState(() {}));
    }
  }

  @override
  void dispose() {
    feedbackSubscription?.cancel();
    controller?.dispose();
    super.dispose();
  }

  Future<void> startExercise() async {
    setState(() {
      isPerforming = true;
      feedbackMessages = [];
    });

    // Placeholder: in production we would stream pose keypoints from the camera
    // to a local model, then POST metrics to the backend for evaluation.
    feedbackSubscription = simulateCoachingStream(widget.prescription.exerciseId).listen((feedback) {
      setState(() {
        feedbackMessages.addAll(feedback.messages);
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.prescription.displayName)),
      body: Column(
        children: [
          if (controller != null && controller!.value.isInitialized)
            AspectRatio(
              aspectRatio: controller!.value.aspectRatio,
              child: CameraPreview(controller!),
            )
          else
            Container(
              height: 240,
              color: Colors.black12,
              alignment: Alignment.center,
              child: const Text('카메라 준비 중'),
            ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: ElevatedButton.icon(
              onPressed: isPerforming ? null : startExercise,
              icon: const Icon(Icons.play_circle),
              label: const Text('운동 시작'),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: feedbackMessages.length,
              itemBuilder: (context, index) {
                final message = feedbackMessages[index];
                return ListTile(
                  leading: Icon(
                    message.type == CoachingMessageType.success
                        ? Icons.check_circle
                        : Icons.warning,
                    color: message.type == CoachingMessageType.success
                        ? Colors.green
                        : Colors.orange,
                  ),
                  title: Text(message.text),
                  subtitle: Text(message.hint ?? ''),
                );
              },
            ),
          )
        ],
      ),
    );
  }
}

enum CoachingMessageType { success, warning }

class CoachingMessage {
  CoachingMessage({required this.text, this.hint, this.type = CoachingMessageType.warning});

  final String text;
  final String? hint;
  final CoachingMessageType type;
}

class CoachingFeedback {
  CoachingFeedback({required this.messages});

  final List<CoachingMessage> messages;
}

Stream<CoachingFeedback> simulateCoachingStream(String exerciseId) async* {
  await Future<void>.delayed(const Duration(seconds: 1));
  yield CoachingFeedback(messages: [
    CoachingMessage(
      text: '얼굴이 목표 각도에 도달하지 못했습니다.',
      hint: '왼쪽으로 10도만 더 돌려주세요.',
    ),
  ]);
  await Future<void>.delayed(const Duration(seconds: 2));
  yield CoachingFeedback(messages: [
    CoachingMessage(
      text: '좋아요! 기준을 충족했습니다.',
      type: CoachingMessageType.success,
    ),
  ]);
}
