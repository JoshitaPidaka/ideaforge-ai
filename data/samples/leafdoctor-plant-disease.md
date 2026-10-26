# LeafDoctor: Offline Plant Disease Detection for Small Farmers

Problem Statement:
Smallholder farmers often lose a large part of their crop to diseases that are detected too late. Agricultural experts are scarce in rural areas, and mobile internet is unreliable in the fields.

Target Users:
Small and marginal farmers, agricultural extension officers, and farmer producer organisations.

Proposed Solution:
An Android app that detects crop diseases from a photo of a leaf, fully offline, and recommends affordable treatments in the farmer's local language.

Key Features:
- On-device deep learning model (quantised MobileNet / EfficientNet) that runs on low-end Android phones without internet
- Detection of 20+ diseases for tomato, potato, chilli and paddy leaves
- Voice-based treatment advice in Telugu, Kannada and Hindi
- Severity estimation from the percentage of infected leaf area
- Community outbreak map: anonymised detections are synced when internet is available to warn nearby farmers

Method:
Transfer learning on public leaf image datasets plus field photos we collect, model quantisation with TensorFlow Lite, and an expert-reviewed treatment knowledge base.

Data:
PlantVillage dataset, PlantDoc field images, and 2,000 photos collected with a local farmer producer organisation.

Platform:
Android (Kotlin + TensorFlow Lite), Firebase for optional sync.

Expected Outcome:
Accurate diagnosis in under 3 seconds without connectivity and earlier treatment for farmers who currently have no access to experts.
