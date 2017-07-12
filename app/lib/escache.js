var cache_manager = require( 'cache-manager' );
var request = require( 'request' );
var URL = require( 'url' );
var sanitizeHtml = require( 'sanitize-html' );

/* 
// note: in elasticsearch 5, _ttl is deprecated, cronjob delete_by_query with createAt

curl -XPUT http://elasticsearch.example.com/_template/1seo -d '
{
  "order": 0,
  "template": "1seo",
  "settings": {},
  "mappings": {
    "prerender": {
      "_ttl": {
        "default": "90d",
        "enabled": true
      },
      "_source": {
        "enabled": true
      },
      "_all": {
        "enabled": false
      },
      "properties": {
        "url": {
          "index": "not_analyzed",
          "type": "string"
        },
        "createAt": {
          "type": "date"
        },
        "expAt": {
          "type": "date"
        },
        "hostname": {
          "type": "string"
        },
        "pathname": {
          "type": "string"
        },
        "query": {
          "dynamic": true,
          "type": "object"
        },
        "hash": {
          "type": "string"
        },
        "body": {
          "type": "string",
          "index": "not_analyzed"
        },
        "content": {
          "type": "string"
        }
      }
    }
  },
  "aliases": {}
}'
*/

module.exports = ( options ) => {
  var opts = options || {};
  opts.esUrl = opts.esUrl || process.env.ES_URL;

  // return dummy init
  if ( !opts.esUrl ) {
    return {
      init: () => {}
    };
  }

  opts.paramsToIgnore = opts.paramsToIgnore || process.env.PARAMS_TO_IGNORE;

  var paramsToIgnore = opts.paramsToIgnore ? opts.paramsToIgnore.split( ' ' ) : [ 'siteid', 'sfs' ];

  var cleanUrl = ( url ) => {
    var urlparts = url.split( '?' );
    if ( urlparts.length >= 2 ) {
      var qps = '&' + urlparts[ 1 ];
      var i;

      for ( i = 0; i < paramsToIgnore.length; i++ ) {
        var p = paramsToIgnore[ i ];
        var regex = new RegExp( '&' + p + '=[^&]*(&|$)', 'gi' );
        qps = qps.replace( regex, '&' )
      }

      qps[ 0 ] === '&' ? qps = qps.slice( 1 ) : '';
      url = urlparts[ 0 ] + '?' + qps;
    }

    return url.replace( /[\?#]*$/gi, '' );
  };

  var parseBody = ( req ) => {
    var url = cleanUrl( req.prerender.url );
    var myUrl = URL.parse( url, true, true );

    var expireDays = 3;
    var date = new Date();
    if ( /\/(article|recipe|recipevideo)\//gi.test( myUrl.pathname ) ) {
      expireDays = 14;
    }
    // console.log( myUrl );

    return {
      url: url,
      createAt: ( new Date() ).getTime(),
      expAt: ( new Date( date.setTime( date.getTime() + expireDays * 86400000 ) ) ).getTime(),
      hostname: myUrl.hostname,
      pathname: myUrl.pathname,
      query: myUrl.query,
      hash: myUrl.hash,
      body: req.prerender.documentHTML
    }
  }

  var my_cache = {
    get: function ( key, callback ) {
      var esurl = opts.esUrl.replace( /\/$/gi, '' ) + '/1seo/prerender/' + new Buffer( key ).toString( 'base64' );

      request( {
        url: esurl,
        method: 'GET'
      }, ( err, res, resBody ) => {
        if ( err ) {
          return callback( err );
        }

        if ( resBody.indexOf( '{' ) >= 0 ) {
          resBody = JSON.parse( resBody );
        }

        callback( null, resBody._source );
      } );
    },
    set: function ( key, value, callback ) {
      var esurl = opts.esUrl.replace( /\/$/gi, '' ) + '/1seo/prerender/' + new Buffer( key ).toString( 'base64' );

      value.content = sanitizeHtml( value.body.toString(), {
        allowedTags: [ 'b', 'i', 'em', 'strong', 'a', 'title', 'span' ],
        allowedAttributes: {
          '*': [ 'href', 'title', 'content', 'alt' ]
        }
      } );

      var payload = {
        url: esurl + '/_update',
        method: 'POST',
        json: {
          'doc': value,
          'doc_as_upsert': true
        }
      };

      // console.log( payload );
      request( payload, ( err, res, resBody ) => {
        if ( err ) {
          // console.log( 'error' + err );
          return callback( err );
        }
        // console.log( resBody );

        callback( null, resBody );
      } );
    }
  }

  return {
    init: () => {
      this.cache = cache_manager.caching( {
        store: my_cache,
        max: 100,
        ttl: 600 /*seconds*/
      } );
    },

    beforePhantomRequest: ( req, res, next ) => {
      if ( req.method !== 'GET' ) {
        return next();
      }

      var v = parseBody( req );
      this.cache.get( v.url, ( err, result ) => {
        if ( !err && result && result.expAt > ( new Date() ).getTime() ) {
          console.log( 'cache hit' );
          return res.send( 200, result.body );
        }

        next();
      } );
    },

    beforeSend: ( req, res, next ) => {
      if ( req.prerender.statusCode !== 200 ) {
        return next();
      }

      var v = parseBody( req );
      this.cache.set( v.url, v, next );
    }
  };
};