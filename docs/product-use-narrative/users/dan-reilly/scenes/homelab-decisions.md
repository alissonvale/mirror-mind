# Homelab decisions

**Voice:** persona
**Organization:** reilly-homelab
**Journey:** vmware-to-proxmox
**Personas:** engineer, maker

## Briefing

The homelab is mid-migration from VMware to Proxmox. Most decisions in this scene are small (which VLAN this VM lands on, whether to bother with HA for a service that nobody else in the house cares about) but they accumulate, and getting them wrong means a weekend of cleanup.

Here I think out loud about a specific decision in front of me right now. Not "teach me Proxmox" — I have the docs. More like "here's the trade-off I'm seeing, talk it through with me before I commit and then resent the commit for six months."

The mirror plays the role the lancaster-homelabbers crew plays for me on Tuesday nights: someone who knows enough to push back on the lazy answer.
