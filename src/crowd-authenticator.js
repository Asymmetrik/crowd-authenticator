let
	crypto = require('crypto'),
	Group = require('atlassian-crowd-client/lib/models/group'),
	User = require('atlassian-crowd-client/lib/models/user');

function allSettled(promise) {
	return promise.then(
		(result) => { return { result: result, status: 'resolved' }; },
		(err) => { return { error: err, status: 'rejected' }; });
}

function initializeConfig(config) {
	config = config || {};
	config.passwordStrategy = config.passwordStrategy || defaultPasswordStrategy;
	config.groupPrefix = config.groupPrefix || 'crowd-authenticator:';
	config.defaultGroups = config.defaultGroups || [];

	return config;
}

function defaultPasswordStrategy() {
	return new Promise((resolve, reject) => {
		crypto.randomBytes(32, (ex, password) => {
			if(null != ex) {
				reject(ex);
			}
			else {
				resolve(password);
			}
		});
	});
}

function subtractLists(aList, bList) {

	aList = aList || [];
	bList = bList || [];

	// Figure out which layers need to be removed (a - b)
	return aList
		.filter((a) => {
			return !(bList.find((b) => { return ( a === b); }));
		});

}


module.exports = function(crowdClient, authStrategy, config) {

	config = initializeConfig(config);

	let createCrowdUser = (u) => {

		return config.passwordStrategy()
			.then((password) => {

				// Create a new user
				return new User(u.firstName, u.lastName, u.displayName,
					u.email, u.username, password,
					true);

			});

	};

	let getOrCreateCrowdUser = (crowdUserInfo) => {

		return crowdClient.user.get(crowdUserInfo.username, true)
			.catch((err) => {

				// If it's the user not found error, create the user
				if(null != err && err.type === 'USER_NOT_FOUND') {

					// Create the user
					let user = createCrowdUser(crowdUserInfo);
					return crowdClient.user.create(user);

				}
				// Any other error is terminal
				else {
					throw err;
				}
			});
	};

	let syncCrowdUserGroups = (crowdUserInfo) => {

		return new Promise((resolve, reject) => {

			// Get all of the user groups from crowd
			crowdClient.user.groups.list(crowdUserInfo.username)
				.then((groups) => {

					let crowdGroups = groups || [];
					let authGroups = crowdUserInfo.groups || [];

					let crowdAuthGroups = crowdGroups.filter((g) => { return g.startsWith(config.groupPrefix); });
					authGroups = authGroups.map((g) => { return `${config.groupPrefix}${g}`; });

					let defaultGroups = config.defaultGroups;

					let toRemove = [];
					let toAdd = [];

					// Need to remove crowdGroups that start with the prefix but aren't in the authGroups list
					toRemove = toRemove.concat(subtractLists(crowdAuthGroups, authGroups));

					// Need to add auth groups that are not in crowdGroups
					toAdd = toAdd.concat(subtractLists(authGroups, crowdGroups));

					// Need to add default groups that are not in crowd groups
					toAdd = toAdd.concat(subtractLists(defaultGroups, crowdGroups));

					// We need to ensure all the toAdd groups exist
					let createGroupsPromises = toAdd.map((g) => {
						return crowdClient.group.create(new Group(g));
					});

					let addGroupPromises = toAdd.map((g) => {
						return crowdClient.user.groups.add(crowdUserInfo.username, g);
					});
					addGroupPromises = addGroupPromises.concat(toRemove.map((g) => {
						return crowdClient.user.groups.remove(crowdUserInfo.username, g);
					}));


					// First run all the promises to create the groups
					return Promise.all(createGroupsPromises.map(allSettled))
						.then(() => {
							return Promise.all(addGroupPromises.map(allSettled));
						});

				})
				.then((results) => {
					resolve(results);
				})
				.catch((err) => { reject(err); });

		});

	};

	// Return an object that wraps the authenticate object
	return {

		/**
		 * Main authenticate call
		 * @param authRequest
		 */
		authenticate: function(authId) {

			// Validate the authId
			if(null == authId) {
				throw new Error('crowd-authenticator error: Must provide an authId');
			}

			// Try to authenticate the user using the configure auth strategy
			return authStrategy.getAuthInfo(authId)
				.then((crowdUserInfo) => {

					/**
					 * The user was authenticated by the auth strategy, so get or create the user
 					 */
					return getOrCreateCrowdUser(crowdUserInfo)
						.then(() => { return crowdUserInfo; } );

				})
				.then((crowdUserInfo) => {

					/**
					 * Sync the user groups
					 */
					return syncCrowdUserGroups(crowdUserInfo)
						.then(() => { return crowdUserInfo; });

				})
				.then((crowdUserInfo) => {

					// Authenticate the user and create the session information
					return crowdClient.session.createUnvalidated(crowdUserInfo.username);

				});

		}

	};

};
