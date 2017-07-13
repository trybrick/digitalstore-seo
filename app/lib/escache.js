var cache_manager = require( 'cache-manager' );
var request = require( 'request' );
var URL = require( 'url' );
var sanitizeHtml = require( 'sanitize-html' );

/* 
// note: in elasticsearch 5, _ttl is deprecated, cronjob delete_by_query with createAt
// also change all "string" type to "text"

curl -XPUT http://elasticsearch.example.com/_template/1seo -d '
{
  "order": 0,
  "template": "1seo",
  "settings": {},
  "mappings": {
    "prerender": {
      "_ttl": {
        "default": "30d",
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
          "index": "no",
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
        "title": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "image": {
          "type": "string"
        },
        "body": {
          "type": "string",
          "index": "no",
          "ignore_above": 20
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

  var paramsToIgnore = opts.paramsToIgnore ? opts.paramsToIgnore.split( ' ' ) : [ 'siteid', 'sfs', 'q' ];

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

  var extractTitle = ( str ) => {
    var tres = str.match( /<title>[^<]*/gi );
    if ( tres && tres[ 0 ] ) {
      return tres[ 0 ].substr( 7 );
    }

    return "";
  }

  var extractMeta = ( name, str ) => {
    var reg = new RegExp( '<meta(?: [^>]+)?\s*=\s*[\'"]+' + name + '[\'"]+[^>]*', 'gi' );
    var rst = reg.exec( str );
    if ( rst && rst[ 0 ] ) {
      var res = /content\s*=\s*['"]([^">]+)/gi.exec( rst[ 0 ] );
      if ( res && res[ 1 ] ) {
        return res[ 1 ];
      }
    }

    return "";
  }

  var parseUrl = ( req, parseBody = false ) => {
    var url = cleanUrl( req.prerender.url );
    var myUrl = URL.parse( url, true, true );

    var expireDays = 3;
    var date = new Date();
    if ( /\/(article|recipe|recipevideo)\//gi.test( myUrl.pathname ) ) {
      expireDays = 14;
    }

    // console.log( myUrl );
    var value = {
      url: url,
      createAt: ( new Date() ).getTime(),
      expAt: ( new Date( date.setTime( date.getTime() + expireDays * 86400000 ) ) ).getTime(),
      hostname: myUrl.hostname,
      pathname: myUrl.pathname,
      query: myUrl.query,
      hash: myUrl.hash
    };

    if ( parseBody ) {
      var body = req.prerender.documentHTML.toString();
      // parse body, title, description, image, and content text
      try {
        value.title = extractTitle( body );
        value.description = extractMeta( 'description', body );
        value.image = extractMeta( 'image', body );
        var content = sanitizeHtml( body, {
          allowedTags: [ 'b', 'i', 'em', 'strong', 'a' ],
          allowedAttributes: {
            '*': [ 'href', 'title', 'content', 'alt' ]
          }
        } );

        content = content.replace( /<[^\/>][^>]*>\s*<\/[^>]+>/gi, "" ); // strip empty tags
        content = content.replace( /<[^\/>][^>]*>\s*<\/[^>]+>/gi, "" ); // 2nd filter for nested tags

        // remove all invalid spacing
        content = content.replace( /\t|\r|\f/g, '' );

        // collapse space/newlines into single
        content = content.replace( / {2,}/g, ' ' ).replace( /\n\s*\n+\s*/g, '\n' );
        value.content = content.replace( /\n+/g, '\n' );
      } catch ( e ) {
        console.log( 'escache parse body error: ', e );
      }
      value.body = body;
    }

    return value;
  }

  var my_cache = {
    get: function ( key, callback ) {
      var esurl = opts.esUrl.replace( /\/$/gi, '' ) + '/1seo/prerender/' + new Buffer( key ).toString( 'base64' );

      request( {
        url: esurl,
        method: 'GET'
      }, ( err, res, resBody ) => {
        if ( err ) {
          // console.log( "error:" + err )
          return callback( err );
        }

        if ( resBody.indexOf( '{' ) >= 0 ) {
          resBody = JSON.parse( resBody );
        }

        // console.log( 'hit', resBody );
        callback( null, resBody._source );
      } );
    },
    set: function ( key, value, callback ) {
      var esurl = opts.esUrl.replace( /\/$/gi, '' ) + '/1seo/prerender/' + new Buffer( key ).toString( 'base64' );

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

      var v = parseUrl( req, false );
      this.cache.get( v.url, ( err, result ) => {
        if ( !err && result && result.expAt > ( new Date() ).getTime() ) {
          console.log( 'cache hit' );
          return res.send( 200, result.body );
        }

        next();
      } );
    },

    beforeSend: ( req, res, next ) => {
      if ( req.prerender.statusCode !== 200 || req.prerender.ignore ) {
        return next();
      }

      var v = parseUrl( req, true );
      this.cache.set( v.url, v, next );
    }
  };
};
