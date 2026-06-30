'use strict';

import {OAuth2Driver} from "homey-oauth2app";

class SSerierDriver extends OAuth2Driver {
  async onOAuth2Init() {}

  /**
   * Called during pairing to list devices available to pair.
   * @param {object} param0 - An object containing pairing options.
   * @param {import("./MyUplinkOAuth2Client")} param0.oAuth2Client - The OAuth2 client instance.
   * @returns {Promise<Array>} An array of device objects to be paired.
   */
  async onPairListDevices({oAuth2Client}) {
    const systems = await oAuth2Client.getSystems();

    // Per pump we offer three pairing options (opt-in energy split): the normal single device, plus
    // a Heating and a Hot water consumer device. Pick the single OR the two role devices — the role
    // pair splits the pump's energy by operating priority so Homey Energy can cost the two
    // categories separately. (Spike: a pair-view toggle is the eventual UX; selection is simpler.)
    return systems.systems.flatMap(system =>
        system.devices.flatMap(device => {
          const store = { systemId: system.systemId };
          return [
            { name: device.product.name, data: { id: device.id }, store },
            { name: `${device.product.name} — Heating`, data: { id: device.id, role: 'heating' }, store },
            { name: `${device.product.name} — Hot water`, data: { id: device.id, role: 'hotwater' }, store },
          ];
        })
    );
  }
}

export default SSerierDriver;