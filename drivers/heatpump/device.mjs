'use strict';

import {OAuth2Device} from "homey-oauth2app";
import fSeriesParameterMap from "../../lib/models/f-series-parameter-map.mjs";
import {SettingsManager} from "../../lib/helpers/settings-manager.mjs";
import {PowerCalculator} from "../../lib/helpers/power-calculator.mjs";
import FSeriesParameterIds from "../../lib/models/f-series-parameter-enum.mjs";
import RequestQueueHelper from "../../lib/helpers/request-queue.mjs";
import {buildEffectiveParameters, fSeriesOverrideConfig} from "../../lib/helpers/parameter-override.mjs";

/**
 * Represents a Nibe Heat Pump device in Homey
 */
class FSeriesDevice extends OAuth2Device {
    /**
     * List of parameters to monitor
     * @type {number[]}
     */
    static MONITORED_PARAMETERS = [
        FSeriesParameterIds.OUTDOOR_TEMP,
        FSeriesParameterIds.ROOM_TEMP,
        FSeriesParameterIds.CURRENT_COMPRESSOR_FREQ,
        FSeriesParameterIds.CURRENT_3,
        FSeriesParameterIds.CURRENT_1,
        FSeriesParameterIds.CURRENT_2,
        FSeriesParameterIds.EXHAUST_AIR_FAN_SPEED,
        FSeriesParameterIds.EXTRACT_AIR_TEMP,
        FSeriesParameterIds.EXHAUST_AIR_TEMP,
        FSeriesParameterIds.DEGREE_MINUTES,
        FSeriesParameterIds.SET_POINT_TEMP_1,
        FSeriesParameterIds.CONDENSER_TEMP,
        FSeriesParameterIds.TEMPORARY_LUX,
        FSeriesParameterIds.INCREASED_VENTILATION,
        FSeriesParameterIds.HEATING_MEDIUM_SUPPLY,
        FSeriesParameterIds.RETURN_LINE_TEMP,
        FSeriesParameterIds.HOT_WATER_TOP,
        FSeriesParameterIds.HOT_WATER_CHARGING,
        FSeriesParameterIds.SUCTION_GAS_TEMP,
        FSeriesParameterIds.SUPPLY_LINE,
        FSeriesParameterIds.CALCULATED_SUPPLY_LINE,
        FSeriesParameterIds.TIME_HEAT_ADDITION,
        FSeriesParameterIds.COMPRESSOR_STATUS,
        FSeriesParameterIds.AIR_VELOCITY_SENSOR,
        // Removed for now since it doesn't return the correct value
        // ParameterIds.ELECTRIC_ADDITION_STATUS
        FSeriesParameterIds.SET_POINT_TEMP_F730,
        FSeriesParameterIds.SET_MAX_ELECTRICAL_ADD,
        FSeriesParameterIds.OPERATIONAL_MODE,
        FSeriesParameterIds.BRINE_PUMP_SPEED,
    ];

    /**
     * Maps Homey capabilities to Nibe parameter IDs
     * @type {Object.<string, number>}
     */
    static CAPABILITY_PARAMETER_MAP = {
        'state_button.temp_lux': FSeriesParameterIds.TEMPORARY_LUX,
        'state_button.ventilation_boost': FSeriesParameterIds.INCREASED_VENTILATION,
    };

    /**
     * Capabilities that are only added when the heat pump actually reports the parameter.
     * If the parameter is missing from the API response, the capability is removed.
     * @type {Object.<number, string>}
     */
    static OPTIONAL_CAPABILITIES = {
        [FSeriesParameterIds.OPERATIONAL_MODE]: 'heater_operational_mode',
        [FSeriesParameterIds.BRINE_PUMP_SPEED]: 'measure_pump_speed.brine',
    };

    /**
     * Initialize the device
     * @returns {Promise<void>}
     */
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
            this.log(`Device ${this.deviceId} initialized`);

            // Initialize services
            this.settingsManager = new SettingsManager(this, this.oAuth2Client);
            this.powerCalculator = new PowerCalculator();
            this.requestQueue = new RequestQueueHelper(this);

            // Build effective parameter map (applies user overrides from settings)
            this._buildEffectiveParameters();

            // Initial setup
            await this.fetchAndSetDataPoints(this._effectiveMonitored);
            await this.settingsManager.initializeSettings();
            await this.powerCalculator.updateDevicePower(this);
            await this.powerCalculator.updateMeterPower(this);

            // Set up capability listeners
            await this.setupCapabilityListeners();
            // Remove deprecated capabilities from existing devices
            const deprecatedCapabilities = [
                'status_electric_addition',
                'hot_water_demand',
                'set_max_electrical_add',
            ];
            for (const cap of deprecatedCapabilities) {
                if (this.hasCapability(cap)) {
                    try {
                        this.log(`Removing deprecated capability: ${cap}`);
                        await this.removeCapability(cap);
                    } catch (err) {
                        this.error(`Failed to remove capability ${cap}: ${err.message}`);
                    }
                }
            }
            // Start polling
            this.startPolling();
        } catch (error) {
            this.error('Error during device initialization:', error.message, error.stack);
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
                await this.powerCalculator.updateDevicePower(this);
                await this.powerCalculator.updateMeterPower(this);
                await this.settingsManager.updateHeatpumpSettings();
            } catch (error) {
                this.error(`Error during polling: ${error.message}`);
            }
        }, 1000 * 60 * this.pollInterval);
    }

    /**
     * Sets the target temperature
     * @param {number} temperature - Target temperature in Celsius
     * @returns {Promise<void>}
     */
    async setTargetTemperature(temperature) {
        try {
            this.log(`Setting target temperature to ${temperature}°C`);
            if (!this.hasCapability('target_temperature.room')) {
                throw new Error('Device does not support target temperature control');
            }

            // Determine active setpoint parameter
            const activeParam = this.getActiveSetPointParameterId();
            let primaryTried = false;
            let lastError;

            const tryUpdate = async (parameterId) => {
                if (parameterId == null) return;
                primaryTried = true;
                await this.requestQueue.queueParameterUpdate(parameterId, Number(temperature));
                this.log(`Set target temperature via parameter ${parameterId}`);
            };

            try {
                await tryUpdate(activeParam);
            } catch (err) {
                lastError = err;
                // Fallback: try the other parameter
                const alt = activeParam === FSeriesParameterIds.SET_POINT_TEMP_F730
                    ? FSeriesParameterIds.SET_POINT_TEMP_1
                    : FSeriesParameterIds.SET_POINT_TEMP_F730;
                try {
                    await tryUpdate(alt);
                    // Switch internal mode if alternate succeeded
                    this._useF730SetPoint = (alt === FSeriesParameterIds.SET_POINT_TEMP_F730);
                    this.log(`Fallback succeeded using parameter ${alt}`);
                } catch (altErr) {
                    this.error(`Failed setting temperature on both parameters: primary ${activeParam} error: ${lastError?.message}, fallback ${altErr.message}`);
                    throw altErr;
                }
            }

            // Update capability after successful parameter write
            await this.setCapabilityValue('target_temperature.room', Number(temperature));
            this.log(`Successfully set target temperature to ${temperature}°C (active param: ${this.getActiveSetPointParameterId()})`);
        } catch (error) {
            this.error(`Failed to set target temperature: ${error.message}`);
            throw error;
        }
    }

    /**
     * Sets up capability listeners for device control
     */
    async setupCapabilityListeners() {
        // Register standard mapped capabilities
        for (const [capability, parameterId] of Object.entries(FSeriesDevice.CAPABILITY_PARAMETER_MAP)) {
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
        // Dynamic listener for room target temperature
        if (this.hasCapability('target_temperature.room')) {
            this.registerCapabilityListener('target_temperature.room', async (value) => {
                await this.setTargetTemperature(value);
            });
        }
    }

    /**
     * Returns cached autocomplete options for a given parameter ID.
     * @param {number} paramId
     * @returns {Array<{id: string, name: string}>}
     */
    getActionEnumOptions(paramId) {
        return this._actionEnumCache?.[paramId] ?? [];
    }

    getActiveSetPointParameterId() {
        if (this._useF730SetPoint) return FSeriesParameterIds.SET_POINT_TEMP_F730;
        return FSeriesParameterIds.SET_POINT_TEMP_1;
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
        /*
            This has become sort of a mess due to the dual setpoint parameters and fallback logic.
            Mainly because the F730 uses some edge-cases.
            TODO: Refactor and clean up the logic here.
         */
        try {
            this.log(`Fetching data points for ${params.length} parameters`);
            const dataPoints = await this.oAuth2Client.getDataPoints(this.deviceId, params);
            const seenParams = new Set();
            const numericValues = {};
            const heatingMediumSupplyId = this._getEffectiveParamId(FSeriesParameterIds.HEATING_MEDIUM_SUPPLY);
            const supplyLineId = this._getEffectiveParamId(FSeriesParameterIds.SUPPLY_LINE);
            const setPoint1Id = FSeriesParameterIds.SET_POINT_TEMP_1;
            const setPointF730Id = FSeriesParameterIds.SET_POINT_TEMP_F730;

            for (const point of dataPoints) {
                const paramId = Number(point.parameterId);
                const param = this._effectiveMap[paramId];
                if (!param) {
                    this.log(`Unknown parameter: ${paramId}`);
                    continue;
                }
                seenParams.add(paramId);
                try {
                    let value;
                    // actionEnum: cache options for flow action autocomplete, no capability
                    if (param.type === 'actionEnum') {
                        if (Array.isArray(point.enumValues) && point.enumValues.length > 0) {
                            if (!this._actionEnumCache) this._actionEnumCache = {};
                            this._actionEnumCache[paramId] = point.enumValues.map(e => ({
                                id: String(e.value),
                                name: e.text
                            }));
                        }
                        continue;
                    }

                    switch (param.type) {
                        case 'boolean':
                            value = Boolean(point.value);
                            break;
                        case 'number':
                            value = Number(point.value);
                            numericValues[paramId] = value;
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

                    // Skip heating medium supply (handled separately) and both setpoint params (handled after loop)
                    if (paramId === heatingMediumSupplyId || paramId === setPoint1Id || paramId === setPointF730Id) {
                        continue;
                    }

                    // Convert watts to kW for internal addition power capability
                    if (param.capabilityName === "measure_power.internal_addition" && typeof value === 'number') {
                        value = value * 1000;
                    }

                    if (this.hasCapability(param.capabilityName)) {
                        await this.setCapabilityValue(param.capabilityName, value);
                    } else {
                        await this.addCapability(param.capabilityName);
                        await this.setCapabilityValue(param.capabilityName, value);
                    }
                } catch (capError) {
                    this.error(`Error setting capability for param ${paramId}: ${capError.message}`);
                }
            }

            // Decide active setpoint parameter
            const hasF730SetPoint = seenParams.has(setPointF730Id) && this.isValidNumber(numericValues[setPointF730Id]);
            const hasSetPoint1 = seenParams.has(setPoint1Id) && this.isValidNumber(numericValues[setPoint1Id]);
            if (hasF730SetPoint) {
                if (!this._useF730SetPoint) {
                    this._useF730SetPoint = true;
                    this.log('Detected F730-specific setpoint parameter; switching to SET_POINT_TEMP_F730 (47015).');
                }
            } else if (hasSetPoint1 && this._useF730SetPoint) {
                // If F730 param disappears, fallback
                this._useF730SetPoint = false;
                this.log('F730 setpoint parameter missing; reverting to SET_POINT_TEMP_1 (47398).');
            } else if (!hasF730SetPoint && !hasSetPoint1) {
                this.log('No setpoint parameters reported in this poll cycle.');
            }

            // Update target_temperature.room capability value
            const chosenValue = this._useF730SetPoint
                ? (numericValues[setPointF730Id] ?? numericValues[setPoint1Id])
                : (numericValues[setPoint1Id] ?? numericValues[setPointF730Id]);
            if (this.isValidNumber(chosenValue)) {
                if (!this.hasCapability('target_temperature.room')) {
                    await this.addCapability('target_temperature.room');
                }
                await this.setCapabilityValue('target_temperature.room', chosenValue);
            }

            // Prune optional capabilities that the device does not report
            for (const [defaultParamId, capability] of Object.entries(FSeriesDevice.OPTIONAL_CAPABILITIES)) {
                const effectiveId = this._getEffectiveParamId(Number(defaultParamId));
                if (!seenParams.has(effectiveId) && this.hasCapability(capability)) {
                    try {
                        this.log(`Removing optional capability ${capability}: parameter ${effectiveId} not reported by device`);
                        await this.removeCapability(capability);
                    } catch (err) {
                        this.error(`Failed to remove capability ${capability}: ${err.message}`);
                    }
                }
            }

            const hasSupplyLine = seenParams.has(supplyLineId) && this.isValidTemperature(numericValues[supplyLineId]);
            const hasHeatingMedium = seenParams.has(heatingMediumSupplyId) && this.isValidTemperature(numericValues[heatingMediumSupplyId]);
            const supplyLineCapability = this._effectiveMap[supplyLineId]?.capabilityName;
            const heatingMediumCapability = this._effectiveMap[heatingMediumSupplyId]?.capabilityName;

            // Always remove heating medium capability as it's only used as fallback
            if (heatingMediumCapability && this.hasCapability(heatingMediumCapability)) {
                try {
                    await this.removeCapability(heatingMediumCapability);
                } catch (remErr) {
                    this.error(`Failed removing ${heatingMediumCapability}: ${remErr.message}`);
                }
            }

            // Use SUPPLY_LINE if valid, otherwise fallback to HEATING_MEDIUM_SUPPLY
            if (hasSupplyLine) {
                const supplyValue = numericValues[supplyLineId];
                if (supplyLineCapability) {
                    if (!this.hasCapability(supplyLineCapability)) {
                        await this.addCapability(supplyLineCapability);
                    }
                    await this.setCapabilityValue(supplyLineCapability, supplyValue);
                    if (this._supplyLineFallbackLogged) {
                        this._supplyLineFallbackLogged = false;
                        this.log('SUPPLY_LINE now reporting valid value; fallback no longer in effect.');
                    }
                }
            } else if (hasHeatingMedium) {
                // SUPPLY_LINE invalid or missing, use HEATING_MEDIUM_SUPPLY
                const fallbackValue = numericValues[heatingMediumSupplyId];
                if (supplyLineCapability) {
                    if (!this.hasCapability(supplyLineCapability)) {
                        await this.addCapability(supplyLineCapability);
                    }
                    await this.setCapabilityValue(supplyLineCapability, fallbackValue);
                    if (!this._supplyLineFallbackLogged) {
                        this._supplyLineFallbackLogged = true;
                        const supplyLineValue = numericValues[supplyLineId];
                        const reason = seenParams.has(supplyLineId)
                            ? `invalid value ${supplyLineValue}°C (out of range)`
                            : 'not reported';
                        this.log(`Fallback applied: SUPPLY_LINE ${reason}, using HEATING_MEDIUM_SUPPLY (${fallbackValue}°C) instead.`);
                    }
                }
            }
        } catch (error) {
            this.error(`Error fetching data points: ${error.message}`);
            throw error;
        }
    }

    // Helper to validate numeric value (not NaN, finite)
    isValidNumber(value) {
        return typeof value === 'number' && !isNaN(value) && isFinite(value);
    }

    // Helper to validate if temperature is within sensible range
    isValidTemperature(value) {
        return this.isValidNumber(value) && value >= -50 && value <= 100;
    }

    /**
     *
     * @param {Object} param
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

        // Special handling for electricity addition status
        if (param.capabilityName === "status_electric_addition") {
            this.log(param.capabilityName, 'value', point.value);
            return this.processElectricAdditionStatus(point);
        }

        // Standard enum handling for other parameters
        return this.processStandardEnum(point);
    }

    /**
     * Process electric addition status enum values
     * @param {Object} point - The data point from the API
     * @returns {string} The processed value
     */
    processElectricAdditionStatus(point) {
        const roundedValue = Math.round(point.value * 10);
        // Try to find an exact match first
        const exactMatch = point.enumValues.find(item =>
            Number(item.value) === roundedValue
        );

        let valueText = exactMatch?.text;

        // If no exact match, try to find the closest match
        if (!valueText) {
            valueText = this.findClosestEnumValue(roundedValue, point.enumValues);
        }

        // If we still don't have a value, use the original
        if (!valueText) {
            valueText = String(point.value);
        }

        // Translate and capitalize
        return this.formatEnumValue(valueText);
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
     * Find the closest enum value for a given numeric value
     * @param {number} targetValue - The target value to match
     * @param {Array} enumValues - Array of enum value objects
     * @returns {string} The text of the closest matching enum
     */
    findClosestEnumValue(targetValue, enumValues) {
        // Convert all enum values to numbers for comparison
        const numericEnums = enumValues.map(item => ({
            value: Number(item.value),
            text: item.text
        })).filter(item => !isNaN(item.value));

        if (numericEnums.length === 0) return null;

        // Find the closest enum value
        let closest = numericEnums[0];
        let closestDiff = Math.abs(targetValue - closest.value);

        for (let i = 1; i < numericEnums.length; i++) {
            const diff = Math.abs(targetValue - numericEnums[i].value);
            if (diff < closestDiff) {
                closest = numericEnums[i];
                closestDiff = diff;
            }
        }

        // Only accept matches that are reasonably close (within 10 units)
        if (closestDiff <= 10) {
            return closest.text;
        }

        return closest.text;
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
            buildEffectiveParameters(fSeriesParameterMap, FSeriesDevice.MONITORED_PARAMETERS, fSeriesOverrideConfig, settings);

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
     * Resolve a default parameter ID to its effective (possibly overridden) ID
     * @param {number} defaultParamId
     * @returns {number}
     */
    _getEffectiveParamId(defaultParamId) {
        return this._paramIdOverrides?.[defaultParamId] ?? defaultParamId;
    }

    /**
     * Clean up when device is deleted
     */
    async onDeleted() {
        this.log(`Device ${this.deviceId} deleted, cleaning up`);
        if (this.pollTimer) {
            this.homey.clearInterval(this.pollTimer);
        }
        if (this.requestQueue) {
            this.requestQueue.clearQueue();
        }
    }
}

export default FSeriesDevice;

