[< Dan Reilly](../)

# Reilly Homelab

**Status:** active

## Briefing

This is the family's self-hosted tech stack, run out of my basement and a small VPS at Hetzner. It's not a business, it's not a hobby project in the sandbox sense — it's the infrastructure the family actually depends on day to day. Treating it as an organization is a habit that keeps it clean: it forces me to think in terms of SLAs, backups, and documentation rather than "it'll be fine."

What runs where:

**In the basement, on a Proxmox host (an HP DL380 I bought used eight years ago):**
- Plex (movies, music, the kids' shows)
- Home Assistant (thermostats, outdoor lights, a few sensors)
- Nextcloud (shared files, calendars, contacts)
- Pi-hole (DNS + ad blocking for the house)
- A small dev VM I use for experiments

**On the Hetzner VPS (a small CX22 instance):**
- Caddy in front of everything, handling TLS
- Bitwarden for family passwords
- Radicale for calendar/contact sync (backed up to Nextcloud)
- The Mirror Mind server for all four of us
- Uptime Kuma monitoring everything else

**Off-site:**
- Weekly restic backups to a drive at my brother-in-law's house in Cleveland
- Critical configs in a private Git repo on a third VPS

## Situation

The stack is stable. Nothing is paging me regularly. The last real incident was a disk on the DL380 that failed predictably (SMART had been warning for a month) and got swapped over a Saturday morning with Elena mostly unaware. Good.

The things I'm actually thinking about:

**The Mirror Mind server is newer than the rest.** I stood it up in late autumn and the family started using it over the following month. The shape of its resource usage — CPU, disk, outbound tokens to the LLM provider — is something I'm still learning. I want to make sure I'm watching it the way I watch everything else before it gets surprising.

**Backup testing is behind schedule.** I do weekly backups but I don't restore-test them nearly often enough. "Your backups aren't backups until you've restored from them" is a rule I preach and half-follow. I should fix that.

**The DL380 is eight years old.** It's still running fine, but the power draw is ugly and the noise is worse than I remember. I've been thinking about whether to replace it with something newer and smaller (a small mini-PC cluster, maybe) or keep running it until it actually dies. No rush either way, but the question is open.

**Documentation is 70% of what it should be.** I have Ansible playbooks for most rebuilds, but a few of the older services exist only in my head. If I were hit by a bus, Elena would eventually figure out the family passwords and then be stuck. I should finish the runbook I keep starting.
