module.exports = function(RED) {

    function TabNode(config) {
        RED.nodes.createNode(this, config);
        this.config = {
            clientid: config.clientid,
            order: config.order || 0,
            secret: config.secret || ''
        };
		
    }

    RED.nodes.registerType("covs-clientsecret", TabNode);
};
