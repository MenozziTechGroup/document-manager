// In-app help / user guide. Written for techs using DocCenter cold.
const RED = 'var(--mits-red)'

function Section({ title, children }) {
  return (
    <section className="mb-7">
      <h2 className="text-sm font-semibold mb-2 pb-1 border-b" style={{ color: 'var(--mits-charcoal)', borderColor: '#e5e7eb' }}>{title}</h2>
      <div className="space-y-2 text-sm" style={{ color: '#374151' }}>{children}</div>
    </section>
  )
}
function Q({ q, children }) {
  return (
    <div>
      <div className="font-medium" style={{ color: 'var(--mits-charcoal)' }}>{q}</div>
      <div className="text-xs mt-0.5" style={{ color: '#6b7280', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

export default function HelpView() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b" style={{ borderColor: '#e5e7eb', background: 'white' }}>
        <h1 className="font-semibold text-base" style={{ color: 'var(--mits-charcoal)' }}>Help &amp; Guide</h1>
        <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>How DocCenter works and how to get things done</div>
      </div>

      <div className="p-6 max-w-2xl">

        <Section title="The big picture">
          <Q q="What is DocCenter?">
            A central place to find, organize, and run your MITS documents — Runbooks, SOPs, Checklists,
            Client Guides, Scripts, Letters, and more. The document <em>files</em> stay in your SharePoint folder;
            DocCenter adds the organization on top (tags, descriptions, review dates, playbooks) and shares it
            across the team.
          </Q>
          <Q q="Where do the files actually live?">
            In your <strong>vault</strong> — the SharePoint-synced folder on your PC (set in Settings → Vault Folder).
            DocCenter never moves or stores the files; it reads and opens them straight from there.
          </Q>
          <Q q="Is this shared with the team?">
            Yes. Everyone signs in, and the library organization, playbooks, and in-progress runs are shared live.
            Your vault folder path and a few personal settings stay on your own machine.
          </Q>
        </Section>

        <Section title="Getting started">
          <Q q="Sign in">
            Use your DocCenter email + password. You stay signed in on that machine. Set your name under
            Settings → Your Name so the activity log shows who did what.
          </Q>
          <Q q="Point at your vault">
            Settings → Vault Folder → Browse to your SharePoint-synced documents folder. Organize it with
            subfolders named after the categories (Runbooks, SOPs, Checklists, Client Guides, Scripts, Letters)
            so documents get categorized automatically.
          </Q>
          <Q q="Sync Vault">
            Click <strong>Sync Vault</strong> to scan that folder and pull documents into the library. Run it again
            anytime you add or change files in SharePoint — it adds new ones, re-links moved/renamed files to their
            existing info, and never touches the files themselves.
          </Q>
        </Section>

        <Section title="Documents">
          <Q q="Why two files per document (Word + PDF)?">
            The <strong>.docx is the editable master</strong>; the <strong>.pdf is the read-only copy</strong> for safe
            reading and sharing. DocCenter pairs them into one entry. <strong>Open PDF</strong> opens the read-only
            copy; <strong>Edit Source</strong> opens the Word file when you intend to make changes. (A Word-only
            document just shows a single "Open Document" button.)
          </Q>
          <Q q="Adding a document">
            Use <strong>Add Document</strong>, or simply <strong>drag a file onto the window</strong>. Pick a category
            and DocCenter files it into the right SharePoint subfolder for you. For a Word doc you can tick
            "Also create a PDF copy" to generate the read-only PDF automatically.
          </Q>
          <Q q="Doc ID, Domain, Audience">
            <strong>Doc ID</strong> is a stable handle like <span style={{ fontFamily: 'monospace' }}>SOP-MDM-003</span>
            (use Suggest, or type your established ID). <strong>Domain</strong> is the tool/area (Hornetsecurity, M365,
            DNSFilter…) and lets you browse across types. <strong>Audience</strong> marks a doc Internal or Client-facing.
          </Q>
          <Q q="Review dates & version notes">
            Set a <strong>review date</strong> to get reminded (and flagged on the dashboard) when a doc is due for a
            refresh. Paste a changelog into <strong>Version notes</strong> when you update a version, and the
            <strong> Source chat link</strong> lets you jump back to the Claude conversation that built it.
          </Q>
          <Q q="Superseding an old version">
            When a new version replaces an older document, open the new one and use <strong>Supersede…</strong> to pick
            the old doc — it gets archived and annotated automatically.
          </Q>
          <Q q="Scripts">
            PowerShell and other scripts are first-class. They show a dark terminal icon, an <strong>Open in Editor</strong>
            button (opens safely in an editor, never runs), and a <strong>Copy contents</strong> action to paste into a terminal.
          </Q>
        </Section>

        <Section title="Finding & organizing">
          <Q q="Search">
            Press <strong>Ctrl+K</strong> (or click the bar) to search. It matches titles, tags, Doc IDs, descriptions —
            and the <strong>text inside</strong> your documents.
          </Q>
          <Q q="Browse">
            The dashboard's <strong>Browse Library</strong> toggle switches between By Type, By Domain, and By Client.
            The sidebar mirrors these. Inside a list, use <strong>Sort</strong> and <strong>Filters</strong> (status,
            file type, needs-review).
          </Q>
          <Q q="Favorites & recent">
            Star a document to pin it; recently opened docs appear on the dashboard.
          </Q>
          <Q q="Bulk changes">
            In a document list, click <strong>Select</strong>, tick several docs, then set status/category, add a tag,
            set a review date, add them to a playbook, or remove — all at once.
          </Q>
        </Section>

        <Section title="Playbooks (run a workflow)">
          <Q q="What's a playbook?">
            An ordered, phased bundle of documents for a repeatable job (e.g. client onboarding). It's a checklist of
            <em>which documents to follow, in what order</em> — the steps themselves live in the documents it references.
          </Q>
          <Q q="Phases">
            Documents are grouped into <strong>Prep → Execute → Verify → Handoff</strong>, and each is marked Required or
            Conditional. Build a playbook under Playbooks → Manage: add documents, set their phase/order, toggle required.
          </Q>
          <Q q="Running one">
            Click <strong>Start</strong>, enter the client + ticket, and you get a tracked checklist with progress, an
            "up next" marker, and Open buttons. Your progress saves and is visible to the team, so anyone can pick it up.
            In-progress runs sit at the top of the Playbooks screen for quick resume.
          </Q>
        </Section>

        <Section title="Settings">
          <Q q="What's there">
            Your account + sign out, your name (for the activity log), the vault folder, an optional SharePoint link
            (for "Copy SharePoint link"), metadata backup, the search index rebuild, CSV export of the library, the tag
            library, and a one-time "Migrate local library to cloud" for a machine's existing data.
          </Q>
          <Q q="Activity log">
            A running record of changes on this machine (edits, imports, syncs, playbook activity), attributed to your name.
          </Q>
        </Section>

        <Section title="Good to know">
          <Q q="The app needs internet to load the shared library">
            It's online-first. If it can't reach the library you'll see a Retry screen. Your files in SharePoint are
            always available locally regardless.
          </Q>
          <Q q="First-run Windows warning">
            On install, Windows SmartScreen may warn ("unknown publisher") — that's expected for now; choose
            More info → Run anyway. The app updates itself automatically after that.
          </Q>
          <Q q="Need a hand?">
            Ask Michael, or check the project docs (BACKEND_SETUP.md / RELEASING.md) for the technical side.
          </Q>
        </Section>

      </div>
    </div>
  )
}
