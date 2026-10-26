# CampusMate: Multilingual Campus Help Assistant

Problem Statement:
First-year students at our university struggle to find accurate answers about scholarships, exam rules, hostel procedures and department contacts. Information is scattered across PDFs, notice boards and WhatsApp groups, and much of it is only in English while many students are more comfortable in Telugu or Hindi.

Target Users:
Undergraduate students (especially first-years), parents, and the student help-desk staff.

Proposed Solution:
We will build a chat assistant that answers student questions using only verified university documents. Administrators upload circulars, handbooks and calendars; the system splits them into passages, indexes them with embeddings and answers with retrieval-augmented generation, always citing the source document and page.

Key Features:
- Retrieval-augmented question answering over official university PDFs with page-level citations
- Answers in English, Telugu and Hindi, including voice input for low-literacy users
- Freshness alerts: documents that are older than the current semester are flagged as possibly outdated
- Escalation to the right office with a pre-filled ticket when the assistant is not confident
- Admin dashboard showing the most frequently asked unanswered questions

Method:
Document ingestion with PDF parsing and chunking, a vector database for semantic search, an open-weight LLM for answer generation, and a confidence threshold that triggers escalation instead of guessing.

Data:
Public university handbooks, academic calendars, scholarship circulars, and a set of 300 real student questions collected from the help desk.

Platform:
Web app and WhatsApp bot; Python FastAPI backend; React frontend.

Expected Outcome:
Reduce repeated help-desk queries by 40% and give every student a trustworthy, cited answer within seconds in their preferred language.
