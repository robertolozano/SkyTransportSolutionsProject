"""
Generates the submission deck.

Kept in the repo so the deck is reproducible and reviewable rather than a binary
someone has to trust. Run:  /tmp/deckenv/bin/python scripts/build-deck.py
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

# Palette lifted from the application's design tokens, so the deck and the
# product read as one thing.
NAVY = RGBColor(0x1E, 0x3A, 0x8A)
INK = RGBColor(0x0F, 0x17, 0x2A)
INK_SOFT = RGBColor(0x47, 0x55, 0x69)
FAINT = RGBColor(0x94, 0xA3, 0xB8)
CANVAS = RGBColor(0xF6, 0xF7, 0xF9)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CRITICAL = RGBColor(0xB9, 0x1C, 0x1C)
GOOD = RGBColor(0x15, 0x80, 0x3D)
HIGH = RGBColor(0xC2, 0x41, 0x0C)
EDGE = RGBColor(0xE2, 0xE8, 0xF0)

FONT = "Arial"
W, H = Inches(13.333), Inches(7.5)

prs = Presentation()
prs.slide_width, prs.slide_height = W, H
BLANK = prs.slide_layouts[6]


def bg(slide, color=WHITE):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = color


def box(slide, left, top, width, height, fill=None, line=None):
    from pptx.enum.shapes import MSO_SHAPE
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shp.adjustments[0] = 0.06
    if fill:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    else:
        shp.fill.background()
    if line:
        shp.line.color.rgb = line
        shp.line.width = Pt(1)
    else:
        shp.line.fill.background()
    shp.shadow.inherit = False
    return shp


def text(slide, s, left, top, width, height, size=18, color=INK, bold=False,
         align=PP_ALIGN.LEFT, space_after=6, line_spacing=1.15):
    tb = slide.shapes.add_textbox(left, top, width, height)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    lines = s if isinstance(s, list) else [s]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(space_after)
        p.line_spacing = line_spacing
        run = p.add_run()
        run.text = line
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
        run.font.name = FONT
    return tb


def bullets(slide, items, left, top, width, size=16, color=INK_SOFT, gap=10):
    """items: list of (bold_lead, rest) or plain strings."""
    tb = slide.shapes.add_textbox(left, top, width, Inches(4.5))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(gap)
        p.line_spacing = 1.2
        if isinstance(item, tuple):
            lead, rest = item
            r1 = p.add_run(); r1.text = lead
            r1.font.size = Pt(size); r1.font.bold = True
            r1.font.color.rgb = INK; r1.font.name = FONT
            r2 = p.add_run(); r2.text = rest
            r2.font.size = Pt(size); r2.font.color.rgb = color; r2.font.name = FONT
        else:
            r = p.add_run(); r.text = item
            r.font.size = Pt(size); r.font.color.rgb = color; r.font.name = FONT
    return tb


def slide_with_header(title, kicker=None):
    s = prs.slides.add_slide(BLANK)
    bg(s, WHITE)
    # Navy rule at the top for a consistent spine.
    box(s, Inches(0), Inches(0), W, Inches(0.09), fill=NAVY)
    top = Inches(0.55)
    if kicker:
        text(s, kicker.upper(), Inches(0.85), top, Inches(11.5), Inches(0.3),
             size=11, color=FAINT, bold=True)
        top = Inches(0.92)
    text(s, title, Inches(0.85), top, Inches(11.6), Inches(0.9), size=30, color=INK, bold=True)
    return s


def stat(slide, left, top, value, label, color=INK, width=Inches(2.6)):
    text(slide, value, left, top, width, Inches(0.6), size=34, color=color, bold=True)
    text(slide, label, left, top + Inches(0.58), width, Inches(0.5), size=12, color=FAINT)


# ---------------------------------------------------------------- 1. Title
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
box(s, Inches(0), Inches(0), Inches(0.28), H, fill=NAVY)
text(s, "SKY INNOVATION PROJECT  ·  AUTOMATE TRACK", Inches(1.1), Inches(2.1),
     Inches(11), Inches(0.4), size=13, color=FAINT, bold=True)
text(s, "Compliance Radar", Inches(1.1), Inches(2.6), Inches(11), Inches(1.1),
     size=54, color=INK, bold=True)
text(s, "Sky Transport Solutions is paid to remember 18,000 carriers' deadlines.",
     Inches(1.1), Inches(3.85), Inches(10.5), Inches(0.5), size=20, color=INK_SOFT)
text(s, "This derives every one of them from the regulations, models what blocks what,",
     Inches(1.1), Inches(4.28), Inches(10.5), Inches(0.5), size=20, color=INK_SOFT)
text(s, "and surfaces the date each truck stops being legal.",
     Inches(1.1), Inches(4.71), Inches(10.5), Inches(0.5), size=20, color=INK_SOFT)
text(s, "Roberto Lozano", Inches(1.1), Inches(5.8), Inches(6), Inches(0.4),
     size=16, color=INK, bold=True)

# ---------------------------------------------------------------- 2. The company
s = slide_with_header("Sky Transport Solutions is not a trucking company.", "What I learned first")
bullets(s, [
    ("They are the outsourced paperwork department ", "for ~18,000 motor carriers — about 25 people holding other people's compliance obligations."),
    ("Their customers are owner-operators and small fleets. ", "The person who owns the truck is driving it 11 hours a day. He is not logging into seven government portals."),
    ("The product is memory and follow-through. ", "Membership tiers — Silver $199, Gold $299, Diamond $399 per truck per year — are sorted by how many renewals Sky remembers for you."),
], Inches(0.85), Inches(2.0), Inches(11.6), size=17)
box(s, Inches(0.85), Inches(4.9), Inches(11.6), Inches(1.4), fill=CANVAS, line=EDGE)
text(s, "This is a deadline liability business.",
     Inches(1.2), Inches(5.2), Inches(11), Inches(0.45), size=18, color=NAVY, bold=True)
text(s, "Every design decision followed from that. I spent the first hours on the domain rather than the code, and that research is what made the rest specific.",
     Inches(1.2), Inches(5.68), Inches(11), Inches(0.5), size=14, color=INK_SOFT)

# ---------------------------------------------------------------- 3. Domain
s = slide_with_header("Three things make this genuinely hard.", "The domain")
cards = [
    ("Deadlines are derived,\nnot delivered.",
     "Nobody sends a bill. The biennial federal update is due on a date encoded in the carrier's own USDOT number — last digit picks the month, second-to-last picks the year.", NAVY),
    ("Obligations are chained.",
     "The IRS returns a stamped Schedule 1 after the heavy vehicle tax is filed, and the DMV will not renew registration without it. A missed emissions test in August is a plate failure in November.", HIGH),
    ("Failure is asymmetric.",
     "Filing on time earns $199–$399 a year. Missing one item parks a truck earning ~$800 a day — and the client blames the service they hired to remember.", CRITICAL),
]
x = Inches(0.85)
for title, body, accent in cards:
    box(s, x, Inches(2.0), Inches(3.65), Inches(3.6), fill=CANVAS, line=EDGE)
    box(s, x, Inches(2.0), Inches(3.65), Inches(0.08), fill=accent)
    text(s, title.replace("\n", " "), x + Inches(0.3), Inches(2.35), Inches(3.05), Inches(0.9),
         size=17, color=INK, bold=True)
    text(s, body, x + Inches(0.3), Inches(3.35), Inches(3.05), Inches(2.0), size=13, color=INK_SOFT)
    x += Inches(3.9)

# ---------------------------------------------------------------- 4. Problems -> features
s = slide_with_header("From pain point to feature.", "How I chose what to build")
rows = [
    ("Every deadline must be derived", "Rules engine — 7 cited rules deriving dates from the regulations"),
    ("Obligations block each other", "Dependency graph → a single out-of-service date per truck"),
    ("Chasing documents from drivers", "Proactive requests 60 days out, then a fixed escalation ladder"),
    ("Retyping into seven portals", "Master record → pre-populated filing packets"),
    ("Everything spikes at once", "Seasonal view + pull-forward that flattens the peak"),
    ("One miss costs more than one filing earns", "Revenue-at-risk ranking and tier coverage gaps"),
]
top = Inches(1.95)
for i, (problem, feature) in enumerate(rows):
    fill = CANVAS if i % 2 == 0 else WHITE
    box(s, Inches(0.85), top, Inches(11.6), Inches(0.72), fill=fill, line=EDGE)
    text(s, problem, Inches(1.15), top + Inches(0.2), Inches(4.6), Inches(0.4), size=14, color=INK, bold=True)
    text(s, "→", Inches(5.85), top + Inches(0.19), Inches(0.4), Inches(0.4), size=15, color=FAINT)
    text(s, feature, Inches(6.35), top + Inches(0.2), Inches(5.9), Inches(0.4), size=14, color=INK_SOFT)
    top += Inches(0.79)

# ---------------------------------------------------------------- 5. The asset
s = slide_with_header("The rules engine is the asset.", "Architecture")
bullets(s, [
    ("Pure. ", "src/rules/ imports nothing — no database, no React, no HTTP. Facts in, dated obligations out."),
    ("Deterministic. ", "The current date is injected, never read from the clock, so every rule is testable against a fixed day."),
    ("Cited. ", "Each rule carries the agency, the CFR section, and a source URL — and an explicit marker saying whether it was verified or still needs review."),
    ("Runs anywhere. ", "Because it has no I/O, the same functions that derive dates on the server run unchanged in the browser for the what-if simulator."),
], Inches(0.85), Inches(1.95), Inches(11.6), size=16)
box(s, Inches(0.85), Inches(4.75), Inches(11.6), Inches(1.55), fill=CANVAS, line=EDGE)
text(s, "Obligations are materialised, not computed per request.", Inches(1.2), Inches(5.05),
     Inches(11), Inches(0.4), size=16, color=NAVY, bold=True)
text(s, "Deriving in application code per page load does not survive 18,000 carriers. Persisting them makes book-wide questions a GROUP BY — and gives an audit trail for \"why did we think this was due?\"",
     Inches(1.2), Inches(5.5), Inches(10.9), Inches(0.8), size=13, color=INK_SOFT)

# ---------------------------------------------------------------- 6. The differentiator
s = slide_with_header("The date nobody's calendar contains.", "The differentiator")
text(s, "Altamont Freight Systems, Unit 101 — a real chain from the seeded book:",
     Inches(0.85), Inches(1.9), Inches(11.5), Inches(0.4), size=15, color=INK_SOFT)
chain = [("CARB Clean Truck Check", "Aug 17", CRITICAL), ("Form 2290 (HVUT)", "Aug 31", HIGH),
         ("IRP Plate Renewal", "Sep 16", INK)]
x = Inches(0.85)
for i, (label, date, accent) in enumerate(chain):
    box(s, x, Inches(2.5), Inches(3.1), Inches(1.25), fill=CANVAS, line=EDGE)
    box(s, x, Inches(2.5), Inches(3.1), Inches(0.07), fill=accent)
    text(s, label, x + Inches(0.25), Inches(2.78), Inches(2.6), Inches(0.4), size=14, color=INK, bold=True)
    text(s, date, x + Inches(0.25), Inches(3.18), Inches(2.6), Inches(0.4), size=13, color=INK_SOFT)
    if i < 2:
        text(s, "→", x + Inches(3.2), Inches(2.95), Inches(0.5), Inches(0.4), size=20, color=FAINT)
    x += Inches(3.7)
text(s, "OUT OF SERVICE", Inches(8.25), Inches(3.85), Inches(3.1), Inches(0.3), size=11, color=CRITICAL, bold=True)
box(s, Inches(0.85), Inches(4.45), Inches(11.6), Inches(1.85), fill=CANVAS, line=EDGE)
text(s, "The binding constraint is the emissions check five days from now.",
     Inches(1.2), Inches(4.8), Inches(11), Inches(0.45), size=18, color=INK, bold=True)
text(s, "The plate expires September 16, but miss the emissions check and the renewal behind it cannot complete, whatever the calendar says. No due-date list shows this — it appears only once you model what blocks what. That truck is also on the Silver plan, which does not cover plate renewals at all.",
     Inches(1.2), Inches(5.35), Inches(10.9), Inches(0.95), size=14, color=INK_SOFT)

# ---------------------------------------------------------------- 7. AI workflow
s = slide_with_header("Research first, then encode it.", "How I worked with AI")
bullets(s, [
    ("Context before code. ", "I researched the company and the regulations before writing anything — what STS actually sells, how each deadline is derived, which filings gate which. That research is why the rules carry citations instead of guesses."),
    ("Then I turned that context into five subagents, ", "committed to the repo: compliance-rules, data-layer, security-boundaries, test-author, ui-ux."),
    ("Each encodes judgment that is not in the code — ", "a regulation, a trap already hit, a boundary already argued about. They route by task, so the next change starts from that knowledge instead of rediscovering it."),
], Inches(0.85), Inches(1.9), Inches(11.6), size=15)
box(s, Inches(0.85), Inches(4.75), Inches(11.6), Inches(1.55), fill=CANVAS, line=EDGE)
text(s, "The filter mattered more than the count.", Inches(1.2), Inches(5.05), Inches(11), Inches(0.4),
     size=16, color=NAVY, bold=True)
text(s, "An agent earns its place when it encodes judgment not already in the code. I rejected code-reviewer, refactorer, performance, accessibility and docs-writer — \"look for bugs\" is default behaviour, and five agents that route cleanly beat twelve that overlap. The rejections are documented in the repo.",
     Inches(1.2), Inches(5.5), Inches(10.9), Inches(0.8), size=13, color=INK_SOFT)

# ---------------------------------------------------------------- 8. Automating deadlines
s = slide_with_header("Automating the work that has no trigger.", "Feature — AUTOMATE")
bullets(s, [
    ("7 rules, each cited. ", "Biennial federal update, quarterly fuel tax, heavy vehicle tax, CA emissions, plate renewal, annual federal registration, medical certificates."),
    ("Two of them are marked \"needs review\" on purpose. ", "The CARB testing cadence and plate staggering are genuinely uncertain, and the app says so rather than looking confident."),
    ("Backward scheduling. ", "A due date is not a start date. Each step is bound by its own deadline and by the start of whatever depends on it — the demo truck already reads \"behind schedule\"."),
    ("Document collection runs itself. ", "Requests go out 60 days before expiry, then climb a fixed ladder — text, second text, staff call, escalate. Staff time is spent only after the cheap channels fail."),
], Inches(0.85), Inches(1.9), Inches(11.6), size=15)

# ---------------------------------------------------------------- 9. Document capture
s = slide_with_header("They photograph it. A person confirms it.", "Feature — document intake")
bullets(s, [
    ("Capture where the client is. ", "A live camera opens on phone or laptop; images are downscaled in the browser — a 12 MB shot becomes ~200 KB, which on truck-stop signal decides whether the upload finishes."),
    ("Two reading paths, one pipeline. ", "A generated PDF goes to a deterministic text parser; a photograph goes to a vision model. Both return the same shape, so review doesn't care which ran."),
    ("It refuses to guess. ", "An ambiguous date — 03/04/2027 could be 3 April or 4 March — returns nothing rather than a coin flip. Half the guesses would silently move a compliance deadline."),
    ("Extraction proposes; a person commits. ", "The staff screen sets what was read against what the record says and flags differences. Nothing writes back automatically."),
], Inches(0.85), Inches(1.9), Inches(11.6), size=15)

# ---------------------------------------------------------------- 10. Three surfaces
s = slide_with_header("Three audiences, three surfaces, one rules engine.", "Feature — client experience")
cols = [
    ("Public", "/start", "A prospect who isn't a customer yet. Six questions, and the requirement list updates live — answering \"intrastate only\" drops 10 requirements to 5 and the price from $1,200 to $975.", NAVY),
    ("Client", "/c/<token>", "An owner-operator on a phone. Leads with \"You're covered\" or \"We need a few things.\" No risk scores, no jargon, no rule citations — a test enforces it.", GOOD),
    ("Staff", "console", "A specialist with 18,000 carriers. Dense tables, ranked work queue, dependency chains, filing packets, scan review.", HIGH),
]
x = Inches(0.85)
for name, route, body, accent in cols:
    box(s, x, Inches(1.95), Inches(3.65), Inches(3.9), fill=CANVAS, line=EDGE)
    box(s, x, Inches(1.95), Inches(3.65), Inches(0.08), fill=accent)
    text(s, name, x + Inches(0.3), Inches(2.3), Inches(3.05), Inches(0.4), size=19, color=INK, bold=True)
    text(s, route, x + Inches(0.3), Inches(2.75), Inches(3.05), Inches(0.35), size=12, color=FAINT)
    text(s, body, x + Inches(0.3), Inches(3.2), Inches(3.05), Inches(2.4), size=13, color=INK_SOFT)
    x += Inches(3.9)
text(s, "Onboarding is public because a prospect has no account to log into — the account is what the flow produces. That's why no client ever sees another client.",
     Inches(0.85), Inches(6.1), Inches(11.6), Inches(0.6), size=14, color=INK_SOFT)

# ---------------------------------------------------------------- 11. Testing
s = slide_with_header("The tests found two real bugs.", "What happened")
box(s, Inches(0.85), Inches(1.9), Inches(5.65), Inches(3.9), fill=CANVAS, line=EDGE)
box(s, Inches(0.85), Inches(1.9), Inches(5.65), Inches(0.08), fill=CRITICAL)
text(s, "Valid PDFs were rejected", Inches(1.15), Inches(2.25), Inches(5.05), Inches(0.4), size=17, color=INK, bold=True)
text(s, "Upload validation trusted the browser's declared file type, which is derived from the extension — so a file without one reported nothing and was refused.\n\nFixed by identifying files from their magic number. More permissive for real users, and stricter against a forged type.",
     Inches(1.15), Inches(2.8), Inches(5.05), Inches(2.8), size=13, color=INK_SOFT)

box(s, Inches(6.8), Inches(1.9), Inches(5.65), Inches(3.9), fill=CANVAS, line=EDGE)
box(s, Inches(6.8), Inches(1.9), Inches(5.65), Inches(0.08), fill=CRITICAL)
text(s, "The simulator went silent", Inches(7.1), Inches(2.25), Inches(5.05), Inches(0.4), size=17, color=INK, bold=True)
text(s, "The what-if tool rebuilt dependency edges from the simulated dates. Slipping a prerequisite past its deadline deleted the edge instead of breaking it — so it reported no problem in exactly the case it exists to surface.\n\nTopology is a property of the rules, not the calendar.",
     Inches(7.1), Inches(2.8), Inches(5.05), Inches(2.8), size=13, color=INK_SOFT)
text(s, "Both are now pinned by tests. 91 unit tests run in under a second with no database; 20 browser tests cover what unit tests structurally cannot.",
     Inches(0.85), Inches(6.05), Inches(11.6), Inches(0.6), size=14, color=INK_SOFT)

# ---------------------------------------------------------------- 12. Honesty
s = slide_with_header("Where it tells you what it doesn't know.", "A deliberate choice")
bullets(s, [
    ("Two rules are marked \"needs review.\" ", "Encoding regulation from secondary sources is where compliance software quietly goes wrong. A rule that announces uncertainty is safer than one that looks confident and is subtly wrong."),
    ("A truncated list says so. ", "\"The first 200 of 919\" — not \"200 obligations\", which reads as complete."),
    ("Unread documents are shown as unread. ", "With no model credentials configured, the app queues for manual review rather than displaying a plausible-looking result."),
    ("Capacity assumptions are printed on the page. ", "Staff count, hours per filing — labelled estimates, not measurements."),
], Inches(0.85), Inches(1.9), Inches(11.6), size=15)
box(s, Inches(0.85), Inches(5.2), Inches(11.6), Inches(1.1), fill=CANVAS, line=EDGE)
text(s, "In a compliance product, a screen that looks authoritative and is wrong is worse than one that admits its limits.",
     Inches(1.2), Inches(5.55), Inches(11), Inches(0.5), size=16, color=NAVY, bold=True)

# ---------------------------------------------------------------- 13. Results
s = slide_with_header("What exists.", "Results")
stat(s, Inches(0.85), Inches(2.0), "7", "compliance rules,\neach cited")
stat(s, Inches(3.45), Inches(2.0), "22", "routes across\nthree surfaces")
stat(s, Inches(6.05), Inches(2.0), "111", "tests — 91 unit,\n20 browser")
stat(s, Inches(8.65), Inches(2.0), "1,150", "obligations derived\nfrom 40 carriers")
bullets(s, [
    ("PostgreSQL + Prisma, ", "10 tables, 6 migrations, with hand-written SQL for the aggregate work an ORM hides."),
    ("Next.js + React, ", "Server Components querying the database directly — no API layer to maintain."),
    ("Five subagents committed to the repo, ", "encoding the domain and the decisions."),
], Inches(0.85), Inches(3.9), Inches(11.6), size=15)
box(s, Inches(0.85), Inches(5.55), Inches(11.6), Inches(0.95), fill=CANVAS, line=EDGE)
text(s, "Not built: cross-portal reconciliation against live agency records, and writing a confirmed extraction back to the credential. Both are described rather than half-implemented.",
     Inches(1.2), Inches(5.82), Inches(10.9), Inches(0.6), size=13, color=INK_SOFT)

# ---------------------------------------------------------------- 14. What I'd do next
s = slide_with_header("What I'd do next.", "If this were real")
bullets(s, [
    ("Wire the live FMCSA lookup. ", "Enter a real USDOT number and derive from the actual record instead of seeded data. Highest-value next step, and the one I'd start with."),
    ("Close the extraction loop. ", "A confirmed reading should update the credential and let the engine recompute from it — today it stops at the comparison."),
    ("Reconcile against agency records. ", "Silent data drift — an address updated with the state but not the feds — causes real revocations, and nobody audits for it."),
    ("Measure the assumptions. ", "The capacity model uses estimated handling times. Real ones come from time tracking, and would turn the planning view from a shape into a number."),
], Inches(0.85), Inches(1.9), Inches(11.6), size=15)

# ---------------------------------------------------------------- 15. Demo
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
box(s, Inches(0), Inches(0), Inches(0.28), H, fill=NAVY)
text(s, "DEMO", Inches(1.1), Inches(1.6), Inches(11), Inches(0.4), size=13, color=FAINT, bold=True)
text(s, "Let me show you.", Inches(1.1), Inches(2.05), Inches(11), Inches(0.9), size=44, color=INK, bold=True)
steps = [
    "Public walkthrough — answer \"intrastate only\" and watch 10 requirements become 5",
    "Dashboard — the ranked work queue and what a parked truck actually costs",
    "Unit 101 — the chain, the out-of-service date, and the what-if slider breaking it",
    "Rules — where every date came from, and which two need review",
    "Client portal — send a document, watch it get read back",
    "Scans — what was read set against what the record says",
]
top = Inches(3.25)
for i, stp in enumerate(steps):
    text(s, str(i + 1), Inches(1.1), top, Inches(0.4), Inches(0.4), size=15, color=NAVY, bold=True)
    text(s, stp, Inches(1.6), top, Inches(10.6), Inches(0.4), size=16, color=INK_SOFT)
    top += Inches(0.52)

out = "docs/compliance-radar-deck.pptx"
import os
os.makedirs("docs", exist_ok=True)
prs.save(out)
print(f"wrote {out} — {len(prs.slides.__iter__.__self__._sldIdLst)} slides")
