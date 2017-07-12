const options = {
  width: process.env.PRERENDER_VIEWPORT_WIDTH || 2880,
  height: process.env.PRERENDER_VIEWPORT_HEIGHT || 1800
};

module.exports = {
  onPhantomPageCreate: function ( phantom, req, res, next ) {
    if ( req.headers && req.headers[ 'x-viewport-width' ] && req.headers[ 'x-viewport-height' ] ) {

      var width = options.width;
      var height = options.height;

      var newWidth = parseInt( req.headers[ 'x-viewport-width' ] );
      var newHeight = parseInt( req.headers[ 'x-viewport-height' ] );

      if ( !isNaN( newWidth ) && !isNaN( newHeight ) && newWidth > 0 && newHeight > 0 ) {
        width = newWidth;
        height = newHeight;
      }

      req.prerender.page.run( width, height, function ( width, height, resolve ) {

        this.viewportSize = {
          width: width,
          height: height
        };

        resolve();
      } ).then( function () {

        next();
      } ).catch( function ( err ) {
        console.log( 'custom viewport size error', err );
      } );

    } else {

      next();
    }
  }
};
