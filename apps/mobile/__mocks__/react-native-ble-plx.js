/* global module, require */
/* eslint-disable @typescript-eslint/no-require-imports */
// Manual mock for react-native-ble-plx 3.x — auto-loaded by Jest because
// it sits in __mocks__ adjacent to node_modules. Re-exports the in-memory
// mock from tools/ble-mock so the implementation lives in one place and
// is reusable from integration tests via tools/ble-mock helpers.
//
// Why a re-export and not the impl here: tools/ble-mock is the
// canonical "in-memory mock implementing the same interface" called for
// in plans/sprint-05-watch-pairing.md. Keeping both files in sync would
// drift; the __mocks__ thin shim avoids that.

module.exports = require('../../../tools/ble-mock');
