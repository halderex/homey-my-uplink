/**
 * Parameter IDs for NIBE S-Series heat pump systems.
 *
 * @module models/sseries-parameter-enum
 */

/**
 * Parameter IDs for various sensors and controls in S-Series heat pumps
 * @readonly
 * @enum {number}
 */
const SSeriesParameterIds = {
    // Temperature readings
    OUTDOOR_TEMP: 4,
    AVERAGE_OUTDOOR_TEMP: 54,
    SUPPLY_LINE_TEMP: 8,
    RETURN_TEMP: 10,
    HOT_WATER_TOP: 11,
    HOT_WATER_CHARGING: 12,
    HOT_WATER_AMOUNT: 29972,       // Hot water amount remaining (minutes)
    ADD_HEAT_TIME_HOT_WATER: 1865, // Op. time el. add. heat for hot water (h)
    BRINE_IN: 13,
    BRINE_OUT: 14,
    SUPPLY_LINE: 15,
    DISCHARGE_TEMP: 16,
    LIQUID_LINE: 17,
    SUCTION_GAS: 19,

    // Operational status
    DEGREE_MINUTES: 781,           // Degree minutes
    FLOW_SENSOR: 58,               // Flow sensor (BF1)
    COMPRESSOR_STARTS: 1959,       // Compressor starter
    TOTAL_COMPRESSOR_RUNTIME: 1961, // Total run time compressor
    COMPRESSOR_HOT_WATER_RUNTIME: 1963, // Total run time compressor hot water
    COMPRESSOR_STATUS: 1965,       // Operating mode compressor

    // Pump speeds
    HEATING_MEDIUM_PUMP_SPEED: 1975, // Heating medium pump speed (GP1)
    BRINE_PUMP_SPEED: 1977,        // Brine pump speed (GP2)

    // Current measurements
    CURRENT_1: 64,                 // Current (BE3)
    CURRENT_2: 65,                 // Current (BE2)
    CURRENT_3: 66,                 // Current (BE1)

    // Compressor and frequency
    CURRENT_COMPRESSOR_FREQ: 5927, // Current compressor frequency

    // Power and energy
    INSTANTANEOUS_POWER: 22130,    // Instantaneous used power
    SYSTEM_POWER_CONSUMPTION: 27335, // System power consumption (kW)
    POWER_DEMAND_AT_DOT: 6978,     // Power demand at DOT

    // Energy measurements
    HEATING_PRODUCED_ENERGY: 25133,    // Produced energy - Heating
    HOT_WATER_PRODUCED_ENERGY: 25134,  // Produced energy - Hot water
    LIFETIME_HEATING_USED_ENERGY: 25137,        // Used energy - Heating
    LIFETIME_HOT_WATER_USED_ENERGY: 25138,      // Used energy - Hot water
    LIFETIME_ENERGY_CONSUMED: 28393,
    // Heat meter
    HEATING_ENERGY_COMPRESSOR: 27378,  // Heating, compressor only
    HOT_WATER_ENERGY_COMPRESSOR: 27379, // Hot water, compressor only

    // System settings and status
    HEATING_OFFSET: 3671,          // Heating offset climate system 1
    OPERATION_PRIORITY: 55000,     // Priority
    ELECTRIC_ADDITION_STATUS: 55027, // Int elec add heat
    
    // Room temperature and settings
    ROOM_TEMP_SETPOINT: 47751,     // Room sensor setpoint
    ROOM_TEMP: 48351,              // Room temperature

    // Additional features
    HOT_WATER_BOOST: 7086,         // More hot water
    QUICK_WATER_HEATING: 27233,    // Quick water heating (On/Off)
    CURRENT_SMART_PRICE_ADAPTATION: 4789 // Activated (Smart Price Adaption)
};

export default SSeriesParameterIds;