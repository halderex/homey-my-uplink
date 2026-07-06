/**
 * Maps NIBE S-Series parameters to Homey capabilities and metadata
 * @module models/sseries-parameter-map
 */

/**
 * @typedef {Object} SSeriesParameter
 * @property {string} capabilityName - Capability name in Homey
 * @property {string} parameterName - Descriptive name of the parameter
 * @property {string} type - Data type of the parameter (e.g., "number", "boolean", "enum")
 */

import SSeriesParameterIds from "./s-series-parameter-enum.mjs";

/**
 * Map ParameterIds to Homey capabilities and additional metadata
 * @type {Object.<number, SSeriesParameter>}
 */
const sSeriesParameterMap = {
    [SSeriesParameterIds.OUTDOOR_TEMP]: {
        capabilityName: "measure_temperature.outdoor",
        parameterName: "Current Outdoor Temperature (BT1)",
        type: "number"
    },
    [SSeriesParameterIds.AVERAGE_OUTDOOR_TEMP]: {
        capabilityName: "measure_temperature.average_outdoor",
        parameterName: "Average Outdoor Temperature",
        type: "number"
    },
    [SSeriesParameterIds.RETURN_TEMP]: {
        capabilityName: "measure_temperature.return_line",
        parameterName: "Return Line (BT3)",
        type: "number"
    },
    [SSeriesParameterIds.HOT_WATER_TOP]: {
        capabilityName: "measure_temperature.hot_water_top",
        parameterName: "Hot Water Top (BT7)",
        type: "number"
    },
    [SSeriesParameterIds.HOT_WATER_CHARGING]: {
        capabilityName: "measure_temperature.hot_water_charging",
        parameterName: "Hot Water Charging (BT6)",
        type: "number"
    },
    [SSeriesParameterIds.HOT_WATER_AMOUNT]: {
        capabilityName: "hotwater_amount",
        parameterName: "Hot Water Amount Remaining",
        type: "number"
    },
    [SSeriesParameterIds.ADD_HEAT_TIME_HOT_WATER]: {
        capabilityName: "time.hot_water_add_heat",
        parameterName: "Op. Time El. Add. Heat For Hot Water",
        type: "number"
    },
    [SSeriesParameterIds.BRINE_IN]: {
        capabilityName: "measure_temperature.brine_in",
        parameterName: "Brine In (BT10)",
        type: "number"
    },
    [SSeriesParameterIds.BRINE_OUT]: {
        capabilityName: "measure_temperature.brine_out",
        parameterName: "Brine Out (BT11)",
        type: "number"
    },
    [SSeriesParameterIds.SUPPLY_LINE_TEMP]: {
        capabilityName: "measure_temperature.supply_line",
        parameterName: "Supply line (BT2)",
        type: "number"
    },
    [SSeriesParameterIds.DISCHARGE_TEMP]: {
        capabilityName: "measure_temperature.discharge",
        parameterName: "Discharge (BT14)",
        type: "number"
    },
    [SSeriesParameterIds.LIQUID_LINE]: {
        capabilityName: "measure_temperature.liquid_line",
        parameterName: "Liquid Line (BT15)",
        type: "number"
    },
    [SSeriesParameterIds.SUCTION_GAS]: {
        capabilityName: "measure_temperature.suction_gas",
        parameterName: "Suction Gas (BT17)",
        type: "number"
    },
    [SSeriesParameterIds.CALCULATED_SUPPLY_LINE]: {
        capabilityName: "measure_temperature.calculated_supply",
        parameterName: "Calculated Supply Line, Climate System 1",
        type: "number"
    },
    [SSeriesParameterIds.AIRFLOW]: {
        capabilityName: "airflow",
        parameterName: "Airflow (BP16)",
        type: "number"
    },
    [SSeriesParameterIds.ROOM_TEMP]: {
        capabilityName: "measure_temperature.room",
        parameterName: "Room Temperature (BT50)",
        type: "number"
    },
    [SSeriesParameterIds.CURRENT_1]: {
        capabilityName: "measure_current.one",
        parameterName: "Current (BE3)",
        type: "number"
    },
    [SSeriesParameterIds.CURRENT_2]: {
        capabilityName: "measure_current.two",
        parameterName: "Current (BE2)",
        type: "number"
    },
    [SSeriesParameterIds.CURRENT_3]: {
        capabilityName: "measure_current.three",
        parameterName: "Current (BE1)",
        type: "number"
    },
    [SSeriesParameterIds.DEGREE_MINUTES]: {
        capabilityName: "measure_degree_minutes",
        parameterName: "Degree Minutes",
        type: "number"
    },
    [SSeriesParameterIds.HEATING_MEDIUM_PUMP_SPEED]: {
        capabilityName: "measure_pump_speed.heating_medium",
        parameterName: "Heating Medium Pump Speed (GP1)",
        type: "number"
    },
    [SSeriesParameterIds.BRINE_PUMP_SPEED]: {
        capabilityName: "measure_pump_speed.brine",
        parameterName: "Brine Pump Speed (GP2)",
        type: "number"
    },
    [SSeriesParameterIds.CURRENT_COMPRESSOR_FREQ]: {
        capabilityName: "measure_frequency.compressor",
        parameterName: "Current Compressor Frequency",
        type: "number"
    },
    [SSeriesParameterIds.COMPRESSOR_STARTS]: {
        capabilityName: "measure_compressor_starts",
        parameterName: "Compressor Starter",
        type: "number"
    },
    [SSeriesParameterIds.TOTAL_COMPRESSOR_RUNTIME]: {
        capabilityName: "time.compressor_runtime",
        parameterName: "Total Compressor Runtime",
        type: "number"
    },
    [SSeriesParameterIds.ADD_HEAT_TIME_HEATING]: {
        capabilityName: "time.add_heat_heating",
        parameterName: "Op. Time El. Add. Heat For Heating",
        type: "number"
    },
    [SSeriesParameterIds.COMPRESSOR_STATUS]: {
        capabilityName: "status_compressor",
        parameterName: "Compressor Operating Mode",
        type: "enum"
    },
    [SSeriesParameterIds.INSTANTANEOUS_POWER]: {
        capabilityName: "measure_power",
        parameterName: "Instantaneous Used Power",
        type: "number"
    },
    [SSeriesParameterIds.SYSTEM_POWER_CONSUMPTION]: {
        capabilityName: "measure_power.system",
        parameterName: "System Power Consumption",
        type: "number"
    },
    [SSeriesParameterIds.OPERATION_PRIORITY]: {
        capabilityName: "status_operation_priority",
        parameterName: "Operation Priority",
        type: "enum"
    },
    [SSeriesParameterIds.ELECTRIC_ADDITION_STATUS]: {
        capabilityName: "status_electric_addition",
        parameterName: "Internal Electric Addition Heat Status",
        type: "enum"
    },
    [SSeriesParameterIds.INTERNAL_ADD_HEAT_POWER]: {
        capabilityName: "measure_power.internal_addition",
        parameterName: "Power Internal Additional Heat",
        type: "number"
    },
    [SSeriesParameterIds.HOT_WATER_BOOST]: {
        capabilityName: "state_button.hot_water_boost",
        parameterName: "More Hot Water",
        type: "boolean"
    },
    [SSeriesParameterIds.ROOM_TEMP_SETPOINT]: {
        capabilityName: "target_temperature.room",
        parameterName: "Room Temperature Setpoint",
        type: "number"
    },
    [SSeriesParameterIds.LIFETIME_ENERGY_CONSUMED]: {
        capabilityName: "meter_power.lifetime_energy_consumed",
        parameterName: "Lifetime Energy Consumed",
        type: "number"
    },
    [SSeriesParameterIds.QUICK_WATER_HEATING]: {
        capabilityName: "state_button.quick_water_heating",
        parameterName: "Quick Water Heating",
        type: "boolean"
    }
};

export default sSeriesParameterMap;