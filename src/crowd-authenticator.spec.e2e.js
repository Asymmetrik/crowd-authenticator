/* eslint-disable no-console */

let
	CrowdClient = require('atlassian-crowd-client'),
	should = require('should'),
	CrowdAuthenticator = require('./crowd-authenticator');

describe('Crowd Authenticator', () => {
	let crowdClient = new CrowdClient(require('../crowdconfig'));

	function clearAll() {
		return crowdClient.user.remove('test')
			.catch(() => {})
			.then(() => {
				let crowdAuthenticator = CrowdAuthenticator();
				let promises = [ 'p:one', 'p:two', 'default'].map((g) => {
					return crowdClient.group.remove(g).catch(() => {});
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
		let authStrategy = {
			getAuthInfo: (authId) => {
				return new Promise((resolve) => {
					resolve({
						firstname: 'Test',
						lastname: 'User',
						displayname: 'Test User',
						email: 'test@email.com',
						username: authId,
						groups: [ 'one', 'two' ]
					});
				});
			}
		};

		let crowdAuthenticator = CrowdAuthenticator(crowdClient, authStrategy, config);
		return crowdAuthenticator.authenticate('test')
			.catch((err) => {
				console.log(err);
			})
			.then(() => {

				return crowdClient.user.get('test')
					.then((user) => {
						should.exist(user);
						should(user.username).equal('test');

						return crowdClient.user.groups.list('test');
					})
					.then((groups) => {
						should(groups).be.an.Array();
						should(groups).have.length(3);
						should(groups).containDeep([ 'p:one', 'p:two', 'default' ]);
					});

			});
	});


});

