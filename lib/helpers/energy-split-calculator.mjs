'use strict';

/**
 * Splits a single S-series heat pump's energy between heating and hot water so Homey Energy can
 * cost the two categories separately.
 *
 * The pump exposes only ONE live power reading (22130) and ONE real cumulative meter (28393, kWh) —
 * no per-category breakdown. This calculator attributes that single stream to a role by the pump's
 * operating priority (14950): priority 3 = hot water, everything else (heating, pre-heating and —
 * crucially — Off/standby base load) = heating. The two roles are complements, so their shares
 * always sum to 1 and nothing is dropped.
 *
 * One calculator instance per role-device. Ported from the proven implementation in
 * com.nibe.eu.myuplink (drivers/heatpump/device.js: _pollPower + _accumulateMeter).
 */

const POWER_POINT = 22130;       // Instantaneous used power (W)
const PRIORITY_POINT = 14950;    // Operating priority (0=Off,1=Heating,2=Cooling,3=Hot water,...)
const LIFETIME_POINT = 28393;    // Tot. consumption (kWh) — the real cumulative meter / anchor

// Only priority 3 is hot water; the complement (incl. idle/standby) counts as heating.
const HOTWATER_PRIORITIES = new Set([3]);

// A real 5-min meter increment can't exceed a fraction of a kWh; a larger jump means a counter
// reset/rollover or a long restart gap — re-baseline instead of dumping a spike into one category.
const SANE_MAX_DELTA_KWH = 5;
// Guard the power-integration interval (hours) against restart gaps polluting the attribution ratio.
const MAX_INTEGRATION_HOURS = 0.5;

export class EnergySplitCalculator {
    /**
     * @param {object} device - the Homey device (provides oAuth2Client, store, capabilities, log)
     * @param {object} opts
     * @param {boolean} opts.isHotWater - true for the hot-water role, false for heating
     */
    constructor(device, { isHotWater }) {
        this.device = device;
        this.isHotWater = isHotWater;
        // Power integrated (Wh) over the current meter window: total across the pump, and the part
        // spent serving this device's category — their ratio splits the real meter delta.
        this._catWh = 0;
        this._totWh = 0;
        this._lastPriority = null;
        this._lastFastTs = Date.now();
        const stored = device.getStoreValue('meterKwh');
        this._meterKwh = typeof stored === 'number' ? stored : 0;
    }

    /** Does the given priority count as this device's category? */
    _matches(priority) {
        const isHot = HOTWATER_PRIORITIES.has(priority);
        return this.isHotWater ? isHot : !isHot;
    }

    /** Restore meter_power from the store so it stays monotonic across restarts. */
    async restore() {
        const dev = this.device;
        if (dev.hasCapability('meter_power')) {
            await dev.setCapabilityValue('meter_power', this._meterKwh).catch(() => {});
        }
    }

    /** Numeric value of a returned point, or null. */
    static _val(point) {
        if (!point || point.value === undefined || point.value === null) return null;
        const n = Number(point.value);
        return Number.isFinite(n) ? n : null;
    }

    /**
     * Fast poll (run every minute): set live measure_power to the pump's power when it's serving
     * this category (else 0), integrate power over elapsed time into the window accumulators that
     * weight the meter split, and grow meter_power smoothly by the category's energy this interval
     * (the coarse 28393 meter only steps in whole kWh, so this gives sub-kWh resolution).
     */
    async fastPoll() {
        const dev = this.device;
        try {
            const points = await dev.oAuth2Client.getDataPoints(dev.deviceId, [POWER_POINT, PRIORITY_POINT]);
            const byId = {};
            for (const p of points) byId[Number(p.parameterId)] = p;

            const now = Date.now();
            const dtH = (now - this._lastFastTs) / 3600000;
            this._lastFastTs = now;

            const power = EnergySplitCalculator._val(byId[POWER_POINT]);
            if (power === null) return;
            const priorityVal = EnergySplitCalculator._val(byId[PRIORITY_POINT]);
            const priority = priorityVal === null ? null : Math.trunc(priorityVal);
            this._lastPriority = priority;

            const inCategory = this._matches(priority);
            if (dtH > 0 && dtH < MAX_INTEGRATION_HOURS) {
                this._totWh += power * dtH;
                if (inCategory) {
                    this._catWh += power * dtH;
                    this._meterKwh += (power * dtH) / 1000;
                    await dev.setStoreValue('meterKwh', this._meterKwh);
                    if (dev.hasCapability('meter_power')) await dev.setCapabilityValue('meter_power', this._meterKwh);
                }
            }

            const live = inCategory ? power : 0.0;
            if (dev.hasCapability('measure_power')) await dev.setCapabilityValue('measure_power', live);
            dev.log(`[split] power=${power}W priority=${priority} inCat=${inCategory} -> ${live}W meter=${this._meterKwh.toFixed(3)}kWh`);
        } catch (error) {
            // Don't flip availability on a transient power-poll error — the main poll owns that.
            dev.error(`[split] fast poll failed: ${error.message}`);
        }
    }

    /**
     * Anchor meter_power to the real cumulative meter (28393). Attributes the meter's increase since
     * the last anchor to this device's category by the power-weighted share, and pulls the smooth
     * meter UP to that accurate total if integration lagged (e.g. electric add-heat that shows in
     * 28393 but not in 22130). Never decreases — stays monotonic and reconciled with the billed
     * total. Reads the lifetime value his 5-min poll already cached, falling back to a direct fetch.
     */
    async anchor() {
        const dev = this.device;
        try {
            let total = dev._internalValues?.get('meter_power.lifetime_energy_consumed');
            if (typeof total !== 'number') {
                const points = await dev.oAuth2Client.getDataPoints(dev.deviceId, [LIFETIME_POINT]);
                total = EnergySplitCalculator._val(points.find(p => Number(p.parameterId) === LIFETIME_POINT));
            }
            if (typeof total !== 'number') return;

            const last = dev.getStoreValue('lastTotal');
            let trueKwh = dev.getStoreValue('trueKwh');
            if (typeof trueKwh !== 'number') trueKwh = this._meterKwh; // seed from the smooth meter

            if (typeof last === 'number') {
                const delta = total - last;
                if (delta > 0 && delta < SANE_MAX_DELTA_KWH) {
                    const share = this._totWh > 0
                        ? this._catWh / this._totWh
                        : (this._matches(this._lastPriority) ? 1 : 0);
                    trueKwh += delta * share;
                    await dev.setStoreValue('trueKwh', trueKwh);
                    if (trueKwh > this._meterKwh) {
                        this._meterKwh = trueKwh;
                        await dev.setStoreValue('meterKwh', this._meterKwh);
                        if (dev.hasCapability('meter_power')) await dev.setCapabilityValue('meter_power', this._meterKwh);
                    }
                    dev.log(`[split] anchor Δ=${delta.toFixed(3)}kWh share=${share.toFixed(3)} true=${trueKwh.toFixed(3)} meter=${this._meterKwh.toFixed(3)}kWh`);
                } else if (delta !== 0) {
                    dev.log(`[split] ignoring meter delta ${delta} (reset/rollover/gap), re-baselining`);
                }
            }

            await dev.setStoreValue('lastTotal', total);
            // Reset the window so the next anchor is split by fresh power integration.
            this._catWh = 0;
            this._totWh = 0;
        } catch (error) {
            dev.error(`[split] anchor failed: ${error.message}`);
        }
    }
}

export default EnergySplitCalculator;
