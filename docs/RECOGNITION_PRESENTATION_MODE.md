# Recognition presentation mode

SignVaani's current landmark classifier has not been validated on real webcam
performances. Use demo/manual mode for the presentation to prevent its automatic
labels from being added, translated, or spoken as if they were verified.

## Switch modes

On the Live Sign Recognition screen, use the **Demo/manual mode** button:

- **ON** (the safe default): MediaPipe hand tracking continues, but classification
  requests are not made. Use **Choose Word** to add supported vocabulary manually.
- **OFF**: experimental automatic predictions are enabled. They may be incorrect;
  model scores are not a guarantee of recognition accuracy.

The selection is saved in this browser. To set it before opening/reloading the
app, run this in the browser developer console:

```js
localStorage.setItem("signvaani.recognition.mode", "manual");
location.reload();
```

To restore automatic prediction mode:

```js
localStorage.setItem("signvaani.recognition.mode", "automatic");
location.reload();
```

The screen button can switch modes again at any time. If browser storage is
unavailable, the current screen still switches mode, but the selection will not
persist after leaving it.

## Normal-mode safeguards and diagnostics

The backend keeps geometric rules diagnostic-only; they cannot veto or replace
the raw model output. It abstains for classes absent from the loaded model and
for outputs below the provisional 50% display threshold. That threshold is a
guardrail, not evidence of accuracy. The frontend additionally requires three
matching predictions within a four-response window before accepting a word.
These provisional settings have not been calibrated on independent webcam data.

All classes declared by the loaded model, including HELLO, are exposed
consistently as model-declared classes, but every class remains explicitly
unvalidated. This is separate from the 12-word manual vocabulary.

Detailed prediction probabilities and geometry diagnostics are returned only
when `SIGNVAANI_RECOGNITION_DIAGNOSTICS=true` is set in the local backend
environment. Unset it outside local development. The frontend prints available
diagnostics only in Vite development mode. Scores are not calibrated or
validated accuracy metrics.

These safeguards do not validate or improve the underlying classifier. Do not
describe recognition as reliable until it has been tested with correctly
labelled, independent webcam performances.
