'use strict';

import {OAuth2Driver} from "homey-oauth2app";

// Localized suffixes for the two energy-split role devices, keyed by Homey.i18n language code.
const ROLE_SUFFIX = {
  heating: { en: 'Heating', sv: 'Värme', da: 'Varme', no: 'Varme', nl: 'Verwarming' },
  hotwater: { en: 'Hot water', sv: 'Varmvatten', da: 'Varmt vand', no: 'Varmtvann', nl: 'Warm water' },
};

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
    const lang = this.homey.i18n.getLanguage();
    const suffix = (role) => ROLE_SUFFIX[role][lang] || ROLE_SUFFIX[role].en;

    // Per pump we offer three pairing options (opt-in energy split): the normal single device, plus
    // a Heating and a Hot water consumer device. Pick the single OR the two role devices — the role
    // pair splits the pump's energy by operating priority so Homey Energy can cost the two
    // categories separately.
    //
    // A custom pair-view toggle was tried instead of this 3-entry list (checkbox before the device
    // list, gating which entries onPairListDevices returns) but the pairing view rendered blank and
    // the choice never reached this method even after interacting with it — reverted rather than
    // debug an undocumented platform UI blind. This selection-based approach is what was actually
    // validated end-to-end on real hardware.
    return systems.systems.flatMap(system =>
        system.devices.flatMap(device => {
          const store = { systemId: system.systemId };
          return [
            { name: device.product.name, data: { id: device.id }, store },
            { name: `${device.product.name} — ${suffix('heating')}`, data: { id: device.id, role: 'heating' }, store },
            { name: `${device.product.name} — ${suffix('hotwater')}`, data: { id: device.id, role: 'hotwater' }, store },
          ];
        })
    );
  }
}

export default SSerierDriver;