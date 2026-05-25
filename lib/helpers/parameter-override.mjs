/**
 * Parameter override utilities for remapping parameter IDs via device settings.
 * Allows users to override which myUplink parameter ID maps to each Homey capability.
 *
 * @module helpers/parameter-override
 */

import FSeriesParameterIds from "../models/f-series-parameter-enum.mjs";
import SSeriesParameterIds from "../models/s-series-parameter-enum.mjs";

/**
 * Maps setting IDs to their default F-Series parameter IDs.
 * Each key corresponds to a setting in driver.settings.compose.json.
 * @type {Object.<string, number>}
 */
export const fSeriesOverrideConfig = {
    param_outdoor_temp: FSeriesParameterIds.OUTDOOR_TEMP,
    param_heating_supply: FSeriesParameterIds.HEATING_MEDIUM_SUPPLY,
    param_return_line: FSeriesParameterIds.RETURN_LINE_TEMP,
    param_hot_water_top: FSeriesParameterIds.HOT_WATER_TOP,
    param_hot_water_charging: FSeriesParameterIds.HOT_WATER_CHARGING,
    param_condenser: FSeriesParameterIds.CONDENSER_TEMP,
    param_suction_gas: FSeriesParameterIds.SUCTION_GAS_TEMP,
    param_exhaust_air: FSeriesParameterIds.EXHAUST_AIR_TEMP,
    param_room_temp: FSeriesParameterIds.ROOM_TEMP,
    param_supply_line: FSeriesParameterIds.SUPPLY_LINE,
    param_degree_minutes: FSeriesParameterIds.DEGREE_MINUTES,
    param_compressor_freq: FSeriesParameterIds.CURRENT_COMPRESSOR_FREQ,
    param_operational_mode: FSeriesParameterIds.OPERATIONAL_MODE,
    param_brine_pump_speed: FSeriesParameterIds.BRINE_PUMP_SPEED,
};

/**
 * Maps setting IDs to their default S-Series parameter IDs.
 * Each key corresponds to a setting in driver.settings.compose.json.
 * @type {Object.<string, number>}
 */
export const sSeriesOverrideConfig = {
    param_outdoor_temp: SSeriesParameterIds.OUTDOOR_TEMP,
    param_avg_outdoor_temp: SSeriesParameterIds.AVERAGE_OUTDOOR_TEMP,
    param_supply_line: SSeriesParameterIds.SUPPLY_LINE_TEMP,
    param_return_line: SSeriesParameterIds.RETURN_TEMP,
    param_hot_water_top: SSeriesParameterIds.HOT_WATER_TOP,
    param_hot_water_charging: SSeriesParameterIds.HOT_WATER_CHARGING,
    param_brine_in: SSeriesParameterIds.BRINE_IN,
    param_brine_out: SSeriesParameterIds.BRINE_OUT,
    param_discharge: SSeriesParameterIds.DISCHARGE_TEMP,
    param_suction_gas: SSeriesParameterIds.SUCTION_GAS,
    param_room_temp: SSeriesParameterIds.ROOM_TEMP,
    param_degree_minutes: SSeriesParameterIds.DEGREE_MINUTES,
    param_compressor_freq: SSeriesParameterIds.CURRENT_COMPRESSOR_FREQ,
};

/**
 * Build effective parameter map and monitored parameter list with user overrides applied.
 *
 * When a user sets a parameter override to a non-zero value different from the default,
 * the default parameter ID is swapped out in both the map and the monitored list.
 *
 * @param {Object} defaultMap - Default parameter map (paramId -> capability info)
 * @param {number[]} defaultMonitoredParams - Default list of monitored parameter IDs
 * @param {Object.<string, number>} overrideConfig - Maps setting key to default parameter ID
 * @param {Object} settings - Current device settings
 * @returns {{ effectiveMap: Object, effectiveMonitored: number[], paramIdOverrides: Object.<number, number>, appliedOverrides: Array }}
 */
export function buildEffectiveParameters(defaultMap, defaultMonitoredParams, overrideConfig, settings) {
    const effectiveMap = { ...defaultMap };
    const effectiveMonitored = [...defaultMonitoredParams];
    const paramIdOverrides = {};
    const appliedOverrides = [];

    for (const [settingKey, defaultParamId] of Object.entries(overrideConfig)) {
        const overrideParamId = Number(settings[settingKey]);
        if (!overrideParamId || overrideParamId === 0 || overrideParamId === defaultParamId) continue;

        // Move the map entry from default ID to override ID
        const mapEntry = effectiveMap[defaultParamId];
        if (mapEntry) {
            delete effectiveMap[defaultParamId];
            effectiveMap[overrideParamId] = { ...mapEntry };
            paramIdOverrides[defaultParamId] = overrideParamId;
            appliedOverrides.push({
                settingKey,
                from: defaultParamId,
                to: overrideParamId,
                capability: mapEntry.capabilityName,
            });
        }

        // Swap in monitored params
        const idx = effectiveMonitored.indexOf(defaultParamId);
        if (idx !== -1) {
            effectiveMonitored[idx] = overrideParamId;
        }
    }

    return { effectiveMap, effectiveMonitored, paramIdOverrides, appliedOverrides };
}
