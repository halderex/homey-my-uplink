'use strict';

import {OAuth2App} from "homey-oauth2app";
import {MyUplinkOAuth2Client} from "./lib/api/my-uplink-o-auth2-client.mjs";
import FSeriesParameterIds from "./lib/models/f-series-parameter-enum.mjs";
import SSeriesParameterIds from "./lib/models/s-series-parameter-enum.mjs";

/**
 * Reads a device's room (indoor) temperature.
 *
 * Most devices expose it as the dotted `measure_temperature.room`, but the energy-split heating
 * device promotes it to the ROOT `measure_temperature` so Homey's Climate feature reports the room
 * temperature rather than a heating-circuit temperature. Flow cards must accept both.
 *
 * @param {object} device - the Homey device
 * @returns {number|null} the room temperature, or null if the device exposes neither capability
 */
function getRoomTemperature(device) {
    if (device.hasCapability('measure_temperature.room')) {
        return device.getCapabilityValue('measure_temperature.room');
    }
    if (device.hasCapability('measure_temperature')) {
        return device.getCapabilityValue('measure_temperature');
    }
    return null;
}

class NibeHeatpumpApp extends OAuth2App {
    static OAUTH2_CLIENT = MyUplinkOAuth2Client;
    static OAUTH2_DEBUG = false;
    static OAUTH2_MULTI_SESSION = true;

    async onOAuth2Init() {
        this.log("App started");

        // Register flow actions and conditions
        this.registerFlowActions();
        this.registerFlowConditions();
    }

    registerFlowActions() {

        const setHeatingCurveAction = this.homey.flow.getActionCard('set-heating-curve');
        setHeatingCurveAction.registerRunListener(async (args, state) => {
            const { device, value } = args;

            if (!device) {
                throw new Error('Device not found');
            }

            this.log(`Setting heating curve to ${value} on device ${device.getName()}`);

            // Get the appropriate parameter ID depending on the device type
            const paramId = device.constructor.name === 'SSeriesDevice'
                ? SSeriesParameterIds.HEATING_OFFSET
                : FSeriesParameterIds.HEATING_CURVE;
            await device.setParameterValue(paramId, Number(value));
            return true;
        });

        // Set heating factor system action
        const setHeatingFactorSystemAction = this.homey.flow.getActionCard('set-heating-factor-system');
        setHeatingFactorSystemAction.registerRunListener(async (args, state) => {
            const {device, value} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            this.log(`Setting heating factor system to ${value} on device ${device.getName()}`);

            await device.setParameterValue(FSeriesParameterIds.HEATING_FACTOR_SYSTEM, Number(value));
            return true;
        });

        // Set temperature action
        const setTemperatureAction = this.homey.flow.getActionCard('set-temperature');
        setTemperatureAction.registerRunListener(async (args, state) => {
            const {device} = args;
            const targetTemperature = args.target_temperature;

            if (!device || !device.setTargetTemperature) {
                throw new Error('Device not found or does not support temperature control');
            }

            this.log(`Setting temperature to ${targetTemperature} on device ${device.getName()}`);

            await device.setTargetTemperature(targetTemperature);

            return true;
        });

        const setTempLuxAction = this.homey.flow.getActionCard('set-temp-lux');
        setTempLuxAction.registerRunListener(async (args, state) => {
            const {device, state: tempLuxState} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            const value = tempLuxState === "1";
            this.log(`Setting temporary luxury to ${value ? 'on' : 'off'} on device ${device.getName()}`);
            await device.setParameterValue(FSeriesParameterIds.TEMPORARY_LUX, Number(tempLuxState));
            await device.setCapabilityValue('state_button.temp_lux', value);
            return true;
        });

        // Set ventilation boost action
        const setVentilationBoostAction = this.homey.flow.getActionCard('set-ventilation-boost');
        setVentilationBoostAction.registerRunListener(async (args, state) => {
            const {device, state: ventBoostState} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            const value = ventBoostState === "1";
            this.log(`Setting ventilation boost to ${value ? 'on' : 'off'} on device ${device.getName()}`);
            await device.setParameterValue(FSeriesParameterIds.INCREASED_VENTILATION, Number(ventBoostState));
            await device.setCapabilityValue('state_button.ventilation_boost', value);
            return true;
        });

        // Set degree minutes action
        const setDegreeMinutesAction = this.homey.flow.getActionCard('set-degree-minutes');
        setDegreeMinutesAction.registerRunListener(async (args, state) => {
            const { device, value } = args;

            if (!device) {
                throw new Error('Device not found');
            }

            this.log(`Setting degree minutes to ${value} on device ${device.getName()}`);

            const paramId = device.constructor.name === 'SSeriesDevice'
                ? SSeriesParameterIds.DEGREE_MINUTES
                : FSeriesParameterIds.DEGREE_MINUTES;

            await device.setParameterValue(paramId, Number(value));
            return true;
        });

        // Set heating curve offset action
        const setHeatingCurveOffsetAction = this.homey.flow.getActionCard('set-heating-curve-offset');
        setHeatingCurveOffsetAction.registerRunListener(async (args, state) => {
            const {device, value} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            this.log(`Setting heating curve offset to ${value} on device ${device.getName()}`);

            const paramId = device.constructor.name === 'SSeriesDevice'
                ? SSeriesParameterIds.HEATING_OFFSET
                : FSeriesParameterIds.OFFSET_CLIMATE_SYSTEM_1;

            await device.setParameterValue(paramId, Number(value));
            return true;
        });

        // Set max electrical addition action
        const setMaxElectricalAddAction = this.homey.flow.getActionCard('set-max-electrical-add');
        setMaxElectricalAddAction.registerArgumentAutocompleteListener('power', async (query, args) => {
            const options = args.device.getActionEnumOptions(FSeriesParameterIds.SET_MAX_ELECTRICAL_ADD);
            return options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()));
        });
        setMaxElectricalAddAction.registerRunListener(async (args, state) => {
            const { device, power } = args;

            if (!device) {
                throw new Error('Device not found');
            }

            this.log(`Setting max electrical addition to ${power.id} on device ${device.getName()}`);
            await device.setParameterValue(FSeriesParameterIds.SET_MAX_ELECTRICAL_ADD, Number(power.id));
            return true;
        });
    }

    registerFlowConditions() {
        // Degree minutes condition
        const degreeMinutesCondition = this.homey.flow.getConditionCard('degree-minutes-condition');
        degreeMinutesCondition.registerRunListener(async (args, state) => {
            const {device, comparison, value} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            // Get the current degree minutes value from the capability
            const currentValue = device.getCapabilityValue('measure_degree_minutes');

            if (typeof currentValue !== 'number') {
                throw new Error('Degree minutes value not available');
            }

            this.log(`Checking if degree minutes ${currentValue} is ${comparison} ${value}`);

            switch (comparison) {
                case 'greater':
                    return currentValue > value;
                case 'equals':
                    // For degree minutes, use a tolerance range (±5 DM) for "equals"
                    return Math.abs(currentValue - value) <= 5;
                case 'less':
                    return currentValue < value;
                default:
                    throw new Error(`Invalid comparison: ${comparison}`);
            }
        });
        
        // Heating curve condition
        const heatingCurveCondition = this.homey.flow.getConditionCard('heating-curve-condition');
        heatingCurveCondition.registerRunListener(async (args, state) => {
            const {device, comparison, value} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            // Get the heating curve value from device settings
            const settings = await device.getSettings();
            const currentValue = settings.heating_curve;

            if (typeof currentValue !== 'number') {
                throw new Error('Heating curve value not available');
            }

            this.log(`Checking if heating curve ${currentValue} is ${comparison} ${value}`);

            switch (comparison) {
                case 'greater':
                    return currentValue > value;
                case 'equals':
                    return currentValue === value;
                case 'less':
                    return currentValue < value;
                default:
                    throw new Error(`Invalid comparison: ${comparison}`);
            }
        });

        // Heating curve offset condition
        const heatingCurveOffsetCondition = this.homey.flow.getConditionCard('heating-curve-offset-condition');
        heatingCurveOffsetCondition.registerRunListener(async (args, state) => {
            const {device, comparison, value} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            // Get the heating curve offset value from device settings
            const settings = await device.getSettings();
            const currentValue = settings.heating_offset_climate_system_1;

            if (typeof currentValue !== 'number') {
                throw new Error('Heating curve offset value not available');
            }

            this.log(`Checking if heating curve offset ${currentValue} is ${comparison} ${value}`);

            switch (comparison) {
                case 'greater':
                    return currentValue > value;
                case 'equals':
                    return currentValue === value;
                case 'less':
                    return currentValue < value;
                default:
                    throw new Error(`Invalid comparison: ${comparison}`);
            }
        });

        // Heating factor system condition
        const heatingFactorSystemCondition = this.homey.flow.getConditionCard('heating-factor-system-condition');
        heatingFactorSystemCondition.registerRunListener(async (args, state) => {
            const {device, comparison, value} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            let currentValue = device.getCapabilityValue('measure_heating_factor_system');

            if (typeof currentValue !== 'number') {
                try {
                    const parameterValues = await device.oAuth2Client.getDataPoints(
                        device.deviceId,
                        [FSeriesParameterIds.HEATING_FACTOR_SYSTEM]
                    );

                    if (parameterValues && parameterValues.length > 0) {
                        currentValue = Number(parameterValues[0].value);
                    } else {
                        throw new Error('Heating factor system value not available');
                    }
                } catch (error) {
                    this.error(`Failed to get heating factor system value: ${error.message}`);
                    throw new Error('Heating factor system value not available');
                }
            }

            this.log(`Checking if heating factor system ${currentValue} is ${comparison} ${value}`);

            switch (comparison) {
                case 'greater':
                    return currentValue > value;
                case 'equals':
                    return currentValue === value;
                case 'less':
                    return currentValue < value;
                default:
                    throw new Error(`Invalid comparison: ${comparison}`);
            }
        });

        // Outdoor temperature condition
        const outsideTempCondition = this.homey.flow.getConditionCard('outside-temperature-condition');
        outsideTempCondition.registerRunListener(async (args, state) => {
            const {device, comparison, temperature} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            const currentTemp = device.getCapabilityValue('measure_temperature.outdoor');

            if (typeof currentTemp !== 'number') {
                throw new Error('Outside temperature not available');
            }

            this.log(`Checking if outside temperature ${currentTemp}°C is ${comparison} ${temperature}°C`);

            switch (comparison) {
                case 'greater':
                    return currentTemp > temperature;
                case 'equals':
                    // Allow for a small tolerance in temperature comparison (±0.1°C)
                    return Math.abs(currentTemp - temperature) <= 0.1;
                case 'less':
                    return currentTemp < temperature;
                default:
                    throw new Error(`Invalid comparison: ${comparison}`);
            }
        });

        // Indoor temperature condition
        const indoorTempCondition = this.homey.flow.getConditionCard('indoor-temperature-condition');
        indoorTempCondition.registerRunListener(async (args, state) => {
            const {device, comparison, temperature} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            const currentTemp = getRoomTemperature(device);

            if (typeof currentTemp !== 'number') {
                throw new Error('Indoor temperature not available');
            }

            this.log(`Checking if indoor temperature ${currentTemp}°C is ${comparison} ${temperature}°C`);

            switch (comparison) {
                case 'greater':
                    return currentTemp > temperature;
                case 'equals':
                    // Allow for a small tolerance in temperature comparison (±0.1°C)
                    return Math.abs(currentTemp - temperature) <= 0.1;
                case 'less':
                    return currentTemp < temperature;
                default:
                    throw new Error(`Invalid comparison: ${comparison}`);
            }
        });

        // Temperature difference condition
        const tempDiffCondition = this.homey.flow.getConditionCard('temperature-difference-condition');
        tempDiffCondition.registerRunListener(async (args, state) => {
            const {device, comparison, temperature} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            const indoorTemp = getRoomTemperature(device);
            const outdoorTemp = device.getCapabilityValue('measure_temperature.outdoor');

            if (typeof indoorTemp !== 'number' || typeof outdoorTemp !== 'number') {
                throw new Error('Temperature readings not available');
            }

            const tempDifference = Math.abs(indoorTemp - outdoorTemp);

            this.log(`Checking if temperature difference ${tempDifference.toFixed(1)}°C is ${comparison} ${temperature}°C`);

            switch (comparison) {
                case 'greater':
                    return tempDifference > temperature;
                case 'equals':
                    // Allow for a small tolerance in temperature comparison (±0.1°C)
                    return Math.abs(tempDifference - temperature) <= 0.1;
                case 'less':
                    return tempDifference < temperature;
                default:
                    throw new Error(`Invalid comparison: ${comparison}`);
            }
        });

        // Temperature in range condition
        const tempRangeCondition = this.homey.flow.getConditionCard('temperature-in-range-condition');
        tempRangeCondition.registerRunListener(async (args, state) => {
            console.log(args)
            const {device, type, min, max} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            let currentTemp;

            if (type === 'indoor') {
                currentTemp = getRoomTemperature(device);
            } else if (type === 'outdoor') {
                currentTemp = device.getCapabilityValue('measure_temperature.outdoor');
            } else {
                throw new Error(`Invalid temperature type: ${type}`);
            }

            if (typeof currentTemp !== 'number') {
                throw new Error(`${type} temperature not available`);
            }

            this.log(`Checking if ${type} temperature ${currentTemp}°C is/isn't between ${min}°C and ${max}°C`);

            return currentTemp >= min && currentTemp <= max;
        });

        // Temporary Lux condition
        const tempLuxCondition = this.homey.flow.getConditionCard('temp-lux-condition');
        tempLuxCondition.registerRunListener(async (args, state) => {
            const {device} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            const isActive = device.getCapabilityValue('state_button.temp_lux');

            if (typeof isActive !== 'boolean') {
                throw new Error('Temporary luxury status not available');
            }

            this.log(`Checking if temporary luxury is active: ${isActive}`);
            return isActive;
        });

        // Ventilation Boost condition
        const ventilationBoostCondition = this.homey.flow.getConditionCard('ventilation-boost-condition');
        ventilationBoostCondition.registerRunListener(async (args, state) => {
            const {device} = args;

            if (!device) {
                throw new Error('Device not found');
            }

            const isActive = device.getCapabilityValue('state_button.ventilation_boost');

            if (typeof isActive !== 'boolean') {
                throw new Error('Ventilation boost status not available');
            }

            this.log(`Checking if ventilation boost is active: ${isActive}`);
            return isActive;
        });
    }
}

export default NibeHeatpumpApp;