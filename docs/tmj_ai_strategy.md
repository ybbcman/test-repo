# TMJ Digital Therapeutics AI Strategy

## Target Use Cases
- Pose and range-of-motion assessment for TMJ-related exercises (neck rotation, jaw opening, shoulder alignment).
- Real-time guidance that tells a patient how to adjust their motion to satisfy clinician-defined thresholds.
- Personalized recommendations and adherence analytics.

## Model Selection
1. **Pose Estimation Backbone**
   - Use an existing 3D human pose estimation model such as **MediaPipe Holistic**, **OpenPose with 3D lifting**, or **MoveNet** combined with depth estimation (MediaPipe and MoveNet are optimized for mobile/edge).
   - For jaw-specific tracking, augment with **Facial Landmarks** (e.g., MediaPipe Face Mesh) to capture mandibular motion and head orientation.

2. **Action Quality Assessment (AQA)**
   - Start from transformer-based sequence models (e.g., **ST-GCN**, **PoseC3D**, or **Timesformer** variants) pretrained on action recognition datasets.
   - Fine-tune on clinician-annotated TMJ therapy sessions where each sequence is labeled with success/failure and deviation metrics (angle, tempo).

3. **Voice & Text Coaching Generation**
   - Use a lightweight instruction-tuned language model (e.g., **LLaMA-3 8B Instruct** distilled or GPT-4o-mini via API) conditioned on detected errors.
   - Template-based prompts ensure consistent, medically reviewed guidance.

## Data Pipeline & Fine-tuning
1. **Data Collection**
   - Capture multi-angle videos of clinicians and sample patients performing each exercise.
   - Annotate key frames with target joint angles, repetitions, and qualitative feedback.
2. **Feature Extraction**
   - Extract pose keypoints (33 body, 468 face) and convert to joint angles/distances relevant to TMJ therapy (e.g., cervical rotation degrees, mandibular opening).
   - Normalize sequences by patient anthropometrics.
3. **Fine-tuning Strategy**
   - **Pose Model**: If base model insufficient for jaw motion, fine-tune face mesh on annotated jaw landmarks using transfer learning with low learning rate and data augmentation (lighting, occlusions).
   - **AQA Model**: Train regression/classification heads for each clinician-defined metric (e.g., rotation >= 60°). Loss combines angle deviation (MSE) + binary cross-entropy for pass/fail.
   - **Feedback Generator**: Build structured JSON output from AQA (e.g., `{ "metric": "neck_rotation", "target": 60, "actual": 45 }`) and feed into prompt templates to produce text/audio guidance. Validate outputs with clinicians.
4. **Deployment**
   - Run pose estimation on-device (Flutter app via tflite). Send anonymized keypoints to backend for AQA inference or run quantized model locally if feasible.
   - Cache clinician thresholds per exercise in backend; models fetch at runtime.

## Evaluation
- **Clinical Accuracy**: Compare AI measurements to clinician goniometer readings.
- **Patient Adherence**: Track completion rate, improvement trend.
- **Safety Checks**: Rule-based overrides for dangerous ranges, escalate to clinician when repeated failures occur.

## Privacy & Security
- Store videos securely (HIPAA/PHIPA compliance). Use signed URLs for playback.
- Process sensitive frames on-device where possible; encrypt transmissions (TLS) and at rest.

