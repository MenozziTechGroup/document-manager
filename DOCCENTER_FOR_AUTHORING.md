# Authoring MITS Documents for DocCenter

> Paste this into the MITS Documents Claude project's knowledge. It tells the
> authoring assistant what DocCenter is and how to produce documents that drop
> cleanly into it. Companion to `MITS_DocumentTemplates.md` (section skeletons)
> and the MITS Style Guide.

## What DocCenter is

DocCenter is the MITS desktop app that catalogs, organizes, searches, and runs
our controlled documents. The **document files live in SharePoint**; DocCenter
adds the organization layer (categories, tags, Doc IDs, review dates, playbooks)
and shares it across the team via a cloud backend. It is the live index — so you
no longer maintain a separate index document.

## The handoff: how a document you build reaches DocCenter

1. You author the document here and the user **downloads the finished `.docx`** (the editable master).
2. In DocCenter the user clicks **Add Document** (or drags the `.docx` onto the window),
   picks the category, and DocCenter **files it into the correct SharePoint subfolder**
   and can **auto-generate the read-only PDF** from the Word file.
3. DocCenter pairs the `.docx` (master) and `.pdf` (read-only) into one entry.

**So your deliverable is a clean, final `.docx`.** Do **not** produce the PDF —
DocCenter generates it. Do not produce an index entry — DocCenter is the index.

## What to set / name so it slots in cleanly

- **Filename:** descriptive, words separated by spaces or underscores. If it's a new
  version, end with `_vN.N` (e.g. `Server_Maintenance_Runbook_v2.1.docx`) — DocCenter
  auto-detects the version from that suffix.
- **Doc ID:** every controlled document has a stable ID in the form **`TYPE-DOMAIN-NNN`**
  (e.g. `SOP-MDM-003`). Reuse the established ID when revising; for a new doc, propose the
  next number in that type+domain series.
- **Keep the changelog** at the end of the document. DocCenter has a **Version notes** field
  where that changelog is pasted, so a concise, current changelog is valuable.

## Type codes (category)

| Code | Type | Folder |
|---|---|---|
| SOP | Standard Operating Procedure | SOPs |
| RBK | Runbook | Runbooks |
| CHK | Checklist | Checklists |
| CGD | Client Guide | Client Guides |
| REF | Reference | Reference |
| POL | Policy | Policies |
| SCR | Script (.ps1 etc.) | Scripts |
| LTR | Letter | Letters |
| OTH | Other | (uncategorized) |

DocCenter derives the category from the folder a file lives in (any ancestor folder whose
name contains the category keyword), so folders should keep the category word in their name
(`Client Guides`, not `Guides`). Nested folders are fine.

## Domain codes (the tool/area)

`IT` General IT · `MDM` Apple/MDM · `DNS` DNSFilter · `NIN` NinjaOne · `M365` Microsoft 365 ·
`HRN` Hornetsecurity · `PS` PowerShell · `DOC` Document System · `ACC` Account Management ·
`ONB` Onboarding · `OFB` Offboarding · `INC` Incident Response.

Pick the domain that best describes what the document is about; it forms the middle of the Doc ID
and lets the team browse everything for a tool across document types.

## Audience

Mark each document **Internal** (default) or **Client-facing**. Client Guides are Client-facing;
most others are Internal. Keep client-facing docs jargon-free and reassuring.

## Document structure

Follow the section skeletons in `MITS_DocumentTemplates.md` for each type (Purpose, Scope,
Procedure, Verification, etc.), the standard MITS title block, and the revision-history block.
DocCenter doesn't enforce structure — the templates standard does — but consistent structure is
what keeps the library professional.

## Playbooks (when asked to build one)

A **Playbook** in DocCenter is an ordered, phased **manifest of existing documents** for a
repeatable job (e.g. client onboarding) — it is *not* a procedure itself.

- Group referenced documents into phases: **Prep → Execute → Verify → Handoff**.
- Reference each document by its **Doc ID**; the steps live in those documents, not the playbook.
- Mark each referenced doc **Required** or **Conditional** (with the condition).
- Don't write procedural steps in a playbook — if you're writing steps, they belong in an SOP/RBK
  that the playbook references.

## What DocCenter handles for you (so you don't have to)

- Generating the read-only **PDF** from your Word master
- Filing the document into the right **SharePoint folder**
- The live **index**, full-text **search**, tags, **review-date** reminders, favorites
- **Version notes** (from your changelog) and source-chat links
- Sharing everything across the team and auto-updating itself

## Quick checklist for a finished document

- [ ] It's a clean, final `.docx` (no PDF needed)
- [ ] Follows the right template/type structure + title block + revision history
- [ ] Has a Doc ID in `TYPE-DOMAIN-NNN` form (reuse on revision)
- [ ] Filename is descriptive, with `_vN.N` if versioned
- [ ] Changelog at the end (becomes DocCenter's Version notes)
- [ ] Correct type (category) and domain in mind; audience set appropriately
