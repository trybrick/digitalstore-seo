module.exports = ( healthcheckEndpoint ) => {
  return {
    beforePhantomRequest( req, res, next ) {
      if ( req.prerender.url === healthcheckEndpoint ) {
        // console.log( 'Handling healthcheck' );
        req.prerender.ignore = true;
        res.send( 200, 'OK' );
        return;
      }
      return next();
    }
  };
};
