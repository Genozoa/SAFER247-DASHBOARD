# SAFER247 implementation status

The `GPT-branch2` branch uses the stable pre-TCP-KISS APRS WAV-based implementation. The persistent TCP KISS work remains only on `GPT-branch`.

| Task | Implementation | Further verification |
| --- | --- | --- |
| Registration | Call sign and strong password; no personnel code or administrator approval | Control registration endpoint exposure before real LDRRMO deployment |
| Existing accounts | Revision 0010 removes verification metadata and keeps passwords, account activation flags and sessions | PostgreSQL migration smoke test |
| Credential icons | lucide-react call-sign and password icons with accessible visibility controls | Desktop/mobile visual QA |
| Messaging | Text-only APRS composer and received media/location indicators | Browser QA |
| Radio | Existing Dire Wolf `gen_packets`/`atest` WAV, spool, live audio, and SSTV PD90 | Physical hardware validation remains outstanding |

Other existing features remain unchanged: reviewed image correlation, responder positions, Demo-only sample records, local tile route, and heatmap behavior.

No CI test result proves a database migration or physical radio transmission. See [deployment guide](LDRRMO_DEPLOYMENT.md).
