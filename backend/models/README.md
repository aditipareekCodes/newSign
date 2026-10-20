# SignVaani ISL Model Weights Directory

Place trained classification model artifacts in this directory.

Supported formats detected by `backend/app/routers/recognition.py`:
- `isl_classifier.onnx` (Loaded via `onnxruntime`)
- `isl_classifier.joblib` (Loaded via `scikit-learn` / `joblib`)
- `isl_classifier.tflite` (Loaded via TensorFlow Lite runtime)
- `isl_classifier.keras` (Loaded via Keras / TensorFlow)

Expected input:
- 63-dimensional normalized landmark feature vector (21 3D hand keypoints from MediaPipe Tasks Vision, wrist-centered at index 0 and scaled by palm reference length).

Supported classes (12 canonical words):
- `I`, `NEED`, `WATER`, `HELP`, `FAMILY`, `THANK`, `YOU`, `HOME`, `MEDICAL`, `PLEASE`, `FOOD`, `PAIN`

When no weight file is present, SignVaani honestly reports that live MediaPipe 21 3D hand landmark tracking is active while neural classification weights are not loaded.
