[< Dan Reilly](../)

# Keystone Valley Health Network

**Status:** active

## Briefing

Keystone Valley Health Network is a regional nonprofit hospital system covering three counties in central Pennsylvania. Two acute-care hospitals, one critical-access hospital, a cancer center, and a network of outpatient clinics. Roughly 3,200 employees. Annual revenue in the low hundreds of millions.

I've been here fourteen years. I joined as a Linux systems admin when there were seven of us in infrastructure; now there are nineteen, and I'm the senior IC on the team — not a manager on paper, but the person two junior engineers look to every day, and the person the director calls when something breaks that everyone else is afraid of.

My surface area:
- The Linux server fleet (around 180 hosts, roughly 70/30 RHEL/Rocky)
- The virtualization layer (VMware today, Proxmox in a slow parallel migration)
- Part of the network — firewalls, core switches, some segmentation work
- The hybrid bridge to AWS (we run about 20% of workload there, rising)
- On-call rotation, roughly every fifth week

I report to the Director of Infrastructure, who reports to the CIO. The CIO is new in the last eighteen months.

## Situation

The organization is changing, and not in the direction I'd choose. A new CIO came in with a cloud-first mandate and a timeline that doesn't match the reality of a hospital stack built over twenty years. Two rounds of layoffs in the last three years trimmed the team on the application side; infrastructure has been spared but the margin is thin.

A recent incident — a misconfigured change in the storage layer during a patch window — had my name in the postmortem in a way I didn't love. Not blamed, exactly, but named. The director is still on my side. The CIO knows the name now.

I'm carrying three live threads here:

The VMware-to-Proxmox migration is underway and visible to leadership, partly as a cost conversation (Broadcom pricing made it politically easy) and partly as a stake in the ground about what "cloud-first" means in practice. Getting this right matters for the team's credibility and for my own.

The cloud-first pressure is an ongoing negotiation. The CIO wants more workload in AWS faster than I think is wise. I'm not against cloud — I'm against moving things that don't benefit from being there, at a pace that guarantees mistakes.

And there's the quieter thread of what I'm building toward. Fourteen years is long. I've been senior IC for six of those. Staying on this track another five is one option; moving into management, trying security or architecture, or eventually going independent are others. The hospital is where those questions play out practically — what I do here shapes what comes next.
