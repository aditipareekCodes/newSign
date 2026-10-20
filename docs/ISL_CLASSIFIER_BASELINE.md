# ISL classifier baseline: evaluation blocked

## Decision

No classifier was trained and no model or label mapping was saved. The existing pilot is not sufficient for a defensible held-out evaluation: it has only 52 accepted images from four classes, no signer/source identifiers suitable for grouping, and its recorded split contains no validation examples. A random image split would risk leakage and would not establish performance on an unseen signer.

The pilot output remains under `generated/isl_pilot/`; it is not connected to production recognition.

## Files and metadata verified

The pilot manifest at `generated/isl_pilot/metadata.json` reports:

| Class | Accepted feature files | Manifest count |
|---|---:|---:|
| YOU | 15 | 15 |
| HELP | 10 | 10 |
| WATER | 12 | 12 |
| FOOD | 15 | 15 |
| **Total** | **52** | **52** |

All 52 expected `.npy` files exist in their class directories. Each loaded array has shape `(63,)`, dtype `float32`, and finite values. The manifest lists 52 distinct archive image paths. Their SHA-256 hashes are all unique, so no byte-identical files were found among these accepted samples.

There are also 28 rejected candidates from the 80 images attempted (up to 20 per class): 22 with multiple detected hands and 6 with no hand detected. Those counts match the manifest.

The archive’s `ISL_CSLRT_Corpus_word_details.xlsx` was read from inside the ZIP. Its `export_dataframe` sheet has the columns `Word` and `Frames path`, with no signer or session column. It confirms the exact counts and example paths below:

| Exact word-level label | Archive images | SignVaani label status |
|---|---:|---|
| YOU | 110 | Exact match |
| HELP | 26 | Exact match |
| WATER | 21 | Exact match |
| FOOD | 23 | Exact match |
| THANK | 14 | Exact match |
| PLEASE | 2 | Exact match, too sparse for this pilot |
| I_ME_MINE_MY | 97 | Candidate only; not mapped to `I` |
| NEED | 0 | Missing |
| FAMILY | 0 | Missing |
| HOME | 0 | Missing |
| MEDICAL | 0 | Missing |
| PAIN | 0 | Missing |
| I | 0 | No exact label |

The candidate `I_ME_MINE_MY` remains unassigned; a human sign-level review is required before deciding whether any examples represent the target sign `I`.

## Leakage and evaluation assessment

- The recorded `train_validation_plan` has 52 training records and **0 validation records**. The pilot's grouping uses the filename stem; the selected stems are unique, so every sample falls into training.
- The 52 accepted paths and file hashes establish distinct archive files, not independent sign performances, recording sessions, or signers.
- Corpus text describes seven signers overall, but the word-level spreadsheet does not map these selected frames to signer IDs. The sentence-level frame metadata has a numeric directory component, but it does not provide an established join from these word-level image paths to signer identity or video source.
- Source-video overlap therefore cannot be ruled out, and a signer-independent split cannot be formed from the current pilot metadata.
- A coarse 64-bit difference-hash screen at distance `<= 4` produced 142 candidate image pairs. This is not proof of duplicate frames: similar backgrounds and framing can produce close hashes. The pairs would need visual/source provenance review before splitting.

These constraints make the current pilot unsuitable for held-out metric reporting. No precision, recall, F1, confusion matrix, or macro-F1 is reported; there is no valid held-out set. No training accuracy is substituted for generalization performance.

## Preprocessing/inference consistency

The frontend service `src/services/handLandmarkService.ts` uses MediaPipe landmark indices in their native 0–20 order, subtracts landmark 0 (wrist), scales by the Euclidean distance from landmark 0 to landmark 9, then flattens `[x0,y0,z0,...,x20,y20,z20]` to 63 float values. The pilot applies the same ordering, origin, reference distance, and flattening.

Review found one edge-case mismatch: the frontend uses a unit scale when palm length is `<= 0.001`, while the Python pilot previously used `1e-6`. The pilot threshold has now been aligned to the frontend, and a regression test covers this boundary. Normal sample features with ordinary palm lengths are unchanged. MediaPipe runtime modes and CPU/GPU delegates can still result in small numerical differences; this comparison establishes matching feature convention, not bitwise-identical detector output.

## License and attribution

The archive text says the corpus is publicly available, but no explicit license file or redistribution grant was identified in the ZIP. Dataset rights and required attribution remain unverified. Obtain confirmation from the dataset owner/source before model training, publication, or redistribution of source or derived data. This report does not treat “publicly available” as a license.

## Data collection required before a baseline

For each of SignVaani's 12 canonical labels, collect at least:

- **10 distinct signers**
- **20 valid, independently performed recordings per signer per class**, across at least two recording sessions
- **200 valid performances per class** (2,400 total for 12 classes)
- Explicit signer ID, session ID, performance/clip ID, canonical label, and consent/rights/attribution record for each item
- Source clip-to-frame provenance, so frames from one performance remain in one split group

For an initial signer-held-out evaluation, reserve two complete signers (40 performances per class) as the untouched test set and use the other eight signers (160 performances per class) for training and development. Keep recordings from a signer/session/performance together; deduplicate and review near-duplicate frames before splitting. The held-out set must not be used for preprocessing choices, tuning, or augmentation.

These are proposed minimum collection targets for this project, not a claim that the corpus or field has a universal sample-size standard. Increase them if signer variability, within-class variation, or confidence intervals indicate that the evaluation is unstable.

The collection must include verified canonical data for all 12 labels. The current archive has no exact `I`, `NEED`, `FAMILY`, `HOME`, `MEDICAL`, or `PAIN` word folders; `I_ME_MINE_MY` must remain separate until verified. `PLEASE` has only two source images. Confirm that each target sign's one- or two-hand requirements are supported by the intended inference pipeline before collecting or labeling it.

## Limitations

- The sample is very small and class-imbalanced (10–15 accepted samples per pilot class).
- The pilot does not establish signer diversity or independent performance/session counts.
- The broader archive's seven signers are not linked to these word-level examples in the inspected metadata.
- Licensing and attribution requirements are unresolved.
- These are static word-level images and 63-D single-frame hand features. They do not model motion, transition, facial expression, body pose, or timing needed for continuous ISL recognition/translation.
- The current live recognition pipeline's multiple-hand behavior can reject signs requiring both hands; those labels need explicit compatibility review.
- No classification quality or production readiness has been established.

## Commands and validation

Local inspection/validation performed:

- Read `docs/ISL_PREPROCESSING_PILOT.md` and `generated/isl_pilot/metadata.json`.
- Enumerated the generated `.npy` files, loaded their arrays, and compared counts with the manifest.
- Read word-level spreadsheet rows and headers directly from `datasets/archive.zip`.
- Compared source-file SHA-256 hashes and ran a coarse difference-hash candidate screen on the 52 accepted source images.
- Compared normalization with `src/services/handLandmarkService.ts`.
- `PYTHONPATH=. python -m unittest discover -s tests -v` — all six tests passed after adding the frontend threshold parity regression.

No classifier training, held-out evaluation, model export, artifact loading, or production integration was attempted because the evaluation gate failed.

