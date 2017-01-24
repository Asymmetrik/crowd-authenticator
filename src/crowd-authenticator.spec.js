let
	should = require('should'),
	CrowdAuthenticator = require('./crowd-authenticator');

describe('Crowd Authenticator', () => {

	describe('authenticate', () => {

		let crowdUserInfo = {
			firstname: 'Test',
			lastname: 'User',
			displayname: 'Test User',
			email: 'test@email.com',
			username: 'test'
		};

		it('should error if there is no valid Crowd UserInfo', () => {

			let crowdAuthenticator = CrowdAuthenticator();
			crowdAuthenticator.authenticate()
				.then(
					() => { should.fail(); },
					(err) => { should.exist(err); }
				);

		});

		it('should authenticate a valid user', () => {

			let crowdClient = {
				user: {
					get: () => { return Promise.resolve(); },
					create: () => { return Promise.resolve(); },
					groups: {
						list: () => { return Promise.resolve(); },
						add: () => { return Promise.resolve(); },
						remove: () => { return Promise.resolve(); }
					}
				},
				group: {
					create: () => { return Promise.resolve(); }
				},
				session: {
					createUnvalidated: () => {
						return Promise.resolve({
							token: 'token',
							createdAt: new Date(),
							expiresAt: new Date()
						});
					}
				}
			};

			let crowdAuthenticator = CrowdAuthenticator(crowdClient);
			return crowdAuthenticator.authenticate(crowdUserInfo)
				.then((session) => {
					should.exist(session);
					should(session.token).equal('token');
				});
		});

	});

	describe('Context Helpers', () => {

		describe('createCrowdUser', () => {

			it('should create a valid User', () => {

				let userSpec = {
					firstname: 'Test',
					lastname: 'User',
					displayname: 'Test User',
					email: 'test@email.com',
					username: 'username'
				};
				let crowdAuthenticator = CrowdAuthenticator();
				return crowdAuthenticator.createCrowdUser(userSpec)
					.then((user) => {
						should.exist(user);
						should(user.firstname).equal(userSpec.firstname);
						should(user.lastname).equal(userSpec.lastname);
						should(user.displayname).equal(userSpec.displayname);
						should(user.email).equal(userSpec.email);
						should(user.username).equal(userSpec.username);
					});

			});
		});

		describe('getOrCreateCrowdUser', () => {
			let userSpec = {
				firstname: 'Test',
				lastname: 'User',
				displayname: 'Test User',
				email: 'test@email.com',
				username: 'username'
			};
			let crowdClient = {
				user: {
					get: () => {},
					create: () => {}
				}
			};

			it('should get the user when they exist', () => {

				crowdClient.user.get = () => {
					return Promise.resolve(crowdAuthenticator.createCrowdUser(userSpec));
				};

				let crowdAuthenticator = CrowdAuthenticator(crowdClient);
				return crowdAuthenticator.getOrCreateCrowdUser(userSpec)
					.then((user) => {
						should.exist(user);
						should(user.username).equal(userSpec.username);
					});

			});

			it('should create the user if they don\'t exist', () => {

				let created = false;
				crowdClient = {
					user: {
						get: () => {
							return Promise.reject({ type: 'USER_NOT_FOUND' });
						},
						create: (user) => {
							created = true;
							return Promise.resolve(crowdAuthenticator.createCrowdUser(userSpec));
						}
					}
				};

				let crowdAuthenticator = CrowdAuthenticator(crowdClient);
				return crowdAuthenticator.getOrCreateCrowdUser(userSpec)
					.then((user) => {
						should(created).equal(true);
						should.exist(user);
						should(user.username).equal(userSpec.username);

						// Verify it's the right kind of user object
						should.exist(user.toCrowd);
					});

			});

			it('should throw an error if the client causes an error', () => {

				crowdClient = {
					user: {
						get: () => {
							return Promise.reject({ type: 'OTHER ERROR' });
						}
					}
				};

				let crowdAuthenticator = CrowdAuthenticator(crowdClient);
				return crowdAuthenticator.getOrCreateCrowdUser(userSpec)
					.then(() => { should.fail(); },
						(err) => { should.exist(err); });

			});

		});

		describe('syncCrowdUserGroups', () => {

			it('should sync user groups', () => {
				let config = {
					defaultGroups: [ 'default1', 'default2' ],
					groupPrefix: 'p:'
				};

				let userSpec = {
					username: 'username',
					groups: [ 'one', 'two' ]
				};

				let addedGroups = [];
				let removedGroups = [];
				let createdGroups = [];

				let crowdClient = {
					user: {
						groups: {
							list: (u) => {
								return Promise.resolve([
									'p:two', 'p:three',
									'default2',
									'manual'
								]);
							},
							add: (u, g) => {
								addedGroups.push(g);
								return Promise.resolve();
							},
							remove: (u, g) => {
								removedGroups.push(g);
								return Promise.resolve();
							}
						}
					},
					group: {
						create: (g) => {
							createdGroups.push(g.groupname);
							return Promise.resolve();
						}
					}
				};

				// User has groups 'one', 'two' in auth
				// User is in groups 'p:two', 'p:three', 'default2', 'manual'
				// toAdd - 'p:one', 'default1'
				// toRemove - 'p:three'
				// toCreate - 'p:one', 'default1'

				let crowdAuthenticator = CrowdAuthenticator(crowdClient, config);
				return crowdAuthenticator.syncCrowdUserGroups(userSpec)
					.then(() => {
						should(addedGroups).have.length(2);
						should(addedGroups).containDeep([ 'p:one', 'default1' ]);
						should(removedGroups).have.length(1);
						should(removedGroups).containDeep([ 'p:three' ]);
						should(createdGroups).have.length(2);
						should(createdGroups).containDeep([ 'p:one', 'default1' ]);
					});

			});

		});

	});

	describe('Helpers', () => {

		describe('allSettled', () => {
			it('should resolve all promises', () => {

				let crowdAuthenticator = CrowdAuthenticator();

				let promises = [];
				promises.push(new Promise((resolve, reject) => {
					resolve('success');
				}));
				promises.push(new Promise((resolve, reject) => {
					reject('error');
				}));

				return Promise.all(promises.map(crowdAuthenticator.allSettled))
					.then((results) => {
						should(results).have.length(2);
						should(results[0].status).equal('resolved');
						should(results[0].result).equal('success');
						should(results[1].status).equal('rejected');
						should(results[1].error).equal('error');
					});
			});
		});

		describe('denodeify', () => {
			it('should resolve on success', () => {

				let crowdAuthenticator = CrowdAuthenticator();
				let nodePromise = crowdAuthenticator.nodePromiseResolver();

				nodePromise.nodeResolver(null, 'Hello World');

				return nodePromise.promise
					.then((val) => {
						should(val).equal('Hello World');
					},
					(err) => {
						should.fail();
					});
			});
		});

		describe('nodePromise', () => {
			it('should reject on error', () => {

				let crowdAuthenticator = CrowdAuthenticator();
				let nodePromise  = crowdAuthenticator.nodePromiseResolver();

				nodePromise.nodeResolver('Error');

				return nodePromise.promise
					.then((val) => {
							should.fail();
						},
						(err) => {
							should(err).equal('Error');
						});
			});
		});

		describe('initializeConfig', () => {

			let crowdAuthenticator = CrowdAuthenticator();

			it('should create a default config', () => {
				let config = crowdAuthenticator.initializeConfig();
				should.exist(config);
				should.exist(config.passwordStrategy);
				should.exist(config.groupPrefix);
				should(config.defaultGroups).be.an.Array();
			});

			it('should leave alone a provided config', () => {
				let config = crowdAuthenticator.initializeConfig({
					passwordStrategy: () => { return 'password'; },
					groupPrefix: 'prefix',
					defaultGroups: [ 'one', 'two' ]
				});

				should.exist(config);
				should(config.passwordStrategy()).equal('password');
				should(config.groupPrefix).equal('prefix');
				should(config.defaultGroups).be.an.Array();
				should(config.defaultGroups).has.length(2);
				should(config.defaultGroups).containDeep([ 'one', 'two' ]);
			});

		});

		describe('defaultPasswordStrategy', () => {

			let crowdAuthenticator = CrowdAuthenticator();

			it('should create a valid string password', () => {
				return crowdAuthenticator.defaultPasswordStrategy()
					.then((password) => {
						should.exist(password);
						should(password).be.a.String();
						should(password.length).equal(32);
					});
			});

		});

		describe('validateCrowdUserInfo', () => {

			it('should fail when required fields are missing', () => {

				let crowdAuthenticator = CrowdAuthenticator();

				should.exist(crowdAuthenticator.validateCrowdUserInfo());
				should.exist(crowdAuthenticator.validateCrowdUserInfo({}));
				should.exist(crowdAuthenticator.validateCrowdUserInfo({
					username: 'test',
					email: 'test@email.com'
				}));
				should.exist(crowdAuthenticator.validateCrowdUserInfo({
					displayname: 'Test User',
					email: 'test@email.com'
				}));
				should.exist(crowdAuthenticator.validateCrowdUserInfo({
					displayname: 'Test User',
					username: 'test'
				}));

				should.not.exist(crowdAuthenticator.validateCrowdUserInfo({
					displayname: 'Test User',
					username: 'test',
					email: 'test@email.com'
				}));

			});
		});

		describe('subtractLists', () => {

			let crowdAuthenticator = CrowdAuthenticator();

			it('should return the difference', () => {
				let a = [ 'one', 'two', 'three' ];
				let b = [ 'two', 'three', 'four' ];

				let result = crowdAuthenticator.subtractLists(a, b);
				should(result).be.an.Array();
				should(result).have.length(1);
				should(result[0]).equal('one');

				result = crowdAuthenticator.subtractLists(b, a);
				should(result).be.an.Array();
				should(result).have.length(1);
				should(result[0]).equal('four');

				result = crowdAuthenticator.subtractLists([ 'one' ], []);
				should(result).be.an.Array();
				should(result).have.length(1);
				should(result[0]).equal('one');
			});

			it('should handle empty lists', () => {
				let result = crowdAuthenticator.subtractLists([], []);
				should(result).be.an.Array();
				should(result).have.length(0);

				result = crowdAuthenticator.subtractLists(null, null);
				should(result).be.an.Array();
				should(result).have.length(0);

				result = crowdAuthenticator.subtractLists([], [ 'one' ]);
				should(result).be.an.Array();
				should(result).have.length(0);
			});

		});

	});


});
