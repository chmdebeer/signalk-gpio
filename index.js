// https://github.com/Mikhus/canvas-gauges/tree/master/examples
// http://arild.github.io/fagdag_nov2012/#/8
// https://github.com/nicolas-van/steelseries
// https://github.com/HanSolo/SteelSeries-Canvas
// https://github.com/sbender9/signalk-n2k-switching
// https://github.com/preeve9534/signalk-switchbank

const Gpio = require('onoff').Gpio;

module.exports = function(app) {
  var plugin = {};
  var unsubscribes = [];
  var options;
  var relays = {};

  plugin.id = "signalk-gpio";
  plugin.name = "SignalK GPIO interface";
  plugin.description = "Plugin that turns a switch on or off based on SignalK values";

  plugin.start = function(theOptions) {
    app.debug('Plugin started');

    options = theOptions;

    options.relays.forEach((relay) => {
      if (relay.enabled && relay.path && relay.gpio ) {
        relays[relay.path] = {
          gpio: new Gpio(relay.gpio, 'out'),
          inverse: relay.inverse,
          lastValue: undefined
        }
        if (relays[relay.path].inverse) {
          relays[relay.path].gpio.writeSync(1);
        } else {
          relays[relay.path].gpio.writeSync(0);
        }
      }
    })

    let localSubscription = {
      context: 'vessels.self', // Get data for all contexts
      subscribe: [{
        path: 'electrical.switches.bank.*', // Get all paths
        "policy": "instant",
        "minPeriod": 200
      }]
    };

    app.subscriptionmanager.subscribe(
      localSubscription,
      unsubscribes,
      subscriptionError => {
        app.error('Error:' + subscriptionError);
      },
      delta => {
        delta.updates.forEach(update => {
          update.values.forEach(value => {
            app.debug(value.path + " = " + value.value);
            if (relays[value.path]) {
              if ((relays[value.path].lastValue == undefined) || (relays[value.path].lastValue != value.value)) {
                app.debug('Value changed');
                app.debug(value);
                relays[value.path].lastValue = value.value;
                if (relays[value.path].inverse) {
                  relays[value.path].gpio.writeSync(value.value ^ 1);
                } else {
                  relays[value.path].gpio.writeSync(value.value);
                }
              }
            }
          });
        });
      }
    );

  }

  plugin.stop = function() {
    app.debug("stopping...")
    unsubscribes.forEach(f => f());
    unsubscribes = [];
  };

  plugin.schema = function() {
    // var paths = JSON.parse(JSON.stringify(app.streambundle.getAvailablePaths())).sort()
    var res = {
      type: 'object',
      properties: {
        relays: {
          type: 'array',
          title: 'Relays',
          items: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                title: 'Description',
                default: 'Relay'
                // enum: paths
              },
              enabled: {
                type: 'boolean',
                title: 'Enabled',
                default: true
              },
              inverse: {
                type: 'boolean',
                title: 'Inverse',
                default: false
              },
              path: {
                type: 'string',
                title: 'Path',
                default: 'electrical.switches.bank.1.0.state'
                // enum: paths
              },
              gpio: {
                type: "number",
                title: "GPIO No",
                enum: [4, 5, 6, 12, 13, 17, 18, 22, 23, 24, 25, 26, 27]
              }
            }
          }
        }
      }
    }
    return res
  }

  return plugin;
}
