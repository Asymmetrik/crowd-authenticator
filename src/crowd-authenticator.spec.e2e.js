/* eslint-disable no-console */

let
	CrowdClient = require('atlassian-crowd-client'),
	should = require('should'),
	CrowdAuthenticator = require('./crowd-authenticator');

describe('Crowd Authenticator', () => {

	let crowdClient = new CrowdClient(require('../crowdconfig'));
	let authStrategy = {
		getAuthInfo: (authId) => {
			return new Promise((resolve, reject) => {
				resolve({
					firstname: 'Test',
					lastname: 'User',
					displayname: 'Test User',
					email: 'test@email.com',
					username: authId,
					attributes: ['role1', 'role2']
				});
			});
		}
	};

	let crowdAuthenticator = CrowdAuthenticator(crowdClient, authStrategy, { defaultGroups: [ 'jira-user' ] });
	crowdAuthenticator.authenticate('test')
		.then((result) => {
			console.log(result);
		}, (err) => {
			console.log(err);
		});

});

