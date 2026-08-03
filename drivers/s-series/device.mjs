'use strict';

import {OAuth2Device} from "homey-oauth2app";

import {SettingsManager} from "../../lib/helpers/settings-manager.mjs";
import {PowerCalculator} from "../../lib/helpers/power-calculator.mjs";
import SSeriesParameterIds from "../../lib/models/s-series-parameter-enum.mjs";
import sSeriesParameterMap from "../../lib/models/s-series-parameter-map.mjs";
import RequestQueueHelper from "../../lib/helpers/request-queue.mjs";
import {buildEffectiveParameters, sSeriesOverrideConfig} from "../../lib/helpers/parameter-override.mjs";
import {EnergySplitCalculator} from "../../lib/helpers/energy-split-calculator.mjs";

/**
 * Opt-in "energy split" roles. When a device is paired with data.role set to one of these, the pump
 * is represented as two Homey consumer devices (heating + hot water) so Homey Energy can cost the
 * two categories separately. Each role keeps a focused capability set and a restricted monitored
 * parameter list (so the dynamic capability management never re-adds the other role's sensors);
 * measure_power / meter_power are driven by EnergySplitCalculator instead of the single-device path.
 * LIFETIME_ENERGY_CONSUMED (28393) stays in every role's list so the anchor can read it.
 */
// measure_current.one/two/three (BE1-3) are deliberately excluded from both roles: on this pump
// family those clamps sit on the incoming main supply (a power-guard for the house fuse), so they
// read whole-house draw, not the pump's own consumption — confirmed by comparing them against the
// pump-scoped 22130 reading during the split's validation. Showing them on a role device would
// contradict its own correctly-split measure_power.
const ROLE_CONFIG = {
    heating: {
        deviceClass: 'heatpump',
        isHotWater: false,
        // Capability order matches com.nibe.eu.myuplink's heating device tile-for-tile (its
        // ROLES.heating.capabilities order = its displayed order): room temp, target temp,
        // priority, compressor freq, supply/return/calculated-supply/outdoor temps, pump speed,
        // airflow, power, meter, additional heat power, add-heat runtime. Capabilities this app
        // has that com.nibe.eu.myuplink's heating device doesn't are appended last.
        capabilities: [
            // Room temp/setpoint are promoted to the ROOT measure_temperature / target_temperature
            // (see _roomTempCap below): Homey's Climate feature reads a device's temperature
            // capability, and dotted sub-capabilities also lose the auto-generated Flow trigger and
            // Flow tag. Keeping them root means Climate unambiguously reports the ROOM temperature
            // rather than a heating-circuit temperature, regardless of capability order.
            'measure_temperature', 'target_temperature',
            'status_operation_priority', 'measure_frequency.compressor',
            'measure_temperature.supply_line', 'measure_temperature.return_line',
            'measure_temperature.calculated_supply', 'measure_temperature.outdoor',
            'measure_pump_speed.heating_medium', 'airflow',
            'measure_power', 'meter_power',
            'measure_power.internal_addition', 'time.add_heat_heating',
            // Additional, existing data points (not in com.nibe.eu.myuplink):
            'status_compressor', 'measure_degree_minutes',
            'measure_temperature.discharge', 'measure_temperature.liquid_line',
            'measure_temperature.average_outdoor', 'measure_temperature.suction_gas',
            'measure_compressor_starts', 'time.compressor_runtime', 'status_electric_addition',
            // Reference only (appended last): the pump's own per-function books via myUplink,
            // for cross-checking the derived split. Not meters — see the parameter map.
            'myuplink_used_energy', 'myuplink_produced_energy',
        ],
        // The room temperature / setpoint are NOT fetched here — refreshZoneData()
        // (called at the end of fetchAndSetDataPoints, for the heating role) sources both from
        // getSmartHomeZones() instead, matching how the stock single device already gets them.
        monitored: [
            SSeriesParameterIds.OPERATION_PRIORITY, SSeriesParameterIds.CURRENT_COMPRESSOR_FREQ,
            SSeriesParameterIds.SUPPLY_LINE_TEMP, SSeriesParameterIds.RETURN_TEMP,
            SSeriesParameterIds.CALCULATED_SUPPLY_LINE, SSeriesParameterIds.OUTDOOR_TEMP,
            SSeriesParameterIds.HEATING_MEDIUM_PUMP_SPEED, SSeriesParameterIds.AIRFLOW,
            SSeriesParameterIds.INTERNAL_ADD_HEAT_POWER, SSeriesParameterIds.ADD_HEAT_TIME_HEATING,
            SSeriesParameterIds.COMPRESSOR_STATUS, SSeriesParameterIds.DEGREE_MINUTES,
            SSeriesParameterIds.DISCHARGE_TEMP, SSeriesParameterIds.LIQUID_LINE,
            SSeriesParameterIds.AVERAGE_OUTDOOR_TEMP, SSeriesParameterIds.SUCTION_GAS,
            SSeriesParameterIds.COMPRESSOR_STARTS, SSeriesParameterIds.TOTAL_COMPRESSOR_RUNTIME,
            SSeriesParameterIds.ELECTRIC_ADDITION_STATUS, SSeriesParameterIds.LIFETIME_ENERGY_CONSUMED,
            SSeriesParameterIds.LIFETIME_HEATING_USED_ENERGY, SSeriesParameterIds.HEATING_PRODUCED_ENERGY,
        ],
    },
    hotwater: {
        deviceClass: 'boiler',
        isHotWater: true,
        capabilities: [
            'measure_power', 'meter_power',
            'measure_temperature.hot_water_top', 'measure_temperature.hot_water_charging',
            'hotwater_amount', 'state_button.hot_water_boost', 'state_button.quick_water_heating',
            'status_operation_priority', 'time.hot_water_add_heat',
            // Reference only (appended last) — see the heating role.
            'myuplink_used_energy', 'myuplink_produced_energy',
        ],
        monitored: [
            SSeriesParameterIds.HOT_WATER_TOP, SSeriesParameterIds.HOT_WATER_CHARGING,
            SSeriesParameterIds.HOT_WATER_AMOUNT, SSeriesParameterIds.HOT_WATER_BOOST,
            SSeriesParameterIds.QUICK_WATER_HEATING, SSeriesParameterIds.OPERATION_PRIORITY,
            SSeriesParameterIds.ADD_HEAT_TIME_HOT_WATER, SSeriesParameterIds.LIFETIME_ENERGY_CONSUMED,
            SSeriesParameterIds.LIFETIME_HOT_WATER_USED_ENERGY, SSeriesParameterIds.HOT_WATER_PRODUCED_ENERGY,
        ],
    },
};

const SPLIT_FAST_POLL_MS = 60 * 1000;

/**
 * Represents a Nibe S-Series Heat Pump device in Homey
 */
class SSeriesDevice extends OAuth2Device {
    /**
     * List of parameters to monitor
     * @type {number[]}
     */
    static MONITORED_PARAMETERS = [
        SSeriesParameterIds.OUTDOOR_TEMP,
        SSeriesParameterIds.SUPPLY_LINE_TEMP,
        SSeriesParameterIds.RETURN_TEMP,
        SSeriesParameterIds.HOT_WATER_TOP,
        SSeriesParameterIds.HOT_WATER_CHARGING,
        SSeriesParameterIds.SUPPLY_LINE,
        SSeriesParameterIds.DISCHARGE_TEMP,
        SSeriesParameterIds.LIQUID_LINE,
        SSeriesParameterIds.SUCTION_GAS,
        SSeriesParameterIds.DEGREE_MINUTES,
        SSeriesParameterIds.CURRENT_COMPRESSOR_FREQ,
        SSeriesParameterIds.COMPRESSOR_STATUS,
        SSeriesParameterIds.HEATING_MEDIUM_PUMP_SPEED,
        SSeriesParameterIds.CURRENT_1,
        SSeriesParameterIds.CURRENT_2,
        SSeriesParameterIds.CURRENT_3,
        SSeriesParameterIds.LIFETIME_ENERGY_CONSUMED,
        SSeriesParameterIds.AVERAGE_OUTDOOR_TEMP,
        SSeriesParameterIds.SYSTEM_POWER_CONSUMPTION,
        SSeriesParameterIds.QUICK_WATER_HEATING
    ];

    /**
     * Maps Homey capabilities to Nibe parameter IDs
     * @type {Object.<string, number>}
     */
    static CAPABILITY_PARAMETER_MAP = {
        'state_button.hot_water_boost': SSeriesParameterIds.HOT_WATER_BOOST,
        'state_button.quick_water_heating': SSeriesParameterIds.QUICK_WATER_HEATING,
        // 'state_button.ventilation_boost': SSeriesParameterIds.VENTILATION_BOOST,
        'target_temperature.room': SSeriesParameterIds.ROOM_TEMP_SETPOINT
    };

    /**
     * Capability holding the room temperature. The energy-split heating role promotes it to the
     * ROOT `measure_temperature` so Homey's Climate feature reports the actual room temperature
     * (and so the auto-generated Flow trigger/tag exist); every other device keeps the original
     * dotted `measure_temperature.room`.
     * @returns {string}
     */
    get _roomTempCap() {
        return this._role === 'heating' ? 'measure_temperature' : 'measure_temperature.room';
    }

    /**
     * Capability holding the room setpoint. Promoted alongside _roomTempCap for the heating role —
     * Homey pairs a thermostat tile from a matching measure/target suffix, so both must move
     * together or the tile fragments into separate rows.
     * @returns {string}
     */
    get _roomSetpointCap() {
        return this._role === 'heating' ? 'target_temperature' : 'target_temperature.room';
    }

    async onOAuth2Init() {
        try {
            this.deviceId = this.getData().id;
            this.pollInterval = await this.getSetting('fetchIntervall') || 5;

            const deviceInfoHeader = `${"#".repeat(10)} DEVICE INFO ${"#".repeat(10)}`
            const infoHeader = `
${deviceInfoHeader}
            
NAME: ${this.getName()}
POLL INTERVAL: ${this.pollInterval}
CAPABILITIES: ${this.getCapabilities()}
                
${"#".repeat(deviceInfoHeader.length)}
        `
            this.log(infoHeader);
            this.log(`Device ${this.deviceId} initialized (S-Series)`);

            // Opt-in energy split: a role-tagged device represents one category (heating / hot water)
            const role = this.getData().role;
            this._role = ROLE_CONFIG[role] ? role : null;
            this._split = this._role !== null;
            if (this._split) {
                const cls = ROLE_CONFIG[this._role].deviceClass;
                if (this.getClass() !== cls) await this.setClass(cls).catch((e) => this.error(`setClass: ${e.message}`));
                this.log(`Energy-split role: ${this._role} (class ${cls})`);
            }

            // Initialize services
            this.settingsManager = new SettingsManager(this, this.oAuth2Client);
            this.powerCalculator = new PowerCalculator();
            this.requestQueue = new RequestQueueHelper(this)

            // Capabilities that should only be used internally, not shown in UI
            this._internalCapabilities = new Set([
                'meter_power.lifetime_energy_consumed',
                'measure_power.system'
            ]);

            // Build effective parameter map (applies user overrides from settings)
            this._buildEffectiveParameters();

            // For a split role, fetch only this role's parameters and prune foreign capabilities so
            // the dynamic capability management never re-adds the other category's sensors.
            if (this._split) {
                const roleCfg = ROLE_CONFIG[this._role];
                this._effectiveMonitored = roleCfg.monitored.slice();
                await this._pruneToRole(roleCfg);
            }

            // Migrate: remove deprecated capabilities from UI for existing devices
            for (const cap of this._internalCapabilities) {
                if (this.hasCapability(cap)) {
                    this.log(`Removing deprecated visible capability: ${cap}`);
                    await this.removeCapability(cap);
                }
            }

            // Fetch data first to ensure we have the right capabilities
            await this.fetchAndSetDataPoints(this._effectiveMonitored);

            // Migrate: remove deprecated capabilities that are now internal-only
            for (const cap of ['meter_power.lifetime_energy_consumed', 'measure_power.system']) {
                if (this.hasCapability(cap)) {
                    this.log(`Removing deprecated visible capability: ${cap}`);
                    await this.removeCapability(cap);
                }
            }

            if (this._split) {
                // measure_power / meter_power are owned by the split calculator (priority-weighted
                // attribution of 22130, anchored to the real 28393 meter).
                for (const cap of ['measure_power', 'meter_power']) {
                    if (!this.hasCapability(cap)) await this.addCapability(cap);
                }
                this.energySplit = new EnergySplitCalculator(this, { isHotWater: ROLE_CONFIG[this._role].isHotWater });
                await this.energySplit.restore();
                await this.energySplit.fastPoll();
            } else {
                // Check if we have any power source and add measure_power if needed
                const hasCurrentCapabilities =
                    this.hasCapability('measure_current.one') ||
                    this.hasCapability('measure_current.two') ||
                    this.hasCapability('measure_current.three');

                const hasSystemPower = this._internalValues?.get('measure_power.system') != null;
                const hasLifetimeEnergy = this._internalValues?.get('meter_power.lifetime_energy_consumed') != null;

                if (hasCurrentCapabilities || hasLifetimeEnergy || hasSystemPower) {
                    if (!this.hasCapability('measure_power')) {
                        this.log('Adding measure_power capability');
                        await this.addCapability('measure_power');
                    }
                    // Now update power value
                    await this.powerCalculator.updateDevicePower(this);
                } else {
                    this.log('No current sensors, system power, or lifetime energy found, skipping power calculation');
                    if (this.hasCapability('measure_power')) {
                        await this.removeCapability('measure_power');
                    }
                }

                // Use system-reported lifetime energy as meter_power for Homey energy tracking
                if (hasLifetimeEnergy) {
                    if (!this.hasCapability('meter_power')) {
                        this.log('Adding meter_power capability');
                        await this.addCapability('meter_power');
                    }
                    await this.updateMeterPowerFromSystem();
                }
            }

            await this.settingsManager.initializeSettings();

            // Set up capability listeners
            await this.setupCapabilityListeners();

            // Start polling
            this.startPolling();
        } catch (error) {
            this.error('Error during device initialization:', error.message, error.stack);
        }
    }

    /**
     * Sets meter_power directly from the system-reported lifetime energy consumption
     */
    async updateMeterPowerFromSystem() {
        try {
            if (!this.hasCapability('meter_power')) {
                return;
            }
            const lifetimeEnergy = this._internalValues?.get('meter_power.lifetime_energy_consumed');
            if (lifetimeEnergy != null) {
                await this.setCapabilityValue('meter_power', lifetimeEnergy);
                this.log(`meter_power set from system: ${lifetimeEnergy} kWh`);
            }
        } catch (error) {
            this.error('Error updating meter_power from system:', error);
        }
    }

    async triggerFlow(flowId, token) {
        const flow = this.homey.flow.getTriggerCard(flowId);
        return flow.trigger({token});
    }

    /**
     * Sets up polling for data updates
     */
    startPolling() {
        this.pollTimer = this.homey.setInterval(async () => {
            this.log(`Fetching data for device ${this.deviceId}`);
            try {
                await this.fetchAndSetDataPoints(this._effectiveMonitored);
                if (this._split) {
                    // Anchor the split meters to the real 28393 total that the fetch just refreshed.
                    await this.energySplit.anchor();
                } else {
                    await this.powerCalculator.updateDevicePower(this);
                    await this.updateMeterPowerFromSystem();
                }
                await this.settingsManager.updateHeatpumpSettings();
                await this.refreshZoneData();
            } catch (error) {
                this.error(`Error during polling: ${error.message}`);
            }
        }, 1000 * 60 * this.pollInterval);

        // Split devices integrate live power every minute for smooth, sub-kWh meter_power.
        if (this._split) {
            this.splitFastTimer = this.homey.setInterval(() => this.energySplit.fastPoll(), SPLIT_FAST_POLL_MS);
        }
    }

    /**
     * Sets up capability listeners for device control
     */
    async setupCapabilityListeners() {
        // Handle standard parameter-based capabilities
        for (const [capability, parameterId] of Object.entries(SSeriesDevice.CAPABILITY_PARAMETER_MAP)) {
            // Skip room temperature which is handled separately
            if (capability === 'target_temperature.room') continue;
            // A role device only has its own subset of capabilities.
            if (!this.hasCapability(capability)) continue;

            this.registerCapabilityListener(capability, async (value) => {
                try {
                    this.log(`Setting capability ${capability} to ${value}`);
                    await this.requestQueue.queueParameterUpdate(parameterId, Number(value));
                } catch (error) {
                    this.error(`Error setting ${capability}: ${error.message}`);
                    // Re-fetch the current value to revert UI
                    await this.fetchAndSetDataPoints([parameterId]);
                }
            });
        }

        // Special handling for room temperature which uses zones - keep this as is
        if (this.hasCapability(this._roomSetpointCap))
        this.registerCapabilityListener(this._roomSetpointCap, async (value) => {
            try {
                this.log(`Setting room temperature to ${value}`);

                // First get all zones
                const zones = await this.oAuth2Client.getSmartHomeZones(this.deviceId);

                // Find zones that are not command-only (can be controlled)
                const controllableZones = zones.filter(zone => !zone.commandOnly);

                if (controllableZones.length === 0) {
                    this.error('No controllable zones found');
                    return;
                }

                // For simplicity, we'll set all controllable zones to the same temperature
                // Alternatively, you could store the preferred zone in settings
                for (const zone of controllableZones) {
                    this.log(`Setting zone ${zone.zoneId} (${zone.name}) to ${value}°C`);
                    await this.oAuth2Client.setZoneTemperature(this.deviceId, zone.zoneId, value);
                }

                // Store the target temperature
                await this.setCapabilityValue(this._roomSetpointCap, value);

            } catch (error) {
                this.error(`Error setting room temperature: ${error.message}`);
                // Revert UI to the current setpoint
                await this.refreshZoneData();
            }
        });
    }

    async setParameterValue(parameterId, value) {
        try {
            return await this.requestQueue.queueParameterUpdate(parameterId, value);
        } catch (error) {
            this.error(`Error setting parameter ${parameterId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Fetches and updates data points for given parameters
     * @param {number[]} params - Parameter IDs to fetch
     * @returns {Promise<void>}
     */
    async fetchAndSetDataPoints(params) {
        try {
            this.log(`Fetching data points for ${params.length} parameters`);
            const dataPoints = await this.oAuth2Client.getDataPoints(this.deviceId, params);
            // Create a set of parameter IDs that were actually returned
            const returnedParameterIds = new Set(dataPoints.map(point => Number(point.parameterId)));

            // Track which capabilities were updated
            const updatedCapabilities = new Set();

            // Process returned data points
            for (const point of dataPoints) {
                const param = this._effectiveMap[Number(point.parameterId)];
                if (!param) {
                    this.log(`Unknown parameter: ${point.parameterId}`);
                    continue;
                }

                try {
                    let value;
                    switch (param.type) {
                        case 'boolean':
                            value = Boolean(point.value);
                            break;
                        case 'number':
                            value = Number(point.value);
                            break;
                        case 'string':
                            value = String(point.value);
                            break;
                        case 'enum':
                            value = this.processEnumValue(point, param);
                            break;
                        default:
                            value = point.value;
                    }

                    if (this.hasCapability(param.capabilityName)) {
                        await this.setCapabilityValue(param.capabilityName, value);
                        this.log(`Updated ${param.capabilityName} to ${value}`);
                    } else if (this._internalCapabilities?.has(param.capabilityName)) {
                        // Store internally without adding as visible capability
                        if (!this._internalValues) this._internalValues = new Map();
                        this._internalValues.set(param.capabilityName, value);
                        this.log(`Stored internal value ${param.capabilityName}: ${value}`);
                    } else {
                        // Add capability if it doesn't exist
                        await this.addCapability(param.capabilityName);
                        await this.setCapabilityValue(param.capabilityName, value);
                        this.log(`Added capability: ${param.capabilityName} with value ${value}`);
                    }

                    // Mark this capability as updated
                    updatedCapabilities.add(param.capabilityName);

                    await this.processFlowTriggers(param);
                } catch (capError) {
                    this.error(`Error setting capability ${param.capabilityName}: ${capError.message}`);
                }
            }

            // Split devices own measure_power via EnergySplitCalculator — skip the single-device
            // power-source bookkeeping below.
            if (!this._split) {
                // Check if current sensors, system power, or lifetime energy exist to justify keeping measure_power
                const hasCurrent = returnedParameterIds.has(SSeriesParameterIds.CURRENT_1) ||
                    returnedParameterIds.has(SSeriesParameterIds.CURRENT_2) ||
                    returnedParameterIds.has(SSeriesParameterIds.CURRENT_3);

                const hasLifetimeEnergy = returnedParameterIds.has(SSeriesParameterIds.LIFETIME_ENERGY_CONSUMED);
                const hasSystemPower = returnedParameterIds.has(SSeriesParameterIds.SYSTEM_POWER_CONSUMPTION);

                // Keep measure_power if we have current sensors, system power OR lifetime energy
                if (!hasCurrent && !hasSystemPower && !hasLifetimeEnergy && this.hasCapability('measure_power')) {
                    this.log('No current sensors, system power, or lifetime energy found, removing measure_power capability');
                    await this.removeCapability('measure_power');
                }
            }

            // For the room temperature and setpoint, we'll check for zones in a separate method
            // since they're controlled through the zone system rather than parameters

            // Find capabilities that were expected but not updated
            const expectedCapabilities = new Set();
            for (const paramId of params) {
                const param = this._effectiveMap[paramId];
                if (param && param.capabilityName) {
                    expectedCapabilities.add(param.capabilityName);
                }
            }

            // Remove unsupported capabilities (excluding those we just decided to keep)
            for (const capabilityName of expectedCapabilities) {
                if (!updatedCapabilities.has(capabilityName) &&
                    this.hasCapability(capabilityName)) {

                    this.log(`Removing unsupported capability: ${capabilityName}`);
                    await this.removeCapability(capabilityName);
                }
            }

            // Handle zone-based capabilities separately
            await this.refreshZoneData();

        } catch (error) {
            this.error(`Error fetching data points: ${error.message}`);
            throw error;
        }
    }

    /**
     * Sets the target temperature
     * @param {number} temperature - Target temperature in Celsius
     * @returns {Promise<void>}
     */
    async setTargetTemperature(temperature) {
        try {
            this.log(`Setting target temperature to ${temperature}°C`);

            // First, check if we have the capability
            if (!this.hasCapability(this._roomSetpointCap)) {
                throw new Error('Device does not support target temperature control');
            }

            // First update the capability value
            await this.setCapabilityValue(this._roomSetpointCap, temperature);

            // For S-Series, we need to update through the zone system - keep this as is
            const zones = await this.oAuth2Client.getSmartHomeZones(this.deviceId);

            // Find zones that are not command-only (can be controlled)
            const controllableZones = zones.filter(zone => !zone.commandOnly);

            if (controllableZones.length === 0) {
                throw new Error('No controllable zones found');
            }

            // Set all controllable zones to the same temperature
            for (const zone of controllableZones) {
                this.log(`Setting zone ${zone.zoneId} (${zone.name}) to ${temperature}°C`);
                await this.oAuth2Client.setZoneTemperature(this.deviceId, zone.zoneId, temperature);
            }

            this.log(`Successfully set target temperature to ${temperature}°C`);
        } catch (error) {
            this.error(`Failed to set target temperature: ${error.message}`);
            throw error;
        }
    }

    /**
     * Refreshes zone data and updates related capabilities
     */
    async refreshZoneData() {
        // The hot-water role is a boiler — it has no room/zone temperature or setpoint.
        if (this._role === 'hotwater') return;
        try {
            const zones = await this.oAuth2Client.getSmartHomeZones(this.deviceId);

            // Find a non-command-only zone to get the temperature setpoint
            const controlZone = zones.find(zone => !zone.commandOnly);

            if (controlZone) {
                // Add/update room temperature capabilities if we have a controllable zone
                if (!this.hasCapability(this._roomSetpointCap)) {
                    await this.addCapability(this._roomSetpointCap);
                }

                if (!this.hasCapability(this._roomTempCap)) {
                    await this.addCapability(this._roomTempCap);
                }

                // Update the target temperature capability
                if (controlZone.setpointHeat !== null) {
                    await this.setCapabilityValue(this._roomSetpointCap, controlZone.setpointHeat);
                    this.log(`Updated target temperature to ${controlZone.setpointHeat} from zone: ${controlZone.name}`);
                }

                // If the zone has a temperature reading, update that too
                if (controlZone.temperature !== null) {
                    await this.setCapabilityValue(this._roomTempCap, controlZone.temperature);
                    this.log(`Updated room temperature to ${controlZone.temperature} from zone: ${controlZone.name}`);
                }
                if (controlZone.indoorHumidity !== null || controlZone.indoorHumidity !== 0) {
                    await this.addCapability(`measure_humidity.${controlZone.name}`);
                    await this.setCapabilityOptions(`measure_humidity.${controlZone.name}`, {
                        "title": {
                            "en": `${controlZone.name} humidity`,
                            "sv": `${controlZone.name} luftfuktighet`,
                            "no": `${controlZone.name} luftfuktighet`,
                            "da": `${controlZone.name} luftfugtighed`,
                        }
                    })
                    await this.setCapabilityValue(`measure_humidity.${controlZone.name}`, controlZone.indoorHumidity)
                    this.log(`Updated room humidity to ${controlZone.indoorHumidity} from zone: ${controlZone.name}`);
                } 
            } else {
                // No controllable zones found, remove room temperature capabilities
                if (this.hasCapability(this._roomSetpointCap)) {
                    this.log(`No controllable zones found, removing ${this._roomSetpointCap} capability`);
                    await this.removeCapability(this._roomSetpointCap);
                }

                // Keep the room temperature capability if any zone has a temperature value
                const anyZoneWithTemp = zones.some(zone => zone.temperature !== null);
                if (!anyZoneWithTemp && this.hasCapability(this._roomTempCap)) {
                    this.log(`No zones with temperature readings, removing ${this._roomTempCap} capability`);
                    await this.removeCapability(this._roomTempCap);
                }
            }
        } catch (error) {
            // If we get an error (like 404 Not Found), zones might not be supported at all
            this.error(`Error refreshing zone data: ${error.message}`);

            // Remove zone-related capabilities if we can't access zones
            if (error.statusCode === 404) {
                if (this.hasCapability(this._roomSetpointCap)) {
                    this.log(`Zones not supported, removing ${this._roomSetpointCap} capability`);
                    await this.removeCapability(this._roomSetpointCap);
                }

                if (this.hasCapability(this._roomTempCap)) {
                    this.log(`Zones not supported, removing ${this._roomTempCap} capability`);
                    await this.removeCapability(this._roomTempCap);
                }
            }
        }
    }

    /**
     * Process flow triggers based on parameter updates
     * @param {Object} param - The parameter mapping info
     */
    async processFlowTriggers(param) {
        if (param.parameterName === "status_compressor") {
            await this.triggerFlow("compressor-status-changed", param.value);
        }
    }

    /**
     * Process an enum value from the API
     * @param {Object} point - The data point from the API
     * @param {Object} param - The parameter mapping info
     * @returns {string} The processed enum value
     */
    processEnumValue(point, param) {
        // Standard enum handling for display-only parameters
        return this.processStandardEnum(point);
    }

    /**
     * Process standard enum values
     * @param {Object} point - The data point from the API
     * @returns {string} The processed value
     */
    processStandardEnum(point) {
        const roundedValue = Math.round(point.value);

        // Get the matching enum text or fall back to the numeric value
        const enumText = point.enumValues.find(item =>
            Number(item.value) === roundedValue
        )?.text || String(point.value);

        // Translate and capitalize
        return this.formatEnumValue(enumText);
    }

    /**
     * Format an enum value text (translate and capitalize)
     * @param {string} text - The text to format
     * @returns {string} The formatted text
     */
    formatEnumValue(text) {
        // Translate the text
        const translated = this.homey.__(text);

        // Capitalize the first letter
        return typeof translated === 'string'
            ? translated.charAt(0).toUpperCase() + translated.slice(1)
            : translated;
    }

    /**
     * Handle device settings changes
     * @param {object} options - Settings change information
     */
    async onSettings({oldSettings, newSettings, changedKeys}) {
        try {
            // Handle poll interval change separately
            if (changedKeys.includes('fetchIntervall') &&
                newSettings.fetchIntervall !== oldSettings.fetchIntervall) {

                this.log(`Updating poll interval from ${oldSettings.fetchIntervall} to ${newSettings.fetchIntervall} minutes`);
                this.pollInterval = newSettings.fetchIntervall;

                // Reset the polling interval
                if (this.pollTimer) {
                    this.homey.clearInterval(this.pollTimer);
                }
                this.startPolling();
            }

            // Handle power-related settings changes
            if (changedKeys.includes('powerFactor') || changedKeys.includes('voltage')) {
                this.log('Power calculation parameters changed, updating power value');
                await this.powerCalculator.updateDevicePower(this);
            }

            // Handle parameter override changes
            const paramOverridesChanged = changedKeys.some(key => key.startsWith('param_'));
            if (paramOverridesChanged) {
                this.log('Parameter overrides changed, rebuilding effective parameters');
                this._buildEffectiveParameters(newSettings);
                await this.fetchAndSetDataPoints(this._effectiveMonitored);
            }

            // Handle heat pump settings
            await this.settingsManager.handleSettingsUpdate(oldSettings, newSettings, changedKeys);

        } catch (error) {
            this.error(`Error handling settings change: ${error.message}`);
            throw error;
        }
    }

    /**
     * Build effective parameter map and monitored list from defaults + user overrides
     * @param {Object} [settings] - Settings object to use. Defaults to this.getSettings().
     */
    _buildEffectiveParameters(settings) {
        settings = settings ?? this.getSettings();
        const { effectiveMap, effectiveMonitored, paramIdOverrides, appliedOverrides } =
            buildEffectiveParameters(sSeriesParameterMap, SSeriesDevice.MONITORED_PARAMETERS, sSeriesOverrideConfig, settings);

        this._effectiveMap = effectiveMap;
        this._effectiveMonitored = effectiveMonitored;
        this._paramIdOverrides = paramIdOverrides;

        if (appliedOverrides.length > 0) {
            this.log('Applied parameter overrides:', JSON.stringify(appliedOverrides));
        } else {
            this.log('No parameter overrides active, using defaults');
        }
    }

    /**
     * Remove any capability not in this role's set (keeping internal-only capabilities), then make
     * sure the remaining ones are in exactly roleCfg.capabilities' declared order — matching
     * com.nibe.eu.myuplink's tile layout tile-for-tile. Homey's addCapability() only appends, it
     * never reorders an existing device's capabilities, so if this device's current order doesn't
     * match (e.g. after a code update changed the order), rebuild it: remove everything in the
     * role's set and re-add in the declared sequence. This is a one-time reset per order change —
     * values repopulate from the fetch that immediately follows in onOAuth2Init.
     * @param {object} roleCfg - the ROLE_CONFIG entry for this device's role
     */
    async _pruneToRole(roleCfg) {
        const keep = new Set(roleCfg.capabilities);
        for (const cap of this.getCapabilities()) {
            if (keep.has(cap) || this._internalCapabilities?.has(cap)) continue;
            try {
                await this.removeCapability(cap);
                this.log(`[split] pruned capability: ${cap}`);
            } catch (e) {
                this.error(`[split] prune ${cap}: ${e.message}`);
            }
        }

        const desired = roleCfg.capabilities;
        const current = this.getCapabilities().filter((cap) => keep.has(cap));
        // "In order" means the capabilities the device already has appear in the declared
        // sequence — NOT that it has all of them. A pure addition (new capabilities appended to
        // the role) must not fall through to the rebuild below: that removes every capability
        // first, which blanks a live meter mid-run. Compare against the declared order filtered
        // to what's actually present, so missing ones are simply added (they land at the end,
        // which is where appended capabilities are declared).
        const present = desired.filter((cap) => current.includes(cap));
        const inOrder = current.length === present.length && current.every((cap, i) => cap === present[i]);
        if (inOrder) {
            for (const cap of desired) {
                if (!this.hasCapability(cap)) await this.addCapability(cap).catch((e) => this.error(`[split] add ${cap}: ${e.message}`));
            }
            return;
        }

        this.log(`[split] capability order changed, rebuilding: [${current.join(',')}] -> [${desired.join(',')}]`);
        for (const cap of current) {
            await this.removeCapability(cap).catch((e) => this.error(`[split] reorder-remove ${cap}: ${e.message}`));
        }
        for (const cap of desired) {
            await this.addCapability(cap).catch((e) => this.error(`[split] reorder-add ${cap}: ${e.message}`));
        }
    }

    /**
     * Clean up when device is deleted
     */
    async onDeleted() {
        this.log(`Device ${this.deviceId} deleted, cleaning up`);
        if (this.pollTimer) {
            this.homey.clearInterval(this.pollTimer);
        }
        if (this.splitFastTimer) {
            this.homey.clearInterval(this.splitFastTimer);
        }
        if (this.requestQueue) {
            this.requestQueue.clearQueue();
        }
    }
}

export default SSeriesDevice;