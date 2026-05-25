/**
 * Parameter IDs for NIBE heat pump systems.
 * 
 * @module models/parameter-enum
 */

/**
 * Parameter IDs for various sensors and controls
 * @readonly
 * @enum {number}
 */
const FSeriesParameterIds = {
    // Temperature readings
    OUTDOOR_TEMP: 40004,
    HEATING_MEDIUM_SUPPLY: 40008, // For F730, this will read the same as SUPPLY_LINE
    RETURN_LINE_TEMP: 40012,
    HOT_WATER_TOP: 40013,
    HOT_WATER_CHARGING: 40014,
    CONDENSER_TEMP: 40017,
    DISCHARGE_TEMP: 40018,
    LIQUID_LINE_TEMP: 40019,
    EVAPORATOR_TEMP: 40020,
    SUCTION_GAS_TEMP: 40022,
    EXHAUST_AIR_TEMP: 40025,
    EXTRACT_AIR_TEMP: 40026,
    ROOM_TEMP: 40033,
    SUPPLY_LINE: 40047,
    CALCULATED_SUPPLY_LINE: 43009,
    
    // Electrical readings
    CURRENT_1: 40079,
    CURRENT_2: 40081,
    CURRENT_3: 40083,
    ELECTRIC_ADDITION_STATUS: 50113,
    ELECTRICITY_ADDITION: 47370,
    
    // System status
    AVERAGE_OUTDOOR_TEMP: 40067,
    DEGREE_MINUTES: 40940,
    TIME_HEAT_ADDITION: 43081,
    POWER_INTERNAL_ADDITIONAL_HEAT: 43084,
    OPERATING_TIME: 43420,
    TIME_HOT_WATER_ADDITION: 43239,
    
    // Controls and settings
    OPERATION_MODE: 47137,
    OPERATIONAL_MODE: 47570,
    HEATING_CURVE: 47007,
    OFFSET_CLIMATE_SYSTEM_1: 47011,
    HEATING_ADDITION: 47371,
    SET_POINT_TEMP_1: 47398,
    HEATING_FACTOR_SYSTEM: 47402,
    SET_POINT_TEMP_F730: 47015, // Specific to F730 model


    // Fan and ventilation
    HEATING_PUMP_SPEED: 43181,
    BRINE_PUMP_SPEED: 47418,
    EXHAUST_AIR_FAN_SPEED: 50221,
    AIR_VELOCITY_SENSOR: 42782,
    
    // Comfort modes
    TEMPORARY_LUX: 50004,
    INCREASED_VENTILATION: 50005,
    NIGHT_COOLING: 47537,
    
    // Electrical addition
    SET_MAX_ELECTRICAL_ADD: 47212,

    // Compressor info
    COMPRESSOR_STATUS: 50095,
    CURRENT_COMPRESSOR_FREQ: 41778,
    COMPRESSOR_STARTS: 43416,
    
    // Smart features
    SMART_PRICE_MODE: 41929,
};

// Export the ParameterIds directly to match the import in your code
export default FSeriesParameterIds
