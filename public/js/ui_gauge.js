module.exports = function (RED) {
    var ui = require('../ui')(RED);

    function GaugeNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        var group = RED.nodes.getNode(config.group);
        if (!group) { return; }
        var tab = RED.nodes.getNode(group.config.tab);
        if (!tab) { return; }

        if (config.width === "0") { delete config.width; }
        if (config.height === "0") { delete config.height; }
        node.autoheight = parseInt(group.config.width*0.5+1.5) || 4;
        if (config.gtype && config.gtype !== "gage") { node.autoheight = parseInt(group.config.width*0.75+0.5); }

         var gageoptions = {};
        gageoptions.lineWidth = {'theme-dark':0.75,'theme-covisint':0.75};
        gageoptions.pointerOptions = {'theme-dark':{color:'#8e8e93'},'theme-covisint':{color:'#8e8e93'}};
        gageoptions.backgroundColor = {'theme-dark':'#515151','theme-covisint':'white'  };
        gageoptions.levelColors = {'theme-dark':['#00B500', '#E6E600', '#CA3838'],'theme-covisint':['#00B500', '#E6E600', '#CA3838']};
        gageoptions.compassColor = {'theme-dark':'#0b8489', 'theme-light':'#1784be','theme-covisint':'#1784be'};

        var waveoptions = {};
        waveoptions.circleColor = {'theme-dark':'#097479', 'theme-light':'#0094ce','theme-covisint':'#0094ce'};
        waveoptions.waveColor = {'theme-dark':'#097479', 'theme-light':'#0094ce','theme-covisint':'#0094ce'};
        waveoptions.textColor = {'theme-dark':'#0b8489', 'theme-light':'#1784be','theme-covisint':'#1784be'};
        waveoptions.waveTextColor = {'theme-dark':'#0fbbc3', 'theme-light':'#a4dbf8','theme-covisint':'#a4dbf8'};

        var done = ui.add({
            node: node,
            tab: tab,
            group: group,
            control: {
                type: 'gauge',
                name: config.name,
                title: config.title,
                label: config.label,
                order: config.order,
                value: config.min,
                format: config.format,
                gtype: config.gtype || 'gage',
                min: config.min,
                max: config.max,
                width: config.width || group.config.width || 6,
                height: config.height || node.autoheight,
                gageoptions: gageoptions,
                waveoptions: waveoptions
            },
            beforeSend: function (msg) {
                //msg.topic = config.topic;
            },
            convert: ui.toFloat.bind(this, config)
        });
        node.on("close", done);
    }
    RED.nodes.registerType("ui_gauge", GaugeNode);
};
