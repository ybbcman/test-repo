# Clinician Guidance Workflow

This note outlines how clinicians author measurement thresholds and how the AI
engine transforms deviations into multimodal feedback.

## Authoring Experience
1. Clinician records or uploads a reference video per step.
2. For each step they select the target body region (neck rotation, jaw opening,
   shoulder drop) and define:
   - **Metric definition** (e.g., `neck_rotation_left`).
   - **Comparator** (`>=`, `<=`, `between`).
   - **Target values** (degrees, millimeters, seconds).
   - **Coaching prompt**: plain-language tip that will be surfaced verbatim to the
     patient alongside AI-generated hints.
3. Optional AI assist: the portal can propose threshold values by running pose
   estimation on the clinician video and suggesting typical ranges.

## Runtime Evaluation
1. The mobile app streams pose keypoints + facial landmarks to a local inference
   module (TensorFlow Lite). The module computes metrics, for example:
   ```json
   {
     "metric": "neck_rotation_left",
     "actual_value": 48.2,
     "unit": "deg"
   }
   ```
2. These metrics are POSTed to the backend with the prescription identifier. The
   backend compares each measurement with the stored thresholds and emits a
   structured deviation report.
3. The `/ai/coach` endpoint assembles deviations into a prompt template:
   ```json
   {
     "patient_state": [
       {
         "metric": "neck_rotation_left",
         "target": 60,
         "actual": 48.2,
         "coaching_prompt": "얼굴을 왼쪽으로 더 돌려주세요."
       }
     ],
     "language": "ko-KR",
     "audio": true
   }
   ```
4. A language model fills in empathetic instructions (e.g., "얼굴을 왼쪽으로 10도만
   더 돌려주시면 목표에 도달합니다"), while a TTS service converts the message into
   speech. The app plays the audio and displays the text.

## Closing the Loop
- When the patient meets the target for the required repetitions, the app marks
  the attempt successful and sends a progress event with aggregated stats.
- Clinicians view adherence trends (success/attempts) on the portal and can adjust
  thresholds or prescribe avatar variants if the patient struggles with the
  original instructions.
