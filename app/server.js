const prerender = require( 'prerender' );

const setViewport = require( './lib/setViewport' );
const forwardHeaders = require( './lib/forwardHeaders' );
const stripHtml = require( './lib/stripHtml' );
const healthcheck = require( './lib/healthcheck' );
const escache = require( './lib/escache' );

const options = {
  workers: process.env.PRERENDER_NUM_WORKERS || 4,
  iterations: process.env.PRERENDER_NUM_ITERATIONS || 25,
  softIterations: process.env.PRERENDER_NUM_SOFT_ITERATIONS || 10,
  jsTimeout: process.env.JS_TIMEOUT || 30000,
  jsCheckTimeout: 600,
  phantomArguments: {
    '--load-images': true,
    '--ignore-ssl-errors': true,
    '--ssl-protocol': 'tlsv1.2'
  }
};
console.log( 'Starting with options:', options );

const server = prerender( options );

server.use( healthcheck( 'healthcheck' ) );

if ( process.env.BASIC_AUTH_USERNAME ) {
  server.use( prerender.basicAuth() );
}

if ( process.env.PRERENDER_LOGGER ) {
  console.log( 'starting logger' );
  server.use( prerender.logger() );
}

server.use( setViewport );
server.use( forwardHeaders );
server.use( prerender.sendPrerenderHeader() );
server.use( prerender.removeScriptTags() );
server.use( prerender.httpHeaders() );
server.use( stripHtml );
server.use( escache() );

if ( process.env.REDIS_URL ) {
  server.use( require( 'prerender-redis-cache' ) );
}


server.start();

const shutdown = () => {
  console.log( 'Shutdown initiated' );
  server.exit();
  // At this point prerender has started killing its phantom workers already.
  // We give it 5 seconds to quickly do so, and then halt the process. This
  // will ensure relatively rapid redeploys (prerender no longer accepts new
  // requests at this point
  setTimeout( () => {
    console.log( 'Prerender has shut down' );
    process.exit();
  }, 5000 );
};

process.on( 'SIGINT', shutdown );
process.on( 'SIGTERM', shutdown );
