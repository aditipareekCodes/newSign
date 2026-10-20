# ISL Isolated 40-Word Dataset Audit

**Audit date:** 2026-10-12  
**Candidate directory:** `C:\Users\Aditi Pareek\Downloads\isl-isolated-40words`  
**Scope:** Read-only dataset and pipeline inspection. No training, extraction into the dataset, model replacement, or application-code changes were performed.

## Executive summary

This is a useful *candidate for a carefully controlled preprocessing pilot*, but it is not ready to train or replace SignVaani's production classifier:

- It contains **642 labeled MP4 clips in 40 word folders**, with **642 matching, valid JSON sidecars**. A further JSON file is a Hugging Face cache index, not a video annotation; this explains the directory-wide count of 643 JSON files.
- The clips are short videos (metadata duration 1.73–14.27 seconds), not independent still images. Several sampled signs show motion and at least one sampled `hello` clip uses two hands.
- SignVaani currently classifies one hand in one frame as a **63-value** vector. This discards motion and cannot represent the relationship between two hands.
- **The metadata split is empty for all 642 clips.** The `signer` field is not consistently a person ID; for example, CISLR records values such as `relation`, which is a semantic category, not an individual signer. Do not call a random clip split signer-independent.
- Counts are highly imbalanced. `home` has one clip, while some labels have 36–39. Several SignVaani targets are absent.
- The aggregate declares `license: other` / `multi-source-aggregate`; its upstream sources have different terms. In particular, ISL500 says research/academic use and asks users to contact its authors for commercial use. Public hackathon, redistribution, and commercial use are **not cleared**.

**Recommendation:** do not train or deploy from this aggregate yet. First confirm rights for each source, manually review the 25 rows marked `Needs Manual Review`, establish source/performance grouping, and collect or obtain more verified examples for underrepresented target words. Keep video sequences intact for any later temporal evaluation.

## 1. SignVaani landmark and inference format

Inspected [handLandmarkService.ts](../src/services/handLandmarkService.ts), [recognitionService.ts](../src/services/recognitionService.ts), [recognition.py](../backend/app/routers/recognition.py), [model_metadata.json](../backend/models/model_metadata.json), and [the model directory README](../backend/models/README.md).

The existing live path uses MediaPipe Tasks Vision HandLandmarker. For each detected hand, `preprocessLandmarks`:

1. Takes MediaPipe's 21 landmarks in its canonical order:
   - `0`: wrist
   - `1–4`: thumb CMC, MCP, IP, tip
   - `5–8`: index MCP, PIP, DIP, tip
   - `9–12`: middle MCP, PIP, DIP, tip
   - `13–16`: ring MCP, PIP, DIP, tip
   - `17–20`: pinky MCP, PIP, DIP, tip
2. Subtracts wrist landmark `0` from every point.
3. Scales all three coordinates by the reciprocal of the 3D wrist-to-middle-MCP distance (`0` to `9`); if that distance is at most `0.001`, it uses scale `1`.
4. Flattens points in index order as `[x0, y0, z0, x1, y1, z1, ..., x20, y20, z20]`.

The output is a **63-element `Float32Array` for one hand**. The recognition service converts it to a number array and posts `{ "features": [...] }` to `/recognize/predict`; the backend request schema and model metadata expect 63 features. Mirroring is used for drawing the camera overlay, not in this preprocessing. When two hands are detected, the current recognition service selects one hand's vector rather than encoding both hands or a sequence.

This is shape/preprocessing compatibility only. A matching 63-value input does not establish that a video sign can be recognized correctly by the current single-frame model.

## 2. Dataset structure and file integrity

The local README describes 642 clips and 40 gloss folders. The on-disk check found:

| Item | Verified count/result |
|---|---:|
| Word-label folders | 40 |
| MP4 clips | 642 |
| `metadata.csv` rows | 642 |
| JSON files in word folders | 642 |
| Additional JSON in `.cache` | 1 Hugging Face cache tree index; not a clip annotation |
| Missing MP4s referenced by CSV | 0 |
| Unlisted MP4s in word folders | 0 |
| Missing colocated JSON sidecars | 0 |
| Invalid JSON among 642 sidecars | 0 |
| Label/folder/sidecar-label mismatches | 0 |
| MP4s that opened and decoded a first frame | 642/642 |
| Full-file SHA-256 compared with CSV | 642/642 match; 642 distinct hashes |

The user-reported total of 643 JSON files is accurate for the whole directory only when the `.cache` index is included. There are 642 actual per-video JSON sidecars.

The 642 local MP4s are 30 FPS on OpenCV inspection: 561 are 854×480 and 81 are 480×480. CSV duration is present for every row and ranges from 1.73 to 14.27 seconds.

**Sidecar caveat:** the JSON files are colocated with their matching MP4 and their word/normalized-word values agree with the CSV and folder label. They retain upstream-source metadata, however: each JSON's `video_path` is an original source path, and fields such as source FPS, resolution, duration, SHA-256, and perceptual hash can differ from the normalized local MP4 and its CSV row. The CSV describes the local normalized rendition; the JSON is not a byte-for-byte copy of that rendition's metadata. The local MP4 SHA-256 was independently checked against the CSV and matched for every clip.

The file check decoded the first frame of every clip, not every frame. Full-stream decoding was intentionally not performed, so corruption later in a clip is not ruled out.

### Video counts by label

Counts use `normalized_word`; the directory slug for `thank you` is `thank_you`.

| Label | Clips | Label | Clips | Label | Clips | Label | Clips |
|---|---:|---|---:|---|---:|---|---:|
| brother | 3 | come | 4 | drink | 16 | eat | 18 |
| father | 16 | food | 17 | friend | 38 | go | 17 |
| goodbye | 3 | he | 17 | hello | 36 | help | 16 |
| home | 1 | hospital | 21 | market | 36 | me | 3 |
| mother | 18 | no | 17 | okay | 23 | please | 18 |
| read | 3 | school | 37 | she | 17 | sister | 17 |
| sit | 19 | sorry | 6 | stand | 2 | stop | 4 |
| student | 17 | tea | 17 | teacher | 17 | thank you | 39 |
| today | 17 | water | 18 | what | 17 | when | 2 |
| where | 17 | write | 3 | yes | 17 | you | 18 |

### SignVaani target coverage

| SignVaani target | Candidate label/count | Notes |
|---|---:|---|
| HELP | `help`: 16 | 1 CISLR, 15 ISL500 |
| WATER | `water`: 18 | 3 CISLR, 15 ISL500 |
| FOOD | `food`: 17 | 2 CISLR, 15 ISL500 |
| YOU | `you`: 18 | 3 CISLR, 15 ISL500 |
| PLEASE | `please`: 18 | 3 CISLR, 15 ISL500 |
| THANK | `thank you`: 39 | 3 CISLR, 15 ISL500, 21 INCLUDE; mapping to `THANK` needs ISL label/sign verification |
| HELLO | `hello`: 36 | 15 ISL500, 21 INCLUDE |
| HOME | `home`: 1 | 1 CISLR; far too little to evaluate |
| I | no exact label; `me`: 3 | Do not treat `me` as `I` without ISL semantic/sign verification |
| NEED | absent | No exact label found |
| FAMILY | absent | No exact label found |
| MEDICAL | absent | No exact label found |
| PAIN | absent | No exact label found |

The archive has some model-like vocabulary overlap, but it does not cover SignVaani's 12-word manual vocabulary. In particular, neither `me` nor `thank you` should be silently relabeled to `I` or `THANK`.

## 3. Metadata, provenance, and evaluation risks

The 642 CSV rows have these metadata properties:

| Field | Present | Values / concern |
|---|---:|---|
| Source dataset (`dataset`) | 642/642 | ISL500 405; INCLUDE 143; CISLR 81; ISLRTC dictionary 13 |
| `signer` | 642/642 | Values exist, but are not consistently signer identities |
| `split` | **0/642** | Empty in every row; no train/validation/test split is provided |
| `duration` | 642/642 | 179 distinct values; 1.73–14.27 seconds |
| `fps` | 642/642 | CSV says 30.0 for every normalized MP4 |
| `resolution` | 642/642 | 854×480 or 480×480 |
| `license` | 642/642 | Four source-specific text values; several point elsewhere rather than grant a clear license |
| `review_status` | 642/642 | 617 `accepted`; 25 `Needs Manual Review` (21 INCLUDE, 4 ISLRTC) |

**Do not interpret `signer` as a reliable universal signer ID.** The 81 CISLR rows use values such as `relation`, `action`, `profession`, `substance`, and `geography`; these are semantic/category labels, not person identities. The exact warning in the request is confirmed: `signer: "relation"` is not a trustworthy individual signer ID. ISL500 rows use `User001`–`User015`, consistent with the upstream ISL500 README's 15-user description. INCLUDE values include source-video-like `include_MVI_...` strings; these may help group related clips but do not establish signer identity. **The split field remains empty for all sources.**

### Duplicate and same-source risks

- Actual SHA-256 over each local MP4 matched its CSV hash and was unique across all 642 videos; no byte-identical local files were found.
- All 642 rows say `duplicate_status=unique`, but this field alone is not proof that perceptually similar clips are absent.
- The provided 64-bit perceptual hashes have 508 unique values: 55 hash-collision groups (435 pair combinations) share an identical hash. A Hamming-distance screen at four bits yields 6,215 candidate pairs. These are **review candidates, not verified duplicates**; similar framing/backgrounds can create false matches. Do not automatically delete them.
- Rows can share people, recording sessions, source recordings, or background even when their hashes are unique. Group related source clips together before any split. Never split extracted frames from one clip across train and test.

## 4. License and source terms

The local README labels the aggregate `license: other` / `multi-source-aggregate` and explicitly says it is not dual-licensed under one open license. The metadata's per-row `license` text is not itself sufficient proof that every use is permitted.

| Upstream source | Clips | Evidence inspected | Use/redistribution status |
|---|---:|---|---|
| ISL500 / ISL-DATA | 405 | [Upstream README](https://huggingface.co/datasets/ISL500/ISL-DATA/raw/main/README.md) says research and academic use; contact authors for commercial use. Its Hub API metadata did not expose a license tag. | **Not cleared for commercial/public unrestricted use.** Ask the dataset authors and retain written terms. This is the largest source (about 63% of clips). |
| INCLUDE | 143 | Candidate README claims CC-BY-4.0. The guessed upstream Hub page returned HTTP 401 in this audit, so that specific upstream grant was not independently confirmed here. | If CC-BY-4.0 applies, attribution, a license link, and indication of changes are required. Verify the authoritative source and any rights beyond copyright before reuse. |
| CISLR | 81 | Candidate per-row text says `research (see HF card)`; the [upstream Hub API](https://huggingface.co/api/datasets/Exploration-Lab/CISLR) tags `afl-3.0` and reports automatic gating. | Conflicting/insufficiently reconciled statements. Confirm the applicable source license and video rights before any public or commercial use. |
| ISLRTC dictionary re-encode | 13 | Candidate README calls out Government open data / data.gov.in terms; the [re-encoded upstream card](https://huggingface.co/datasets/Vignesh3816/Indian_Sign_Language_Data.gov_Rencoded) claims MIT and points back to the original Government of India dataset. | Check the original data.gov.in terms and confirm the re-encoder could grant the claimed rights. Do not assume the re-encode removes source obligations. |

The local dataset README also lists source papers and repositories. Preserve per-source attribution and modification history if use is later cleared. This is a technical audit, not legal advice. **No unrestricted public hackathon or commercial use is approved by this inspection.**

## 5. Representative video and hand-landmark inspection

Inspected three frames (approximately 20%, 50%, and 80% of each clip) from one sample each for `help`, `water`, `food`, `you`, `please`, `thank you`, `hello`, and `home`. The sample included CISLR, ISL500, and INCLUDE sources. Videos showed signers and hand/arm actions; the signs were not just static image files.

The local MediaPipe Tasks Vision 1.1.0 hand landmarker and SignVaani's existing local `public/models/hand_landmarker.task` asset were used on only those sampled frames. At least one hand was detected on one or more sampled frames in 7 of the 8 clips. The sampled `hello` clip had two hands detected on all three frames. The sampled `water` clip had no hand detected on its three sampled frames despite a visible hand action; the single `home` clip had a detection on only one of its three sampled frames. This demonstrates that visible hands do not guarantee reliable per-frame extraction, especially in low-resolution/compressed clips. It is a small diagnostic sample, not a dataset-wide detection rate, label validation, or recognition test.

Because these are multi-second videos, single-frame processing loses motion. The sampled `help`, `water`, `thank you`, and `home` clips include movement between frames, and the sampled `hello` involves two hands. A single-hand 63-value vector cannot represent temporal direction/order or two-hand coordination. Some labels may have a stable handshape component, but that must be established sign-by-sign with ISL review; do not assume a static apex frame is sufficient for the full vocabulary.

## 6. Safe preprocessing and evaluation plan

1. **Resolve permission before deriving or distributing features.** Obtain source-specific written clarification where necessary, especially for ISL500 and the CISLR discrepancy. Retain source, original filename, local hash, citation, applicable license/version, and permitted-use evidence in the generated manifest.
2. **Validate labels with fluent ISL reviewers.** Review all 25 `Needs Manual Review` samples first. Confirm the meaning and performance for every proposed target; do not map `me` to `I` or `thank you` to `THANK` without explicit semantic/sign approval.
3. **Keep one video as one performance record.** Sample multiple timestamped frames, retain missing-hand flags and both detected hands, and preserve ordering. Record the MediaPipe model/version and exact preprocessing schema. Do not turn frames from one clip into independent labeled samples.
4. **Separate by reliable identity/source groups.** For ISL500, hold out complete `User###` identities, not frames or clips at random. Group INCLUDE clips by original recording where identifiable. CISLR category-valued `signer` data cannot support signer-independent evaluation; use source-video-disjoint evaluation only if reliable source grouping can be reconstructed, and describe that limitation. If identities/grouping cannot be verified for a class, do not claim signer-independent accuracy for it.
5. **Address imbalance and absent labels.** `home` has one clip; several other classes have 2–6. Obtain additional consented, verified performances from multiple signers and sessions for low-count classes and missing SignVaani words. Any target with too few independent performers should remain unsupported/unvalidated, rather than being padded with augmented copies.
6. **Use a temporal baseline for motion-dependent signs.** Compare a separately reported single-frame baseline only for signs reviewed as sufficiently static against a sequence-based representation that preserves frame order and both hands where needed. Split and evaluate by whole signer/source groups; keep a final untouched group-held-out test set. Report per-class counts, extraction failures, confusion/abstention, and confidence calibration. Do not promote a model from training scores or random-frame splits.
7. **Keep the production artifact isolated.** Generate features, manifests, and candidate models in separate, clearly named locations. No production model or inference behavior should change until rights, label review, grouped evaluation, and acceptance criteria are explicitly approved.

## 7. Files and inspection steps

### Project files inspected

- [src/services/handLandmarkService.ts](../src/services/handLandmarkService.ts)
- [src/services/recognitionService.ts](../src/services/recognitionService.ts)
- [backend/app/routers/recognition.py](../backend/app/routers/recognition.py)
- [backend/models/model_metadata.json](../backend/models/model_metadata.json)
- [backend/models/README.md](../backend/models/README.md)

### Dataset files inspected

- `README.md`, `metadata.csv`, and 40 `sources.txt` files under the candidate directory.
- All 642 video-sidecar JSON files; the additional `.cache/huggingface/trees/7bdd9f3664fda0290009c5e75a9339607325b958.json` is a cache listing, not a clip sidecar.
- All 642 MP4 files were opened and their first frame decoded. A SHA-256 digest was computed for each complete file and compared with the CSV.
- Three selected frames from each of the eight named sample clips were visually reviewed and passed to the local MediaPipe hand detector.
- [Previous dataset comparison](./ISL_DATASET_COMPARISON.md) and [preprocessing pilot report](./ISL_PREPROCESSING_PILOT.md) were checked for project context.

Inspection used read-only PowerShell directory listing and local Python (`csv`, `json`, `hashlib`, OpenCV, MediaPipe) commands, plus public source-card/terms pages linked above. No dataset video was uploaded, extracted into the dataset directory, or modified. No production model, backup, database, or application source code was modified. No classifier was trained.

## Conclusion and blocker

The videos are technically useful for a **rights-cleared, label-reviewed temporal preprocessing pilot**, and all local clip hashes and first-frame reads passed. They are not yet suitable evidence for replacing SignVaani's current classifier: there is no provided split, signer identity is inconsistent, many classes are sparse, some signs require motion or two hands, and the aggregate's reuse terms are not uniform or fully resolved. The next step is rights and source-identity review plus human label validation—not training or deployment.
