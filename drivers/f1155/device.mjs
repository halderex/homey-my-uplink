'use strict';

import { OAuth2Device } from 'homey-oauth2app';
import F1155Parameters from './parameters.mjs';
import { RequestQueueHelper } from '../../lib/helpers/request-queue.mjs';

class F1155Device extends OAuth2Device {

    async onOAuth2Init() {
        try {
            
            this.deviceId = this.getData().id;
            this.pollInterval = await this.getSetting('fetchIntervall') || 5;

            this.log(`F1155 device initialized: ${this.getName()} (${this.deviceId})`);
            this.log(`Poll interval: ${this.pollInterval} min`);

            this.requestQueue = new RequestQueueHelper(this);
            this.buildParams(await this.getSettings());

            const store = this.getStore();
            if (store.firmwareVersion || store.serialNumber) {
                await this.setSettings({
                    firmware: store.firmwareVersion || '',
                    serialNumber: store.serialNumber || '',
                });
            }

            await this.fetchAndApplyData();
            await this.registerCapabilityListeners();
            this.startPolling();
        } catch (error) {
            this.error('Failed to initialize F1155 device:', error.message);
        }
    }

    // Builds this.params — the resolved parameter IDs used everywhere in this device.
    // Starts from the defaults in parameters.mjs and applies any non-zero overrides from settings.
    buildParams(settings) {
        const resolveParam = (settingKey, defaultId) => Number(settings[settingKey]) || defaultId;
        this.params = {
            ...F1155Parameters,
            OUTDOOR_TEMP:           resolveParam('override_outdoor_temp',       F1155Parameters.OUTDOOR_TEMP),
            SUPPLY_LINE:            resolveParam('override_supply_line',         F1155Parameters.SUPPLY_LINE),
            RETURN_LINE:            resolveParam('override_return_line',         F1155Parameters.RETURN_LINE),
            HOT_WATER_TOP:          resolveParam('override_hot_water_top',       F1155Parameters.HOT_WATER_TOP),
            HOT_WATER_CHARGING:     resolveParam('override_hot_water_charging',  F1155Parameters.HOT_WATER_CHARGING),
            ROOM_TEMP:              resolveParam('override_room_temp',           F1155Parameters.ROOM_TEMP),
            BRINE_IN:               resolveParam('override_brine_in',            F1155Parameters.BRINE_IN),
            BRINE_OUT:              resolveParam('override_brine_out',           F1155Parameters.BRINE_OUT),
            DEGREE_MINUTES:             resolveParam('override_degree_minutes',          F1155Parameters.DEGREE_MINUTES),
            COMPRESSOR_FREQUENCY:       resolveParam('override_compressor_freq',          F1155Parameters.COMPRESSOR_FREQUENCY),
            TARGET_ROOM_TEMP:           resolveParam('override_target_room_temp',         F1155Parameters.TARGET_ROOM_TEMP),
            CONDENSER:                  resolveParam('override_condenser',               F1155Parameters.CONDENSER),
            SUCTION_GAS:                resolveParam('override_suction_gas',             F1155Parameters.SUCTION_GAS),
            CALCULATED_SUPPLY_LINE:     resolveParam('override_calculated_supply_line',  F1155Parameters.CALCULATED_SUPPLY_LINE),
            CURRENT_BE1:                resolveParam('override_current_be1',             F1155Parameters.CURRENT_BE1),
            CURRENT_BE2:                resolveParam('override_current_be2',             F1155Parameters.CURRENT_BE2),
            CURRENT_BE3:                resolveParam('override_current_be3',             F1155Parameters.CURRENT_BE3),
            COMPRESSOR_STATUS:          resolveParam('override_compressor_status',        F1155Parameters.COMPRESSOR_STATUS),
            COMPRESSOR_STARTS:          resolveParam('override_compressor_starts',        F1155Parameters.COMPRESSOR_STARTS),
            HEATING_MEDIUM_PUMP_SPEED:  resolveParam('override_heating_medium_pump',     F1155Parameters.HEATING_MEDIUM_PUMP_SPEED),
            BRINE_PUMP_SPEED:           resolveParam('override_brine_pump_speed',         F1155Parameters.BRINE_PUMP_SPEED),
            EXT_ENERGY_METER:           resolveParam('override_ext_energy_meter',         F1155Parameters.EXT_ENERGY_METER),
            TEMPORARY_LUX:              resolveParam('override_temporary_lux',            F1155Parameters.TEMPORARY_LUX),
        };
    }

    startPolling() {
        this.pollTimer = this.homey.setInterval(async () => {
            try {
                await this.fetchAndApplyData();
            } catch (error) {
                this.error('Poll cycle failed:', error.message);
            }
        }, 1000 * 60 * this.pollInterval);
    }

    async fetchAndApplyData() {
        this.log('Fetching data points...');

        const pollParameters = [
            this.params.OUTDOOR_TEMP,
            this.params.SUPPLY_LINE,
            this.params.RETURN_LINE,
            this.params.HOT_WATER_TOP,
            this.params.HOT_WATER_CHARGING,
            this.params.BRINE_IN,
            this.params.BRINE_OUT,
            this.params.CONDENSER,
            this.params.SUCTION_GAS,
            this.params.ROOM_TEMP,
            this.params.CALCULATED_SUPPLY_LINE,
            this.params.CURRENT_BE1,
            this.params.CURRENT_BE2,
            this.params.CURRENT_BE3,
            this.params.COMPRESSOR_FREQUENCY,
            this.params.COMPRESSOR_STATUS,
            this.params.COMPRESSOR_STARTS,
            this.params.HEATING_MEDIUM_PUMP_SPEED,
            this.params.BRINE_PUMP_SPEED,
            this.params.DEGREE_MINUTES,
            this.params.TARGET_ROOM_TEMP,
            this.params.TEMPORARY_LUX,
            this.params.EXT_ENERGY_METER,
            this.params.EXHAUST_AIR_TEMP,
            this.params.EXTRACT_AIR_TEMP,
            this.params.EXHAUST_FAN_SPEED,
        ];

        const points = await this.oAuth2Client.getDataPoints(this.deviceId, pollParameters);

        const data = {};
        for (const point of points) {
            data[point.parameterId] = point;
        }

        await this.measureTemperatureOutdoor(data);
        await this.measureTemperatureSupplyLine(data);
        await this.measureTemperatureReturnLine(data);
        await this.measureTemperatureHotWaterTop(data);
        await this.measureTemperatureHotWaterCharging(data);
        await this.measureTemperatureBrineIn(data);
        await this.measureTemperatureBrineOut(data);
        await this.measureTemperatureCondenser(data);
        await this.measureTemperatureSuctionGas(data);
        await this.measureTemperatureRoom(data);
        await this.measureTemperatureCalculatedSupplyLine(data);
        await this.measureCurrentOne(data);
        await this.measureCurrentTwo(data);
        await this.measureCurrentThree(data);
        await this.measureFrequencyCompressor(data);
        await this.statusCompressor(data);
        await this.measureCompressorStarts(data);
        await this.measurePumpSpeedHeatingMedium(data);
        await this.measurePumpSpeedBrine(data);
        await this.measureDegreeMinutes(data);
        await this.targetTemperatureRoom(data);
        await this.stateButtonTempLux(data);
        await this.meterPower(data);
        await this.measureTemperatureExhaustAir(data);
        await this.measureTemperatureExtractAir(data);
        await this.measureFanSpeedExhaustAir(data);
    }

    async measureTemperatureOutdoor(data) {
        const point = data[String(this.params.OUTDOOR_TEMP)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_temperature.outdoor', value);
    }

    async measureTemperatureSupplyLine(data) {
        const point = data[String(this.params.SUPPLY_LINE)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_temperature.supply_line', value);
    }

    async measureTemperatureReturnLine(data) {
        const point = data[String(this.params.RETURN_LINE)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_temperature.return_line', value);
    }

    async measureTemperatureHotWaterTop(data) {
        const point = data[String(this.params.HOT_WATER_TOP)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_temperature.hot_water_top', value);
    }

    async measureTemperatureHotWaterCharging(data) {
        const point = data[String(this.params.HOT_WATER_CHARGING)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_temperature.hot_water_charging', value);
    }

    async measureTemperatureBrineIn(data) {
        const point = data[String(this.params.BRINE_IN)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_temperature.brine_in', value);
    }

    async measureTemperatureBrineOut(data) {
        const point = data[String(this.params.BRINE_OUT)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_temperature.brine_out', value);
    }

    async measureTemperatureCondenser(data) {
        const point = data[String(this.params.CONDENSER)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_temperature.condenser', value);
    }

    async measureTemperatureSuctionGas(data) {
        const point = data[String(this.params.SUCTION_GAS)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_temperature.suction_gas', value);
    }

    async measureTemperatureRoom(data) {
        const point = data[String(this.params.ROOM_TEMP)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_temperature.room', value);
    }

    async measureTemperatureCalculatedSupplyLine(data) {
        const point = data[String(this.params.CALCULATED_SUPPLY_LINE)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_temperature.calculated_supply_line', value);
    }

    async measureCurrentOne(data) {
        const point = data[String(this.params.CURRENT_BE1)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_current.one', value);
    }

    async measureCurrentTwo(data) {
        const point = data[String(this.params.CURRENT_BE2)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_current.two', value);
    }

    async measureCurrentThree(data) {
        const point = data[String(this.params.CURRENT_BE3)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_current.three', value);
    }

    async measureFrequencyCompressor(data) {
        const point = data[String(this.params.COMPRESSOR_FREQUENCY)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_frequency.compressor', value);
    }

    async statusCompressor(data) {
        const point = data[String(this.params.COMPRESSOR_STATUS)];
        if (!point) return;

        const numericValue = Math.round(Number(point.value));
        const match = point.enumValues.find(e => Number(e.value) === numericValue);
        const statusText = match ? match.text : String(point.value);

        const previous = this.getCapabilityValue('status_compressor');
        await this.setCapabilityValue('status_compressor', statusText);

        if (previous !== statusText) {
            this.log(`Compressor status changed: ${previous} → ${statusText}`);
            const triggerCard = this.homey.flow.getTriggerCard('compressor-status-changed');
            await triggerCard.trigger(this, { compressor_status: statusText }).catch(err => {
                this.error('Failed to trigger compressor-status-changed:', err.message);
            });
        }
    }

    async measurePumpSpeedHeatingMedium(data) {
        const point = data[String(this.params.HEATING_MEDIUM_PUMP_SPEED)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_pump_speed.heating_medium', value);
    }

    async measurePumpSpeedBrine(data) {
        const point = data[String(this.params.BRINE_PUMP_SPEED)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_pump_speed.brine', value);
    }

    async measureDegreeMinutes(data) {
        const point = data[String(this.params.DEGREE_MINUTES)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_degree_minutes', value);
    }

    async targetTemperatureRoom(data) {
        const point = data[String(this.params.TARGET_ROOM_TEMP)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('target_temperature.room', value);
    }

    async stateButtonTempLux(data) {
        const point = data[String(this.params.TEMPORARY_LUX)];
        if (!point) return;
        await this.setCapabilityValue('state_button.temp_lux', Boolean(point.value));
    }

    async meterPower(data) {
        const point = data[String(this.params.EXT_ENERGY_METER)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('meter_power', value);
    }

    async measureCompressorStarts(data) {
        const point = data[String(this.params.COMPRESSOR_STARTS)];
        if (!point) return;
        const value = Number(point.value);
        if (!isFiniteNumber(value)) return;
        await this.setCapabilityValue('measure_compressor_starts', value);
    }

    async measureTemperatureExhaustAir(data) {
        const point = data[String(this.params.EXHAUST_AIR_TEMP)];
        if (point) {
            const value = Number(point.value);
            if (!isFiniteNumber(value)) return;
            if (!this.hasCapability('measure_temperature.exhaust_air')) await this.addCapability('measure_temperature.exhaust_air');
            await this.setCapabilityValue('measure_temperature.exhaust_air', value);
        } else if (this.hasCapability('measure_temperature.exhaust_air')) {
            await this.removeCapability('measure_temperature.exhaust_air');
        }
    }

    async measureTemperatureExtractAir(data) {
        const point = data[String(this.params.EXTRACT_AIR_TEMP)];
        if (point) {
            const value = Number(point.value);
            if (!isFiniteNumber(value)) return;
            if (!this.hasCapability('measure_temperature.extract_air')) await this.addCapability('measure_temperature.extract_air');
            await this.setCapabilityValue('measure_temperature.extract_air', value);
        } else if (this.hasCapability('measure_temperature.extract_air')) {
            await this.removeCapability('measure_temperature.extract_air');
        }
    }

    async measureFanSpeedExhaustAir(data) {
        const point = data[String(this.params.EXHAUST_FAN_SPEED)];
        if (point) {
            const value = Number(point.value);
            if (!isFiniteNumber(value)) return;
            if (!this.hasCapability('measure_fan_speed.exhaust_air')) await this.addCapability('measure_fan_speed.exhaust_air');
            await this.setCapabilityValue('measure_fan_speed.exhaust_air', value);
        } else if (this.hasCapability('measure_fan_speed.exhaust_air')) {
            await this.removeCapability('measure_fan_speed.exhaust_air');
        }
    }

    async registerCapabilityListeners() {
        this.registerCapabilityListener('target_temperature.room', async (value) => {
            this.log(`Setting target room temperature to ${value}°C`);
            await this.requestQueue.queueParameterUpdate(
                this.params.TARGET_ROOM_TEMP,
                Number(value)
            );
        });

        this.registerCapabilityListener('state_button.temp_lux', async (value) => {
            this.log(`Setting temporary lux to ${value}`);
            await this.requestQueue.queueParameterUpdate(
                this.params.TEMPORARY_LUX,
                value ? 1 : 0
            );
        });
    }

    async onSettings({ newSettings, changedKeys }) {
        this.buildParams(newSettings);
        if (changedKeys.includes('heating_curve')) {
            this.log(`Updating heating curve to ${newSettings.heating_curve}`);
            await this.requestQueue.queueParameterUpdate(
                this.params.HEATING_CURVE,
                Number(newSettings.heating_curve)
            );
        }

        if (changedKeys.includes('heating_offset')) {
            this.log(`Updating heating offset to ${newSettings.heating_offset}`);
            await this.requestQueue.queueParameterUpdate(
                this.params.HEATING_OFFSET,
                Number(newSettings.heating_offset)
            );
        }

        if (changedKeys.includes('fetchIntervall')) {
            this.pollInterval = Number(newSettings.fetchIntervall);
            this.log(`Poll interval updated to ${this.pollInterval} min — restarting polling`);
            if (this.pollTimer) this.homey.clearInterval(this.pollTimer);
            this.startPolling();
        }
    }

    async onOAuth2Deleted() {
        if (this.pollTimer) this.homey.clearInterval(this.pollTimer);
        if (this.requestQueue) this.requestQueue.clearQueue();
    }
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

export default F1155Device;
