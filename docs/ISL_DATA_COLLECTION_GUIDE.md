# SignVaani local ISL landmark collection guide

This tool collects explicitly labelled, static MediaPipe hand-landmark performances for the 12-word manual vocabulary plus the model-declared `HELLO` class. It does not train or load a sign classifier and does not change live recognition behavior.

## Before collection: reserve final-test signers

1. Decide which **two complete signers** will be the final test signers before recording anyone.
2. Open SignVaani, sign in as usual, and choose **Open collection tool** on Home.
3. In **Final-test signer IDs**, enter the two distinct, stable IDs separated by a comma, for example `test-01, test-02`, then click **Reserve and lock test signers**.
4. Record the IDs in the project’s study log. They are stored in this browser's local storage; they are not inferred or uploaded.
5. After recording starts, the reserved IDs cannot be changed in this browser. Do not delete or edit the browser's collection settings to reclassify signers.

Reserved IDs are marked `final_test` on every saved capture. Do not inspect their features, labels, or predictions during model development, model selection, preprocessing choices, or tuning. Keep every capture from a signer in the same split. Final-test data should only be evaluated after the pipeline is frozen.

Use a different stable, pseudonymous ID for each development signer; never use a name or contact detail. Use a new session ID for each distinct recording session. Do not share signer IDs between people.

## Record one performance

1. Select the canonical label **before** performing the sign. The tool never guesses or assigns labels.
2. Enter the signer ID and session ID. IDs allow letters, numbers, `.`, `_`, `-` (1–64 characters).
3. Check the displayed split. A reserved signer must say `FINAL TEST`; every other signer says `DEVELOPMENT`.
4. Click **Start local camera** and allow camera permission. The collection screen uses the local bundled MediaPipe WASM and hand-landmarker model; it disables CDN fallback. If local assets are unavailable, it reports an error instead of fetching them.
5. Click **Start recording**, perform one independent repetition, then click **Stop recording**. Do not treat neighboring frames as separate performances.
   Confirm the local recording-consent checkbox before starting. This stores
   the user's confirmation in each record; it is not a substitute for any
   applicable institutional or legal consent process.
6. Review the local still preview, duration, valid landmark frames, and invalid-frame reasons. The preview exists only temporarily in page memory; it is never persisted or exported. The tool requires at least 1.8 seconds and 8 valid single-hand samples for acceptance.
7. Confirm the displayed label as the performer, record a pseudonymous reviewer/reference code, and attest that the sign-label pairing was independently reviewed before clicking **Accept performance**. The tool records these attestations; it cannot independently verify that the review occurred. If the capture is wrong or incomplete, give a rejection reason and click **Reject performance**. Rejected attempts are retained as metadata, without features.
8. Start a new capture for the next independent repetition. Each gets a unique performance ID. Do not split frames from a single performance between training and validation/test.

`no_hand`, `multiple_hands`, detector errors, and non-finite/invalid features are not used as valid frames. Captures with too few valid frames cannot be accepted. The number of such failures is visible during review.

## What gets recorded and where

- Each accepted performance contributes **one** feature vector: the per-coordinate median of valid sampled frames. Adjacent camera frames are not emitted as independent samples.
- The vector has 63 float values in MediaPipe landmark order 0–20, with `(x,y,z)` per point. It uses the same live inference preprocessing: subtract wrist landmark 0 and normalize by the Euclidean distance between landmarks 0 and 9, using unit scale when that distance is at most `0.001`.
- Schema-version-2 metadata includes the preprocessing schema, user-confirmed consent, performer label confirmation, independent-review attestation and reference, canonical label, signer ID, session ID, unique performance ID, timestamp, source (`local_webcam`), signer split, accepted/rejected status and decision reason, duration, frame counts, and invalid-frame counts. These fields record user attestations; they do not themselves prove a sign is valid ISL.
- The browser persists metadata and accepted features in local IndexedDB. No camera images, video, or landmark data are sent to a backend or external service. The collector does not save video.
- The reserved test IDs are stored in browser local storage. Use the same browser/profile for the collection study and keep an independent record of the reserved IDs.

The Home screen, camera, or model asset may have their own application behaviors outside the collector. In particular, normal live recognition still has its pre-existing MediaPipe fallback behavior; it is not invoked by this local-only collection screen.

## Export and inspection

1. On the collection screen, click **Export local JSON**. The browser downloads `signvaani-isl-performances.json` with schemaVersion 2.
2. Keep the export in a protected, local project data location. It contains signer-linked derived data; follow the study's consent and access policy.
3. Run the local inspector:

   ```powershell
   python scripts\inspect_isl_collection.py C:\path\to\signvaani-isl-performances.json
   ```

   The inspector validates schema, canonical labels, consent, explicit label review, preprocessing identifier, unique performance IDs, feature-vector shape, and completion metadata. It reports counts by class, signer, signer/session, status, and individual performance. It reads the given JSON file only; it does not extract archives or write into the input file.
4. Back up the exported file securely. IndexedDB is browser-local storage, not a backup or a shared database. Do not send the export to an online converter or external service.

## Labels and sign validity

Selectable labels are the 12-word manual vocabulary (`I`, `NEED`, `WATER`, `HELP`, `FAMILY`, `THANK`, `YOU`, `HOME`, `MEDICAL`, `PLEASE`, `FOOD`, and `PAIN`) plus `HELLO`, which is declared by the current model but remains unvalidated. A user confirmation is not expert or community sign verification; document appropriate ISL label/sign review before accepting samples for training.

Do not map the archive's `I_ME_MINE_MY` label to `I` automatically. It remains a candidate requiring semantic/sign-level verification. Confirm that each contributor is performing the intended ISL sign and that the chosen label is appropriate; obtain consent and document label review. The eight-class model trainer uses only `FOOD`, `HELLO`, `HELP`, `I`, `PLEASE`, `THANK`, `WATER`, and `YOU`; other manually selectable labels are retained in exports and explicitly counted as excluded from that model's training.

## Important scope limitations

This collector records a static 63-D single-hand pose summary. Static vectors cannot represent movement direction, transitions, repetition, two-hand coordination, facial expression, or body pose. Signs needing those cues require a temporal or multimodal representation and should not be considered validly captured by this static pilot tool. The current application recognition path may also be unable to process two-hand signs; the collection tool rejects frames with multiple detected hands rather than choosing one.

The current trainer requires at least 15 development performances for every
automatic-model class from at least 3 development signers, plus at least two
complete signers reserved for final testing. It also creates a signer-grouped
development validation split. These are minimum implementation gates, not
statistical guarantees or proof of adequate diversity. Do not train until
dataset permissions/attribution are verified, each label is reviewed,
signer/session provenance is checked, duplicates are investigated, and the
reserved final-test set remains untouched.

Schema-version-1 browser records are preserved during the IndexedDB upgrade
and exported separately as `legacyPerformances`. They lack explicit consent
and preprocessing provenance and are excluded from the trainer's
`performances` manifest; they must not be represented as verified
schema-version-2 samples.

No classifier is trained or connected to production by this tool.
