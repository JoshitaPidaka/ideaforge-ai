# GrievanceLens: AI Analysis of Citizen Complaints for Municipal Offices

Problem Statement:
Municipal corporations receive thousands of complaints about water supply, roads, streetlights and garbage collection. Complaints arrive as free text, photos and voice notes, are routed manually, and recurring problems in the same area are not noticed until they escalate.

Target Users:
Municipal officers, ward councillors and citizens who file complaints.

Proposed Solution:
A platform that automatically classifies each complaint by department and urgency, groups duplicate complaints about the same issue, detects recurring hotspots on a map, and drafts a status update for the citizen.

Key Features:
- Multilingual complaint classification (department, category, urgency) from text and voice notes
- Photo understanding: identify potholes, overflowing garbage or broken streetlights from citizen photos
- Duplicate and cluster detection to merge complaints about the same problem
- Geographic hotspot heatmap and weekly trend report for each ward
- SLA tracking with automatic escalation when complaints are not resolved in time

Method:
Text classification with a fine-tuned multilingual transformer, image classification with a vision model, clustering with sentence embeddings and geolocation, and an LLM to draft citizen updates.

Data:
Open civic complaint datasets (e.g. 311 service requests), plus synthetic complaints in Telugu and Hindi for testing.

Platform:
Web dashboard for officers (React), citizen web form and WhatsApp intake, Python backend with PostgreSQL + PostGIS.

Expected Outcome:
Faster routing of complaints, earlier detection of recurring infrastructure failures, and transparent status updates for citizens.
