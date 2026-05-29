'use strict';

import { OAuth2Driver } from 'homey-oauth2app';

class F1155Driver extends OAuth2Driver {
    async onOAuth2Init() {}

    async onPairListDevices({ oAuth2Client }) {
        const systems = await oAuth2Client.getSystems();

        return systems.systems.flatMap(system =>
            system.devices
                .filter(device => device.product.name.toUpperCase().includes('F1155'))
                .map(device => ({
                    name: device.product.name,
                    data: {
                        id: device.id,
                    },
                    store: {
                        systemId: system.systemId,
                        firmwareVersion: device.currentFwVersion,
                        serialNumber: device.product.serialNumber,
                    },
                }))
        );
    }
}

export default F1155Driver;
