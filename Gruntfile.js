module.exports = function(grunt) {
    grunt.initConfig({
		exec: {
			bower_install: {
				command: 'bower install',
				stdout: true,
				stderr: false
				
			},
			run_install_devicepubs: {
			  cwd: 'public/node/covs-devicePublisher',
			  command: 'npm install --no-optional',
			  stdout: false,
			  stderr: false
			},
			create_local_link_devicepubs: {
				cwd: 'public/node/covs-devicePublisher',
				command: 'npm link',
				stdout: true,
				stderr: false
			},
			create_sym_link_devicepubs: {
				cwd: 'node_modules',
				command: 'npm link node-red-contrib-covs-devicePublisher',
				stdout: true,
				stderr: false
			},
			run_install_pubs: {
			  cwd: 'public/node/covs-appPublisher',
			  command: 'npm install --no-optional',
			  stdout: false,
			  stderr: false
			},
			create_local_link_pubs: {
				cwd: 'public/node/covs-appPublisher',
				command: 'npm link',
				stdout: true,
				stderr: false
			},
			create_sym_link_pubs: {
				cwd: 'node_modules',
				command: 'npm link node-red-contrib-covs-appPublisher',
				stdout: true,
				stderr: false
			},
			run_install_subsDevice: {
			  cwd: 'public/node/covs-deviceSubscriber',
			  command: 'npm install --no-optional',
			  stdout: false,
			  stderr: false
			},
			create_local_link_subsDevice: {
				cwd: 'public/node/covs-deviceSubscriber',
				command: 'npm link',
				stdout: true,
				stderr: false
			},
			create_sym_link_subsDevice: {
				cwd: 'node_modules',
				command: 'npm link node-red-contrib-covs-deviceSubscriber',
				stdout: true,
				stderr: false
			},
			run_install_subsApp: {
			  cwd: 'public/node/covs-appSubscriber',
			  command: 'npm install --no-optional',
			  stdout: false,
			  stderr: false
			},
			create_local_link_subsApp: {
				cwd: 'public/node/covs-appSubscriber',
				command: 'npm link',
				stdout: true,
				stderr: false
			},
			create_sym_link_subsApp: {
				cwd: 'node_modules',
				command: 'npm link node-red-contrib-covs-appSubscriber',
				stdout: true,
				stderr: false
			},
			
			run_install_oauth: {
			  cwd: 'public/node/covs-oauth',
			  command: 'npm install --no-optional',
			  stdout: false,
			  stderr: false
			},
			create_local_link_oauth: {
				cwd: 'public/node/covs-oauth',
				command: 'npm link',
				stdout: true,
				stderr: false
			},
			create_sym_link_oauth: {
				cwd: 'node_modules',
				command: 'npm link node-red-contrib-covs-oauth',
				stdout: true,
				stderr: false
			},
			run_install_group: {
			  cwd: 'public/node/covs-group',
			  command: 'npm install --no-optional',
			  stdout: false,
			  stderr: false
			},
			create_local_link_group: {
				cwd: 'public/node/covs-group',
				command: 'npm link',
				stdout: true,
				stderr: false
			},
			create_sym_link_group: {
				cwd: 'node_modules',
				command: 'npm link node-red-contrib-covs-group',
				stdout: true,
				stderr: false
			},
			run_install_clientsecret: {
			  cwd: 'public/node/covs-clientsecret',
			  command: 'npm install --no-optional',
			  stdout: false,
			  stderr: false
			},
			create_local_link_clientsecret: {
				cwd: 'public/node/covs-clientsecret',
				command: 'npm link',
				stdout: true,
				stderr: false
			},
			create_sym_link_clientsecret: {
				cwd: 'node_modules',
				command: 'npm link node-red-contrib-covs-clientsecret',
				stdout: true,
				stderr: false
			}
		},
        copy: {
            main: {
                files: [{
					expand: true,
                    cwd: 'public/js/',
                    src: ['theme.js'],
                    dest: 'node_modules/node-red/red/api/'	
				},
				{
					expand: true,
                    cwd: 'public/js/',
                    src: ['ui.js'],
                    dest: 'node_modules/node-red-dashboard/'	
				},
				{
					expand: true,
                    cwd: 'src/views/node-red-dashboard/',
                    src: ['ui_base.html'],
                    dest: 'node_modules/node-red-dashboard/nodes/'	
				},
				{
					expand: true,
                    cwd: 'public/js/',
                    src: ['ui_base.js'],
                    dest: 'node_modules/node-red-dashboard/nodes/'	
				},
				{
					expand: true,
                    cwd: 'public/js/',
                    src: ['ui_gauge.js'],
                    dest: 'node_modules/node-red-dashboard/nodes/'	
				},
				{
					expand: true,
                    cwd: 'src/views/node-red-dashboard/',
                    src: ['index.html'],
                    dest: 'node_modules/node-red-dashboard/dist/'	
				},
				{
					expand: true,
                    cwd: 'public/css/',
                    src: ['app.min.css'],
                    dest: 'node_modules/node-red-dashboard/dist/css/'	
				},
				{
					expand: true,
                    cwd: 'public/',
                    src: ['/images'],
                    dest: 'node_modules/node-red-dashboard/dist/'
				},
				{
                    expand: true,
                    cwd: 'public/images/',
                    src: ['logomark.ico'],
                    dest: 'node_modules/node-red-dashboard/dist/images/'
                },
				{
                    expand: true,
                    cwd: 'public/images/',
                    src: ['logomark.ico'],
                    dest: 'node_modules/node-red/public/red/images/'
                },
				{
                    expand: true,
                    cwd: 'public/images/',
                    src: ['logomark.ico'],
                    dest: 'node_modules/node-red-contrib-web-worldmap/worldmap/images'
                },
				{
                    expand: true,
                    cwd: 'src/views/node-red-contrib-web-worldmap/',
                    src: ['index.html'],
                    dest: 'node_modules/node-red-contrib-web-worldmap/worldmap/'
                },
				{
                    expand: true,
                    cwd: 'public/images/',
                    src: ['logo.png'],
                    dest: 'node_modules/node-red-dashboard/dist/'
                },
				{
                    expand: true,
                    cwd: 'src/views/node-red-contrib-web-worldmap/',
                    src: ['worldmap.html'],
                    dest: 'node_modules/node-red-contrib-web-worldmap/'
                },
				{
					expand: true,
                    cwd: 'node_modules/',
					src: ['@covisint/**'],
                    dest: 'bower_components/'		
				}]
            }
        },
		
	}	
	);

    grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-exec');
    grunt.registerTask('default', ['exec','copy']);
	
};