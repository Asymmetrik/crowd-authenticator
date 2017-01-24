# @asymmetrik/crowd-authenticator

[![Build Status](https://travis-ci.org/Asymmetrik/crowd-authenticator.svg)](https://travis-ci.org/Asymmetrik/crowd-authenticator)
[![Code Climate](https://codeclimate.com/github/Asymmetrik/crowd-authenticator/badges/gpa.svg)](https://codeclimate.com/github/Asymmetrik/crowd-authenticator)
[![Test Coverage](https://codeclimate.com/github/Asymmetrik/crowd-authenticator/badges/coverage.svg)](https://codeclimate.com/github/Asymmetrik/crowd-authenticator/coverage)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Authenticator for creating sessions with Atlassian Crowd.
> The authenticator wraps the logic necessary to sync Crowd with an external authentication system.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Contribute](#contribute)
- [License](#license)


## Install

Include this module as a dependency of your application in the `package.json` file. For example:
```
{
  ...
  dependencies: {
    "@asymmetrik/crowd-authenticator": "latest"
  }
  ...
}
```

## Usage

Include the module via `require` wherever applicable:
```
let CrowdAuthenticator = require('@asymmetrik/crowd-authenticator');
let CrowdClient = require('atlassian-crowd-client');

// Create the crowd client
let crowdClient = new CrowdClient({
	baseUrl: 'http://localhost:8095/crowd/',
	application: {
		name: 'crowd-authenticator',
		password: 'password'
	}
});

// Create a custom config
let config = {
	passwordStrategy: () => { return Promise.resolve('password'); },
	groupPrefix: 'prefix:',
	defaultGroups: [ 'jira-user', 'confluence-user' ]
};

// Create the authenticator instance
let crowdAuthenticator = CrowdAuthenticator(crowdClient, config);

let userInfo = {
	firstname: 'Test',
	lastname: 'User',
	displayname: 'Test User',
	email: 'test@email.com',
	username: authId,
	groups: [ 'one', 'two' ]
};

// Authenticate
crowdAuthenticator.authenticate(userInfo)
	.then((session) => {
		// session contains token and expiration information
		// at this point, crowd will contain the defaultGroups plus all groups on the userInfo
	);

```

## API

See above Usage example.

## Contribute

PRs accepted.


## License

See LICENSE for details
