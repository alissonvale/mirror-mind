---
title: "Proxmox networking: translating the vDS mess"
persona: engineer
organizations: [keystone-valley-health]
journeys: [vmware-to-proxmox]
---

**User:**
I've been dreading the networking piece of the Proxmox migration and I think I need to actually think about it instead of pushing it down the list again. The vDS config at the main site has about twelve years of accretion on it. Some of it I understand, some of it I don't, and some of it I'm pretty sure was wrong when it was built but everyone is afraid to touch. Where do I start.

**Assistant:**
Before we pick an approach, a question about where you actually are. Have you already diagrammed what the current vDS actually does — VLANs, uplinks, port groups, traffic types — or is that one of the things you've been dreading?

**User:**
Dreading it. There's a diagram from 2019 that's out of date. I've been meaning to regenerate it from the running config for months.

**Assistant:**
Then that's the first move, and it isn't the Proxmox move. You don't migrate a network you don't actually understand — that's how segmentation breaks in production six months later. Generate the current-state diagram from the live config first, not from memory or the old Visio.

A few ways to do it, cheapest to most involved:

- `esxcli` + `Get-VDPortgroup` / `Get-VDSwitch` from PowerCLI → dump port groups, VLANs, uplinks to CSV, clean up by hand. Not pretty, but honest.
- One of the open-source tools that does vCenter-to-graphviz. I've seen `vcbuild` used for this; quality depends on how weird your config is.
- Pay someone for a day of their time. Sometimes the right answer.

Whatever route, the output you want is: every VLAN, which hosts see it, which VMs use it, and what the uplink story is. That's the document the rest of the migration hangs on.

**User:**
Ok, so step zero is regenerate the diagram. Assume I do that. Then what's the actual translation question.

**Assistant:**
Then the question gets clearer. Proxmox uses Linux bridges by default, plus the option of OVS or OVN for anything more sophisticated. Most hospital-scale shops I've watched land on one of three shapes:

- **Pure Linux bridges per VLAN.** Simple. Very few moving parts. Works great until you need something vDS was doing that bridges don't do (LACP with complex hashing, certain kinds of traffic shaping, MAC learning across a fabric). For most workloads, it's enough.
- **OVS on each host.** Gives you more of the vDS feature parity. More configuration surface. More places to get it wrong. Worth it only if you can point at specific features you need.
- **OVN fabric.** The "full SDN" answer. Real overlay networking, distributed routing, nice API. Also a significant new concept to learn and operate. Not a good place to be during a migration unless someone on the team already knows it well.

My honest bet for Keystone: Linux bridges for most things, OVS only on the hosts where you actually hit a wall with bridges. Don't go to OVN during the migration. You can evolve to it later if you need to.

**User:**
Leadership is going to ask why not OVN. Cloud-first CIO, wants the modern thing.

**Assistant:**
The honest answer is that OVN is the right tool for a team that already knows OVN, and it's the wrong tool for a team that has to learn it while also migrating a hospital's core infrastructure. The risk budget isn't there.

If you want to give him a path: propose Linux bridges for the migration, with a line in the roadmap that says "evaluate OVN for fabric replacement once we're off VMware and the team has breathing room." That's not punting; that's sequencing. "We're not saying no to OVN; we're saying not during the cutover."

If he still wants OVN now, the question back to him is: what specific capability does OVN give us that Linux bridges don't, that we need during this migration. If he can't name it, the case isn't there.

**User:**
Good. One more. The service-by-service vs site-by-site question is still live. I keep leaning site-by-site. Am I right.

**Assistant:**
What's the argument for service-by-service?

**User:**
Faster retirement of VMware chunks. Parallel progress across sites. "Showing movement."

**Assistant:**
Those are all cosmetic wins. The costs of service-by-service:

- More concurrent state to track: a given VM might live half-migrated for weeks.
- More rollback complexity: if something breaks, the "where is it right now" question has more possible answers.
- Harder blast-radius reasoning: a problem at 3am could be in Proxmox or in VMware or at the boundary.
- Harder to demonstrate that a piece is *done*: a retired VMware host is a clean signal; a partially-migrated service isn't.

Site-by-site gives you a bounded scope per phase, a clear rollback plan, and one clean "this site is now Proxmox" milestone each time. It's slower by the calendar, but it's almost always faster by the incident count.

You're right. The argument for service-by-service is political, not operational. I'd say it that way to the director, not the CIO.

**User:**
Yeah. Ok. I'm going to block out next Saturday morning to do the diagram work. Appreciate this.

**Assistant:**
Good. Saturday in the shop might be better, but Saturday at the desk is the right call this week.
