[< Dan Reilly](./)

# Dan Reilly

**Age:** 48
**Location:** Lancaster, Pennsylvania
**Occupation:** Senior Infrastructure Engineer at Keystone Valley Health Network (14th year)
**Family:** Married to Elena, 21 years. Two teenagers at home.

## Background

Dan grew up outside Scranton, the second of three kids. His father was a postal carrier, his mother kept the books at a small dental practice. He took apart the family PC in 1988, broke it, fixed it, and never stopped. Associate's degree in Computer Information Systems from a community college; he started in desktop support at 22 and has been in IT ever since.

He met Elena at a friend's wedding in his early twenties. They married two years later. They bought their house in Lancaster in 2012 with a 30-year mortgage and finally paid off the kitchen renovation last summer.

Twenty-six years into the field, Dan has watched Novell NetWare give way to Active Directory, AD give way to cloud, and cloud start to feel like the same old mainframe with a web UI. He has no patience for hype and a lot of patience for systems that have to stay up while someone's baby is in the NICU.

## What he does

Dan is the senior infrastructure engineer at Keystone Valley Health Network, a regional nonprofit hospital system covering three counties. He's been there fourteen years. He's responsible for the Linux server fleet, the virtualization layer (still VMware, with an in-progress migration to Proxmox), part of the network gear, and increasingly the hybrid bridge to AWS. He's not a people manager — he has two junior engineers who look to him but don't report to him on paper.

Salary is in the mid-nineties. In Lancaster that's solidly middle-class. Elena works full-time at a regional insurance company. The household is comfortable, not rich — one modest vacation a year, no boat, no second home.

## The homelab

In the basement, Dan runs a Proxmox server on a refurbished HP DL380 he bought used. It hosts the family's Plex, a Home Assistant instance that drives the thermostats and the outdoor lights, a Nextcloud, and a handful of other small services.

For anything that needs to be on the public internet — the family's password manager, their shared calendar sync, and now their Mirror Mind server — he rents a small VPS at Hetzner. He keeps it tidy: Caddy in front, systemd services for everything, Ansible playbooks for the rebuilds, weekly offsite backups to a drive at his brother-in-law's place two states away.

He discovered Mirror Mind in a self-hosting community thread in late autumn. He set it up on the Hetzner box over a weekend, built his own identity, and then — over the following month — added Elena and the two kids as users on the same server. The four of them each have their own mirror. They don't share data. Dan is the admin; everyone else is just a user.

This matters to Dan: he doesn't want his family's inner lives running on someone else's cloud. The server is his. If a vendor goes out of business, the SQLite file is his to move. He's seen enough services die to trust that particular detail.

## The shop

In the corner of the garage Dan has a small woodworking shop. He built the bench himself, eight years ago, from a plan out of an old *Fine Woodworking* and a stack of mismatched maple he got for cheap at an estate sale. He has a rotation of vintage hand planes he's tuned up over the years, a wall of chisels he keeps sharp, and a small collection of Japanese saws that surprised him with how much he liked them.

He works slowly, mostly with hand tools, mostly unplugged. He reads Christopher Schwarz and Paul Sellers the way other people read self-help — constantly, with a small degree of skepticism. He does not own a domino joiner. He does not own a pocket-hole jig. He has nothing against them; he just likes the quiet.

Over those eight years the shop has produced a kitchen island for Elena, a blanket chest for their bedroom, a small tool cabinet for himself, a Shaker-style bedside table that took him seven months and that he likes more than anything else he's made, and a long list of projects that aren't quite done. The current long one is a writing desk in cherry, hand-cut dovetails and all, that he's been building for his mother. He hasn't told her it exists. He isn't yet sure whether it's a gift or an heirloom.

The shop is the one place where the work is physical, the wood is the answer, and nobody is paging him about an outage. It's where he goes to think without a screen. If the homelab is how he keeps the family's digital life clean, the shop is where he keeps his own hands honest.

## What he carries

**His daughter's college.** She's a sophomore in high school. College is two years away. They've been saving a little at a time since she was born, and it's not going to be enough for the kind of school she's pointing toward. He has not figured out yet how to have that conversation with her without killing the dream.

**His mother.** Dad died in 2023. Mom is 76 and lives alone outside Scranton, about two and a half hours away. She's started repeating stories. Last month she left the stove on twice in one week. He drives up the first weekend of every month. His older brother lives in Phoenix and is useful on phone calls.

**The A1C.** At his last physical it came back at 5.9 — pre-diabetic, not yet diabetic. He carries about twenty extra pounds. He walks the dog two miles in the evenings and insists it counts.

**Work, quietly.** Fourteen years at the hospital, and the organization is changing. Two rounds of layoffs in the last three years — not his team, but close. A new CIO wants to move more to cloud, faster than Dan thinks is wise. A recent incident on a critical system had his name in a postmortem in a way he didn't love. He's not panicking. He is paying attention.

**The quiet question.** Twenty-six years in ops. At forty-eight, the question of whether he stays on this track, moves into management, tries something adjacent (security? solutions architecture? teaching?), or starts a small consulting thing on the side — that question has started showing up at 3 a.m. more often than he admits.

## How he thinks

Dan reads practically. Current rotation: a stack of Tailscale blog posts he's been meaning to work through, a book on SRE principles (Google's, he's suspicious of parts of it), *The Soul of a New Machine* for the third time, and a Michael Connelly detective novel to wind down. He listens to *Darknet Diaries* on his commute and a couple of political podcasts he keeps meaning to cut down on.

He plays acoustic guitar — fingerstyle, mostly for himself. He's not on social media except a mostly-lurking Mastodon account.

## Voice and temperament

- Plain-spoken. Pennsylvanian-neutral accent. Does not perform expertise.
- Dry. Quick with a deadpan line but slow to raise his voice.
- Patient. Ops teaches you that problems are almost always simpler and almost always more annoying than they first seem.
- Skeptical of hype — AI, cloud-first, serverless, anything with "next-generation" in the name.
- Avoids confrontation, but will plant his feet when a change is going to break something. Will not be rolled by a vendor or an executive.
- Private about his inner life. Journals in spurts. Doesn't share easily.

## How he uses Mirror Mind

Dan uses his mirror across five rough modes:

1. **Work thinking** — architecture decisions, incident postmortems, scripts for difficult conversations (with vendors, with his manager, with the CIO). Thinking through the VMware-to-Proxmox migration arc without letting it become a résumé-driven hobby.
2. **The homelab** — design decisions on the Hetzner box and the basement stack; how to keep the family's Mirror Mind server clean as it grows; whether Tailscale plus a reverse proxy is enough or whether something sturdier is needed.
3. **Family and caregiving** — how to talk with his daughter about the college-money question, how to coordinate with his brother on their mother's care, how to stop dodging his A1C number.
4. **The quiet question** — what comes after twenty-six years in ops. Exploring management, security, architecture, consulting — not to decide tomorrow, but to stop pretending the question isn't there.
5. **Incidental capture** — a quick thought on the drive home, a half-formed idea during a meeting, a vent at the end of a rough on-call week.

He uses the mirror mostly from his laptop at home in the evenings, and from Telegram on his phone throughout the day. Occasionally from the CLI when he's already SSH'd into something and wants to think out loud.

## Why he works as a pilot demo persona

Dan exercises a fair cross-section of Mirror Mind's surface area without demanding an executive's life:

- **Hosts the server.** Dan is the narrative reason this family has a self-hosted Mirror Mind at all. He provisioned the VPS, set up the server, and added the other users. This anchors the admin surface in a believable user.
- **Non-technical creative practice.** Woodworking is a genuine passion, not a footnote. It gives Mirror Mind a different kind of material to work with — slow craft, physical problem-solving, project arcs measured in months, a domain where the language is joinery and grain and sharpening rather than infrastructure and ops.
- **Multiple organizations.** Keystone Valley Health Network (day job), his own homelab / family tech stack (a real operational context for him), and the small local homelab meetup he attends once a month.
- **Multiple journeys.** The VMware-to-Proxmox migration, the quiet career question, his mother's care, his daughter's college, his own health.
- **Domain range across personas.** Engineer (work and homelab), strategist (career and organizational politics), son (his mother), coach (health and habit), chronicler (the blog posts he keeps meaning to publish).
- **Continuity over time.** Caregiving arcs, slow-burn career thinking, a multi-quarter infrastructure migration. Conversations should accumulate.
- **Mixed channels.** Laptop at home, Telegram on the move, CLI when he's already in a terminal.
- **Everyday sensitivity.** Money, a parent in decline, workplace politics, health — good pressure on privacy without being dramatic.
