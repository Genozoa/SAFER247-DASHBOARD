# APRS dependency review

| Component | Inspected/tested revision | License and use |
| --- | --- | --- |
| Dire Wolf | stable tag 1.8.1, `a231971a652bfb574a4bae9a5d875fbce53d2267` | GPL-2.0-or-later source headers and GPLv2 `LICENSE`; separate external `gen_packets` / `atest` processes, no source vendored |
| aprslib / aprs-python | package 0.7.2; upstream `c2a0f18ce028a4cced582567a73d57f0d03cd00f` | GPL-2.0-or-later source headers, setup metadata says GPLv2; imported parser, no runtime package dependencies |

Source links:

- https://github.com/wb2osz/direwolf/tree/1.8.1
- https://github.com/wb2osz/direwolf/blob/1.8.1/LICENSE
- https://github.com/rossengeorgiev/aprs-python
- https://github.com/rossengeorgiev/aprs-python/blob/master/LICENSE

Dire Wolf's source build needs a C toolchain, CMake, threading support, and
ALSA development headers on Linux; GPSD, Hamlib, GPIO, and discovery libraries
were optional and absent in the offline build. The available environment had
no CMake or ALSA headers initially. CMake was installed into a scratch virtual
environment, and Debian ALSA development headers were extracted into scratch
storage. Only the two WAV CLI targets were built. No system packages, radios,
or background Dire Wolf service were installed/configured by these tests.

The original project archive has no project-wide LICENSE file. Distributing
an application that imports GPL aprslib requires reviewing the resulting
license obligations and providing the required notices/source as applicable.
This patch vendors neither upstream source nor binaries and makes the radio
parser an explicit optional install. That packaging choice is not a ruling on
application license compatibility. Confirm distribution terms before shipping
a proprietary combined application. Full upstream license text remains
available with the separately installed packages and source URLs above.

Upstream tests use obsolete mox3 and contain Python 3.12 test-helper failures;
see README for exact counts. No failed test was described as passing. No
hardware interoperability is implied by compiler success or WAV round trips.
