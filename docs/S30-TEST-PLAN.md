# S30 HomeKit Perfect Temp — development test plan

> **Development branch.** Do not remove the native Lennox HomeKit thermostat until hardware validation is complete.
> This fork is not an official Lennox release and cannot force Lennox to use a 2°F heat/cool deadband.

## Changes in these two forks
- `pateboyd/lennoxapi`: write scheduled changes through a per-zone override with a next-period hold; correct hold structure, away schedule IDs, and setpoint-only publishing.
- `pateboyd/homebridge-lennox`: in Perfect Temp use `spC` only; combine rapid HomeKit heat/cool writes; clamp limits based on S30 configuration.
- Both forks provide automated checks and are kept on development branches until the S30 test is complete.

## Installing the development plugin (Raspberry Pi/Homebridge)

1. Back up your Homebridge configuration from its web UI.
2. Make sure your Homebridge installation uses Node 20, 22, or 24.
3. Ensure Lennox Perfect Temp is **on** at the thermostat and verify the single temperature target.
4. In the Homebridge terminal, if your Homebridge plugins use the system's global npm prefix, install from this Git branch:

   ```bash
   sudo npm install -g "git+https://github.com/pateboyd/homebridge-lennox.git#fix/homekit-perfect-temp-and-schedules"
   ```

   The plugin's `prepare` script compiles the TypeScript code; its dependency resolves to the patched `pateboyd/lennoxapi` development branch.

   **Important:** Some Homebridge installations use a managed plugin directory rather than global npm. On those systems, use the prefix shown by Homebridge; installing globally may not install the plugin into the active Homebridge instance.

5. Configure the plugin using its usual `thermostats[].ipAddress` configuration and enable a separate child bridge.
6. Pair that child bridge with Apple Home. Keep the native Lennox accessory temporarily so you can compare readings, but use the test accessory for setpoint changes.

## Hardware acceptance tests

1. **Single setpoint:** With Perfect Temp on and 72°F selected, adjust the **Homebridge** thermostat in Apple Home to 73°F. The S30 must remain in Perfect Temp and must show one target, not separate heat/cool thresholds.
2. **Manual mode:** Repeat 73→72°F with the S30 in manual schedule.
3. **Scheduled operation:** Enable an ordinary named S30 schedule. Adjust 72→73°F in Apple Home; the thermostat should create a temporary hold instead of snapping back after the next poll. Verify whether the hold expires at the next period.
4. **Heating/cooling modes:** Use Off, Heat, Cool and Auto. Confirm actions match the physical thermostat and do not inadvertently change Perfect Temp on ordinary setpoint writes.
5. **Dual-setpoint mode:** Temporarily disable Perfect Temp on the physical thermostat, restart the test child bridge to refresh exposed HomeKit characteristics, then move heat and cool thresholds together. Confirm the separation remains within S30 requirements.
6. **Limits and error handling:** Attempt a setpoint at each configured bound. Verify accepted values stick and failed writes appear in child bridge logs.
7. **Recovery:** Restart only the Lennox child bridge; confirm the plugin reconnects and reads the active mode correctly.

## Rollback

- Stop/remove the *test* child bridge and revert Apple Home to the original native Lennox accessory.
- If this fork replaced an existing npm-installed Lennox plugin, reinstall the original release with `sudo npm install -g homebridge-lennox@0.1.2` **only if the installation uses global npm**.
- Restore the prior Homebridge configuration backup if necessary. Do not remove other Homebridge child bridges.

## Known limits

- Lennox Perfect Temp's control algorithm is internal to the thermostat. The plugin can preserve single-setpoint commands but cannot redefine the HVAC's hardware deadband.
- HomeKit characteristics may need the child bridge restarted if the thermostat changes between Perfect Temp and conventional Auto mode.
- Simulated tests and GitHub CI do not replace verification with an actual S30.
