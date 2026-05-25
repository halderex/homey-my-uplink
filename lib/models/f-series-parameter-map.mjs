/**
 * Maps NIBE parameters to Homey capabilities and metadata
 * @module models/fseries-parameter-map
 */


/**
 * @typedef {Object} F-SeriesParameter
 * @property {string} capabilityName - Capability name in Homey
 * @property {string} parameterName - Descriptive name of the parameter
 * @property {string} type - Data type of the parameter (e.g., "number", "boolean")
 */

import FSeriesParameterIds from "./f-series-parameter-enum.mjs";

/**
 * Map ParameterIds to Homey capabilities and additional metadata
 * @type {Object.<number, NibeParameter>}
 */
const fSeriesParameterMap = {
    [FSeriesParameterIds.OUTDOOR_TEMP]: {
        capabilityName: "measure_temperature.outdoor",
        parameterName: "Outdoor Temperature (BT1)",
        type: "number"
    },
    [FSeriesParameterIds.HEATING_MEDIUM_SUPPLY]: {
        capabilityName: "measure_temperature.heating_supply",
        parameterName: "Heating Medium Supply (BT63)",
        type: "number"
    },
    [FSeriesParameterIds.RETURN_LINE_TEMP]: {
        capabilityName: "measure_temperature.return_line",
        parameterName: "Return Line Temperature (BT3)",
        type: "number"
    },
    [FSeriesParameterIds.HOT_WATER_TOP]: {
        capabilityName: "measure_temperature.hot_water_top",
        parameterName: "Hot Water Top (BT7)",
        type: "number"
    },
    [FSeriesParameterIds.HOT_WATER_CHARGING]: {
        capabilityName: "measure_temperature.hot_water_charging",
        parameterName: "Hot Water Charging (BT6)",
        type: "number"
    },
    [FSeriesParameterIds.CONDENSER_TEMP]: {
        capabilityName: "measure_temperature.condenser",
        parameterName: "Condenser Temperature (BT12)",
        type: "number"
    },
    [FSeriesParameterIds.SUCTION_GAS_TEMP]: {
        capabilityName: "measure_temperature.suction_gas",
        parameterName: "Suction Gas Temperature (BT17)",
        type: "number"
    },
    [FSeriesParameterIds.EXHAUST_AIR_TEMP]: {
        capabilityName: "measure_temperature.exhaust_air",
        parameterName: "Exhaust Air Temperature (BT20)",
        type: "number"
    },
    [FSeriesParameterIds.ROOM_TEMP]: {
        capabilityName: "measure_temperature.room",
        parameterName: "Room Temperature (BT50)",
        type: "number"
    },
    [FSeriesParameterIds.CURRENT_COMPRESSOR_FREQ]: {
        capabilityName: "measure_frequency.compressor",
        parameterName: "Current Compressor Frequency",
        type: "number"
    },
    [FSeriesParameterIds.SUPPLY_LINE]: {
        capabilityName: "measure_temperature.supply_line",
        parameterName: "Supply Line Temperature",
        type: "number"
    },
    [FSeriesParameterIds.CALCULATED_SUPPLY_LINE]: {
        capabilityName: "measure_temperature.calculated_supply_line",
        parameterName: "Calculated Supply Line Temperature",
        type: "number"
    },
    [FSeriesParameterIds.SET_POINT_TEMP_1]: {
        capabilityName: "target_temperature.room",
        parameterName: "Room sensor set point value heating climate system 1",
        type: "number"
    },
    [FSeriesParameterIds.SET_POINT_TEMP_F730]: {
        capabilityName: "target_temperature.room",
        parameterName: "Room sensor set point value heating climate system (F730)",
        type: "number"
    },
    [FSeriesParameterIds.NIGHT_COOLING]: {
        capabilityName: "night_cooling",
        parameterName: "Night Cooling",
        type: "boolean"
    },
    [FSeriesParameterIds.EXHAUST_AIR_FAN_SPEED]: {
        capabilityName: "measure_fan_speed.exhaust_air",
        parameterName: "Exhaust air fan speed",
        type: "number"
    },
    [FSeriesParameterIds.AIR_VELOCITY_SENSOR]: {
        capabilityName: "measure_air_velocity",
        parameterName: "Value, ait velocity sensor",
        type: "number"
    },
    [FSeriesParameterIds.CURRENT_3]: {
        capabilityName: "measure_current.one",
        parameterName: "Current (BE1)",
        type: "number"
    },
    [FSeriesParameterIds.CURRENT_2]: {
        capabilityName: "measure_current.two",
        parameterName: "Current (BE2)",
        type: "number"
    },
    [FSeriesParameterIds.CURRENT_1]: {
        capabilityName: "measure_current.three",
        parameterName: "Current (BE3)",
        type: "number"
    },
    [FSeriesParameterIds.DEGREE_MINUTES]: {
        capabilityName: "measure_degree_minutes",
        parameterName: "Degree Minutes",
        type: "number"
    },
    [FSeriesParameterIds.EXTRACT_AIR_TEMP]: {
        capabilityName: "measure_temperature.extract_air",
        parameterName: "Extract Air Temperature",
        type: "number"
    },
    [FSeriesParameterIds.TEMPORARY_LUX]: {
        capabilityName: "state_button.temp_lux",
        parameterName: "Temporary Lux",
        type: "boolean"
    },
    [FSeriesParameterIds.INCREASED_VENTILATION]: {
        capabilityName: "state_button.ventilation_boost",
        parameterName: "Ventilation Boost",
        type: "boolean"
    },
    [FSeriesParameterIds.OPERATION_MODE]: {
        capabilityName: "heater_operation_mode",
        parameterName: "Heater Operation Mode",
        type: "enum"
    },
    [FSeriesParameterIds.OPERATIONAL_MODE]: {
        capabilityName: "heater_operational_mode",
        parameterName: "Operational Mode",
        type: "enum"
    },
    [FSeriesParameterIds.BRINE_PUMP_SPEED]: {
        capabilityName: "measure_pump_speed.brine",
        parameterName: "Brine Pump Speed (GP2)",
        type: "number"
    },
    [FSeriesParameterIds.HEATING_CURVE]: {
        capabilityName: "measure_heating_curve",
        parameterName: "Heating curve",
        type: "number"
    },
    [FSeriesParameterIds.OFFSET_CLIMATE_SYSTEM_1]: {
        capabilityName: "measure_offset_climate_system_1",
        parameterName: "Heating offset climate system 1",
        type: "number"
    },
    [FSeriesParameterIds.TIME_HEAT_ADDITION]: {
        capabilityName: "time.heat_addition",
        parameterName: "Time Heat Addition",
        type: "number"
    },
    [FSeriesParameterIds.POWER_INTERNAL_ADDITIONAL_HEAT]: {
        capabilityName: "measure_power.internal_addition",
        parameterName: "Power internal add. heat",
        type: "number"
    },
    [FSeriesParameterIds.COMPRESSOR_STATUS]: {
        capabilityName: "status_compressor",
        parameterName: "Compressor status",
        type: "enum"
    },
    [FSeriesParameterIds.ELECTRIC_ADDITION_STATUS]: {
        capabilityName: "status_electric_addition",
        parameterName: "Electric Addition Status",
        type: "enum"
    },
    [FSeriesParameterIds.SET_MAX_ELECTRICAL_ADD]: {
        capabilityName: null,
        parameterName: "Set Max Electrical Addition",
        type: "actionEnum"
    },
    [FSeriesParameterIds.HEATING_FACTOR_SYSTEM]: {
        capabilityName: "measure_heating_factor_system",
        parameterName: "Heating Factor System",
        type: "number"
    },
};
export default fSeriesParameterMap;
