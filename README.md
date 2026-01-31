# KFCX — NPS Interview Insight Platform

## Context (from the brief)

**The opportunity:** At key touchpoints—NPS surveys, client interviews, and closed-lost reviews—feedback was fragmented, inconsistently captured, and rarely translated into actionable insight. Valuable client feedback was underused, creating missed opportunities to strengthen relationships, respond faster, and embed learning into how the business works, sells, and improves.

**Our role:** Streamlining Korn Ferry’s approach with clear processes, templates, and reporting; supporting ongoing analysis of NPS survey results, NPS interview feedback, and closed-lost feedback to surface actionable insights that drive change.

**This phase:** Improve how **NPS interview** insight is captured, explored, and used—an interactive platform that brings together:

- NPS interview transcripts  
- Structured reports generated from those interviews  
- *(Later)* NPS survey responses, layered into analysis  

**Objective:** Unlock value from customer feedback by bringing it into an interactive platform that makes insight visible and relevant to each consultant, encourages engagement with the data, and enables action to improve client engagements over time—supporting the promise to **Be More Than**.

---

## What the platform does

### Content and management

- **Hosts** all NPS interview transcripts and their structured reports.  
- **Allows** adding new transcripts and reports over time (upload).  
- **Ingests** report PDFs using the naming convention:  
  `R{ID}_NPS{Score}_{Region}_{Solution}_{AccountType}_{MonthYear}.pdf`  
  (e.g. `R29_NPS10_NA_CONSULTING_HOUSE_DEC25.pdf`).  
  Metadata (region, solution, NPS, account type, month/year) is parsed from the filename.  
- *(Future)* Automated generation of structured reports from transcripts.

### Visibility and filtering

- **Shows:** total interviews to date; breakdowns by region, solution, NPS category.  
- **Provides:** list view of interviews; key takeaways per interview (from structured report); link to download the structured report (PDF or JSON).  
- **Filters:** region (NA, EMEA, APAC, LATAM); solution (Executive Search, Professional Search, Consulting); NPS category (Promoters, Passives, Detractors).  
- **API** supports month/quarter range (`monthStart`, `monthEnd`); UI for month/quarter filter can be added if needed.

### Insight and themes

- **Surfaces** views on:  
  - Why clients choose Korn Ferry  
  - Promoter experience  
  - Where the experience falls short  
  - Additional themes that can be credibly surfaced  
- **Displays** direct client quotes with metadata (company, account type, solution, region, NPS).  
- **Supports** exploration of themes (with optional enhancement for “how themes change over time”).

### Exploration and querying

- **Chat/query:** users can ask questions about brand, marketing, or experience and find specific types of quotes or feedback (AI chat over embedded interview content).

### Opportunities and follow-up actions

- **Surfaces** opportunity- and action-oriented insight from transcripts and structured reports (e.g. future needs, ways to deepen the relationship, actions to strengthen the partnership).  
- **Opportunities** page allows filtering and exploration of these items.

### Structured report format (aligned to brief)

Reports follow the reference structure:

| Section | Purpose |
|--------|--------|
| **Overview** | Client role, relationship with KF, reason for engagement, overall sentiment and outcome |
| **What Went Well** | Key strengths; each theme evidenced by direct client quotes |
| **Challenges / Pain Points** | Where expectations weren’t met; evidenced by quotes |
| **Gaps Identified** | What’s missing or could be enhanced longer-term |
| **Key Themes** | 3–4 overarching insights (strengths and improvement areas) |
| **Actions & Recommendations** | Forward-looking recommendations; relationship growth, service improvement, alignment with client priorities |
| **Additional Insight** | Sector challenges, views on AI/innovation, perceptions of KF, comparison with competitors, etc. |

---

## Brief alignment summary

| Brief requirement | Status in app |
|-------------------|----------------|
| Host transcripts + structured reports | ✅ Stored and linked in metadata |
| Add new content over time | ✅ Upload (report PDFs; transcript flow as implemented) |
| Total interviews + breakdowns (region, solution, NPS) | ✅ Dashboard |
| List view of interviews | ✅ Interviews page |
| Key takeaways per interview, evidenced by quotes | ✅ Report structure + interview detail page |
| Download structured report | ✅ Report download API + UI |
| Filter by region, solution, NPS | ✅ Interviews list + API |
| Filter by month or quarter | ✅ API (`monthStart` / `monthEnd`); UI filter optional |
| Themes: why choose KF, promoter experience, where falls short | ✅ Themes page (tabs) |
| Direct quotes with metadata | ✅ Theme cards + quote references |
| Chat/query over feedback | ✅ Chat page + search |
| Surface opportunities & follow-up actions | ✅ Opportunities page + report sections |
| Report naming: R{ID}_NPS{Score}_{Region}_{Solution}_{AccountType}_{MonthYear} | ✅ Parsed in `pdf-parser` |
| Segments: NA, EMEA, APAC, LATAM; ES, PS, Consulting; Promoters, Passives, Detractors | ✅ Types + filters |
| Future: NPS survey data layered in | 🔜 Not in this phase |
| Future: Automated report from transcript | 🔜 Not in this phase |

---

## Who it’s for

Korn Ferry / Magnus teams running NPS interviews: consultants and leaders who need to see what clients value, where the experience falls short, and what opportunities exist—without re-reading every report.

## Tech

- **Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS.  
- **Data:** `data/store/` (metadata index, transcripts, normalized reports); PDFs in `data/store/originals/`.  
- **AI:** OpenAI for embeddings, search, and chat over interview content.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Upload** to add report PDFs; **Dashboard** and **Interviews** to explore; **Themes** and **Opportunities** for insight; **Chat** to query in natural language.
