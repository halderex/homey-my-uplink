// Parameter IDs for the Nibe F1155 heat pump.
// These are the actual parameterId values returned by the myUplink API.

const F1155Parameters = {

    // --- Temperatures ---
    OUTDOOR_TEMP:               40004,  // °C  - Outdoor temperature (BT1)
    SUPPLY_LINE:                40008,  // °C  - Supply line (BT2)
    RETURN_LINE:                40012,  // °C  - Return line (BT3)
    HOT_WATER_TOP:              40013,  // °C  - Hot water top (BT7)
    HOT_WATER_CHARGING:         40014,  // °C  - Hot water charging (BT6)
    BRINE_IN:                   40015,  // °C  - Brine in (BT10)
    BRINE_OUT:                  40016,  // °C  - Brine out (BT11)
    CONDENSER:                  40017,  // °C  - Condenser (BT12)
    DISCHARGE:                  40018,  // °C  - Discharge (BT14)
    LIQUID_LINE:                40019,  // °C  - Liquid line (BT15)
    SUCTION_GAS:                40022,  // °C  - Suction gas (BT17)
    ROOM_TEMP:                  40033,  // °C  - Room temperature (BT50)
    AVERAGE_OUTDOOR_TEMP:       40067,  // °C  - Average outdoor temp (BT1)
    INVERTER_TEMP:              43140,  // °C  - Inverter temperature
    CALCULATED_SUPPLY_LINE:     43009,  // °C  - Calculated supply climate system 1
    HOT_WATER_TEMP:             50325,  // °C  - Hot water temp (combined sensor)

    // --- Electrical ---
    CURRENT_BE3:                40079,  // A   - Current phase 3 (BE3)
    CURRENT_BE2:                40081,  // A   - Current phase 2 (BE2)
    CURRENT_BE1:                40083,  // A   - Current phase 1 (BE1)
    EXT_ENERGY_METER:           40995,  // kWh - External energy meter (BE7) - total consumed energy

    // --- Flow ---
    FLOW_SENSOR:                40072,  // l/m - Flow sensor (BF1)

    // --- Compressor ---
    COMPRESSOR_FREQUENCY:       41778,  // Hz  - Current compressor frequency
    COMPRESSOR_STATUS:          43427,  //     - Status compressor (enum: Off/Starting/Operating/Stopping)
    COMPRESSOR_STARTS:          43416,  //     - Number of compressor starts
    OPERATING_TIME:             43420,  // h   - Operating time total
    OPERATING_TIME_HOT_WATER:   43424,  // h   - Operating time hot water

    // --- Pump speeds ---
    HEATING_MEDIUM_PUMP_SPEED:  43437,  // %   - Heating medium pump speed (GP1)
    BRINE_PUMP_SPEED:           43439,  // %   - Brine pump speed (GP2)

    // --- Energy meters (heat meter) ---
    ENERGY_PASSIVE_COOLING:     40769,  // kWh - Built-in passive cooling energy
    ENERGY_HOT_WATER_TOTAL:     44298,  // kWh - Hot water including internal add. heat
    ENERGY_HEATING_TOTAL:       44300,  // kWh - Heating including internal add. heat
    ENERGY_HOT_WATER_COMPRESSOR:44306,  // kWh - Hot water compressor only
    ENERGY_HEATING_COMPRESSOR:  44308,  // kWh - Heating compressor only

    // --- Additional heat ---
    POWER_INTERNAL_ADD_HEAT:    43084,  // kW  - Power internal add. heat
    TIME_FACTOR_ADD_HEAT:       43081,  //     - Time factor add heat

    // --- Optional: only present on some F-series models ---
    EXHAUST_AIR_TEMP:           40025,  // °C  - Exhaust air temperature
    EXTRACT_AIR_TEMP:           40026,  // °C  - Extract air temperature
    EXHAUST_FAN_SPEED:          50221,  //     - Exhaust air fan speed

    // --- Status ---
    HP_STATUS:                  50095,  //     - Heat pump operating status (full enum: Off/Heating/Hot water/Cooling...)
    DEGREE_MINUTES:             40941,  // DM  - Degree minutes (read-only display value)
    PRIORITY:                   49994,  //     - Priority (enum: Off/Hot water/Heating/Cooling...)
    INT_ELEC_ADD_HEAT_STATUS:   49993,  //     - Internal electric add heat status (enum)
    PUMP_HEATING_MEDIUM_STATUS: 49995,  //     - Pump heating medium GP1 (On/Off)
    PUMP_BRINE_STATUS:          50203,  //     - Pump brine GP2 (On/Off)

    // --- Writable settings ---
    DEGREE_MINUTES_SETPOINT:    40940,  // DM  - Degree minutes setpoint (writable)
    TARGET_ROOM_TEMP:           47398,  // °C  - Room sensor set point heating climate system 1
    HOT_WATER_DEMAND:           47041,  //     - Hot water demand (enum: Economy/Normal/Lux)
    HOT_WATER_BOOST:            48132,  //     - Hot water boost (enum: Off/One-time/3hr/6hr/12hr)
    TEMPORARY_LUX:              50004,  //     - Temporary lux (On/Off)
    OPERATIONAL_MODE:           47137,  //     - Op. mode (enum: auto/manual/add. heat only)
    HEATING_CURVE:              47007,  //     - Heating curve (0-15)
    HEATING_OFFSET:             47011,  //     - Offset climate system 1 (-10 to 10)
};

export default F1155Parameters;
