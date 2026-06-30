import { OAuth2Client } from 'homey-oauth2app';

/**
 * Service for interacting with the MyUplink API
 */
export class MyUplinkOAuth2Client extends OAuth2Client {
    static API_URL = "https://api.myuplink.com";
    static TOKEN_URL = "https://api.myuplink.com/oauth/token";
    static AUTHORIZATION_URL = "https://api.myuplink.com/oauth/authorize";
    static SCOPES = ["READSYSTEM", "WRITESYSTEM", "offline_access"];
    static REDIRECT_URL = "https://callback.athom.com/oauth2/callback/";
    API_URL = "https://api.myuplink.com";
    
    /**
     * Fetches all systems available to the authenticated user
     * @returns {Promise<object>} Systems data
     */
    async getSystems() {
        return this.get({
            path: '/v2/systems/me',
        });
    }

    /**
     * Retrieves datapoints for specified parameters
     * @param {string} deviceId - The device ID
     * @param {number[]} parameterIds - Array of parameter IDs to fetch
     * @returns {Promise<object[]>} Array of datapoints
     */
    async getDataPoints(deviceId, parameterIds) {
        const params = parameterIds.join(',');
        return this.get({
            path: `${this.API_URL}/v2/devices/${deviceId}/points?parameters=${params}`,
        });
    }

    /**
     * Sets parameter values on the device
     * @param {string} deviceId - The device ID
     * @param {object} parameters - Object mapping parameter IDs to values
     * @returns {Promise<object>} API response
     */
    async setParameterValues(deviceId, parameters) {
        return this.patch({
            path: `/v2/devices/${deviceId}/points`,
            json: parameters
        });
    }

    /**
     * Gets device information
     * @param {string} deviceId - The device ID
     * @returns {Promise<object>} Device information
     */
    async getDeviceInformation(deviceId) {
        return this.get({
            path: `/v2/devices/${deviceId}`,
        });
    }

    /**
     * Gets smart home zones for a device
     * @param {string} deviceId - The device ID
     * @returns {Promise<object[]>} Array of zones
     */
    async getSmartHomeZones(deviceId) {
        return this.get({
            path: `/v2/devices/${deviceId}/smart-home-zones`,
        });
    }

    /**
     * Sets temperature for a specific zone
     * @param {string} deviceId - The device ID
     * @param {string} zoneId - The zone ID
     * @param {number} temperature - The target temperature
     * @returns {Promise<object>} API response
     */
    async setZoneTemperature(deviceId, zoneId, temperature) {
        return this.patch({
            path: `/v2/devices/${deviceId}/zones/${zoneId}`,
            json: {
                setpointHeat: temperature
            }
        });
    }
}

export default MyUplinkOAuth2Client;