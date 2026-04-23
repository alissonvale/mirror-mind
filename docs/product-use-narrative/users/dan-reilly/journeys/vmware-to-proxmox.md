[< Dan Reilly](../)

# VMware to Proxmox Migration

**Status:** active
**Organization:** keystone-valley-health

## Briefing

Keystone is moving off VMware. The Broadcom acquisition turned our renewal math into something the CFO couldn't stomach, and the CIO used that as cover to push an initiative he probably wanted to push anyway. We're migrating the on-prem virtualization layer to Proxmox over the course of roughly eighteen months.

I'm technical lead on the migration. That's officially a stretch assignment; unofficially it's work that had to fall on someone who knows both the current stack and what the new stack actually looks like in production, which is a short list. Director agreed. CIO approved.

The scope:
- 180 Linux hosts across three sites (main hospital data center, critical-access site, DR site)
- Roughly 300 VMs, 60/40 stateful/stateless
- Networking reworked where segmentation is wrong anyway (two of the old vSwitches are a mess we've been wanting to clean up for years)
- A new backup story that integrates with Proxmox's native tooling and our existing Veeam fallback
- Documentation and runbook updates across the board
- Training the rest of the team so Proxmox isn't just "Dan knows it"

## Situation

We are in the early phase. A pilot cluster is up at the critical-access site, running four non-critical VMs and shadow-copying a handful more. The team has had two training sessions. I've given an internal talk to the director group on the plan and the risks.

The live questions right now:

**Sequencing.** We have a working plan to migrate by site (critical-access first, then DR, then main). But a few people are pushing for a service-by-service migration across all sites instead, which would let us retire VMware chunks faster. I think they're wrong — service-by-service creates more concurrent state to track and more rollback complexity — but the argument isn't settled.

**Networking.** The piece I'm least sure about. We have legacy vDS configurations that were hand-built over ten years. Translating them cleanly to Linux bridges (or into a full SDN fabric like OVN) is genuinely harder than it sounds, and the cost of getting it wrong is segmentation violations we'd find out about six months later when something weird happens.

**The CIO's timeline.** He wants a demo of measurable progress every ninety days. I understand why. I also know that the real risk on this kind of migration isn't slowness — it's a rushed cutover that drops something important during a patient-care window. The negotiation about pace is ongoing and not explicit.

**What it means for me.** If this goes well, I've led the largest infrastructure transition the hospital has done in a decade. That's a plus on the career ledger. If it goes badly, it goes badly under my name in a way that's more visible than I'm used to. I'm aware of both and trying to let neither be the motivator.
