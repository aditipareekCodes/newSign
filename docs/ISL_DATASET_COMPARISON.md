# ISL dataset comparison for SignVaani

## Scope and method

This audit inspected the three local ZIP archives in the project datasets directory without extracting them to arbitrary locations or modifying the originals.

Relevant project evidence:
- [docs/DEVELOPMENT_STATUS.md](../docs/DEVELOPMENT_STATUS.md) documents the current ISL recognition pipeline as requiring a trained model artifact and an honest model-availability check.
- [src/services/recognitionService.ts](../src/services/recognitionService.ts) defines the intended word set (`I`, `NEED`, `WATER`, `HELP`, `FAMILY`, `THANK`, `YOU`, `HOME`, `MEDICAL`, `PLEASE`, `FOOD`, `PAIN`) and the live pipeline expectation of 21-hand-keypoint preprocessing into a 63-dimensional feature vector.

Inspection commands executed locally (actual examples):
- `Get-ChildItem -Force 'C:\Users\Aditi Pareek\Downloads\signVaani-main new zip\datasets'`
- Python zip inspection scripts to enumerate names, counts, directory structure, target-word labels, and `.npy` metadata

I did not train a model, extract datasets outside the dataset directory, or modify application code.

## 1) Dataset overview

| Dataset | Size / archive name | Representation | Verified internal structure | Class coverage & labels | Compatibility with SignVaani pipeline | Recommendation |
|---|---:|---|---|---|---|---|
| Primary candidate | `archive.zip` (~8.9 GB) | Real ISL frame images + MP4 video clips + metadata spreadsheets | `ISL_CSLRT_Corpus/ISL_CSLRT_Corpus/Frames_Word_Level`, `Frames_Sentence_Level`, `Videos_Sentence_Level`, plus corpus CSV/XLSX metadata | 114 unique word-level folders; target-like present: `YOU`, `I_ME_MINE_MY`, `HELP`, `WATER`, `THANK`, `FOOD`, `PLEASE`; missing: `FAMILY`, `HOME`, `MEDICAL`, `NEED`, `PAIN` | Best match to realistic ISL, but not directly MediaPipe 21-landmark data; requires preprocessing and label mapping | Recommended primary dataset |
| Supplement only | `archive (2).zip` (~3.85 GB) | Encoded `.npy` arrays and JSON label map | `X.npy`, `y.npy`, `y_index_mapping.json` | 250 label classes, with target-like words (`water`, `home`, `please`, `thankyou`, `food`), but not the full SignVaani 12-word set and not mapped to exact project labels | Not a direct match to the project’s 21-hand / 63-feature format; can only be supplemental if the pipeline is explicitly adapted | Use only as supplementary or calibration dataset |
| Exclude for project target | `archive (1).zip` (~48.8 MB) | Static alphabet image dataset | `Dataset/A` ... `Dataset/Z` folders with JPEG images | 26 classes (A-Z letters), 53,512 total JPEG files; no word-class ISL labels for target words | Not aligned with the required word set or the project’s 63-dimensional feature pipeline | Not suitable as primary dataset |

## 2) Verified counts and class evidence

### Dataset A: `archive.zip` (largest archive)

Observed counts from zip-level inspection:
- Total entries: 21,074
- JPG images: 19,899
- MP4 videos: 687
- Metadata/annotation-like files: 488
- Distinct extensions: 6
- Key metadata file found: `ISL_CSLRT_Corpus/ISL_CSLRT_Corpus/ISL_CSLRT.txt`

The metadata file states:
> `ISL-CSLRT: Indian Sign Language Dataset for Continuous Sign Language Recognition and Translation`

and says the corpus is a publicly available dataset for continuous sign-language recognition and translation with sentence-level frames and word-level images.

Word-level class evidence:
- Unique word folders under `Frames_Word_Level`: 114
- Example class counts observed:
  - `YOU`: 110
  - `I_ME_MINE_MY`: 97
  - `HELP`: 26
  - `FOOD`: 23
  - `WATER`: 21
  - `THANK`: 14
  - `PLEASE`: 2
- Missing exact target classes in the word-level folders:
  - `HOME` = 0
  - `MEDICAL` = 0
  - `FAMILY` = 0
  - `NEED` = 0
  - `PAIN` = 0

Target-word coverage check against the required set `{I, NEED, WATER, HELP, FAMILY, THANK, YOU, HOME, MEDICAL, PLEASE, FOOD, PAIN}`:
- Present in the archive: `WATER`, `HELP`, `THANK`, `YOU`, `FOOD`, `PLEASE`
- Present only as a combined label: `I_ME_MINE_MY` (not exact `I`)
- Absent: `NEED`, `FAMILY`, `HOME`, `MEDICAL`, `PAIN`

Sentence-level metadata also lists sentence phrases such as:
- `do you need something`
- `help me`
- `i need water`
- `how can i help you`
- `i am fine. thank you sir`

This is consistent with a real ISL dataset, but label mapping and normalization still need to be done before training a SignVaani classifier.

### Dataset B: `archive (1).zip`

Observed counts from zip-level inspection:
- Total entries: 53,512
- JPG images: 53,512
- Video files: 0
- Distinct extensions: 1
- Top-level class folders: `Dataset/A` ... `Dataset/Z`

Evidence from the archive structure:
- Classes are the letters `A`, `B`, `C`, ..., `Z`
- There are 26 classes and no ISL word folders

Target-word coverage check:
- `I` is present as a letter class, but not as the ISL sign word `I`
- `NEED`, `WATER`, `HELP`, `FAMILY`, `THANK`, `YOU`, `HOME`, `MEDICAL`, `PLEASE`, `FOOD`, `PAIN` are all absent as word classes

Conclusion: this archive is a static letter-image dataset and is not suitable as the primary dataset for the current 12-word SignVaani target set.

### Dataset C: `archive (2).zip`

Observed counts from zip-level inspection:
- Total entries: 3
- `X.npy`: 1
- `y.npy`: 1
- `y_index_mapping.json`: 1

Array inspection:
- `X.shape = (94477, 42, 3)`
- `X.dtype = object`
- `y.shape = (94477,)`
- `y.dtype = int64`

This means the dataset stores 94,477 samples each represented by a 42x3 numeric array; it is not a raw image/video sign corpus and it is not directly the same as the project’s MediaPipe 21-hand-keypoint normalization pipeline.

Label map evidence:
- Total labels in mapping: 250
- Example labels include: `TV`, `after`, `airplane`, `animal`, `home`, `food`, `please`, `thankyou`, `water`
- Some target words exist in the label map, but not in the exact SignVaani target set and not in a clean ISL labeling scheme.

Target-word coverage check against the required set:
- `WATER`: present
- `HOME`: present
- `PLEASE`: present
- `THANK`: present via `thankyou`
- `YOU`: present through general vocabulary, but not as a canonical `YOU` class label in a sign dataset
- `FOOD`: present
- `I`: technically present as `if` / `minemy` but not as a canonical `I` class
- `NEED`, `HELP`, `FAMILY`, `MEDICAL`, `PAIN`: absent

Conclusion: useful only as an encoded supplementary dataset if the model pipeline is reworked to consume this representation; otherwise it is not a direct match for SignVaani’s current 21-landmark/63-feature design.

## 3) Compatibility with the existing SignVaani recognition pipeline

The project’s documented design and implementation are built around live hand tracking and 21-keypoint landmarks normalized into 63-dimensional vectors. Evidence:
- [docs/DEVELOPMENT_STATUS.md](../docs/DEVELOPMENT_STATUS.md) describes `Preprocessing Pipeline` as `21 3D landmarks -> wrist translation -> bounding scale normalization -> 63-dim feature vector`.
- [src/services/recognitionService.ts](../src/services/recognitionService.ts) declares the support set (`I`, `NEED`, `WATER`, `HELP`, `FAMILY`, `THANK`, `YOU`, `HOME`, `MEDICAL`, `PLEASE`, `FOOD`, `PAIN`) and the model-unavailable / live-hand-tracking flow.

Dataset compatibility verdict:
- `archive.zip`: closest match to a real ISL sign corpus, but not already in the 21-landmark 63D feature representation. Requires label extraction, feature engineering, and a mapping step from frames/videos to the project’s 63-dimensional input format.
- `archive (2).zip`: not in the same representation; it is a 42x3 encoded array dataset rather than a landmark dataset. It would only be usable if the feature pipeline is intentionally changed to accept this array schema.
- `archive (1).zip`: completely mismatched with the intended word set and model format.

## 4) Data quality, limitations, and licensing considerations

### Quality and imbalance checks
- `archive.zip`: likely class imbalance across word folders; some classes are high-volume (e.g. `YOU` 110, `I_ME_MINE_MY` 97) while others are extremely sparse (e.g. `PLEASE` 2). This is a real data-quality concern for a word classifier.
- `archive (1).zip`: class balance appears roughly even by letter because it is alphabetic, but it is not aligned to the target words or to the project’s sign semantics.
- `archive (2).zip`: label count is broad and varied, but the mapping is not explicitly tied to the target SignVaani words or to a real ISL lexical set.

### Corruption / password protection / extraction safety
- I did not find evidence of password protection or corrupted ZIP members during the zip-level inspection.
- I did not extract archives to arbitrary paths outside the `datasets` directory, per the project constraints and safety instructions.
- I did not see a clear license file inside the ZIPs; the only explicit legal statement found was in the metadata text for `archive.zip`, which says the corpus is “made available publicly.” I am not treating that as a legal guarantee or license grant; it is only a dataset note.

### Licensing note
- No explicit `LICENSE`, `README`, or other SPDX/creative-commons metadata file was found in the inspected archive structure.
- Because I did not assume a license, the prudent reading is:
  - `archive.zip` is a public corpus with metadata but no verified license file in this local inspection
  - `archive (1).zip` and `archive (2).zip` also did not present any explicit license metadata during the inspection
- Before real model training or public release, the project should verify the source rights and any usage restrictions for each archive.

## 5) Recommendation

### Recommended primary dataset
`archive.zip` is the best primary dataset for a genuine ISL sign classifier because it is the only archive that clearly looks like a real ISL corpus rather than a letter dataset or a generic encoded feature archive.

Why it is the recommended primary dataset:
- It contains `Frames_Word_Level`, `Frames_Sentence_Level`, and `Videos_Sentence_Level` under an ISL corpus naming structure.
- It includes real sign data and metadata describing an ISL dataset built for continuous sign recognition and translation.
- It contains multiple of the target words (`YOU`, `HELP`, `WATER`, `THANK`, `FOOD`, `PLEASE`) and a sentence corpus that includes phrases such as `I NEED WATER` and `HELP ME`.
- It is far more representative of actual ISL than the other two candidate archives.

### Recommended supplementary dataset
`archive (2).zip` can be considered only as a supplementary or calibration dataset if the project changes or augments its training pipeline to consume the 42x3 encoded features.

Why it is not the main dataset:
- It contains 250 generic labels and not the exact SignVaani target labels.
- It is not currently in the same format as the project’s 21-keypoint / 63-feature pipeline.
- It lacks a real sign-image/video corpus and is not a direct match to the project’s classifier objective.

### Dataset to exclude for the current objective
`archive (1).zip` should not be used as the main training set for this project:
- It is a static alphabet dataset (`A` to `Z`), not a word-sign ISL dataset.
- It does not match the required 12-word target set.
- It does not match the project’s real sign recognition pipeline.

## 6) Next steps required before training

Before training any classifier, the project still needs the following steps:
1. Verify exact label mapping for the primary archive and determine which target words are actually present as canonical labels.
2. Create a preprocessing pipeline that converts the selected ISL frame/video data into MediaPipe-style 21-landmark or equivalent 63-dimensional features.
3. Decide whether to train a 12-class classifier from the `archive.zip` word folders, or to use a sentence-level subset plus a word-level mapping step.
4. Handle class imbalance (especially for sparse classes like `PLEASE`) and remove duplicate or corrupted samples.
5. Check the licensing status of all three datasets before publication or downstream model release.
6. Confirm the exact target list and whether `I`, `HOME`, `MEDICAL`, `NEED`, and `PAIN` need a custom labeling or dataset expansion step.
7. Only then train a real model after the preprocessing and label validation are complete.

## 7) Inspection steps that could not be completed here

I could not complete the following within this audit without moving beyond the safe inspection scope:
- A full legal review of dataset licensing terms in all ZIP archives
- A guaranteed exact count of every sentence-level and word-level label in the largest archive beyond the observed zip metadata and folder structure
- A fully validated train-ready dataset extraction to a non-dataset working directory
- Any model training or evaluation

## Bottom line

The most defensible recommendation is:
- Primary dataset: `archive.zip`
- Supplementary-only dataset: `archive (2).zip` only if the feature pipeline is intentionally adapted
- Exclude for this project: `archive (1).zip`

This is the strongest evidence-based path for a genuine ISL sign classifier, but not yet a training-ready dataset. The project still needs preprocessing, label validation, class balancing, and licensing checks before model training.
