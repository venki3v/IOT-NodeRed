module.exports = function(RED) {
    var ui = require('../ui')(RED);

    function BaseNode(config) {
        RED.nodes.createNode(this, config);
        this.config = {
            name: config.name || 'COVS-RED Dashboard',
            theme: config.theme || 'theme-covisint'
        };
        ui.addBaseConfig(config.name, config.theme);

    }

    RED.nodes.registerType("ui_base", BaseNode);
};
