# ISL preprocessing pilot

This document records the local, reproducible preprocessing pilot for the verified SignVaani target labels in the primary archive, without training a final classifier.

## Scope and safeguards

- Primary archive inspected: `datasets/archive.zip`
- Original ZIP unchanged: yes
- Generated outputs kept separate: `generated/isl_pilot/`
- No final classifier trained: yes
- Candidate alias not silently mapped: `I_ME_MINE_MY` is recorded as a semantic candidate for `I` and was not used directly in the pilot.

## Verified label audit

The archive's word-level labels were inspected directly from the ZIP. Verified exact matches for the SignVaani target vocabulary included:
- `YOU`
- `HELP`
- `WATER`
- `FOOD`
- `THANK`
- `PLEASE`

The label `I_ME_MINE_MY` was identified as a candidate alias for `I`, but we did not silently map it to `I`. The current interpretation is:

- `I_ME_MINE_MY` is a combined label that may represent multiple semantically related signs or pronoun variants
- It requires a human/sign-level verification step before any canonical mapping to `I`

Exact label paths found in the archive include examples such as:
- `ISL_CSLRT_Corpus/ISL_CSLRT_Corpus/Frames_Word_Level/YOU/YOU (1).jpg`
- `ISL_CSLRT_Corpus/ISL_CSLRT_Corpus/Frames_Word_Level/HELP/HELP (1).jpg`
- `ISL_CSLRT_Corpus/ISL_CSLRT_Corpus/Frames_Word_Level/WATER/WATER (1).jpg`
- `ISL_CSLRT_Corpus/ISL_CSLRT_Corpus/Frames_Word_Level/FOOD/FOOD (1).jpg`
- `ISL_CSLRT_Corpus/ISL_CSLRT_Corpus/Frames_Word_Level/I_ME_MINE_MY/I (1).jpg`

## License and attribution check

The archive metadata file `ISL_CSLRT_Corpus/ISL_CSLRT_Corpus/ISL_CSLRT.txt` states that the corpus is a publicly available dataset for ISL recognition and translation. During local inspection, no explicit `LICENSE` file, SPDX label, or separate redistribution terms were found in the archive.

Prudent usage requirement before training or redistribution:
- verify source-rights permissions and attribution terms with the dataset owner or original repository
- do not treat the public availability note as a legal license grant without confirming rights

## Preprocessing pilot design

The pilot used a small, reproducible subset of the confirmed classes:
- `YOU`
- `HELP`
- `WATER`
- `FOOD`

The preprocessing logic matches the existing SignVaani frontend pipeline:
- 21 MediaPipe hand landmarks
- wrist-centered normalization
- palm-length scaling
- flattened 63-dimensional feature vector

This follows the same formula used by the project’s live recognition pipeline in the frontend service: subtract wrist coordinates, normalize by palm reference length, and flatten into `[x0, y0, z0, ..., x20, y20, z20]`.

## Actual extracted pilot dataset

Generated output directory:
- `generated/isl_pilot/`

Generated files:
- `generated/isl_pilot/metadata.json`
- `generated/isl_pilot/landmarks/FOOD/*.npy`
- `generated/isl_pilot/landmarks/HELP/*.npy`
- `generated/isl_pilot/landmarks/WATER/*.npy`
- `generated/isl_pilot/landmarks/YOU/*.npy`

Class counts from the generated pilot:
- `YOU`: 15 accepted samples
- `HELP`: 10 accepted samples
- `WATER`: 12 accepted samples
- `FOOD`: 15 accepted samples
- Total accepted: 52
- Total rejected: 28

Rejected reasons:
- `multiple_hands`: 22
- `no_hand`: 6

This is a pilot subset and not a final dataset for training. The goal was to validate the preprocessing path and detect edge cases such as missing hands and multiple-hand ambiguity.

## Validation and tests

Actual test command run:
- `PYTHONPATH=. python -m unittest discover -s tests -v`

Result:
- 5 tests passed
- covered:
  - 63-dimensional feature-vector shape
  - normalization logic
  - label verification and candidate alias handling
  - no-hand detection
  - duplicate-source split safety checks

## Reproducible preprocessing command

Actual command run:
- `python scripts/isl_preprocessing_pilot.py --max-per-class 20 --output-dir generated/isl_pilot`

The script creates the generated landmark dataset locally and records metadata without modifying the original archive.

## Next steps before training the final classifier

1. Add a manual sign-level verification pass for `I_ME_MINE_MY` before mapping it to `I`.
2. Expand the pilot to additional confirmed labels after semantic review.
3. Add a stricter duplicate filtering step across source frames and split boundaries.
4. Only then prepare train/validation splits and model training, while still respecting the dataset’s rights and attribution requirements.

## Conclusion

The pilot confirms that the primary archive contains usable ISL word samples for at least several confirmed target classes, and the preprocessing pipeline can produce the expected 63-dimensional MediaPipe-style feature vectors. However, it also confirms that some frames are rejected because hands are absent or multiple hands are visible, and that the `I_ME_MINE_MY` label requires extra semantic validation.

No final classifier was trained during this phase.
