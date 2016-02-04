var request = require( 'request' ),
		_ = require( 'underscore' );

module.exports.connect = function( apiUrl, options, callback ) {
	options = options || {};

	var headers = {
				'user-agent': 'CitySDK node module',
				'content-type': 'application/json'
			},
			api = {
				getLayers: _.partial( apiCall, 'get', '/layers' ),
				getOwners: _.partial( apiCall, 'get', '/owners' ),
				setLayer: setLayer,
				createLayer: _.partial( apiCall, 'post', 'layers' ),
				getObjects: getObjects,
				createObject: createObject
			},
			perPage = options.perPage || 25,
			batchSize = options.batchSize || 10,
			layer;

	[ 'get', 'put', 'post', 'patch', 'delete' ].forEach( declareHTTPMethodOnApi );

	if( options.username && options.password ) {
		// get session token from /session, add to headers
		apiCall( 'get', 'session', { query: { name: options.username, password: options.password } }, function( err, response ) {
			if( err ) return callback( err );
			headers[ 'X-Auth' ] = response.session_key;
			callback( null, api );
		} );
	}

	return api;

	function declareHTTPMethodOnApi( method ) {
		var requestMethodName = method === 'delete' ? 'del' : method;

		api[ method ] = _.partial( apiCall, requestMethodName );
	}

	function apiCall( method, path, options, cb ) {
		var params = [], query, body, requestOptions;

		if( path.indexOf( 'http' ) !== 0 ) {
			path = apiUrl + path;
		}

		if( typeof options === 'function' ) {
			cb = options;
			options = null;
		}

		options = options || {};
		query = options.query;
		body = options.body;


		requestOptions = {
			headers: headers,
			rejectUnauthorized: false,
			url: path,
			json: true
		};

		if( query ) {
			requestOptions.qs = query;
		}

		if( body ) requestOptions.body = body;

		console.log( method, requestOptions );

		return request[ method ]( requestOptions, createPassBody( cb ) );

		function addParam( key ) {
			params.push( key + '=' + query[ key ] );
		}
	}

	function createPassBody( cb ) {
		return passBody;

		function passBody( error, response, body ) {
			var nextResult, getNextResult;
			console.log( 'err:', error, response.headers, body );
			if( error ) return cb( error );

			if( response.headers.status !== '200 OK' ) {
				return cb( new Error( body ) );
			}

			nextResult = /<([^>]+)>/.exec( response.headers.link );
			if( nextResult) getNextResult = createGetNext( nextResult[ 1 ] );

			api.lastResult = {
				headers: response.headers,
				status: response.headers.status
			};
			api.getNext = getNextResult;

			Object.defineProperty( body, 'headers', { value: response.headers } );
			if( nextResult ) Object.defineProperty( body, 'getNext', { value: getNextResult } );

			cb( error, body );
		}
	}

	function createGetNext( url ) {
		return getNext;

		function getNext( cb ) {
			apiCall( 'get', url, cb );
		}
	}

	function setLayer( layerName ) {
		layer = layerName;
	}

	// function createLayer( layerOptions, cb ) {
	// 	apiCall( 'post', 'layers', layerOptions, function( err, result ) {
	// 		console.log( err || result );
	// 		cb( err, result );
	// 	} );
	// }

	function getObjects( layerName, cb ) {
		if( typeof layerName === 'function' ) {
			cb = layerName;
			layerName = null;
		}

		var l = layerName || layer,
				route = l ? '/layers/' + l + '/objects' : '/objects';

		apiCall( 'get', route, cb );
	}

	function createObject( object, layerName, cb ) {
		if( typeof layerName === 'function' ) {
			cb = layerName;
			layerName = null;
		}

		var l = layerName || layer,
				collection = {
					type: 'FeatureCollection',
					features: object.length ? object : [ object ]
				};

		if( !l ) return cb( new Error( 'createObject: no layer set or specified') );

		apiCall( 'post', '/layers/' + l + '/objects', cb );
	}
};
