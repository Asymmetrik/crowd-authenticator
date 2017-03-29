/* eslint-disable no-console */

let
	CrowdClient = require('atlassian-crowd-client'),
	should = require('should'),
	CrowdAuthenticator = require('./crowd-authenticator');

describe('Crowd Authenticator', () => {
	let crowdClient = new CrowdClient(require('../crowdconfig'));

	function clearAll() {
		return Promise.resolve()
			.then(() => {
				return crowdClient.user.remove('test');
			}).catch(() => {})
			.then(() => {
				return crowdClient.user.remove(encodeURIComponent('test / = , .'));
			}).catch(() => {})
			.then(() => {
				let crowdAuthenticator = CrowdAuthenticator();
				let promises = [ 'p:one', 'p:two', 'default', 'p:/ = . ,'].map((g) => {
						return crowdClient.group.remove(encodeURIComponent(g)).catch(() => {});
					})
					.map(crowdAuthenticator.allSettled);

				return Promise.all(promises);
			});
	}

	beforeEach(clearAll);
	afterEach(clearAll);

	it('should authenticate the test user', () => {
		let config = {
			defaultGroups: [ 'default' ],
			groupPrefix: 'p:'
		};
		let crowdUserInfo = {
			firstname: 'Test',
			lastname: 'User',
			displayname: 'Test User',
			email: 'test@email.com',
			username: 'test',
			groups: [ 'one', 'two' ]
		};

		let crowdAuthenticator = CrowdAuthenticator(crowdClient, config);
		return crowdAuthenticator.authenticate(crowdUserInfo)
			.then(() => {

				return crowdClient.user.get(crowdUserInfo.username)
					.then((user) => {
						should.exist(user);
						should(user.username).equal(crowdUserInfo.username);

						return crowdClient.user.groups.list(crowdUserInfo.username);
					})
					.then((groups) => {
						should(groups).be.an.Array();
						should(groups).have.length(3);
						should(groups).containDeep([ 'p:one', 'p:two', 'default' ]);
					});

			});
	});

	it('should authenticate a user with a bunch of characters that need to be escaped', () => {
		let config = {
			defaultGroups: [ 'default' ],
			groupPrefix: 'p:'
		};
		let crowdUserInfo = {
			firstname: 'Test',
			lastname: 'User',
			displayname: 'Test User',
			email: 'test@email.com',
			username: 'test / = , .',
			groups: [ 'one', 'two', '/ = . ,' ]
		};

		let crowdAuthenticator = CrowdAuthenticator(crowdClient, config);
		return crowdAuthenticator.authenticate(crowdUserInfo)
			.then(() => {

				return crowdClient.user.get(crowdUserInfo.username)
					.then((user) => {
						should.exist(user);
						should(user.username).equal(crowdUserInfo.username);

						return crowdClient.user.groups.list(crowdUserInfo.username);
					})
					.then((groups) => {
						should(groups).be.an.Array();
						should(groups).have.length(4);
						should(groups).containDeep([ 'p:one', 'p:two', 'p:/ = . ,', 'default' ]);
					});

			});
	});

});

