# Complete SAFER 247 project with APRS and PD90 SSTV

This is the complete original project with the APRS and PD90 code already
applied. No patch or upgrade ZIP needs to be applied. The included frontend/dist
has been rebuilt from the current source, using the authenticated API data mode.
Original PDFs, wireframes, lockfiles, hidden examples and unrelated source files
are included. Original compiled assets are retained alongside the updated build.

## Start the project

Use Python 3.11+, Node.js supported by Vite 8, and PostgreSQL with PostGIS.
The API supervises the radio worker when `RADIO_ENABLED=true`; USB audio and
physical radio operation remain unverified.
Dependencies, database data and radio drivers are installed on your own machine;
they are not bundled inside this source archive.

1. From the project root, copy .env.example to .env and configure DATABASE_URL
   and configure other necessary private backend values.
   No personnel registration code is needed.
2. From backend/, create/activate a Python virtual environment and export the
   root configuration before installing dependencies/running migrations.
   Alembic does not automatically read the root .env file:

       set -a
       . ../.env
       set +a

       python -m pip install -r app/radio_lab/requirements.txt
       python -m pip install --no-deps 'open-sstv @ git+https://github.com/bucknova/Open-SSTV.git@d05de1dd1efe8a7ae45bf2618fd1d37a77d03184'
       alembic upgrade head

   Install Dire Wolf gen_packets and atest separately; details are in
   app/radio_lab/aprs/README.md.
3. Copy backend/app/radio_lab/.env.example to .env.local in the same folder,
   configure your station, device names, and modem executable paths. From
   backend/, load both configurations before starting the API:

       set -a
       . ../.env
       . app/radio_lab/.env.local
       set +a

   `RADIO_COMMAND_TIMEOUT` defaults to 60 seconds for the configured audio
   output command. The main radio README gives additional environment and device
   setup details.
4. In a backend terminal, start the API with radio processing enabled:

       RADIO_ENABLED=true uvicorn app.main:app --host 127.0.0.1 --port 8000

   The API lifespan starts and stops the single worker. Do not run a second
   worker alongside it. Setting `RADIO_ENABLED=false` disables the worker.
5. From frontend/, install the lockfile dependencies, then start the UI:

       npm ci
       npm run dev

   Open http://localhost:3000, then register/log in. In API mode, the normal
   Messaging composer queues APRS broadcast text. Authenticated
   `/api/radio/transmissions` requests also support APRS position jobs. Incoming
   SSTV images remain available in the normal feed. Vite proxies /api to the
   backend at 127.0.0.1:8000.

Empty device selectors use the host's default microphone and speakers.
`RADIO_INPUT_DEVICE` and `RADIO_OUTPUT_DEVICE` can select named devices; missing
configured devices fall back to the host default, while a present but unusable
device reports an error without switching. Existing input/output command
overrides remain available. Worker and device status appear on the Settings
page and `/api/radio/status`. No test tone is played at startup; output is used
only for queued transmissions. PD90 uses 320x256 images, VIS 99, and about 90.9
seconds of audio. Audio output does not confirm RF delivery.

Read README.md and TEST_RESULTS.md in this radio_lab folder for all setup,
licenses, test commands/results, limitations, and outstanding hardware/Android
details. Prior software checks passed 135 backend cases across focused runs and
21 frontend cases; physical RF, PTT and Android interoperability are unverified.
