let
	crypto = require('crypto'),
	Group = require('atlassian-crowd-client/lib/models/group'),
	User = require('atlassian-crowd-client/lib/models/user');

function allSettled(promise) {
	return promise.then(
		(result) => { return { result: result, status: 'resolved' }; },
		(err) => { return { error: err, status: 'rejected' }; });
}

function nodePromiseResolver() {
	let toResolve, toReject;
	let promise = new Promise((resolve, reject) => {
		toResolve = resolve;
		toReject = reject;
	});

	return {
		nodeResolver: (err, val) => {
			if(null != err) {
				toReject(err);
			}
			else {
				toResolve(val);
			}
		},
		promise: promise
	};
}

function initializeConfig(config) {
	config = config || {};
	config.passwordStrategy = config.passwordStrategy || defaultPasswordStrategy;
	config.groupPrefix = config.groupPrefix || 'crowd-authenticator:';
	config.defaultGroups = config.defaultGroups || [];

	return config;
}

function defaultPasswordStrategy() {
	return Promise.resolve()
		.then(() => {
			let nodePromise = nodePromiseResolver();
			crypto.randomBytes(16, nodePromise.nodeResolver);
			return nodePromise.promise;
		})
		.then((buf) => { return buf.toString('hex'); });
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

function validateCrowdUserInfo(userInfo) {
	let err;

	if (null == userInfo) {
		err = 'Missing Crowd UserInfo object';
	}
	else if (null == userInfo.displayname) {
		err = 'Missing Crowd UserInfo.displayname';
	}
	else if (null == userInfo.username) {
		err = 'Missing Crowd UserInfo.username';
	}
	else if (null == userInfo.email) {
		err = 'Missing Crowd UserInfo.email';
	}

	return (null == err) ? err : `Crowd Authenticator Error: ${err}`;
}

module.exports = function(crowdClient, config) {

	config = initializeConfig(config);

	let createCrowdUser = (u) => {

		return config.passwordStrategy()
			.then((password) => {

				// Create a new user
				return new User(u.firstname, u.lastname, u.displayname,
					u.email, u.username, password,
					true);

			});

	};

	let getOrCreateCrowdUser = (crowdUserInfo) => {

		return crowdClient.user.get(encodeURIComponent(crowdUserInfo.username), true)
			.catch((err) => {

				// If it's the user not found error, create the user
				if(null != err && err.type === 'USER_NOT_FOUND') {

					// Create the user
					return createCrowdUser(crowdUserInfo)
						.then((user) => {
							return crowdClient.user.create(user);
						});

				}
				// Any other error is terminal
				else {
					throw err;
				}
			});
	};

	let syncCrowdUserGroups = (crowdUserInfo) => {

		// Get all of the user groups from crowd
		return crowdClient.user.groups.list(encodeURIComponent(crowdUserInfo.username))
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

				// First run all the promises to create the groups
				return Promise.all(createGroupsPromises.map(allSettled))
					.then(() => {

						let addGroupPromises = toAdd.map((g) => {
							return crowdClient.user.groups.add(encodeURIComponent(crowdUserInfo.username), g);
						});
						addGroupPromises = addGroupPromises.concat(toRemove.map((g) => {
							return crowdClient.user.groups.remove(encodeURIComponent(crowdUserInfo.username), g);
						}));

						return Promise.all(addGroupPromises.map(allSettled));
					});

			});

	};

	// Return an object that wraps the authenticate object
	return {

		/**
		 * Main authenticate call
		 * @param authRequest
		 */
		authenticate: function(crowdUserInfo) {

			// Validate the authId
			let err = validateCrowdUserInfo(crowdUserInfo);
			if(null != err) {
				return Promise.reject('crowd-authenticator error: Must provide a valid crowdUserInfo object');
			}

			// Try to authenticate the user using the configure auth strategy
			return Promise.resolve()
				.then(() => {

					/**
					 * The user was authenticated by the auth strategy, so get or create the user
 					 */
					return getOrCreateCrowdUser(crowdUserInfo);

				})
				.then(() => {

					/**
					 * Sync the user groups
					 */
					return syncCrowdUserGroups(crowdUserInfo);

				})
				.then(() => {

					// Authenticate the user and create the session information
					return crowdClient.session.createUnvalidated(crowdUserInfo.username);

				});

		},

		allSettled: allSettled,
		nodePromiseResolver: nodePromiseResolver,

		validateCrowdUserInfo: validateCrowdUserInfo,
		initializeConfig: initializeConfig,
		defaultPasswordStrategy: defaultPasswordStrategy,
		subtractLists: subtractLists,

		createCrowdUser: createCrowdUser,
		getOrCreateCrowdUser: getOrCreateCrowdUser,
		syncCrowdUserGroups: syncCrowdUserGroups

	};

};
